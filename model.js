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
var K_HEARTBEAT = 8 * 1000; // default heartbeat length
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
	this.gameId = 0; 
	this.userId = 0; 
	this.round = 0; // round number of this hand
	this.hand = []; // Array of card Ids
};

var Vote = function() {
	this.gameId = 0; 
	this.round = 0; 
	this.judgeId = 0; 
	this.userId = 0; 
	this.questionId = 0; 
	this.answerId = 0;
};

var Submission = function () {
	this.gameId = 0; 
	this.round = 0; 
	this.userId = 0; 
	this.answerId = 0;
};

var Player = function () {
    this.userId = "";
    this.name = "";
    this.gameId = "";
    this.voted = new Date().getTime();
    this.connected = false;
    this.location = "";
}

var Chat = function () {
	this.gameId = 0; 
	this.userId = 0; 
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
	submitAnswerCard: function(gameId, answerId) {
		var game = Games.findOne({_id:gameId});

		if (!game)
			throw new Meteor.Error(404,"No game found to submit answer card to.");
		
		if (!game.open)
			// the game is over. only score screen will display.
			return;
		
		if (Players.find({gameId:gameId,userId:this.userId}).count() === 0)
			throw new Meteor.Error(500,"You are not a player in this game: Cannot submit card.","userId: " + this.userid +", gameId: " + game._id);
		
		if (Players.find({gameId:gameId}).count() < 2)
			throw new Meteor.Error(500,"Too few players to submit answer.");
			
		if (this.userId === game.judgeId)
			throw new Meteor.Error(500,"You cannot submit a card. You're the judge!");

        // does this player have this card in his hand?
        var hand = Hands.find({userId:this.userId,gameId:gameId,round:game.round,hand:answerId}).count();

        if (!hand && !this.isSimulation)
            throw new Meteor.Error(500,"You can't submit a card you don't have!");

		var submission = Submissions.findOne({gameId:gameId,userId:this.userId,round:game.round});
		
		if (submission) {
			Submissions.update({_id:submission._id},{$set:{answerId:answerId}});
			return submission._id;
		} else {
			return Submissions.insert({
				gameId:gameId,
				round:game.round,
				userId:this.userId,
				answerId:answerId
			});
		}
	},
	
	
	// Pick a winner
	pickWinner: function(gameId,submissionId) {
		var game = Games.findOne({_id:gameId});
		
		if (!game)
			throw new Meteor.Error(404,"No game found to submit answer card to.");
	
		if (!game.open)
			// the game is over. only score screen will display.
			return E_GAME_OVER;

		if (Players.find({gameId:gameId,userId:this.userId}).count() === 0)
			throw new Meteor.Error(500,"You are not a player in this game: Cannot judge card.","userId: " + this.userid +", gameId: " + game._id);
			
		var judgeId = game.judgeId;
		var judge = Meteor.users.findOne({_id:judgeId});
		
		if (!judge)
			throw new Meteor.Error(404,"Judge with id "+judgeId.toString()+" not found.")
		
		if (this.userId != judgeId)
			throw new Meteor.Error(500,"It's not your turn to judge!");
		
		var submission = Submissions.findOne({_id:submissionId});
		var submissionCount = Submissions.find({gameId:gameId,round:game.round}).count();
        var connectedCount = Players.find({gameId:gameId,connected:true}).count();

        if (submissionCount < connectedCount-1)
            throw new Meteor.Error(500,"Wait until everyone connected has submitted a card!");

		if (!submission)
			throw new Meteor.Error(404,"Submission not found.");
		
		if (submission.userId == judgeId) {
            Submissions.remove({_id:submission._id});
            throw new Meteor.Error(500,"You cannot pick your own card as the winning card.");
        }

        if (!submission.answerId || (submission.answerId == ""))
            throw new Meteor.Error(500,"You can't pick a hidden answer! Wait until everyone has put in a card.")

		var winner = Votes.findOne({gameId:gameId,round:game.round});

        // Mark that this user just voted
        Players.update({gameId:gameId,userId:judgeId},{$set:{voted:new Date().getTime()}});

		if (winner) {
			Votes.update({_id:winner._id},{$set:{userId:submission.userId,questionId:game.questionId,answerId:submission.answerId}});
			return winner._id;
		} else {
			return Votes.insert({gameId:gameId,round:game.round,judgeId:judgeId,userId:submission.userId,questionId:game.questionId,answerId:submission.answerId})
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

		if (Players.find({gameId:gameId,userId:this.userId}).count() === 0)
			throw new Meteor.Error(500,"You are not a player in this game: Cannot finish round.","userId: " + this.userid +", gameId: " + game._id);
		
		if (Votes.find({gameId:gameId,round:game.round}).count() < 1 && Meteor.isServer)
			throw new Meteor.Error(500,"The judge hasn't voted yet. Cannot finish round.");
				
		// remove the cards from the player's hands
        _.each(Submissions.find({gameId:gameId,round:game.round}).fetch(),function(submission) {
            if (!submission.answerId || submission.answerId == "")
                throw new Meteor.Error(500,"Somebody submitted a redacted answer. Try again!");

            // does this player have this card in his hand?
            var hand = Hands.find({userId:submission.userId,gameId:gameId,round:game.round,
                hand:submission.answerId}).count();

            if (hand === 0)
                throw new Meteor.Error(500,"You can't submit a card you don't have!");

			Hands.update({gameId:gameId,round:game.round,userId:submission.userId},{$pull:{hand:submission.answerId}});
		});
		
		// put in a new question card
		var questionCardId = null;
		var open = true;
		
		if (game.questionCards && game.questionCards.length > 0) {
			questionCardId = game.questionCards.pop();
		} else {
			open = false;
		}

        // The vote has been submitted, so get the next judge. Does not depend on round, only on votes.
        var nextJudge = Meteor.call("currentJudge",game._id);
		
		// increment round
		Games.update({_id:gameId},{$set:{open:open,questionId:questionCardId,modified:new Date().getTime(),judgeId:nextJudge},$inc:{round:1},$pop:{questionCards:1}});
		
		// draw new cards
		Meteor.call("drawHands",gameId,K_DEFAULT_HAND_SIZE);
		
		return gameId;
	},
	
	// Kick a player
	kickPlayer: function(gameId,kickId) {
		var game = Games.findOne({_id:gameId});
		
		if (!game)
			throw new Meteor.Error(404,"No game found to kick from.");
			
		if (Players.find({gameId:gameId,userId:kickId}).count() === 0)
			throw new Meteor.Error(404,"Player is not in the game.","kickId: " + kickId +", gameId: " + gameId);
		
		if (game.ownerId !== this.userId)
			throw new Meteor.Error(403,"You are not the owner of this game. Cannot kick players.");
			
		if (this.userId === kickId)
			throw new Meteor.Error(403,"You cannot kick yourself from your own game.");

        Players.remove({gameId:gameId,userId:kickId});
		Games.update({_id:gameId},{$inc: {players:-1}, $pullAll:{userIds:kickId}, $set:{modified:new Date().getTime()}});
		return gameId;
	},


	// Quit a game
	quitGame: function(gameId) {
		var game = Games.findOne({_id:gameId});
		
		if (!game)
			throw new Meteor.Error(404,"No game found to quit from.");
		
		var open = game.open;
		
		if (Players.find({gameId:gameId}).count() === 1) {
			open = false;
		}
		
		var ownerId = game.ownerId;
		// If the owner is quitting his own game, assign a new player as the owner
		if (game.ownerId === this.userId && game.players > 1) {
			ownerId = Players.findOne({gameId:gameId,userId:{$ne:game.ownerId}}).userId;
		}
		
		return Games.update({_id:gameId},{$inc: {players:-1}, $pullAll:{userIds:this.userId}, $set:{open:open,ownerId:ownerId,modified:new Date().getTime()}});
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
            return players[0].userId;
        } else {
            return "";
        }
    },
	
	// Close the game
	closeGame: function(gameId) {
		var game = Games.findOne({_id:gameId});
		
		if (!game)
			throw new Meteor.Error(404,"Cannot find game to end.");
		
		if (game.ownerId != this.userId)
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
