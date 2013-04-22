/**
 * @author Benjamin Berman
 */

Meteor.publish("openGames",function() {
	return Games.find({open:true},{fields:{password:0,questionCards:0,answerCards:0},limit:50,sort:{modified:-1}});
});

Meteor.publish("hand",function(gameId) {
	return Hands.find({userId:this.userId,gameId:gameId});
});

Meteor.publish("myGames",function() {
    return Games.find({userIds:this.userId},{fields:{password:0,questionCards:0,answerCards:0},limit:50,sort:{players:1,modified:-1}});
});

Meteor.publish("players",function(gameId) {
    return Players.find({gameId:gameId});
});

var SUBMISSIONS = "submissions";

Meteor.publish(SUBMISSIONS, function(gameId,round) {
    var recordset = this;

    recordset.Redacted = {};
    recordset.Redacted.connectedPlayersCount = 0;
    recordset.Redacted.submissionsCount = 0;
    recordset.Redacted.updateSubmissions = function(newSubmission) {
        var submissions = Submissions.find({gameId:gameId,round:round},{fields:{_id:1,gameId:1,answerId:1,round:1}}).fetch();

        _.each(submissions,function(submission){
            try {
                if (recordset.Redacted.submissionsCount >= recordset.Redacted.connectedPlayersCount-1) {
                    recordset.changed(SUBMISSIONS,submission._id, submission);
                } else {
                    recordset.changed(SUBMISSIONS,submission._id, _.omit(submission,'answerId'));
                }
            } catch (e) {
                console.log(e);
            }

        });
    };

    var submissionHandle = Submissions.find({gameId:gameId,round:round},{fields:{_id:1,gameId:1,answerId:1,round:1}}).observe({
        added: function (newSubmission) {
            recordset.Redacted.submissionsCount++;
            recordset.added(SUBMISSIONS,newSubmission._id, _.omit(newSubmission,'answerId'));
            recordset.Redacted.updateSubmissions();

        },
        removed: function (removedSubmission) {
            recordset.removed(SUBMISSIONS,removedSubmission._id);
            recordset.Redacted.submissionsCount--;
        },
        changed: function (changedSubmission) {
            recordset.changed(SUBMISSIONS,changedSubmission._id,changedSubmission);
            recordset.Redacted.updateSubmissions();
        }
    });

    var playersHandle = Players.find({gameId:gameId,connected:true}).observe({
        added: function() {
            recordset.Redacted.connectedPlayersCount++;
            recordset.Redacted.updateSubmissions();
        },
        removed: function() {
            recordset.Redacted.connectedPlayersCount--;
            recordset.Redacted.updateSubmissions();
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

    Games._ensureIndex({location:"2d"});
    Games._ensureIndex({open:1,modified:-1,userIds:1});
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

    // Close games that haven't seen any activity for a while, delete games that have been closed for a while
    Meteor.setInterval(function () {
        Games.update({open:true,modified:{$lt:new Date().getTime() - K_HEARTBEAT*20}},{$set:{open:false}},{multi:true});
        var closedGames = _.pluck(Games.find({open:false},{fields:{_id:1}}).fetch(),"_id");
        Games.remove({open:false,modified:{$lt:new Date().getTime() - K_HEARTBEAT*100}});
        Players.remove({gameId:{$in:closedGames}});

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
    initCards:function() {
        if (Cards.find({}).count() === 0) {
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
    },
    // Draw hands for all players in the game.
    drawHands: function(gameId,handSize) {
        handSize = handSize || K_DEFAULT_HAND_SIZE;

        var game = Games.findOne({_id:gameId, open:true},{fields:{_id:1,open:1,answerCards:1}});

        if (!game)
            throw new Meteor.Error(404,"No game to draw hands from.");

        if (game.open === false) {
            // the game is over. only score screen will display.
            throw new Meteor.Error(403,"This game is closed.");
        }

        // all answer cards exhausted, do not draw any more cards.
        if (game.answerCards.length < 1) {
            Meteor.call("tryCloseGame",gameId);
            throw new Meteor.Error(405,"The game is over, the game is being closed.");
        }

        var drawnCards = [];

        var players = Players.find({gameId:gameId,connected:true},{fields:{_id:1,userId:1}}).fetch();

        _.each(players,function(player) {
            var handCount = Hands.find({gameId:gameId,playerId:player._id}).count();

            for (var i = 0; i < handSize - handCount; i++) {
                var cardId = this.isSimulation ? null : game.answerCards.pop();
                Hands.insert({userId:player.userId,gameId:gameId,playerId:player._id,cardId:cardId});
                drawnCards.push(cardId);
            }
        });

        // update the game
        Games.update({_id:gameId},{$pullAll:{answerCards:drawnCards},$set:{modified:new Date().getTime()}});
    },

    // Find the latest game a given player joined
    findGameWithUser: function(userId) {
        var p = Players.findOne({userId:userId});
        if (p !== null && _.has(p,'gameId')) {
            return p.gameId;
        } else {
            return null;
        }
    },

    // Join a game
    joinGame: function(gameId,_userId) {
        if (!this.userId && !_userId) {
            throw new Meteor.Error(500,"When server calls" + " joinGame" + ", you must impersonate a user.");
        } else if (this.userId) {
            _userId = this.userId;
        }

        var g = Games.findOne({_id:gameId},{fields:{_id:1,open:1}});

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
            var u = Meteor.users.findOne({_id:id});

            if (!u)
                return "Anomyous (" + id +")";

            if (u.profile && u.profile.name)
                return u.profile.name;

            if (u.username)
                return u.username;

            if (u.emails && u.emails[0] && u.emails[0].address)
                return u.emails[0].address;

            return "Anomyous (" + id +")";
        };

        p.name = getUserName(_userId);

        var playerId = Players.insert(p);

        // If there is no owner, this first user is now the owner.
        Games.update({_id:gameId,creatorUserId:_userId,$or:[{judgeId:null},{ownerId:null}]},{$set:{ownerId:playerId,judgeId:playerId}});

        // Increment the player count and join the game.
        Games.update({_id:gameId},{$inc: {players:1}, $addToSet:{userIds:_userId,playerIds:playerId}, $set:{modified:new Date().getTime()}});

        // Update the heartbeat
        Meteor.users.update({_id:_userId},{$set:{heartbeat:new Date().getTime()}});

        // Draw hands for all users
        Meteor.call("drawHands",gameId,K_DEFAULT_HAND_SIZE);

        return gameId;
    },

    findGameWithFewPlayers: function(gameSize) {
        // find the latest game with fewer than five players
        gameSize = gameSize || K_PREFERRED_GAME_SIZE;
        var game = Games.findOne({open:true, players:{$lt:gameSize}},{fields:{_id:1}});

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

        var game = Games.findOne({open:true,location:{$within:{$center:[location,K_LOCAL_DISTANCE]}}},{fields:{_id:1}});

        if (!game)
            return false;
        else
            return game._id;
    },

    findAnyGame: function() {
        var game = Games.findOne({open:true},{fields:{_id:1}});

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
            _userId = this.userId;
        }

        password = password || "";
        location = location || null;

        if (title=="")
            title = "Game #" + (Games.find({}).count() + 1).toString();

        Meteor.call("initCards");

        var shuffledAnswerCards = _.shuffle(_.pluck(Cards.find({type:CARD_TYPE_ANSWER},{fields:{_id:1}}).fetch(),'_id'));

        if (shuffledAnswerCards === null || shuffledAnswerCards.length === 0) {
            throw new Meteor.Error(404,"Cards were not found. Did you forget to initialize cards?");
        }

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

        console.log("Game stats: " + JSON.stringify({"Number of games":Games.find({open:true}).count(),"Last game created":gameId,"Players":Players.find().count()}));

        return gameId;
    },

    // Closes the game if it is valid to do so
    tryCloseGame:function(gameId) {
        var g = Games.findOne({_id:gameId},{fields:{answerCards:1,questionCards:1,open:1}});

        if (!g) {
            throw new Meteor.Error(404,"The game " + gameId + " does not exist.");
        }

        var open = g.open;

        // If no answer cards remain, close
        if (open && g.answerCards && g.answerCards.length === 0) {
            open = false;
        }

        // If no question cards remain, close
        if (open && g.questionCards && g.questionCards.length === 0) {
            open = false;
        }

        // If no players are connected in this game, close
        if (open && Players.find({gameId:gameId,connected:true}).count() === 0) {
            open = false;
        }

        if (g.open !== open) {
            Games.update({_id:gameId},{$set:{open:false},modified:new Date().getTime()});
        }
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