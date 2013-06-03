/**
 * @author Benjamin Berman
 * © 2012 All Rights Reserved
 **/

var K_ANSWERS_PER_QUESTION = 5;
var K_24_HOURS = 24 * 60 * 60 * 1000;

Meteor.methods({
    //
    writeAnswer: function (historyId, answerCardId, _userId) {
        if (!this.userId && !_userId) {
            throw new Meteor.Error(403, "Permission denied.");
        } else if (this.userId) {
            _userId = this.userId;
        }

        var now = new Date().getTime();

        var history = Histories.findOne({_id: historyId});

        // if the history doesn't exist, how am I supposed to ascertain a
        if (history == null) {
            throw new Meteor.Error(404, "You can't answer a card without a question card!\nhistoryId: {0}\nanswerCardId: {1}".format(historyId, answerCardId));
        }

        var questionCardId = history.questionCardId;

        // check that the question and answer cards exist
        if (Cards.find({_id: questionCardId}).count() === 0) {
            throw new Meteor.Error(404, "Question card with id {0} does not exist.".format(questionCardId));
        }

        if (Cards.find({_id: answerCardId}).count() === 0) {
            throw new Meteor.Error(404, "Answer card with id {0} does not exist.".format(answerCardId));
        }

        // Find or create this question with the given cardId which doesn't already have this answer
        var question = Questions.findOne({
            cardId: questionCardId,
            answerCount: {$lt: K_ANSWERS_PER_QUESTION},
            // The question doesn't already have this answer attached to it
            answerCardIds: {$ne: answerCardId}
        });

        // No question card was found, create one
        if (question === null) {
            question = {
                cardId: questionCardId,
                judgeId: null,
                created: now,
                modified: now,
                answerCardIds: [],
                answerCount: 0,
                answerId: null,
                judgeAssigned: null
            };

            question._id = Questions.insert(question);
        }

        // Assign the answer to the question
        var answer = {
            cardId: answerCardId,
            questionId: question._id,
            winner: false,
            userId: _userId,
            created: now,
            modified: now
        };

        answer._id = Answers.insert(answer);

        // Update our local copy to avoid a database query.
        question.answerCardIds.push(answerCardId);
        question.answerCount++;

        Questions.update({_id: question._id}, {
            $push: {answerCardIds: answerCardId},
            $inc: {answerCount: 1},
            $set: {modified: now}
        });

        // update this player's question matching value for judge assignment
        Meteor.call("updateUserMatchingValue", _userId);

        // Update the user's last action, and add the questions they have answered
        Meteor.users.update({_id: _userId}, {
            $set: {lastAction: now},
            $push: {questionIds: question._id}
        });

        // Update the history object with the answer Id
        Histories.update({_id: historyId}, {$set: {answerId: answer._id, modified: now}});

        // if the question has reached the number of answers needed for judging, assign it a judge if it needs one
        if (question.answerCount >= K_ANSWERS_PER_QUESTION && question.judgeId === null) {
            Meteor.call("assignJudgeToQuestion", question._id);
        }

        // return the id of the answer
        return answer._id;
    },

    getQuestionForUser: function (voluntary, _userId) {
        if (!this.userId && !_userId) {
            throw new Meteor.Error(403, "Permission denied.");
        } else if (this.userId) {
            _userId = this.userId;
        }

        var now = new Date().getTime();

        voluntary = (voluntary === undefined || voluntary === null) ? false : voluntary;

        var user = Meteor.users.findOne({_id: _userId});

        if (user === null) {
            throw new Meteor.Error(404, "A user with id {0} was not found.".format(_userId));
        }

        // Avoid questions the user already has
        var unavailableQuestionCardIds = _.pluck(Histories.find({userId: _userId, available: false}, {fields: {_id: 1}}).fetch(), '_id') || [];

        // Do we need to repeat?
        if (unavailableQuestionCardIds.length === Cards.find({type: CARD_TYPE_QUESTION}).count()) {
            unavailableQuestionCardIds = [];

            Histories.update({userId: _userId, available: false}, {$set: {available: true}}, {multi: true});
        }

        var questionCard = Cards.findOne({_id: {$nin: unavailableQuestionCardIds}, type: CARD_TYPE_QUESTION}, {fields: {_id: 1}, limit: 1});

        // Diagnose if we can't find a card
        if (questionCard === null) {
            // Diagnose
            if (Cards.find({type: CARD_TYPE_QUESTION}).count() === 0) {
                throw new Meteor.Error(504, "No cards have been loaded into the database.");
            } else {
                throw new Meteor.Error(404, "No cards found for this user.\nuser: {0}".format(JSON.stringify(user)));
            }
        }

        // Append the question to the user's list of unanswered questions
        var historyId = Histories.insert({userId: _userId, questionCardId: questionCard._id, answerId: null, available: false, judged: false, created: now, modified: now});

        // Update last action
        if (voluntary) {
            Meteor.users.update({_id: _userId}, {$set: {lastAction: now}});
        }

        // Clear old histories
        Histories.remove({available: true, answered: {$ne: null}}, {multi: true});

        // Return this history entry for this user
        return historyId;
    },

    assignJudgeToQuestion: function (questionId, _userId) {
        if (!this.userId && !_userId) {
            throw new Meteor.Error(403, "Permission denied.");
        } else if (this.userId) {
            _userId = this.userId;
        }

        // find the question. it must not already be answered or have an existing judge
        var question = Questions.findOne({_id: questionId, answerId: null});

        if (question === null) {
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

        eligibleUser = Meteor.users.findOne({questionIds: {$ne: questionId}, lastAction: {$lt: now - K_24_HOURS}}, {limit: 1, sort: {matchingValue: 1, lastAction: -1}});

        // Do we need to assign this question to a bot?
        if (eligibleUser === null) {
            eligibleUser = {_id: Meteor.call("getBotUser"), lastAction: now};
        }

        // Did we find a bot? If not, diagnose.
        if (eligibleUser._id === null) {
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
        return _.extend({_id: null}, Meteor.users.findOne({bot: true}, {limit: 1, sort: {lastAction: -1}}))._id;
    }
});