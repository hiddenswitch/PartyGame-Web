/**
 * @author Benjamin Berman
 * © 2012 All Rights Reserved
 **/

var tick = 0;

var botNames = [];

var botPlayers = 400;

Meteor.startup(function() {
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
        Meteor.setTimeout(botEvaluateFunction,1);
    }

    Meteor.setTimeout(botEvaluateFunction,1000);
});

Meteor.methods({
    populate:function(population) {
        for (var i = 0; i < population; i++ ) {
            Meteor.call("botJoinOrCreateGame");
        }
    },

    fillGameWithBots:function(gameId,size) {
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
        var gameId = Meteor.call("findGameWithFewPlayers",Math.floor(Random.fraction()*5+4));
        botId = botId || Meteor.call("getBot");
        if (gameId) {
            return Meteor.call("botJoinGame",gameId,botId);
        } else {
            return Meteor.call("createEmptyBotGameAndJoin",botId);
        }
    },

    createBot:function() {
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
                inGames:0,
                // Perform actions 20 seconds from being able to
                period:Math.floor(Random.fraction()*20)
            }
        });

        return botId;
    },

    createEmptyBotGameAndJoin:function(botId) {
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
        // Evaluate all the bot actions
        tick++;

        var o = {
            botActions:0,
            botSubmittedCards:0,
            botVotes:0,
            botRejoins:0,
            botDrewHands:0,
            botsNotInGame:Meteor.users.find({"profile.bot":true,"profile.inGame":false}).count()
        };


        // Find bots whose period is up

        var bots = Meteor.users.find({"profile.bot":true,"profile.inGame":true,"profile.period":tick % 20}).fetch();
        console.log("Evaluating " + (bots ? bots.length : 0).toString() + " bots...");
        if (bots && bots.length > 0) {
            // Determine the state of the game, and perform the relevant action
            _.each(bots,function(bot){
                // Perform method calls as this bot by using the impersonation capabilities in the methods.
                var players = Players.find({userId:bot._id},{fields:{_id:1,gameId:1}}).fetch();
                if (players && players.length > 0) {
                    _.each(players,function(player) {
                        var game = Games.findOne({_id:player.gameId},{fields:{_id:1,judgeId:1,open:1,round:1}});

                        if (game && game.open) {
                            var isJudge = EJSON.equals(game.judgeId,player._id);

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

                                    Meteor.call("pickWinner",game._id, _.first(_.shuffle(submissionsCursor.fetch()))._id,bot._id,function (e,r){
                                        if (r) {
                                            Meteor.call("finishRound",game._id);
                                        }
                                        if (e) {
                                            // Defer until next time, pick another random card.
                                        }
                                    });
                                }
                                o.botVotes++;
                                o.botActions++;
                            } else
                            // Otherwise, if the bot hasn't submitted an answer, submit an answer.
                            if (game && Submissions.find({playerId:player._id,gameId:game._id,round:game.round}).count() === 0) {
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
                            }
                        } else {
                            Meteor.users.update({_id:bot._id},{$set:{"profile.inGame":false}});
                            o.botRejoins += Meteor.call("botJoinOrCreateGame",bot._id);
                        }
                        // We have done all possible actions in the game.
                    });
                }
            });
        }
        return o;
    }
});