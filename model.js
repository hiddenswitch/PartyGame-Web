/**
 * @author Benjamin S. Berman
 * Copyright 2012
 */


// Adapted from http://stackoverflow.com/a/11379791/1757994
Array.prototype.superSort = function() {
    function dynamicSort(property) {
        return function (obj1,obj2) {
            return obj1[property] > obj2[property] ? 1
                : obj1[property] < obj2[property] ? -1 : 0;
        }
    }

    var props = arguments;

    return this.sort(function (obj1, obj2) {
        var i = 0, result = 0, numberOfProperties = props.length;
        /* try getting a different result from 0 (equal)
         * as long as we have extra properties to compare
         */
        while(result === 0 && i < numberOfProperties) {
            result = dynamicSort(props[i])(obj1, obj2);
            i++;
        }
        return result;
    });
};


var THEME_URL = "http://jquerymobile.com/themeroller/?ver=1.2.0&style_id=20121211-131";

var K_DEFAULT_HAND_SIZE = 8; // default hand size
var K_HEARTBEAT = 30 * 1000; // default heartbeat length
var K_LOCAL_DISTANCE = 0.0003; // distance in lat-lon units, approximately 150 ft (?)
var K_PREFERRED_GAME_SIZE = 7; // the size of a game matchmaking prefers to make

var E_NO_MORE_CARDS = "No more cards.";
var E_GAME_OVER = "The game is over.";

var Game = function() {
    this.title = ""; // game title.
    this.password = ""; // game password if any.
    this.round = -1; // round number.
    this.questionId = 0; // id of current question.
    this.questionCards = []; // question cards.
    this.answerCards = []; // answer cards.
    this.open = 1; // is the game open.
    this.ownerId = 0; // owner of the game.
    this.judgeId = ""; // current judge.
    this.created =  new Date().getTime(); // date created.
    this.modified =  new Date().getTime(); // date modified.
    this.location = null; // location of game.
    this.players = 0; // number of players.
    this.userIds = []; // user Ids of players (to identify games you're in).
    this.deckIds = []; // List of decks used in this game.
};

var CARD_TYPE_QUESTION = 1; // card of type question
var CARD_TYPE_ANSWER = 2; // card of type answer

var Card = function() {
	this.type = CARD_TYPE_QUESTION;  // question or answer card
    this.deckId = ""; // The id of the deck
	this.text = ""; // text of the card
};

var Deck = function() {
    this.title = "";
    this.ownerId = "";
    this.description = "";
    this.price = 0;
    this.storeData = {};
}

var Hand = function() {
	this.gameId = null;
	this.playerId = 0;
    this.userId = null;
	this.round = 0; // round number of this hand
	this.hand = []; // Array of card Ids
};

var Vote = function() {
	this.gameId = 0; 
	this.round = 0; 
	this.judgeId = 0; 
	this.playerId = 0;
	this.questionId = 0; 
	this.answerId = 0;
};

var Submission = function () {
	this.gameId = 0; 
	this.round = 0; 
	this.playerId = 0;
	this.answerId = 0;
};

var Player = function () {
    this.playerId = null;
    this.name = "";
    this.gameId = null;
    this.userId = null;
    this.voted = new Date().getTime();
    this.connected = false;
    this.location = "";
}

var Chat = function () {
	this.gameId = 0; 
	this.playerId = 0;
	this.dateTime = 0; 
	this.text = "";
};

var Decks = new Meteor.Collection("decks");
var Cards = new Meteor.Collection("cards");
var Games = new Meteor.Collection("games");
var Hands = new Meteor.Collection("hands");
var Votes = new Meteor.Collection("votes");
var Submissions = new Meteor.Collection("submissions");
var Players = new Meteor.Collection("players");
var Chats = new Meteor.Collection("chats");


var getPlayerId = function(gameId,userId) {
    if (!gameId || !userId)
        return null;

    var p = Players.find({gameId:gameId,userId:userId},{reactive:false}).fetch();

    if (p && p[0]) {
        return p[0]._id;
    } else {
        return null;
//        throw new Meteor.Error(404,"Player not found for given userId " + userId.toString() + " and gameId " + gameId.toString());
    }
}

var isBot = function(playerId) {

}

/*
 * Game flow:
 * 
 * 1. Match
 * 2. Draw cards
 * 3. Submit answer cards
 * 4. Pick winner
 * 5. Commit votes
 * 6. Increment round counter
 * 7. Go back to #2
 * 
 */

Meteor.methods({
	// Submit a card for voting
	submitAnswerCard: function(gameId, answerId, playerId, _userId) {
        if (!this.userId && !_userId) {
            throw new Meteor.Error(500,"When server calls" + arguments.callee.name + ", you must impersonate a user.");
        } else if (this.userId && _userId) {
            _userId = this.userId
        }

		var game = Games.findOne({_id:gameId});

		if (!game)
			throw new Meteor.Error(404,"No game found to submit answer card to.");
		
		if (!game.open)
			// the game is over. only score screen will display.
			return;

        var playerId = playerId || getPlayerId(gameId,_userId);

		if (Players.find({gameId:gameId}).count() < 2)
			throw new Meteor.Error(500,"Too few players to submit answer.");
			
		if (EJSON.equals(playerId,game.judgeId))
			throw new Meteor.Error(500,"You cannot submit a card. You're the judge!");

        // does this player have this card in his hand?
        var hand = Hands.find({playerId:playerId,gameId:gameId,round:game.round,hand:answerId}).count();

        if (!hand && !this.isSimulation)
            throw new Meteor.Error(500,"You can't submit a card you don't have!");

		var submission = Submissions.findOne({gameId:gameId,playerId:playerId,round:game.round});
		
		if (submission) {
			Submissions.update({_id:submission._id},{$set:{answerId:answerId}});
			return submission._id;
		} else {
			return Submissions.insert({
				gameId:gameId,
				round:game.round,
				playerId:playerId,
				answerId:answerId
			});
		}
	},
	
	
	// Pick a winner
	pickWinner: function(gameId,submissionId,_userId) {
        if (!this.userId && !_userId) {
            throw new Meteor.Error(500,"When server calls" + arguments.callee.name + ", you must impersonate a user.");
        } else if (this.userId && _userId) {
            _userId = this.userId
        }

		var game = Games.findOne({_id:gameId});
		
		if (!game)
			throw new Meteor.Error(404,"No game found to submit answer card to.");
	
		if (!game.open)
			// the game is over. only score screen will display.
			return E_GAME_OVER;

        var playerId = getPlayerId(gameId,_userId);

		var judgeId = game.judgeId;
		var judge = Players.findOne({_id:judgeId});
		
		if (!judge)
			throw new Meteor.Error(404,"Judge with id "+judgeId.toString()+" not found.")
		
		if (playerId != judgeId)
			throw new Meteor.Error(500,"It's not your turn to judge!");
		
		var submission = Submissions.findOne({_id:submissionId});
		var submissionCount = Submissions.find({gameId:gameId,round:game.round}).count();
        var connectedCount = Players.find({gameId:gameId,connected:true}).count();

        if (submissionCount < connectedCount-1)
            throw new Meteor.Error(500,"Wait until everyone connected has submitted a card!");

		if (!submission)
			throw new Meteor.Error(404,"Submission not found.");
		
		if (EJSON.equals(submission.playerId,judgeId)) {
            Submissions.remove({_id:submission._id});
            throw new Meteor.Error(500,"You cannot pick your own card as the winning card.");
        }

        if (!submission.answerId || (EJSON.equals(submission.answerId,"")))
            throw new Meteor.Error(500,"You can't pick a hidden answer! Wait until everyone has put in a card.");

		var winner = Votes.findOne({gameId:gameId,round:game.round});

        // Mark that this user just voted
        Players.update({_id:playerId},{$set:{voted:new Date().getTime()}});

		if (winner) {
			Votes.update({_id:winner._id},{$set:{playerId:submission.playerId,questionId:game.questionId,answerId:submission.answerId}});
			return winner._id;
		} else {
			return Votes.insert({gameId:gameId,round:game.round,judgeId:judgeId,playerId:submission.playerId,questionId:game.questionId,answerId:submission.answerId})
		}
	},

	// Remove submitted hands from the committed round and increment the round number.
	// Close the game if there are no more question cards left.
	finishRound: function(gameId) {
		var game = Games.findOne({_id:gameId});

		if (!game)
			throw new Meteor.Error(404,"Game not found. Cannot finish round on nonexistent game.");
		
		if (!game.open)
			// the game is over. only score screen will display.
			return gameId;

		if (Votes.find({gameId:gameId,round:game.round}).count() < 1 && Meteor.isServer)
			throw new Meteor.Error(500,"The judge hasn't voted yet. Cannot finish round.");

        if (Submissions.find({gameId:gameId,round:game.round}).count() < Players.find({gameId:gameId,connected:true}).count()-1) {
            throw new Meteor.Error(500,"Not enough players have submitted cards in order to finish a round.");
        }

		// remove the cards from the player's hands
        _.each(Submissions.find({gameId:gameId,round:game.round}).fetch(),function(submission) {
            if (!submission.answerId || EJSON.equals(submission.answerId,""))
                throw new Meteor.Error(500,"Somebody submitted a redacted answer. Try again!");

            // does this player have this card in his hand?
            var hand = Hands.find({playerId:submission.playerId,gameId:gameId,round:game.round,
                hand:submission.answerId}).count();

            if (hand === 0)
                throw new Meteor.Error(500,"You can't submit a card you don't have!");

			Hands.update({gameId:gameId,round:game.round,playerId:submission.playerId},{$pull:{hand:submission.answerId}});
		});
		
		// put in a new question card

		
		if (game.questionCards && game.questionCards.length > 0) {
            var questionCardId = game.questionCards.pop();

            var nextJudge = Meteor.call("currentJudge",game._id);

            // increment round
            Games.update({_id:gameId},{$set:{questionId:questionCardId,modified:new Date().getTime(),judgeId:nextJudge},$inc:{round:1},$pop:{questionCards:1}});

            // draw new cards
            Meteor.call("drawHands",gameId,K_DEFAULT_HAND_SIZE);
		} else {
            Games.update({_id:gameId},{$set:{open:false}})
		}

		return gameId;
	},
	
	// Kick a player
	kickPlayer: function(gameId,kickId,_userId) {
        if (!this.userId && !_userId) {
            throw new Meteor.Error(500,"When server calls" + arguments.callee.name + ", you must impersonate a user.");
        } else if (this.userId && _userId) {
            _userId = this.userId
        }

		var game = Games.findOne({_id:gameId});
		
		if (!game)
			throw new Meteor.Error(404,"No game found to kick from.");

        var kickId = getPlayerId(gameId,kickId);
        var playerId = getPlayerId(gameId,_userId);

        var userIdOfKickedPlayer = Players.findOne({_id:kickId}).userId;

		if (!EJSON.equals(game.ownerId,playerId))
			throw new Meteor.Error(403,"You are not the owner of this game. Cannot kick players.");
			
		if (EJSON.equals(playerId,kickId))
			throw new Meteor.Error(403,"You cannot kick yourself from your own game.");

        Players.remove({_id:kickId});
		Games.update({_id:gameId},{$inc: {players:-1}, $pullAll:{userIds:userIdOfKickedPlayer}, $set:{modified:new Date().getTime()}});
		return gameId;
	},


	// Quit a game
	quitGame: function(gameId,_userId) {
        if (!this.userId && !_userId) {
            throw new Meteor.Error(500,"When server calls" + arguments.callee.name + ", you must impersonate a user.");
        } else if (this.userId && _userId) {
            _userId = this.userId
        }

		var game = Games.findOne({_id:gameId});
		
		if (!game)
			throw new Meteor.Error(404,"No game found to quit from.");
		
		var open = game.open;
		
		if (Players.find({gameId:gameId}).count() === 1) {
			open = false;
		}
		
		var ownerId = game.ownerId;

        var playerId = getPlayerId(gameId,_userId);

		// If the owner is quitting his own game, assign a new player as the owner
		if (EJSON.equals(game.ownerId,_userId) && game.players > 1) {
			ownerId = Players.findOne({gameId:gameId,_id:{$ne:game.ownerId}})._id;
		}
		
		return Games.update({_id:gameId},{$inc: {players:-1}, $pullAll:{userIds:_userId}, $set:{open:open,ownerId:ownerId,modified:new Date().getTime()}});
	},

    // Gets the current judge
    // Use the user's number of times voted to fairly pick the next judge
    // Use the user's index in the game.users array to pick the user who connected earliest
    // Ensures that the selected judge is stable when users join, and automatically chooses a new judge when a user
    // connects or disconnects.
    currentJudge: function(gameId) {
        var players = Players.find({gameId:gameId,connected:true}).fetch();

        if (players && players.length > 0) {
            players = players.superSort("voted");
            return players[0]._id;
        } else {
            return null;
        }
    },
	
	// Close the game
	closeGame: function(gameId,_userId) {
        if (!this.userId && !_userId) {
            throw new Meteor.Error(500,"When server calls" + arguments.callee.name + ", you must impersonate a user.");
        } else if (this.userId && _userId) {
            _userId = this.userId
        }

		var game = Games.findOne({_id:gameId});
		
		if (!game)
			throw new Meteor.Error(404,"Cannot find game to end.");

        var playerId = getPlayerId(gameId,_userId);

		if (!EJSON.equals(game.ownerId,playerId))
			throw new Meteor.Error(403,"You aren't the owner of the game. You can't close it.");
		
		if (!game.open)
			throw new Meteor.Error(500,"This game is already closed.");
			
		Games.update({_id:gameId},{$set:{open:false,modified:new Date().getTime()}});
		return gameId;
	},

    heartbeat: function(currentLocation) {
        if (!this.userId)
            return;

        currentLocation = currentLocation || null;

        var d = new Date().getTime();

        // update heartbeat for the given user
        Players.update({userId:this.userId,connected:false},{$set:{connected:true,location:currentLocation}},{multi:true});
        Meteor.users.update({_id:this.userId},{$set:{'profile.heartbeat':new Date().getTime()}});

        return d;
    }
});
