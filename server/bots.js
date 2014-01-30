/**
 * @author Benjamin Berman
 * © 2012 All Rights Reserved
 **/

Bots = {
    fillGameWithBots: function (gameId, size) {
        size = size || K_PREFERRED_GAME_SIZE - 3;
        var g = Games.findOne({_id: gameId}, {fields: {players: 1}});
        var joins = 0;

        if (g && g.players < size) {
            for (var i = 0; i < size - g.players; i++) {
                joins += Bots.botJoinGame(gameId);
            }
        } else {
            return 0;
        }

        return joins;
    },

    botJoinOrCreateGame: function (botId) {
        var gameId = Party.findGameWithFewPlayers(5);
        botId = botId || Bots.getOnlineBotUser();
        if (gameId) {
            return Bots.botJoinGame(gameId, botId);
        } else {
            return Bots.createEmptyBotGameAndJoin(botId);
        }
    },

    createEmptyBotGameAndJoin: function (botId) {
        botId = botId || Bots.getOnlineBotUser();

        var gameId = Party.createEmptyGame("", "", null, botId);

        if (gameId) {
            return Bots.botJoinGame(gameId, botId);
        } else {
            console.log("Failed to create an empty bot game and join it.");
            return 0;
        }
    },

    botJoinGame: function (gameId, botId) {
        // Get a bot
        botId = botId || Bots.getOnlineBotUser();
        if (!botId) {
            console.log("Could not create a bot.");
            return false;
        }

        // Join the specified game.
        if (Party.joinGame(gameId, botId) != null) {
            // Update the bot's quantity of inGames
            Meteor.users.update({_id: botId}, {$set: {inGame: true}});
            return true;
        } else {
            console.log("Bot could not join game.");
            return false;
        }
    },

    botsEvaluate: function (tick) {
        var o = {
            botActions: 0,
            botSubmittedCards: 0,
            botVotes: 0,
            botRejoins: 0,
            botDrewHands: 0,
            doNothing: 0,
            tryAgains: 0,
            botsNotInGame: Meteor.users.find({bot: true, inGame: false}).count()
        };

        var botJoinGame = function (bot) {
            return;
        };

        if (Meteor.settings.rejoinGames) {
            botJoinGame = function (bot) {
                o.botRejoins += Bots.botJoinOrCreateGame(bot._id);
            };
            // Find bots whose period is up

            // De-synchronize the bot process
            var botsNotInGame = Meteor.users.find({bot: true, inGame: false}, {fields: {_id: 1}}).fetch();

            _.each(botsNotInGame, function (bot) {
                botJoinGame(bot);
            });
        }

        var bots = Meteor.users.find({bot: true, inGame: true, period: tick % 20}).fetch();
        if (bots && bots.length > 0) {
            // Determine the state of the game, and perform the relevant action
            _.each(bots, function (bot) {
                // Perform method calls as this bot by using the impersonation capabilities in the methods.
                var players = Players.find({userId: bot._id, open: true}, {fields: {_id: 1, gameId: 1}}).fetch();
                if (players && players.length > 0) {
                    _.each(players, function (player) {
                        var game = Games.findOne({_id: player.gameId, open: true}, {fields: {_id: 1, judgeId: 1, open: 1, round: 1}});

                        if (game != null) {

                            var isJudge = (game.judgeId === player._id);

                            // If the bot is the judge and all the submissions are in, choose a random answer card. Be a little efficient about it.
                            if (isJudge) {
                                // Get the submissions for this game
                                var submissionsCursor = Submissions.find({gameId: player.gameId, round: game.round, playerId: {$ne: player._id}}, {fields: {_id: 1}});
                                var submissionsCount = submissionsCursor.count();

                                // Get the number of connected players
                                var connectedPlayersCount = Players.find({gameId: player.gameId, connected: true, open: true}).count();

                                // If it's possible to judge, judge.
                                if (submissionsCount >= connectedPlayersCount - 1 && submissionsCount !== 0) {
                                    // Judge a random card
                                    submissionsCursor.rewind();
                                    Party.pickWinner(game._id,
                                        _.first(_.shuffle(submissionsCursor.fetch()))._id,
                                        bot._id);
                                    Party.finishRound(game._id);

                                }
                                o.botVotes++;
                                o.botActions++;
                            } else
                            // Otherwise, if the bot hasn't submitted an answer, submit an answer.
                            if (Submissions.find({playerId: player._id, gameId: game._id, round: game.round}).count() === 0) {
                                var hand = Hands.find({playerId: player._id, gameId: game._id}, {_id: 1, cardId: 1}).fetch();
                                if (hand == null || hand.length < K_DEFAULT_HAND_SIZE) {
                                    Party.drawHands(game._id);
                                    o.botDrewHands++;
                                } else {
                                    var answerId = _.first(_.shuffle(hand)).cardId;
                                    Party.submitAnswerCard(
                                        game._id,
                                        answerId,
                                        bot._id);
                                    o.botSubmittedCards++;
                                }
                                o.botActions++;
                            } else
                            // Do nothing...
                            {
                                o.doNothing++;
                            }
                        } else {
                            Meteor.users.update({_id: bot._id}, {$set: {inGame: false}});
                            Players.update({_id: player._id}, {$set: {open: false}});
                            botJoinGame(bot);
                        }
                        // We have done all possible actions in the game.
                    });
                } else {
                    // Rejoin a game.
                    botJoinGame(bot);
                }
            });
        }
        return o;
    },

    entertainmentDelay: 800,
    tick: 0,
    _startup: function () {
        var users = Meteor.users.find({
            bot: {$ne: true},
            $or: [
                {unjudgedQuestionsCount: {$gt: 1}},
                {unansweredHistoriesCount: {$lt: 3}},
                {pendingJudgeCount: {$lt: 2}}
            ]}, {fields: {_id: 1}}).fetch();
        _.each(users, function (user) {
            Bots.onlineBotPlayWithUser(user._id);
        });

        // Tick the party mode bots
        Bots.botsEvaluate(Bots.tick);

        Bots.tick++;
        Meteor.setTimeout(Bots._startup, Bots.entertainmentDelay);
    },
    extendUserDocumentWithBotSettings: function (profile) {
        var userSchemaExtension = {};

        userSchemaExtension.inGame = false;
        userSchemaExtension.bot = true;
        userSchemaExtension.judgeTheseQuestionIds = [];
        userSchemaExtension.location = null;

        return _.extend(profile, userSchemaExtension);
    },

    getOnlineBotUser: function () {
        var now = new Date().getTime();

        // returns the id of a bot user.
        var bot = Meteor.users.findOne({bot: true, lastAction: {$lt: now - K_10_MINUTES}, inGame: false}, {limit: 1, sort: {lastAction: 1}});

        if (bot == null) {
            // Create a bot
            bot = {_id: Bots.createOnlineBot()};
        }

        if (bot._id == null) {
            throw new Meteor.Error(503, "An administrator must review this error. Error code 0x1BFA");
        }

        return bot._id;
    },

    createOnlineBot: function () {
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
            profile: Bots.extendUserDocumentWithBotSettings({
                name: nickname,
                bot: true,
                period: Math.floor(Random.fraction() * 20)
            })
        });

        return botId;
    },

    onlineBotAppendAnswer: function (questionId, botId, answerCardId) {
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
            judgeId: null,
            created: now,
            modified: now
        };

        answer._id = Answers.insert(answer);

        // Update our local copy to avoid a database query.
        question.answerCardIds.push(answerCardId);
        question.answerCount++;

        // update this player's question matching value for judge assignment
        OnlineModeManager.updateUserMatchingValue(botId);

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
            OnlineModeManager.assignJudgeToQuestion(question._id, botId);
        }

        // return the id of the answer
        return answer._id;
    },

    onlineBotJudgeQuestion: function (questionId, botId, coerce) {
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
        if (OnlineModeManager.pickAnswer(answerId, botId) !== questionId) {
            throw new Meteor.Error(500, "Picking an answer failed for answerId {0}.".format(answerId));
        }

        // Pop off this question as something the bot has to judge
        Meteor.users.update({_id: botId}, {$pop: {judgeTheseQuestionIds: questionId}});

        // return the answerId we chose
        return answerId;
    },

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

        var entertainWithQuestions = true;

        if (entertainWithQuestions && user.unansweredHistoriesCount < 3) {
            possibleActions.push(OnlineModeManager.getQuestionForUser.bind(this, userId));
        }

        var entertainByAnsweringQuestionOrJudging = true;

        if (entertainByAnsweringQuestionOrJudging && user.unjudgedQuestionsCount > 0) {
            possibleActions.push(Bots.onlineBotPlayWithUserByAnsweringOrJudging.bind(this, userId));
        }

        var entertainWithJudgement = true;

        if (entertainWithJudgement && user.pendingJudgeCount < 2) {
            possibleActions.push(Bots.onlineBotPlayWithUserByCreatingAQuestionToJudge.bind(this, userId));
        }

        var localGamesCount = (user.location != null && user.location.length == 2 && user.location[0] && user.location[1]) ?
            (Games.find({open: true, location: {$within: {$center: [
                [user.location[0], user.location[1]],
                0.01
            ]}}}, {fields: {_id: 1}}).count())
            : (Games.find({location: null, open: true}).count());

        if (localGamesCount === 0) {
            possibleActions.push(Bots.onlineBotPlayWithUserByCreatingLocalGame.bind(userId, user.location));
        }

        if (possibleActions.length !== 0) {
            return Random.choice(possibleActions)();
        }
    },

    onlineBotPlayWithUserByCreatingLocalGame: function (userId, location) {
        var now = new Date().getTime();

        var ownerBotId = Bots.getOnlineBotUser();
        var gameId = Party.createEmptyGame("", "", location, ownerBotId);

        Bots.botJoinGame(gameId, ownerBotId);
        Bots.fillGameWithBots(gameId, 6);

        return gameId;
    },

    onlineBotPlayWithUserByCreatingAQuestionToJudge: function (userId) {
        var now = new Date().getTime();

        var unavailableQuestionCardIds = CardManager.getUnavailableQuestionCardIdsForUser(userId);

        // Generate something for the user to judge
        var question = {
            cardId: CardManager.getRandomQuestionCardExcluding(unavailableQuestionCardIds)._id,
            judgeId: null,
            created: now,
            modified: now,
            answerCardIds: [],
            userIds: [],
            answerCount: 0,
            answerId: null,
            judgeAssigned: null,
            minimumAnswerCount: K_ANSWERS_PER_QUESTION
        };

        question._id = Questions.insert(question);

        // Make bots submit answers
        for (; question.answerCount < question.minimumAnswerCount; question.answerCount++) {
            Bots.onlineBotAppendAnswer(question._id, Bots.getOnlineBotUser());
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
                    result: Bots.onlineBotAppendAnswer(waitingAnswer.questionId, Bots.getOnlineBotUser())
                };
            } else {
                // If the question was assigned to a bot, judge the question
                if (Meteor.users.find({_id: question.judgeId, bot: true}).count() > 0) {
                    return {
                        userId: userId,
                        reason: "question id {0} not yet judged".format(waitingAnswer.questionId),
                        method: "onlineBotJudgeQuestion",
                        result: Bots.onlineBotJudgeQuestion(waitingAnswer.questionId, question.judgeId)
                    };
                }
            }
        }

        return null;
    }
};

Meteor.startup(Bots._startup);