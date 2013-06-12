/**
 * @author Benjamin Berman
 */

Meteor.publish("localGames",function(location) {
    if (location) {
        return Games.find({open:true,location:{$within:{$center:[[location[1],location[0]],K_LOCAL_DISTANCE]}}},{fields:{_id:1,title:1,players:1,playerNames:1,open:1,round:1,location:1}});
    } else {
        return null;
    }
});

Meteor.publish("questions",function() {
    return Questions.find({judgeId:this.userId});
});

Meteor.publish("histories",function() {
    return Questions.find({userId:this.userId});
});

Meteor.publish("answers",function() {
    return Answers.find({$or:[{userId:this.userId},{judgeId:this.userId}]});
});

Meteor.publish("hand",function(gameId) {
	return Hands.find({userId:this.userId,gameId:gameId});
});

Meteor.publish("myGames",function() {
    return Games.find({userIds:this.userId},{fields:{password:0,questionCards:0,answerCards:0}});
});

Meteor.publish("players",function(gameId) {
    return Players.find({gameId:gameId});
});

var SUBMISSIONS = "submissions";

Meteor.publish(SUBMISSIONS, function(gameId) {
    return Submissions.find({gameId:gameId},{fields:{_id:1,gameId:1,answerId:1,round:1}});
});

Meteor.publish("votesInGame",function(gameId){
	return Votes.find({gameId:gameId});
});

Meteor.publish("cards",function() {
	return Cards.find({});
});

Meteor.publish("usersInGame",function(gameId) {
    // privacy concerns. but does not update correctly when gameId changes.
    var userIds = _.pluck(Players.find({gameId:gameId},{fields:{userId:1}}).fetch(),"userId");
	return Meteor.users.find({_id:{$in:userIds}},{fields:{_id:1,username:1,emails:1,'profile.name':1}});
});

Meteor.startup(function () {
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
    Meteor.users._ensureIndex({heartbeat:-1});
    Meteor.users._ensureIndex({location:"2d"});
});

Meteor.methods({
    initCAHCards:function() {
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

        var open = true;

        // all answer cards exhausted, do not draw any more cards.
        if (game.answerCards.length < 1) {
            Meteor.call("tryCloseGame",gameId);
            throw new Meteor.Error(405,"The game is over, the game is being closed.");
        }

        var drawnCards = [];

        var players = Players.find({gameId:gameId,connected:true},{fields:{_id:1,userId:1}}).fetch();

        for (var i = 0; i < players.length; i++) {
            var player = players[i];
            var handCount = Hands.find({gameId:gameId,playerId:player._id}).count();

            // TODO: Atomize the operations on cards
            for (var j = 0; j < handSize - handCount; j++) {
                if (game.answerCards.length > 0) {
                    var cardId = this.isSimulation ? null : game.answerCards.pop();
                    Hands.insert({userId:player.userId,gameId:gameId,playerId:player._id,cardId:cardId});
                    drawnCards.push(cardId);
                } else {
                    // Out of cards, close game
                    open = false;
                    break;
                }
            }
            if (!open) {
                break;
            }
        }

        // update the game
        Games.update({_id:gameId},{$pullAll:{answerCards:drawnCards},$inc:{answerCardCount:-drawnCards.length},$set:{open:open,modified:new Date().getTime()}});
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

    joinGameWithTitle: function(title,_userId) {
        if (!this.userId && !_userId) {
            throw new Meteor.Error(500,"When server calls" + " joinGame" + ", you must impersonate a user.");
        } else if (this.userId) {
            _userId = this.userId;
        }

        var g = Games.findOne({title:title});

        if (g) {
            return Meteor.call("joinGame", g._id,_userId);
        } else {
            throw new Meteor.Error(404,"A game named " + title + " was not found.");
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

        p.open = true;
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
        Games.update({_id:gameId},{$inc: {players:1}, $addToSet:{userIds:_userId,playerIds:playerId,playerNames: p.name}, $set:{modified:new Date().getTime()}});

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

        var game = Games.findOne({open:true,location:{$within:{$center:[[location[1],location[0]],K_LOCAL_DISTANCE]}}},{fields:{_id:1}});

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
            questionCardsCount:shuffledQuestionCards.length,
            questionCards:shuffledQuestionCards,
            answerCardsCount:shuffledAnswerCards.length,
            answerCards:shuffledAnswerCards,
            questionId:firstQuestionCardId,
            open:true,
            creatorUserId:_userId,
            ownerId:null,
            created: new Date().getTime(),
            modified: new Date().getTime(),
            judgeId:null,
            userIds:[],
            botLust: true,
            location: location ? [location[1],location[0]] : null
        });

        console.log("Game stats: " + JSON.stringify({"Number of games":Games.find({open:true}).count(),"Last game created":gameId,"Players":Players.find().count()}));

        return gameId;
    },

    // Closes the game if it is valid to do so
    tryCloseGame:function(gameId) {

        Games.update(
            gameId === null ?
                {open:true,$or:[{modified:{$lt:new Date().getTime() - K_HEARTBEAT*20}}, {questionCardsCount:0}, {answerCardsCount:0}]} :
                {_id:gameId},{$set:{open:false},modified:new Date().getTime()},{multi:gameId === null});
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