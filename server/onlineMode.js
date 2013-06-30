/**
 * @author Benjamin Berman
 * © 2012 All Rights Reserved
 **/

var K_ANSWERS_PER_QUESTION = 6;
var K_24_HOURS = 24 * 60 * 60 * 1000;
var K_10_MINUTES = 10 * 60 * 1000;
var K_OPTIONS = 3;
var K_INITIAL_COINS = 100;

var CardManager = {
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

        if (self.answerCards.length - exclusionIds.length < count || exclusionIds == null || exclusionIds.length === 0) {
            eligibleAnswerCards = self.answerCards;
        } else {
            eligibleAnswerCards = _.shuffle(_.filter(self.answerCards, function (card) {
                return !_.contains(exclusionIds, card._id);
            }));
        }

        return eligibleAnswerCards.slice(0, 3);
    },
    getUnavailableQuestionCardIdsForUser: function (userId) {
        var unavailableQuestionCardIds = _.uniq(_.pluck(Histories.find({userId: userId, questionAvailable: false}, {fields: {questionCardId: 1}}).fetch(), 'questionCardId')) || [];

        if (unavailableQuestionCardIds.length >= Cards.find({type: CARD_TYPE_QUESTION}).count()) {
            unavailableQuestionCardIds = [];

            Histories.update({userId: _userId, questionAvailable: false}, {$set: {questionAvailable: true}}, {multi: true});
        }

        return unavailableQuestionCardIds;
    },
    getUnavailableAnswerCardIdsForUser: function (userId) {
        var unavailableAnswerCardIds = _.uniq(_.flatten(_.pluck(Histories.find({userId: userId, answersAvailable: false}, {fields: {answerCardIds: 1}}).fetch(), 'answerCardIds'))) || [];

        if (unavailableAnswerCardIds.length >= CardManager.answerCards.length - K_OPTIONS) {
            unavailableAnswerCardIds = [];

            Histories.update({userId: _userId, answersAvailable: false}, {$set: {answersAvailable: true}}, {multi: true});
        }

        return unavailableAnswerCardIds;
    },
    initializeCards: function () {
        CardManager.updateAndShuffleCards();
        Meteor.setInterval(CardManager.updateAndShuffleCards, K_10_MINUTES);
    }
};

var JudgeManager = {
    setJudge: function (questionId, judgeId, coerce) {
        var now = new Date().getTime();

        var question = Questions.findOne({_id: questionId});

        var assignJudge = false;

        if (question.judgeId == null) {
            assignJudge = true;
        } else if (coerce || question.judgeAssigned < now - K_24_HOURS) {
            if (judgeId !== question.judgeId) {
                Meteor.users.update({_id: question.judgeId}, {$inc: {pendingJudgeCount: -1}});
            }
            assignJudge = true;
        }

        if (assignJudge) {
            Meteor.users.update({_id: judgeId}, {$inc: {pendingJudgeCount: 1}});
            return Questions.update({_id: questionId}, {$set: {judgeId: judgeId, judgeAssigned: now, modified: now}});
        } else {
            return null;
        }
    }
};

var BotManager = {
    entertainmentDelay: 800,
    tick: 0,
    keepEntertained: function () {
        Meteor.setInterval(function () {
            _.each(Meteor.users.find({
                bot: false,
                $or: [
                    {unjudgedQuestionsCount: {$gt: Random.choice([0, 1, 2, 3])}},
                    {unansweredHistoriesCount: {$lt: Random.choice([0, 1, 2, 3])}},
                    {pendingJudgeCount: {$lt: Random.choice([0, 1, 2, 3])}}
                ]}, {fields: {_id: 1}}).fetch(),
                function (user) {
                    Meteor.defer(function () {
                        Meteor.call("onlineBotPlayWithUser", user._id);
                    });
                });

            Meteor.call("botsEvaluate", BotManager.tick);
            BotManager.tick++;
        }, BotManager.entertainmentDelay);
    }
};

Meteor.startup(function () {
    // Update and shuffle the cards
    CardManager.initializeCards();
    BotManager.keepEntertained();
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
        if (Cards.find({_id: history.questionCardId}).count() === 0) {
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
            $push: {questionIds: question._id},
            $inc: {unjudgedQuestionsCount: 1, unansweredHistoriesCount: -1}
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
            Meteor.call("assignJudgeToQuestion", question._id, _userId);
        }

        // return the id of the answer
        return answer._id;
    },

    getQuestionForUser: function (_userId) {
        if (!this.userId && !_userId) {
            // voluntary is false because this action was initiated by the server
            throw new Meteor.Error(403, "Permission denied.");
        } else if (this.userId) {
            // this action was initiated by a user
            _userId = this.userId;
        }

        var now = new Date().getTime();

        var user = Meteor.users.findOne({_id: _userId});

        if (user == null) {
            throw new Meteor.Error(404, "A user with id {0} was not found.".format(_userId));
        }

        // Avoid questions the user already has
        // TODO: Flatten Histories query for questionAvailable and answerAvailable into one call.
        var unavailableQuestionCardIds = CardManager.getUnavailableQuestionCardIdsForUser(_userId);
        var questionCard = CardManager.getRandomQuestionCardExcluding(unavailableQuestionCardIds);

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
        var unavailableAnswerCardIds = CardManager.getUnavailableAnswerCardIdsForUser(_userId);
        var answerCardIds = _.pluck(CardManager.getSomeAnswerCardsExcluding(unavailableAnswerCardIds, K_OPTIONS), '_id');

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
        Meteor.users.update({_id: _userId}, {$set: {lastAction: now}, $inc: {unansweredHistoriesCount: 1}});

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
        Meteor.users.update({_id: answer.userId}, {$inc: {score: winningScore, coins: winningScore, unjudgedQuestionsCount: -1}});

        // add losing scores and coins
        Meteor.users.update({_id: {
            $in: _.pluck(Answers.find({questionId: question._id, userId: {$ne: answer.userId}}).fetch(), 'userId')}
        }, {$inc: {score: losingScore, coins: losingScore, unjudgedQuestionsCount: -1}}, {multi: true});

        // decrement the judge's pending judge count
        Meteor.users.update({_id: question.judgeId}, {$inc: {pendingJudgeCount: -1}});

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
        var assignedQuestionToBot = false;

        if (eligibleUser == null) {
            assignedQuestionToBot = true;

            eligibleUser = {_id: Meteor.call("getOnlineBotUser"), lastAction: now};
        }

        // Did we find a bot? If not, diagnose.
        if (eligibleUser._id == null) {
            throw new Meteor.Error(404, "Could not find a user to assign to question {0}".format(questionId));
        }

        // Set the judge or reassign.
        JudgeManager.setJudge(questionId, eligibleUser._id);

        // If we assigned to the bot, update the judgeTheseQuestionIds property to improve performance
        if (assignedQuestionToBot) {
            Meteor.users.update({_id: eligibleUser._id}, {$push: {judgeTheseQuestionIds: questionId}});
        }

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

    getOnlineBotUser: function () {
        if (this.userId) {
            throw new Meteor.Error(503, "You must be an administrator to call this function.");
        }

        var now = new Date().getTime();

        // returns the id of a bot user.
        var bot = Meteor.users.findOne({bot: true, lastAction: {$lt: now - K_10_MINUTES}, inGame: false}, {limit: 1, sort: {lastAction: 1}});

        if (bot == null) {
            // Create a bot
            bot = {_id: Meteor.call("createOnlineBot")};
        }

        if (bot._id == null) {
            throw new Meteor.Error(503, "An administrator must review this error. Error code 0x1BFA");
        }

        return bot._id;
    },

    createOnlineBot: function () {
        if (this.userId) {
            throw new Meteor.Error(503, "You must be an administrator to call this function.");
        }

        var now = new Date().getTime();

        var userIdPadding = Random.id();
        var password = Random.id();
        var foundName = false;

        // Only try 10 names before giving up and using a random name
        for (var i = 0; !foundName || i < 10; i++) {
            var nickname = ShuffledBotNames.length > 0 ? ShuffledBotNames.pop() : "Anonymous " + userIdPadding;
            if (Meteor.users.find({username: nickname}).count() === 0) {
                foundName = true;
            }
        }

        var botId = Accounts.createUser({
            username: nickname,
            email: userIdPadding + "@redactedonline.com",
            password: password,
            profile: {
                name: nickname,
                period: Math.floor(Random.fraction() * 20)
            }
        });

        var userSchemaExtension = {};

        userSchemaExtension.inGame = false;
        userSchemaExtension.heartbeat = now;
        userSchemaExtension.lastAction = now;
        userSchemaExtension.questionIds = [];
        userSchemaExtension.score = 0;
        userSchemaExtension.bot = true;
        userSchemaExtension.bored = false;
        userSchemaExtension.coins = K_INITIAL_COINS;
        userSchemaExtension.inventory = {decks: ['Cards Against Humanity', 'Starter']};
        userSchemaExtension.matchingValue = 0;
        userSchemaExtension.judgeTheseQuestionIds = [];
        userSchemaExtension.unansweredHistoriesCount = 0;
        userSchemaExtension.unjudgedQuestionsCount = 0;
        userSchemaExtension.pendingJudgeCount = 0;
        userSchemaExtension.location = null;

        Meteor.users.update({_id: botId}, {$set: userSchemaExtension});

        return botId;
    },

    onlineBotAppendAnswer: function (questionId, botId, answerCardId) {
        if (this.userId) {
            throw new Meteor.Error(503, "You must be an administrator to call this function.");
        }

        var now = new Date().getTime();

        // TODO: Specify situations for bot logic when arguments are untrusted
        var trusted = true;

        // Perform checks if untrusted
        if (!trusted) {
            if (Meteor.users.find({_id: botId, bot: true}).count() === 0) {
                throw new Meteor.Error(404, "Bot with id {0} not found.".format(botId));
            }

            // Trust that question exists in a server-only function
            if (questionId == null) {
                throw new Meteor.Error(504, "Null question id provided.");
            }
        }

        // Find or create this question with the given cardId which doesn't already have this answer
        var question = Questions.findOne({
            _id: questionId,
            answerId: null,
            // The question doesn't already have this answer attached to it
            answerCardIds: {$ne: answerCardId}
        }, {limit: 1});

        // TODO: Diagnose in detail
        if (question == null) {
            throw new Meteor.Error(504, "Question with id {0} not found, already answered or already contains this answerCardId.".format(questionId));
        }

        if (answerCardId == null) {
            // Get a random answer card to use.
            answerCardId = _.first(CardManager.getSomeAnswerCardsExcluding(question.answerCardIds, 1))._id;
        }

        if (answerCardId == null) {
            throw new Meteor.Error(504, "An answer card was not found for question id {0} and answer card ids {1}.".format(questionId, question.answerCardIds));
        }

        // Assign the answer to the question
        var answer = {
            cardId: answerCardId,
            questionId: questionId,
            winner: null,
            winningAnswerId: null,
            score: null,
            userId: botId,
            created: now,
            modified: now
        };

        answer._id = Answers.insert(answer);

        // Update our local copy to avoid a database query.
        question.answerCardIds.push(answerCardId);
        question.answerCount++;

        // update this player's question matching value for judge assignment
        Meteor.call("updateUserMatchingValue", botId);

        // Update the user's last action, and add the questions they have answered
        Meteor.users.update({_id: botId}, {
            $set: {lastAction: now},
            $push: {questionIds: question._id}
        });

        Questions.update({_id: question._id}, {
            $push: {answerCardIds: answerCardId},
            $inc: {answerCount: 1},
            $set: {modified: now}
        });

        // Bots do not have history yet.

        // if the question has reached the number of answers needed for judging, assign it a judge if it needs one
        if (question.answerCount >= question.minimumAnswerCount && question.judgeId === null) {
            Meteor.call("assignJudgeToQuestion", question._id, botId);
        }

        // return the id of the answer
        return answer._id;
    },

    onlineBotJudgeQuestion: function (questionId, botId, coerce) {
        if (this.userId) {
            throw new Meteor.Error(503, "You must be an administrator to call this function.");
        }

        // TODO: Specify situations for bot logic when arguments are untrusted
        var trusted = true;

        // Perform checks if untrusted
        if (!trusted) {
            if (Meteor.users.find({_id: botId, bot: true}).count() === 0) {
                throw new Meteor.Error(404, "Bot with id {0} not found.".format(botId));
            }

            // Trust that question exists in a server-only function
            if (questionId == null) {
                throw new Meteor.Error(504, "Null question id provided.");
            }

            if (Questions.find({_id: questionId, answerId: null, judgeId: botId}).count() === 0) {
                throw new Meteor.Error(504, "Question with id {0} cannot be found, is already answered or this bot is not the judge.");
            }
        }

        if (coerce) {
            JudgeManager.setJudge(questionId, botId, true);
        }

        // Choose an answer at random
        var answerId = _.first(_.shuffle(_.pluck(Answers.find({questionId: questionId}, {fields: {_id: 1}}).fetch(), "_id")));

        // Pick this answer.
        if (Meteor.call("pickAnswer", answerId, botId) !== questionId) {
            throw new Meteor.Error(500, "Picking an answer failed for answerId {0}.".format(answerId));
        }

        // Pop off this question as something the bot has to judge
        Meteor.users.update({_id: botId}, {$pop: {judgeTheseQuestionIds: questionId}});

        // return the answerId we chose
        return answerId;
    },

    // For a given user, generate an answer or judge event with a bot
    onlineBotPlayWithUser: function (userId) {
        if (this.userId) {
            throw new Meteor.Error(503, "You must be an administrator to call this function.");
        }

        if (userId == null) {
            throw new Meteor.Error(504, "Null user id specified.");
        }

        // Play with the user
        var user = Meteor.users.findOne({_id: userId});

        if (user.bot === true) {
            throw new Meteor.Error(504, "Invalid user.");
        }

        var possibleActions = [];

        if (user.unansweredHistoriesCount < 3) {
            possibleActions.push(Meteor.call.bind(this, "getQuestionForUser", userId));
        }

        if (user.unjudgedQuestionsCount > 0) {
            possibleActions.push(Meteor.call.bind(this, "onlineBotPlayWithUserByAnsweringOrJudging", userId));
        }

        if (user.pendingJudgeCount < 2) {
            possibleActions.push(Meteor.call.bind(this, "onlineBotPlayWithUserByCreatingAQuestionToJudge", userId));
        }

        var localGamesCount = (user.location != null && user.location.length == 2 && user.location[0] && user.location[1]) ?
            (Games.find({open: true, location: {$within: {$center: [[user.location[0], user.location[1]], 0.01]}}}, {fields: {_id: 1}}).count())
            : (Games.find({open: true}).count());

        if (localGamesCount === 0) {
            possibleActions.push(Meteor.call.bind(this, "onlineBotPlayWithUserByCreatingLocalGame", userId, user.location));
        }

        if (possibleActions.length !== 0) {
            return Random.choice(possibleActions)();
        }
    },

    onlineBotPlayWithUserByCreatingLocalGame: function (userId, location) {
        if (this.userId) {
            throw new Meteor.Error(503, "You must be an administrator to call this function.");
        }

        var now = new Date().getTime();

        var ownerBotId = Meteor.call("getOnlineBotUser");
        var gameId = Meteor.call("createEmptyGame", "", "", location, ownerBotId);

        Meteor.call("botJoinGame", gameId, ownerBotId);
        Meteor.call("fillGameWithBots", gameId, 6);

        return gameId;
    },

    onlineBotPlayWithUserByCreatingAQuestionToJudge: function (userId) {
        if (this.userId) {
            throw new Meteor.Error(503, "You must be an administrator to call this function.");
        }

        var now = new Date().getTime();

        var unavailableQuestionCardIds = CardManager.getUnavailableQuestionCardIdsForUser(userId);

        // Generate something for the user to judge
        var question = {
            cardId: CardManager.getRandomQuestionCardExcluding(unavailableQuestionCardIds)._id,
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

        // Make bots submit answers
        for (; question.answerCount < question.minimumAnswerCount; question.answerCount++) {
            Meteor.call("onlineBotAppendAnswer", question._id, Meteor.call("getOnlineBotUser"));
        }

        // Coerce the player as the judge
        JudgeManager.setJudge(question._id, userId, true);

        return {
            userId: userId,
            reason: "player {0} assigned to judge {1}".format(userId, question._id),
            method: "setJudge",
            result: question._id
        };
    },

    onlineBotPlayWithUserByAnsweringOrJudging: function (userId) {
        if (this.userId) {
            throw new Meteor.Error(503, "You must be an administrator to call this function.");
        }

        var waitingAnswer = Answers.findOne({userId: userId, winningAnswerId: null}, {limit: 1, fields: {questionId: 1, _id: 1}, sort: {modified: 1}});

        // If an answer is associated with an unjudged question, diagnose
        if (waitingAnswer != null) {
            var question = Questions.findOne({_id: waitingAnswer.questionId});

            if (question == null) {
                throw new Meteor.Error(504, "Question id {0} not found, associated with waitingAnswer {1}.".format(waitingAnswer.questionId, waitingAnswer._id));
            }

            // Are there insufficient answers? If so, answer this question too
            if (question.answerCount < question.minimumAnswerCount) {
                return {
                    userId: userId,
                    reason: "insufficient answers for questionId {0}".format(waitingAnswer.questionId),
                    method: "onlineBotAppendAnswer",
                    result: Meteor.call("onlineBotAppendAnswer", waitingAnswer.questionId, Meteor.call("getOnlineBotUser"))
                };
            } else {
                // If the question was assigned to a bot, judge the question
                if (Meteor.users.find({_id: question.judgeId, bot: true}).count() > 0) {
                    return {
                        userId: userId,
                        reason: "question id {0} not yet judged".format(waitingAnswer.questionId),
                        method: "onlineBotJudgeQuestion",
                        result: Meteor.call("onlineBotJudgeQuestion", waitingAnswer.questionId, question.judgeId)
                    };
                }
            }
        }

        return null;
    }

});