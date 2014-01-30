/**
 * @author Benjamin Berman
 * © 2012 All Rights Reserved
 **/

PartyModeBots = {
    fillGameWithBots: function (gameId, size) {

        size = size || K_PREFERRED_GAME_SIZE - 3;
        var g = Games.findOne({_id: gameId}, {fields: {players: 1}});
        var joins = 0;

        if (g && g.players < size) {
            for (var i = 0; i < size - g.players; i++) {
                joins += PartyModeBots.botJoinGame(gameId);
            }
        } else {
            return 0;
        }

        return joins;
    },

    botJoinOrCreateGame: function (botId) {
        var gameId = Party.findGameWithFewPlayers(5);
        botId = botId || OnlineModeBots.getOnlineBotUser();
        if (gameId) {
            return PartyModeBots.botJoinGame(gameId, botId);
        } else {
            return PartyModeBots.createEmptyBotGameAndJoin(botId);
        }
    },

    createEmptyBotGameAndJoin: function (botId) {
        botId = botId || OnlineModeBots.getOnlineBotUser();

        var gameId = Party.createEmptyGame("", "", null, botId);

        if (gameId) {
            return PartyModeBots.botJoinGame(gameId, botId);
        } else {
            console.log("Failed to create an empty bot game and join it.");
            return 0;
        }
    },

    botJoinGame: function (gameId, botId) {
        // Get a bot
        botId = botId || OnlineModeBots.getOnlineBotUser();
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
                o.botRejoins += PartyModeBots.botJoinOrCreateGame(bot._id);
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
    }
};