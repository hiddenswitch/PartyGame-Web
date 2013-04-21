/**
 * @author Benjamin Berman
 * © 2012 All Rights Reserved
 **/

Meteor.methods({
    populate:function(population) {
        for (var i = 0; i < population; i++ ) {
            Meteor.call("botJoinOrCreateGame");
        }
    },

    botJoinOrCreateGame:function() {
        var gameId = Meteor.call("findGameWithFewPlayers",Math.floor(Random.fraction()*5+4));

        if (gameId) {
            return Meteor.call("botJoinGame",gameId);
        } else {
            return Meteor.call("createEmptyBotGameAndJoin");
        }
    },

    createBot:function() {
        var userIdPadding = Random.id();
        var password = Random.id();
        var nickname = "Anonymous (" + userIdPadding + ")";
        var botId = Accounts.createUser({
            username:"Anonymous "+userIdPadding,
            email:userIdPadding+"@redactedonline.com",
            password:password,
            profile:{
                name:nickname,
                bot:true,
                inGames:0,
                // Perform actions 4-20 seconds from being able to
                period:Math.floor(4+Random.fraction()*16)
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
        console.log("gameId: " + gameId.toString() + ", botId: "+botId.toString());
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
        var tick = Math.floor(new Date().getTime() / 1000);

        var o = {
            botActions:0,
            botSubmittedCards:0,
            botVotes:0,
            botRejoins:0,
            botDrewHands:0,
            botsNotInGame:Meteor.users.find({"profile.bot":true,"profile.inGame":false}).count()
        };


        // Find bots whose period is up

        var bots = Meteor.users.find({"profile.bot":true,"profile.inGame":true,$where:tick.toString() + " % this.profile.period === 0"}).fetch();
        console.log("Evaluating " + (bots ? bots.length : 0).toString() + " bots...");
        if (bots && bots.length > 0) {
            // Determine the state of the game, and perform the relevant action
            _.each(bots,function(bot){
                // Perform method calls as this bot by using the impersonation capabilities in the methods.
                var players = Players.find({userId:bot._id}).fetch();
                if (players && players.length > 0) {
                    _.each(players,function(player) {
                        var game = Games.findOne({_id:player.gameId});

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
                                    });
                                }
                                o.botVotes++;
                                o.botActions++;
                            } else
                            // Otherwise, if the bot hasn't submitted an answer, submit an answer.
                            if (game && Submissions.find({playerId:player._id,gameId:game._id,round:game.round}).count() === 0) {
                                var hand = Hands.find({playerId:player._id,gameId:game._id}).fetch();
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
                            o.botRejoins += Meteor.call("botJoinOrCreateGame");
                        }
                        // We have done all possible actions in the game.
                    });
                }
            });
        }
        return o;
    }
});