/**
 * @author Benjamin Berman
 * © 2012 All Rights Reserved
 **/

K_ANSWERS_PER_QUESTION = 6;
K_24_HOURS = 24 * 60 * 60 * 1000;
K_10_MINUTES = 10 * 60 * 1000;
K_OPTIONS = 6;
K_INITIAL_COINS = 100;

JudgeManager = {
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
            Answers.update({questionId: questionId}, {$set: {judgeId: judgeId}}, {multi: true});
            return Questions.update({_id: questionId}, {$set: {judgeId: judgeId, judgeAssigned: now, modified: now}});
        } else {
            return null;
        }
    }
};

OnlineModeManager = {
    getQuestionForUser: function (userId) {
        var now = new Date().getTime();

        var user = Meteor.users.findOne({_id: userId});

        if (user == null) {
            throw new Meteor.Error(404, "A user with id {0} was not found.".format(userId));
        }

        // Avoid questions the user already has
        // TODO: Flatten Histories query for questionAvailable and answerAvailable into one call.
        var unavailableQuestionCardIds = CardManager.getUnavailableQuestionCardIdsForUser(userId);

        // Do we need to repeat answers?
        var unavailableAnswerCardIds = CardManager.getUnavailableAnswerCardIdsForUser(userId);
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

        // Try to find a question another user submitted
        var question = Questions.findOne({cardId: {$nin: unavailableQuestionCardIds}, judgeId: {$ne: userId}, answerId: null, answerCount: {$lte: K_ANSWERS_PER_QUESTION}}, {sort: {answerCount: -1}});
        var questionCard = null;

        // If no question was found, just assign a question card id.
        if (question == null) {
            questionCard = CardManager.getRandomQuestionCardExcluding(unavailableQuestionCardIds);

            // Diagnose if we can't find a question card
            if (questionCard == null) {
                // Diagnose
                if (Cards.find({type: CARD_TYPE_QUESTION}).count() === 0) {
                    throw new Meteor.Error(504, "No question cards have been loaded into the database.");
                } else {
                    throw new Meteor.Error(404, "No question cards found for this user.\nuser: {0}".format(JSON.stringify(user)));
                }
            }

            question = {_id: null};
        } else {
            // Otherwise, set the question card id to the one specified by the question
            questionCard = {_id: question.cardId};
        }

        var history = {
            userId: userId,
            questionId: question._id,
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
        history._id = Histories.insert(history);

        // Update last action
        Meteor.users.update({_id: userId}, {$set: {lastAction: now}, $inc: {unansweredHistoriesCount: 1}});

        // Clear old histories
        Histories.remove({questionAvailable: true, answerAvailable: true, answerId: {$ne: null}});

        // Return this history entry for this user
        return history._id;
    },

    /**
     * Sends a question to the given users, which are documents of the form
     * _id (meteor user id)
     * {_id: meteor user id} or
     * {"services.facebook.id": facebook id}
     * @param questionCardId
     * @param toUsers
     * @param userId
     * @returns {*}
     */
    sendQuestion: function (questionCardId, toUsers, userId) {
        var now = new Date().getTime();

        // if the question card doesn't exist, I can't send this question
        if (Cards.find({_id: questionCardId}).count() === 0) {
            throw new Meteor.Error(404, "Question card with id {0} does not exist.".format(questionCardId));
        }

        // Check that the user owns this card
        if (!InventoryManager.userOwnsCard(userId, questionCardId)) {
            throw new Meteor.Error(403, "You can't send a question with the card {0} you do not own.".format(questionCardId));
        }

        // wrap plain id
        toUsers = _.map(toUsers, function (u) {
            if (typeof(u) === "string") {
                return {_id: u};
            } else {
                return u;
            }
        });

        // Ignore the existing user
        toUsers = _.reject(toUsers, function (u) {
            return u._id === userId;
        });

        // Create phantom accounts for Facebook users lacking a meteor account
        var facebookToUserIds = _.map(Meteor.users.find({"services.facebook.id": {$in: _.compact(_.pluck(toUsers, "services.facebook.id"))}}, {fields: {"services.facebook.id": 1, _id: 1}}).fetch(), function (u) {
            return {_id: u._id, "services.facebook.id": u.services.facebook.id};
        });

        var missingUsers = _.filter(toUsers, function (u) {
            if (!_.has(u, "services.facebook.id") && _.has(u, "_id")) {
                return false;
            }

            var u_fbId = _.findWhere(facebookToUserIds, {"services.facebook.id": u["services.facebook.id"]});
            return u_fbId == null;
        });

        var updatedUsers = _.map(missingUsers, function (u) {
            return {_id: Accounts.updateOrCreateUserFromExternalService("facebook", {id: u["services.facebook.id"]}).id, "services.facebook.id": u["services.facebook.id"]};
        });

        var userIdToFbId = _.filter(_.uniq(_.filter(toUsers,function (u) {
            return _.has(u, "_id");
        }).concat(updatedUsers, facebookToUserIds)), function (u) {
            return _.has(u, "services.facebook.id") && _.has(u, "_id");
        });

        userIdToFbId = _.object(_.pluck(userIdToFbId, '_id'), _.pluck(userIdToFbId, 'services.facebook.id'));

        toUsers = _.uniq(_.pluck(_.filter(toUsers,function (u) {
            return _.has(u, "_id");
        }).concat(updatedUsers, facebookToUserIds), "_id"));

        if (toUsers != null && toUsers.length === 0 /*&& Meteor.users.find({_id: {$in: toUsers}}).count() !== toUsers.length */) {
            throw new Meteor.Error(504, "Some or all user IDs could not be found");
        } else if (toUsers == null || toUsers.length === 0) {
            // Set it to an empty array
            toUsers = [];
        }

        // Create a question
        var question = {
            cardId: questionCardId,
            judgeId: userId,
            created: now,
            modified: now,
            answerCardIds: [],
            userIds: _.uniq(toUsers.concat(userId)),
            answerCount: 0,
            answerId: null,
            judgeAssigned: now,
            minimumAnswerCount: K_ANSWERS_PER_QUESTION
        };

        question._id = Questions.insert(question);

        // If users were specified, create histories for them
        var histories = _.map(toUsers, function (u) {
            return {
                userId: u,
                questionId: question._id,
                questionCardId: questionCardId,
                answerId: null,
                questionAvailable: false,
                answersAvailable: false,
                judged: false,
                created: now,
                modified: now
            };
        });

        // Append the question to the users' list of unanswered questions
        // and send a Facebook message inviting them to play
        _.each(histories, function (history) {
            history._id = Histories.insert(history);
            // Message the user over facebook if they have a Facebook account.
            if (_(userIdToFbId).has(history.userId)) {
                var message = Cards.findOne({_id: history.questionCardId}).text + " — answer here: " + Meteor.absoluteUrl("i/" + history._id);
                FacebookManager.sendMessageToUsers(message, userId, [userIdToFbId[history.userId]['services.facebook.id']]);
            }
        });

        // Update last action
        Meteor.users.update({_id: {$in: toUsers}}, {$inc: {unansweredHistoriesCount: 1}}, {multi: true});
        Meteor.users.update({_id: userId}, {$inc: {pendingJudgeCount: 1}});

        // Clear old histories
        Histories.remove({questionAvailable: true, answerAvailable: true, answerId: {$ne: null}});

        return question._id;
    },

    writeAnswer: function (historyId, answerCardId, userId) {
        var now = new Date().getTime();

        var history = Histories.findOne({_id: historyId, answerId: null, judged: false, userId: userId});

        // if the history doesn't exist, how am I supposed to ascertain a valid question card id
        if (history == null) {
            throw new Meteor.Error(404, "You can't answer a card to a question that hasn't been assigned to you, a question that has already been answered, or a question that has already been judged!\nhistoryId: {0}\nanswerCardId: {1}".format(historyId, answerCardId));
        }

        // check that the user owns this card
        if (!InventoryManager.userOwnsCard(userId, answerCardId)) {
            throw new Meteor.Error(403, "You can't answer a question with the card {0} you do not own.".format(answerCardId));
        }

        // check that the question and answer cards exist
        if (Cards.find({_id: history.questionCardId}).count() === 0) {
            throw new Meteor.Error(404, "Question card with id {0} does not exist.".format(history.questionCardId));
        }

        if (Cards.find({_id: answerCardId, type: CARD_TYPE_ANSWER}).count() === 0) {
            throw new Meteor.Error(404, "Answer with id {0} does not exist, or the answer is not of the answer type.".format(answerCardId));
        }

        // If the history has a question id assigned to it already, look it up
        var question = null;

        if (history.questionId == null) {
            // Find or create this question with the given cardId which doesn't already have this answer
            question = Questions.findOne({
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
                    userIds: [],
                    minimumAnswerCount: K_ANSWERS_PER_QUESTION
                };

                question._id = Questions.insert(question);
            }

            Histories.update({_id: history._id}, {$set: {questionId: question._id}});
        } else {
            if (Answers.find({questionId: history.questionId, cardId: answerCardId}).count() !== 0) {
                throw new Meteor.Error(503, "The question {0} already contains the answer {1}".format(history.questionId, answerCardId));
            }

            question = Questions.findOne({_id: history.questionId});
        }

        // Assign the answer to the question
        var answer = {
            cardId: answerCardId,
            questionId: question._id,
            winner: null,
            winningAnswerId: null,
            score: null,
            userId: userId,
            /* Allow other users to see this answer by concatenating the userId to the question's userIds */
            userIds: _.uniq(question.userIds.concat([userId])),
            created: now,
            modified: now
        };

        answer._id = Answers.insert(answer);

        // Update our local copy to avoid a database query.
        question.answerCardIds.push(answerCardId);
        question.answerCount++;

        // update this player's question matching value for judge assignment
        OnlineModeManager.updateUserMatchingValue(userId);

        // Update the user's last action, and add the questions they have answered
        Meteor.users.update({_id: userId}, {
            $set: {lastAction: now},
            $push: {questionIds: question._id},
            $inc: {unjudgedQuestionsCount: 1, unansweredHistoriesCount: -1}
        });

        Questions.update({_id: question._id}, {
            $push: {answerCardIds: answerCardId},
            $addToSet: {userIds: userId},
            $inc: {answerCount: 1},
            $set: {modified: now}
        });

        // Concern userId with the other answers.
        Answers.update({questionId: question._id}, {
            $addToSet: {userIds: userId}
        });

        // Update the history object with the answer Id
        Histories.update({_id: historyId}, {$set: {answerId: answer._id, modified: now}});

        // if the question has reached the number of answers needed for judging, assign it a judge if it needs one
        if (question.answerCount >= question.minimumAnswerCount && question.judgeId === null) {
            OnlineModeManager.assignJudgeToQuestion(question._id, userId);
        }

        // return the id of the answer
        return answer._id;
    },

    pickAnswer: function (answerId, userId) {
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
            throw new Meteor.Error(500, "The question with id {0} has already been judged, and the winner is answer {1}".format(question._id, question.answerId));
        }

        // is a judge assigned to this question?
        var judgeId = question.judgeId || OnlineModeManager.assignJudgeToQuestion(question._id, userId);

        // Am I the judge for this question?
        if (judgeId !== userId) {
            throw new Meteor.Error(403, "User with id {0} is not the judge for this question.".format(userId));
        }

        // Have enough people answered this question?
        if (question.answerCount < question.minimumAnswerCount) {
            throw new Meteor.Error(400, "The question with id {0} has too few answers.\nanswerCount: {0}\nminimumAnswerCount: {1}".format(question._id, question.answerCount, question.minimumAnswerCount));
        }

        // Score the answer
        var winningScore = OnlineModeManager.getWinningScore(question._id, answerId, userId) || K_ANSWERS_PER_QUESTION + 1;
        var losingScore = OnlineModeManager.getLosingScore(question._id, userId) || 1;

        // set this answer as the winning answer
        Questions.update({_id: question._id}, {$set: {answerId: answerId, modified: now}});

        Answers.update({_id: answerId}, {$set: {winner: true, winningAnswerId: answerId, score: winningScore, modified: now}});
        Answers.update({questionId: question._id, winner: {$ne: true}}, {$set: {winner: false, winningAnswerId: answerId, score: losingScore, modified: now}}, {multi: true});

        Histories.update({questionId: question._id}, {$set: {judged: true}}, {multi: true});

        // add this score to the winner's scores and coins
        Meteor.users.update({_id: answer.userId}, {$inc: {score: winningScore, coins: winningScore, unjudgedQuestionsCount: -1}});

        // add losing scores and coins
        Meteor.users.update({_id: {
            $in: _.pluck(Answers.find({questionId: question._id, userId: {$ne: answer.userId}}).fetch(), 'userId')}
        }, {$inc: {score: losingScore, coins: losingScore, unjudgedQuestionsCount: -1}}, {multi: true});

        // decrement the judge's pending judge count
        Meteor.users.update({_id: question.judgeId}, {$inc: {pendingJudgeCount: -1}});

        // reward judging bonus
        var judgingBonus = OnlineModeManager.getJudgingBonus(question._id, answerId, userId);

        Meteor.users.update({_id: userId}, {$inc: {coins: judgingBonus}, $set: {lastAction: now}});

        // return the question id on success
        return question._id;
    },

    assignJudgeToQuestion: function (questionId, userId) {
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

            eligibleUser = {_id: Bots.get(), lastAction: now};
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

    updateUserMatchingValue: function (userId) {
        // For now, this is equal to the number of unanswered judgements the user has assigned to him
        var judgementsAssigned = Questions.find({judgeId: userId, answerId: null}).count();

        Meteor.users.update({_id: userId}, {
            $set: {matchingValue: judgementsAssigned}
        });

        // return the judgement rank of this user
        return judgementsAssigned;
    },

    getWinningScore: function (questionId, answerId, userId) {
        // for now, just return the number of answers for this question + 1.
        return _.extend({answerCount: K_ANSWERS_PER_QUESTION + 1}, Questions.findOne({_id: questionId}, {fields: {answerCount: 1}, limit: 1})).answerCount;
    },

    getLosingScore: function (questionId, userId) {
        return 1;
    },

    getJudgingBonus: function (questionId, answerId, judgeId) {
        // return the number of answers for this question
        return _.extend({answerCount: K_ANSWERS_PER_QUESTION}, Questions.findOne({_id: questionId}, {fields: {answerCount: 1}, limit: 1})).answerCount;
    }
};


Meteor.methods({
    sendQuestion: function (questionCardId, toUserIds) {
        if (!this.userId) {
            throw new Meteor.Error(503, "Permission denied.");
        }

        return OnlineModeManager.sendQuestion(questionCardId, toUserIds, this.userId);
    },

    writeAnswer: function (historyId, answerCardId) {
        if (!this.userId) {
            throw new Meteor.Error(503, "Permission denied.");
        }

        return OnlineModeManager.writeAnswer(historyId, answerCardId, this.userId);
    },

    getQuestionForUser: function () {
        if (!this.userId) {
            throw new Meteor.Error(503, "Permission denied.");
        }

        return OnlineModeManager.getQuestionForUser(this.userId);
    },

    pickAnswer: function (answerId) {
        if (!this.userId) {
            throw new Meteor.Error(503, "Permission denied.");
        }

        return OnlineModeManager.pickAnswer(answerId, this.userId);
    },

    assignJudgeToQuestion: function (questionId) {
        if (!this.userId) {
            throw new Meteor.Error(503, "Permission denied.");
        }

        return OnlineModeManager.assignJudgeToQuestion(questionId, this.userId);
    }
});