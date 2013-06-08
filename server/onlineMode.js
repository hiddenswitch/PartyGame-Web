/**
 * @author Benjamin Berman
 * © 2012 All Rights Reserved
 **/

var K_ANSWERS_PER_QUESTION = 6;
var K_24_HOURS = 24 * 60 * 60 * 1000;
var K_10_MINUTES = 10 * 60 * 1000;
var K_OPTIONS = 3;

var CardCache = {
    questionCards: [],
    answerCards: [],
    updateAndShuffleCards: function () {
        var self = this;
        self.questionCards = _.shuffle(Cards.find({type: CARD_TYPE_QUESTION}).fetch());
        self.answerCards = _.shuffle(Cards.find({type: CARD_TYPE_ANSWER}).fetch());
    },
    getQuestionCardsExcluding: function (exclusionIds) {
        var self = this;
        return _.filter(self.questionCards, function (card) {
            return !_.contains(exclusionIds, card._id);
        });
    },
    getRandomQuestionCardExcluding: function (exclusionIds) {
        var self = this;
        return _.first(_.shuffle(_.filter(self.questionCards, function (card) {
            return !_.contains(exclusionIds, card._id);
        })));
    },
    getAnswerCardsExcluding: function (exclusionIds) {
        var self = this;
        return _.filter(self.answerCards, function (card) {
            return !_.contains(exclusionIds, card._id);
        });
    },
    getSomeAnswerCardsExcluding: function (exclusionIds, count) {
        var self = this;
        count = count || K_OPTIONS;
        var eligibleAnswerCards = null;

        if (self.answerCards.length - exclusionIds.length < count || exclusionIds == null) {
            eligibleAnswerCards = self.answerCards;
        } else {
            eligibleAnswerCards = _.shuffle(_.filter(self.answerCards, function (card) {
                return !_.contains(exclusionIds, card._id);
            }));
        }

        return eligibleAnswerCards.slice(0, 3);
    }
};

Meteor.startup(function () {
    // Update and shuffle the cards
    CardCache.updateAndShuffleCards();
    Meteor.setInterval(CardCache.updateAndShuffleCards, K_10_MINUTES);
});

Meteor.methods({
    writeAnswer: function (historyId, answerCardId, _userId) {
        if (!this.userId && !_userId) {
            throw new Meteor.Error(403, "Permission denied.");
        } else if (this.userId) {
            _userId = this.userId;
        }

        var now = new Date().getTime();

        var history = Histories.findOne({_id: historyId, answerId: null, judged: false, userId: _userId});

        // if the history doesn't exist, how am I supposed to ascertain a valid question card id
        if (history == null) {
            throw new Meteor.Error(404, "You can't answer a card to a question that hasn't been assigned to you, a question that has already been answered, or a question that has already been judged!\nhistoryId: {0}\nanswerCardId: {1}".format(historyId, answerCardId));
        }

        // check that the question and answer cards exist
        if (Cards.find({_id: questionCardId}).count() === 0) {
            throw new Meteor.Error(404, "Question card with id {0} does not exist.".format(history.questionCardId));
        }

        if (Cards.find({_id: answerCardId, type: CARD_TYPE_ANSWER}).count() === 0) {
            throw new Meteor.Error(404, "Answer with id {0} does not exist, or the answer is not of the answer type.".format(answerCardId));
        }

        // Find or create this question with the given cardId which doesn't already have this answer
        var question = Questions.findOne({
            cardId: history.questionCardId,
            // The question hasn't been voted on
            answerId: null,
            // The question doesn't already have this answer attached to it
            answerCardIds: {$ne: answerCardId}
        }, {
            sort: {answerCount: -1, modified: -1},
            limit: 1
        });

        // No question card was found, create one
        if (question == null) {
            question = {
                cardId: history.questionCardId,
                judgeId: null,
                created: now,
                modified: now,
                answerCardIds: [],
                answerCount: 0,
                answerId: null,
                judgeAssigned: null,
                minimumAnswerCount: K_ANSWERS_PER_QUESTION
            };

            question._id = Questions.insert(question);
        }

        // Assign the answer to the question
        var answer = {
            cardId: answerCardId,
            questionId: question._id,
            winner: null,
            winningAnswerId: null,
            score: null,
            userId: _userId,
            created: now,
            modified: now
        };

        answer._id = Answers.insert(answer);

        // Update our local copy to avoid a database query.
        question.answerCardIds.push(answerCardId);
        question.answerCount++;

        // update this player's question matching value for judge assignment
        Meteor.call("updateUserMatchingValue", _userId);

        // Update the user's last action, and add the questions they have answered
        Meteor.users.update({_id: _userId}, {
            $set: {lastAction: now},
            $push: {questionIds: question._id}
        });

        Questions.update({_id: question._id}, {
            $push: {answerCardIds: answerCardId},
            $inc: {answerCount: 1},
            $set: {modified: now}
        });

        // Update the history object with the answer Id
        Histories.update({_id: historyId}, {$set: {answerId: answer._id, modified: now}});

        // if the question has reached the number of answers needed for judging, assign it a judge if it needs one
        if (question.answerCount >= question.minimumAnswerCount && question.judgeId === null) {
            Meteor.call("assignJudgeToQuestion", question._id);
        }

        // return the id of the answer
        return answer._id;
    },

    getQuestionForUser: function (_userId) {
        var voluntary = false;

        if (!this.userId && !_userId) {
            // voluntary is false because this action was initiated by the server
            throw new Meteor.Error(403, "Permission denied.");
        } else if (this.userId) {
            // this action was initiated by a user
            voluntary = true;
            _userId = this.userId;
        }

        var now = new Date().getTime();

        var user = Meteor.users.findOne({_id: _userId});

        if (user == null) {
            throw new Meteor.Error(404, "A user with id {0} was not found.".format(_userId));
        }

        // Avoid questions the user already has
        // TODO: Flatten Histories query for questionAvailable and answerAvailable into one call.
        var unavailableQuestionCardIds = _.uniq(_.pluck(Histories.find({userId: _userId, questionAvailable: false}, {fields: {questionCardId: 1}}).fetch(), 'questionCardId')) || [];

        // Do we need to repeat questions?
        if (unavailableQuestionCardIds.length === Cards.find({type: CARD_TYPE_QUESTION}).count()) {
            unavailableQuestionCardIds = [];

            Histories.update({userId: _userId, questionAvailable: false}, {$set: {questionAvailable: true}}, {multi: true});
        }

        var questionCard = CardCache.getRandomQuestionCardExcluding(unavailableQuestionCardIds);

        // Diagnose if we can't find a question card
        if (questionCard == null) {
            // Diagnose
            if (Cards.find({type: CARD_TYPE_QUESTION}).count() === 0) {
                throw new Meteor.Error(504, "No question cards have been loaded into the database.");
            } else {
                throw new Meteor.Error(404, "No question cards found for this user.\nuser: {0}".format(JSON.stringify(user)));
            }
        }

        // Do we need to repeat answers?
        var unavailableAnswerCardIds = _.uniq(_.flatten(_.pluck(Histories.find({userId: _userId, answersAvailable: false}, {fields: {answerCardIds: 1}}).fetch(), 'answerCardIds'))) || [];

        if (unavailableAnswerCardIds.length > CardCache.answerCards.length - K_OPTIONS) {
            unavailableAnswerCardIds = [];

            Histories.update({userId: _userId, answersAvailable: false}, {$set: {answersAvailable: true}}, {multi: true});
        }

        var answerCardIds = _.pluck(CardCache.getSomeAnswerCardsExcluding(unavailableAnswerCardIds, K_OPTIONS), '_id');

        // Diagnose if we can't find answer cards
        if (answerCardIds == null || answerCardIds.length === 0) {
            // Diagnose
            if (Cards.find({type: CARD_TYPE_ANSWER}).count() === 0) {
                throw new Meteor.Error(504, "No answer cards have been loaded into the database.");
            } else {
                throw new Meteor.Error(404, "No answer cards found for this user.\nuser: {0}".format(JSON.stringify(user)));
            }
        }

        var history = {
            userId: _userId,
            questionCardId: questionCard._id,
            answerCardIds: answerCardIds,
            answerId: null,
            questionAvailable: false,
            answersAvailable: false,
            judged: false,
            created: now,
            modified: now
        };

        // Append the question to the user's list of unanswered questions
        var historyId = Histories.insert(history);

        // Update last action
        if (voluntary) {
            Meteor.users.update({_id: _userId}, {$set: {lastAction: now}});
        }

        // Clear old histories
        Histories.remove({questionAvailable: true, answerAvailable: true, answerId: {$ne: null}}, {multi: true});

        // Return this history entry for this user
        return historyId;
    },

    pickAnswer: function (answerId, _userId) {
        if (!this.userId && !_userId) {
            throw new Meteor.Error(403, "Permission denied.");
        } else if (this.userId) {
            _userId = this.userId;
        }

        var now = new Date().getTime();

        // get the associated answer
        var answer = Answers.findOne({_id: answerId});

        if (answer == null) {
            throw new Meteor.Error(404, "Answer with id {0} not found.".format(answerId));
        }

        // get the associated question
        var question = Questions.findOne({_id: answer.questionId});

        if (question == null) {
            throw new Meteor.Error(404, "Question with id {0} specified by answer {1} not found.".format(answer.questionId, JSON.stringify(answer)));
        }

        if (question.answerId !== null) {
            throw new Meteor.Error(500, "The question with id {0} already has an answer with id {1}".format(question._id, question.answerId));
        }

        // is a judge assigned to this question?
        var judgeId = question.judgeId || Meteor.call("assignJudgeToQuestion", question._id, _userId);

        // Am I the judge for this question?
        if (judgeId !== _userId) {
            throw new Meteor.Error(403, "User with id {0} is not the judge for this question.".format(_userId));
        }

        // Have enough people answered this question?
        if (question.answerCount < question.minimumAnswerCount) {
            throw new Meteor.Error(400, "The question with id {0} has too few answers.\nanswerCount: {0}\nminimumAnswerCount: {1}".format(question._id, question.answerCount, question.minimumAnswerCount));
        }

        // Score the answer
        var winningScore = Meteor.call("getWinningScore", question._id, answerId, _userId) || K_ANSWERS_PER_QUESTION + 1;
        var losingScore = Meteor.call("getLosingScore", question._id, _userId) || 1;

        // set this answer as the winning answer
        Questions.update({_id: question._id}, {$set: {answerId: answerId, modified: now}});

        Answers.update({_id: answerId}, {$set: {winner: true, winningAnswerId: answerId, score: winningScore, modified: now}});
        Answers.update({questionId: question._id, winner: {$ne: true}}, {$set: {winner: false, winningAnswerId: answerId, score: losingScore, modified: now}}, {multi: true});

        // add this score to the winner's scores and coins
        Meteor.users.update({_id: answer.userId}, {$inc: {score: winningScore, coins: winningScore}});

        // add losing scores and coins
        Meteor.users.update({_id: {
            $in: _.pluck(Answers.find({questionId: question._id, userId: {$ne: answer.userId}}).fetch(), 'userId')}
        }, {$inc: {score: losingScore, coins: losingScore}}, {multi: true});

        // reward judging bonus
        var judgingBonus = Meteor.call("getJudgingBonus", question._id, answerId, _userId, _userId);

        Meteor.users.update({_id: _userId}, {$inc: {coins: judgingBonus}, $set: {lastAction: now}});

        // return the question id on success
        return question._id;
    },

    getWinningScore: function (questionId, answerId, _userId) {
        // for now, just return the number of answers for this question + 1.
        return _.extend({answerCount: K_ANSWERS_PER_QUESTION + 1}, Questions.findOne({_id: questionId}, {fields: {answerCount: 1}, limit: 1})).answerCount;
    },

    getLosingScore: function (questionId, _userId) {
        return 1;
    },

    getJudgingBonus: function (questionId, answerId, judgeId, _userId) {
        // return the number of answers for this question
        return _.extend({answerCount: K_ANSWERS_PER_QUESTION}, Questions.findOne({_id: questionId}, {fields: {answerCount: 1}, limit: 1})).answerCount;
    },

    assignJudgeToQuestion: function (questionId, _userId) {
        if (!this.userId && !_userId) {
            throw new Meteor.Error(403, "Permission denied.");
        } else if (this.userId) {
            _userId = this.userId;
        }

        // find the question. it must not already be answered or have an existing judge
        var question = Questions.findOne({_id: questionId, answerId: null});

        if (question == null) {
            throw new Meteor.Error(404, "The question with id {0} could not be found.".format(questionId));
        }

        /* Assign a judge with the following criteria:
         0. The user hasn't answered this question
         1. User hasn't judged in a while
         2. User has judged few cards
         3. User has recently joined the network
         4. Question is old
         5. The user hasn't seen this question before

         Reassign a judge with the following criteria:
         1. The judge hasn't been playing
         2. The judge runs out of time
         3. The judge left the network

         If we fail to assign a judge, assign a bot to judge the card.
         */

        var now = new Date().getTime();

        // Should we assign?
        var eligibleUser = null;

        eligibleUser = Meteor.users.findOne({questionIds: {$ne: questionId}, lastAction: {$gt: now - K_24_HOURS}}, {limit: 1, sort: {matchingValue: 1, lastAction: -1}});

        // Do we need to assign this question to a bot?
        if (eligibleUser == null) {
            eligibleUser = {_id: Meteor.call("getBotUser"), lastAction: now};
        }

        // Did we find a bot? If not, diagnose.
        if (eligibleUser._id == null) {
            throw new Meteor.Error(404, "Could not find a user to assign to question {0}".format(questionId));
        }

        // Set the judge or reassign.
        Questions.update({_id: question._id, $or: [
            {judgeId: null},
            {judgeId: {$ne: eligibleUser._id}, judgeAssigned: {$lt: now - K_24_HOURS}}
        ]}, {$set: {judgeId: eligibleUser._id, judgeAssigned: now, modified: now}});

        // return the id of the assigned user
        return eligibleUser._id;
    },

    updateUserMatchingValue: function (_userId) {
        if (!this.userId && !_userId) {
            throw new Meteor.Error(403, "Permission denied.");
        } else if (this.userId) {
            _userId = this.userId;
        }

        // For now, this is equal to the number of unanswered judgements the user has assigned to him
        var judgementsAssigned = Questions.find({judgeId: _userId, answerId: null}).count();

        Meteor.users.update({_id: _userId}, {
            $set: {matchingValue: judgementsAssigned}
        });

        // return the judgement rank of this user
        return judgementsAssigned;
    },

    getBotUser: function () {
        // returns the id of a bot user.
        return _.extend({_id: null}, Meteor.users.findOne({bot: {$exists: true}}, {limit: 1, sort: {lastAction: 1}}))._id;
    }
});