/**
 * @author Benjamin Berman
 * © 2012 All Rights Reserved
 **/

var tick = 0;

var botNames = [];

var botPlayers = 400;

var tickRate = 800;

Meteor.startup(function() {
    if (Meteor.settings.useBots === true) {
        // Get bot names, erasing stuff that already exists.
        if (Usernames && Usernames.length > 0) {
            var existingUserNames = Meteor.users.find({},{fields:{username:1}}).fetch();
            existingUserNames = existingUserNames || [];
            botNames = _.shuffle(_.without(Usernames,existingUserNames));
            // Clear memory.
            Usernames = null;
        }

        // TODO: Seasonalize the games, keep the number of games random.
        Deps.autorun(function() {
            var countOfBots = Meteor.users.find({'profile.bot':true}).count();
            if (countOfBots < botPlayers) {
                Meteor.call("populate",botPlayers-countOfBots);
            }
        });

        var botEvaluateFunction = function () {
            var botActions = Meteor.call("botsEvaluate");
            console.log("Bot action summary: " + JSON.stringify(botActions));
            Meteor.setTimeout(botEvaluateFunction,tickRate);
        }

        Meteor.setTimeout(botEvaluateFunction,tickRate);
    }
});

Meteor.methods({
    populate:function(population) {
        if (this.userId) {
            throw new Meteor.Error(503,"You must be an administrator to call this function.");
        }

        for (var i = 0; i < population; i++ ) {
            Meteor.call("botJoinOrCreateGame");
        }
    },

    fillGameWithBots:function(gameId,size) {
        if (this.userId) {
            throw new Meteor.Error(503,"You must be an administrator to call this function.");
        }

        size = size || K_PREFERRED_GAME_SIZE;
        var g = Games.findOne({_id:gameId},{fields:{players:1}});
        var joins = 0;

        if (g && g.players < size) {
            for (var i = 0; i < size - g.players; i++) {
                joins += Meteor.call("botJoinGame",gameId);
            }
        } else {
            return 0;
        }

        return joins;
    },

    botJoinOrCreateGame:function(botId) {
        if (this.userId) {
            throw new Meteor.Error(503,"You must be an administrator to call this function.");
        }

        var gameId = Meteor.call("findGameWithFewPlayers",5);
        botId = botId || Meteor.call("getBot");
        if (gameId) {
            return Meteor.call("botJoinGame",gameId,botId);
        } else {
            return Meteor.call("createEmptyBotGameAndJoin",botId);
        }
    },

    createBot:function() {
        if (this.userId) {
            throw new Meteor.Error(503,"You must be an administrator to call this function.");
        }

        var userIdPadding = Random.id();
        var password = Random.id();
        var foundName = false;

        // Only try 10 names before giving up and using a random name
        for (var i = 0; !foundName || i < 10; i++) {
            var nickname = botNames.length > 0 ? botNames.pop() : "Anonymous " + userIdPadding;
            if (Meteor.users.find({username:nickname}).count() === 0) {
                foundName = true;
            }
        }

        var botId = Accounts.createUser({
            username:nickname,
            email:userIdPadding+"@redactedonline.com",
            password:password,
            profile:{
                name:nickname,
                bot:true,
                inGame:false,
                // Perform actions 20 seconds from being able to
                period:Math.floor(Random.fraction()*20)
            }
        });

        return botId;
    },

    createEmptyBotGameAndJoin:function(botId) {
        if (this.userId) {
            throw new Meteor.Error(503,"You must be an administrator to call this function.");
        }

        botId = botId || Meteor.call("getBot");

        var gameId = Meteor.call("createEmptyGame","","",null,botId);

        if (gameId) {
            return Meteor.call("botJoinGame",gameId,botId);
        } else {
            console.log("Failed to create an empty bot game and join it.");
            return 0;
        }
    },

    getBot:function() {
        if (this.userId) {
            throw new Meteor.Error(503,"You must be an administrator to call this function.");
        }

        // Create a new bot, or find a bot with few games, and return the userId of the bot
        var bot = Meteor.users.findOne({"profile.bot":true,"profile.inGame":false});

        var botId;
        // If we didn't find a bot, add one.
        if (bot) {
            botId = bot._id;
        } else {
            botId = Meteor.call("createBot");
        }

        return botId;
    },

    botJoinGame:function(gameId,botId) {
        if (this.userId) {
            throw new Meteor.Error(503,"You must be an administrator to call this function.");
        }

        // Get a bot
        botId = botId || Meteor.call("getBot");
        if (!botId) {
            console.log("Could not create a bot.");
            return;
        }

        // Join the specified game.
        if (Meteor.call("joinGame",gameId,botId)) {
            // Update the bot's quantity of inGames
            Meteor.users.update({_id:botId},{$set:{"profile.inGame":true}});
            return 1;
        } else {
            console.log("Bot could not join game.");
            return 0;
        }
    },

    botsEvaluate:function() {
        if (this.userId) {
            throw new Meteor.Error(503,"You must be an administrator to call this function.");
        }

        // Evaluate all the bot actions
        tick++;

        var o = {
            botActions:0,
            botSubmittedCards:0,
            botVotes:0,
            botRejoins:0,
            botDrewHands:0,
            doNothing:0,
            tryAgains:0,
            botsNotInGame:Meteor.users.find({"profile.bot":true,"profile.inGame":false}).count()
        };

        var botJoinGame = function(bot) {
            o.botRejoins += Meteor.call("botJoinOrCreateGame",bot._id);
        };
        // Find bots whose period is up

        // De-synchronize the bot process
        var botsNotInGame = Meteor.users.find({"profile.bot":true,"profile.inGame":false},{fields:{_id:1}}).fetch();

        _.each(botsNotInGame,function(bot) {
            botJoinGame(bot);
        });

        var bots = Meteor.users.find({"profile.bot":true,"profile.inGame":true,"profile.period":tick % 20}).fetch();
        console.log("Evaluating " + (bots ? bots.length : 0).toString() + " bots...");
        if (bots && bots.length > 0) {
            // Determine the state of the game, and perform the relevant action
            _.each(bots,function(bot){
                // Perform method calls as this bot by using the impersonation capabilities in the methods.
                var players = Players.find({userId:bot._id,open:true},{fields:{_id:1,gameId:1}}).fetch();
                if (players && players.length > 0) {
                    _.each(players,function(player) {
                        var game = Games.findOne({_id:player.gameId,open:true},{fields:{_id:1,judgeId:1,open:1,round:1}});

                        if (game != null) {

                            var isJudge = (game.judgeId === player._id);

                            // If the bot is the judge and all the submissions are in, choose a random answer card. Be a little efficient about it.
                            if (isJudge) {
                                // Get the submissions for this game
                                var submissionsCursor = Submissions.find({gameId:player.gameId,round:game.round},{fields:{_id:1}});
                                var submissionsCount = submissionsCursor.count();

                                // Get the number of connected players
                                var connectedPlayersCount = Players.find({gameId:player.gameId,connected:true}).count();

                                // If it's possible to judge, judge.
                                if (submissionsCount >= connectedPlayersCount-1) {
                                    // Judge a random card
                                    submissionsCursor.rewind();
                                    try {
                                        Meteor.call("pickWinner",game._id, _.first(_.shuffle(submissionsCursor.fetch()))._id,bot._id);
                                        Meteor.call("finishRound",game._id);
                                    } catch (meteorException) {
                                        o.tryAgains++;
                                    }
                                }
                                o.botVotes++;
                                o.botActions++;
                            } else
                            // Otherwise, if the bot hasn't submitted an answer, submit an answer.
                            if (Submissions.find({playerId:player._id,gameId:game._id,round:game.round}).count() === 0) {
                                var hand = Hands.find({playerId:player._id,gameId:game._id},{_id:1,cardId:1}).fetch();
                                if (hand == null || hand.length < K_DEFAULT_HAND_SIZE) {
                                    Meteor.call("drawHands",game._id);
                                    o.botDrewHands++;
                                } else {
                                    Meteor.call("submitAnswerCard",
                                        game._id,
                                        _.first(_.shuffle(hand)).cardId,
                                        null,
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
                            Meteor.users.update({_id:bot._id},{$set:{"profile.inGame":false}});
                            Players.update({_id:player._id},{$set:{open:false}});
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
});