/**
 * @author Benjamin Berman
 * © 2012 All Rights Reserved
 **/

Meteor.startup(function () {
    // Evaluate bots every second.
    Meteor.setInterval(function() {
        var botActions = Meteor.call("botsEvaluate");
        console.log(botActions.toString() + " bot actions performed.");
    },1000);

    // Seasonalize the games to make it seem interesting
    if (Meteor.users.find({"profile.bot":true}).count() == 0) {
        Meteor.call("createBot");
    }

    // TODO: Seasonalize the games, keep the number of games random.
    Meteor.autorun(function(){
        if (Games.find({open:true}).count() < 760) {
            Meteor.call("findGameWithFewPlayers",function(e,r){
                if (r) {
                    Meteor.call("botJoinGame",r);
                } else {
                    Meteor.call("createEmptyBotGameAndJoin");
                }
            });
        }
    });
});

Meteor.methods({
    createBot:function() {
        var userIdPadding = Math.random().toString(36).slice(-8);
        var password = Math.random().toString(36).slice(-8);
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
                period:Math.floor(4+Math.random()*16)
            }
        });

        return botId;
    },

    createEmptyBotGameAndJoin:function(botId) {
        botId = botId || Meteor.call("getBot");
        this.setUserId(botId);
        Meteor.call("createEmptyGame","","",null,function (e,r){
            if (r) {
                Meteor.call("botJoinGame",botId,r);
            } else {
                console.log(e);
            }
        });
    },

    getBot:function() {
        // Create a new bot, or find a bot with few games, and return the userId of the bot
        var bot = Meteor.users.findOne({"profile.bot":true,"profile.inGames":{$lt:3}});

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
            throw new Meteor.Error(500,"Could not create a bot.");
        }

        // Join the specified game.
        this.setUserId(botId);

        if (Meteor.call("joinGame",gameId)) {
            // Update the bot's quantity of inGames
            Meteor.users.update({_id:botId},{$inc:{"profile.inGames":1}});
        } else {
            throw new Meteor.Error(500,"Bot could not join game.");
        }
    },

    botsEvaluate:function() {
        // Evaluate all the bot actions
        var tick = Math.floor(new Date().getTime() / 1000);

        var botActions = 0;

        // Find bots whose period is up
        var bots = Meteor.users.find({"profile.bot":true,"profile.inGames":{$gt:0},$where:tick.toString() + " % this.profile.period == 0"}).fetch();
        console.log("Evaluating " + (bots ? bots.length : 0).toString() + " bots...");
        if (bots && bots.length > 0) {
            // Determine the state of the game, and perform the relevant action
            _.each(bots,function(bot){
                // Perform method calls as this bot.
                this.setUserId(bot._id);

                var players = Players.find({userId:bot._id}).fetch();
                if (players && players.length > 0) {
                    _.each(players,function(player) {
                        var game = Games.findOne({_id:player.gameId});

                        if (game && !game.open) {
                            // The game is closed, free this bot for another game
                            Meteor.users.update({_id:bot._id},{$inc:{inGames:-1}});
                        } else
                        // If the bot is the judge and all the submissions are in, choose a random answer card. Be a little efficient about it.
                        if (game && EJSON.equals(game.currentJudge,player._id)) {
                            // Get the submissions for this game
                            var submissionsCursor = Submissions.find({gameId:player.gameId,round:game.round},{fields:{_id:1}});
                            var submissionsCount = submissionsCursor.count();

                            // Get the number of connected players
                            var connectedPlayersCount = Players.find({gameId:player.gameId,connected:true}).count();

                            // If it's possible to judge, judge.
                            if (submissionsCount >= connectedPlayersCount-1) {
                                // Judge a random card
                                submissionsCursor.rewind();

                                Meteor.call("pickWinner",game._id, _.first(_.shuffle(submissionsCursor.fetch()))._id,function (e,r){
                                    if (r) {
                                        Meteor.call("finishRound",game._id);
                                    }
                                });
                            }
                            botActions++;
                        } else
                        // Otherwise, if the bot hasn't submitted an answer, submit an answer.
                        if (game && Submissions.find({playerId:player._id,gameId:game._id,round:game.round}).count() == 0) {
                            Meteor.call("submitAnswerCard",game._id, _.first(_.shuffle(Hands.findOne({playerId:player._id,gameId:game._id,round:game.round}).hand)));
                            botActions++;
                        }

                        // We have done all possible actions in the game.
                    });
                }
            });
        }
        return botActions;
    }
});