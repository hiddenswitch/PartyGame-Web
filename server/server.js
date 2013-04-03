/**
 * @author Benjamin Berman
 */

Meteor.publish("openGames",function() {
	return Games.find({open:true},{fields:{password:0,questionCards:0,answerCards:0}});
});

Meteor.publish("myHands",function() {
	return Hands.find({userId:this.userId});
});

Meteor.publish("myGames",function() {
    return Games.find({userIds:this.userId},{fields:{password:0,questionCards:0,answerCards:0}});
});

//Meteor.publish("myOwnedGames",function() {
//    var gamesWhereIAmPlayer = _.pluck(Players.find({userId:this.userId},{fields:{gameId:1}}).fetch(),'gameId');
//
//	return Games.find({ownerId:playerId},{fields:{password:0,questionCards:0,answerCards:0}});
//});

Meteor.publish("players",function(gameId) {
    return Players.find({gameId:gameId});
});

var SUBMISSIONS = "submissions";

Meteor.publish(SUBMISSIONS, function(gameId,round) {
    var recordset = this;

    recordset.Redacted = {};
    recordset.Redacted.connectedPlayersCount = 0;
    recordset.Redacted.submissionsCount = 0;

    var submissionHandle = Submissions.find({gameId:gameId,round:round},{fields:{_id:1,gameId:1,answerId:1,round:1}}).observe({
        added: function (newSubmission) {
            recordset.Redacted.submissionsCount++;
            // if we have sufficient submissions, reveal them
            if (recordset.Redacted.submissionsCount >= recordset.Redacted.connectedPlayersCount-1) {
                var submissions = Submissions.find({gameId:gameId,round:round},{fields:{_id:1,gameId:1,answerId:1,round:1}}).fetch();

                recordset.added(SUBMISSIONS,newSubmission._id,newSubmission);

                _.each(submissions,function(existingSubmission){
                    try {
                        recordset.changed(SUBMISSIONS,existingSubmission._id, existingSubmission);
                    } catch (e) {
                        console.log(e);
                    }

                });

                // otherwise, keep them hidden
            } else {
                recordset.added(SUBMISSIONS,newSubmission._id, _.omit(newSubmission,'answerId'));
            }


        },
        removed: function (removedSubmission) {
            recordset.removed(SUBMISSIONS,removedSubmission._id);
            recordset.Redacted.submissionsCount--;
        },
        changed: function (changedSubmission) {
            if (recordset.Redacted.submissionsCount >= recordset.Redacted.connectedPlayersCount) {
                recordset.changed(SUBMISSIONS,changedSubmission._id,changedSubmission);

            } else {
                recordset.changed(SUBMISSIONS,changedSubmission._id, _.omit(changedSubmission,'answerId'));
            }
        }
    });

    var playersHandle = Players.find({gameId:gameId,connected:true}).observe({
        added: function() {
            recordset.Redacted.connectedPlayersCount++;
        },
        removed: function() {
            recordset.Redacted.connectedPlayersCount--;
        }
    });

    recordset.ready();

    recordset.onStop(function () {
        submissionHandle.stop();
        playersHandle.stop();
    });
});

Meteor.publish("votesInGame",function(gameId){
	return Votes.find({gameId:gameId});
});

Meteor.publish("cards",function() {
	return Cards.find({});
});

Meteor.publish("usersInGame",function(gameId) {
    // privacy concerns. but does not update correctly when gameId changes.
	return Meteor.users.find({},{fields:{_id:1,username:1,emails:1,profile:1,location:1}});
});

Meteor.startup(function () {
    // Clear the database
//    clearDatabase();
    // Add the heartbeat field to the user profile
    Accounts.onCreateUser(function(options, user) {
        if (options.profile)
            user.profile = options.profile;
        else
            user.profile = {};
        user.profile.heartbeat = new Date().getTime();
        return user;
    });

    // enable the geospatial index on games and users
    try {
        Games._ensureIndex({location:"2d"});
        Games._ensureIndex({players:1,modified:-1});
        Games._ensureIndex({userIds:1});
        Votes._ensureIndex({gameId:1});
        Hands._ensureIndex({gameId:1});
        Hands._ensureIndex({userId:1});
        Cards._ensureIndex({deckId:1});
        Decks._ensureIndex({title:1});
        Cards._ensureIndex({type:1});
        Players._ensureIndex({userId:1});
        Players._ensureIndex({gameId:1,userId:1,connected:1});
        Submissions._ensureIndex({gameId:1});
        Meteor.users._ensureIndex({'profile.heartbeat':-1});
        Meteor.users._ensureIndex({'profile.location':"2d"});
    } catch (e) {
        console.log("Indexing failure. " + e);
    }

    try {
        if (Cards.find({}).count() < 1) {
            // Cards Against Humanity cards
            var CAHDeck = new Deck();
            CAHDeck.title = "Cards Against Humanity";
            CAHDeck.ownerId = "";
            CAHDeck.description = "The complete Cards Against Humanity questions and answers, licensed Creative Commons" +
                "2.0 BY-NC-SA.";
            CAHDeck.price = 0;

            var CAHId = Decks.insert(CAHDeck);

            _.each(CAH_QUESTION_CARDS,function(c){
                Cards.insert({text:c,type:CARD_TYPE_QUESTION,deckId:CAHId});
            });

            _.each(CAH_ANSWER_CARDS,function(c){
                Cards.insert({text:c,type:CARD_TYPE_ANSWER,deckId:CAHId});
            });
        }
    } catch (e) {
        console.log("Card creation failure.");
    }


    // make sure users have full schema
    try {
        Meteor.users.update({heartbeat:{$exists:false},location:{$exists:false}},{$set:{heartbeat:new Date().getTime(),location:null}},{multi:true});
    } catch (e) {
        console.log("User schema extension failure.");
    }


    // make sure games have full schema
    try {
        Games.update({connected:{$exists:false},modified:{$exists:false}},{$set:{connected:[],modified:new Date().getTime()}},{multi:true});
    } catch (e) {
        console.log("Game schema extension failure.");
    }

    // Evaluate bots every second.


    // TODO: Seasonalize the games, keep the number of games random.

    if (Games.find({open:true}).count() < 760) {
        Meteor.call("populate",760);
    }

    Meteor.setInterval(function() {
        var botActions = Meteor.call("botsEvaluate");
        console.log(botActions.toString() + " bot actions performed.");
    },1000);

    // Close games that haven't seen any activity for a while
    Meteor.setInterval(function () {
        Games.update({open:true,modified:{$lt:new Date().getTime() - K_HEARTBEAT*20}},{$set:{open:false}},{multi:true});
    },40*K_HEARTBEAT);

    // Update player connected status. Bots are always connected
    Meteor.setInterval(function () {
        var disconnectedUsers = Meteor.users.find({'profile.bot':false,'profile.heartbeat':{$lt:new Date().getTime() - K_HEARTBEAT*2}}).fetch();

        // Set the connected attribute of the Players collection documents to false for disconnected users
        Players.update({userId:{$in:_.pluck(disconnectedUsers,'_id')},connected:true},{$set:{connected:false}},{multi:true});

        // Update the judges
        _.each(Games.find({open:true}).fetch(),function(g){
            var gameCurrentJudge = Meteor.call("currentJudge",g._id);
            if (g.judge !== gameCurrentJudge) {
                Games.update({_id:g._id},{$set:{judgeId:gameCurrentJudge}});
            }
        });

    },2*K_HEARTBEAT);
});

Meteor.methods({
    // Draw hands for all players in the game.
    drawHands: function(gameId,handSize) {
        if (Meteor.isSimulation)
            return "";



        handSize = handSize || K_DEFAULT_HAND_SIZE;

        var game = Games.findOne({_id:gameId, open:true});

        if (!game)
            throw new Meteor.Error(404,"No game to draw hands from.");



        if (!_.has(game,"answerCards"))
            throw new Meteor.Error(500,"Why are there no answer cards?");

        // all answer cards exhausted, do not draw any more cards.
        if (game.answerCards.length < 1) {
            throw new Meteor.Error(403,"The game is over.");
        }





        if (!game.open)
        // the game is over. only score screen will display.
            throw new Meteor.Error(403,"This game is closed.");



        var players = Players.find({gameId:gameId}).fetch();

        // storing all the ids of drawn cards to remove from the game database entry
        var drawnCards = [];



        // a card drawing function
        var drawCards = function(oldHand) {
            var newHand = oldHand || [];

            while (newHand.length < handSize) {
                if (game.answerCards.length > 0)
                    newHand.push(game.answerCards.pop());
            }

            // add the drawn cards to the list of cards to remove later from the game's deck
            drawnCards = _.union(drawnCards,newHand);

            return newHand;
        }
        // update any existing hands



        _.each(players,function(player){
            var handDoc = Hands.findOne({gameId:gameId,round:game.round,playerId:player._id});

            if (handDoc) {
                if (handDoc.hand.length < handSize) {
                    Hands.update({_id:handDoc._id},{$set:{hand:drawCards(handDoc.hand)}});
                }
            } else {
                var oldHand = [];

                if (game.round > 0) {
                    // get the old hand
                    var oldHandDoc = Hands.findOne({gameId:gameId,round:game.round-1,playerId:player._id});
                    if (oldHandDoc)
                        oldHand = _.union(oldHand,oldHandDoc.hand);
                }

                // add the new hand
                Hands.insert({
                    gameId:gameId,
                    round:game.round,
                    playerId:player._id,
                    userId:player.userId,
                    hand:drawCards(oldHand)
                });
            }
        });



        // update the game
        Games.update({_id:gameId},{$pullAll:{answerCards:drawnCards},$set:{modified:new Date().getTime()}});
    },

    // Find the latest game a given player joined
    findGameWithPlayer: function(playerId) {

    },

    // Join a game
    joinGame: function(gameId,_userId) {
        if (!this.userId && !_userId) {
            throw new Meteor.Error(500,"When server calls" + " joinGame" + ", you must impersonate a user.");
        } else if (this.userId) {
            _userId = this.userId
        }

        var g = Games.findOne({_id:gameId});

        if (!g)
            throw new Meteor.Error(404,"Cannot join nonexistent game.");

        if (!g.open)
            throw new Meteor.Error(403,"The game is closed, cannot join.");

        // If this user is already in the game, update the connected status and return.
        if (Players.find({gameId:gameId,userId:_userId}).count() > 0) {
            Players.update({gameId:gameId,userId:_userId},{$set:{connected:true}});
            return gameId;
        }

        // Otherwise, join the game by adding to the players list, updating the heartbeat, and incrementing the players
        // count.
        var p = new Player();

        p.userId = _userId;
        p.gameId = gameId;
        p.voted = new Date().getTime();
        p.connected = true;

        var getUserName = function(id) {
            var u = Meteor.users.find({_id:id},{reactive:false}).fetch();

            if (!u)
                return "REDACTED.";

            u = u[0];

            if (!u)
                return "REDACTED.";

            if (u.profile && u.profile.name)
                return u.profile.name;

            if (u.username)
                return u.username;

            if (u.emails && u.emails[0] && u.emails[0].address)
                return u.emails[0].address;

            return "REDACTED.";
        };

        p.name = getUserName(_userId);

        var playerId = Players.insert(p);



        // If there is no owner, this first user is now the owner.
        Games.update({_id:gameId,creatorUserId:_userId,$or:[{judgeId:null},{ownerId:null}]},{$set:{ownerId:playerId,judgeId:playerId}});

        // Increment the player count and join the game.
        Games.update({_id:gameId},{$inc: {players:1}, $addToSet:{userIds:_userId}, $set:{modified:new Date().getTime()}});



        // Update the heartbeat
        Meteor.users.update({_id:_userId},{$set:{heartbeat:new Date().getTime()}});

        // Draw hands for all users
        Meteor.call("drawHands",gameId,K_DEFAULT_HAND_SIZE);



        return gameId;
    },

    findGameWithFewPlayers: function() {
        // find the latest game with fewer than five players

        var game = Games.findOne({open:true, players:{$lt:K_PREFERRED_GAME_SIZE}});

        if (!game)
            return false;
        else
            return game._id;
    },

    findLocalGame: function(location) {
        if (this.isSimulation)
            return;

        location = location || null;

        if (!location)
            return false;

        var game = Games.findOne({open:true,location:{$within:{$center:[location,K_LOCAL_DISTANCE]}}});

        if (!game)
            return false;
        else
            return game._id;
    },

    findAnyGame: function() {
        var game = Games.findOne({open:true});

        if (!game)
            return false;
        else
            return game._id;
    },

    // Create a new, empty game
    // required title
    // optional password
    createEmptyGame: function(title,password,location,_userId) {
        if (!this.userId && !_userId) {
            throw new Meteor.Error(500,"When server calls" + " createEmptyGame" + ", you must impersonate a user.");
        } else if (this.userId) {
            _userId = this.userId
        }

        console.log("Creating " + JSON.stringify([title,password,location,_userId]));
        password = password || "";
        location = location || null;

        if (title=="")
            title = "Game #" + (Games.find({}).count() + 1).toString();

//		if (Games.find({title:title,open:true}).count() > 0)
//			throw new Meteor.Error(500,"A open game by that name already exists!");



        var shuffledAnswerCards = _.shuffle(_.pluck(Cards.find({type:CARD_TYPE_ANSWER},{fields:{_id:1}}).fetch(),'_id'));

        if (!shuffledAnswerCards)
            throw new Meteor.Error(404,"No answer cards found.");

        var shuffledQuestionCards = _.shuffle(_.pluck(Cards.find({type:CARD_TYPE_QUESTION},{fields:{_id:1}}).fetch(),'_id'));

        if (!shuffledQuestionCards)
            throw new Meteor.Error(404,"No question cards found.");

        var firstQuestionCardId = shuffledQuestionCards.pop();

        var gameId = Games.insert({
            title:title, // game title
            password:password, // game password if any
            players:0, // number of players in the game
            round:0, // round number
            questionCards:shuffledQuestionCards,
            answerCards:shuffledAnswerCards,
            questionId:firstQuestionCardId,
            open:true,
            creatorUserId:_userId,
            ownerId:null,
            created: new Date().getTime(),
            modified: new Date().getTime(),
            judgeId:null,
            userIds:[],
            location: location
        });

        console.log("Created game " + gameId.toString());

        return gameId;
    }
});

var clearDatabase = function() {
    Games.remove({});
    Hands.remove({});
    Players.remove({});
    Votes.remove({});
    Cards.remove({});
    Submissions.remove({});
    Meteor.users.remove({});
};