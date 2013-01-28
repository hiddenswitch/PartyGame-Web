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
    this.title = ""; // game title
    this.password = ""; // game password if any
    this.round = -1; // round number
    this.questionId = 0; // id of current question
    this.questionCards = []; // question cards
    this.answerCards = []; // answer cards
    this.open = 1; // is the game open
    this.ownerId = 0; // owner of the game
    this.judge = ""; // current judge
    this.created =  new Date().getTime(); // date created
    this.modified =  new Date().getTime(); // date modified
    this.location = null; // location of game
    this.players = 0; // number of players
};

var CARD_TYPE_QUESTION = 1; // card of type question
var CARD_TYPE_ANSWER = 2; // card of type answer

var Card = function() {
	this.type = CARD_TYPE_QUESTION;  // question or answer card
    this.deck = ""; // The name of the deck
	this.text = ""; // text of the card
};

var Hand = function() {
	this.gameId = 0; 
	this.userId = 0; 
	this.round = 0; 
	this.hand = [];
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
    this.firstRound = 0;
    this.created = new Date().getTime();
    this.connected = false;
    this.judge = false;
    this.location = "";
}

var Chat = function () {
	this.gameId = 0; 
	this.userId = 0; 
	this.dateTime = 0; 
	this.text = "";
};

var COLLECTIONS_CARDS = "cards";
var COLLECTIONS_GAMES = "games";
var COLLECTIONS_HANDS = "hands";
var COLLECTIONS_VOTES = "votes";
var COLLECTIONS_CHATS = "chats";
var COLLECTION_SUBMISSIONS = "submissions";
var COLLECTION_PLAYERS = "players";

var Cards = new Meteor.Collection(COLLECTIONS_CARDS);
var Games = new Meteor.Collection(COLLECTIONS_GAMES);
var Hands = new Meteor.Collection(COLLECTIONS_HANDS);
var Votes = new Meteor.Collection(COLLECTIONS_VOTES);
var Submissions = new Meteor.Collection(COLLECTION_SUBMISSIONS);
var Players = new Meteor.Collection(COLLECTION_PLAYERS);
var Chats = new Meteor.Collection(COLLECTIONS_CHATS);

// get the distance between two points
var distance = function(p1,p2) {
    return Math.sqrt(Math.pow(p1[0]-p2[0],2)+Math.pow(p1[1]-p2[1],2));
};

// TODO Make the current judge stable even when the connected user changes.
// Get the current judge id
var getJudgeId = function(g) {
    if (g && g.judge)
        return g.judge;
};

var getJudgeIdForGameId = function(id) {
    var g = Games.findOne({_id:id});
    if (g && g.judge)
        return g.judge;
};

// Match into an existing game, or create a new one to join into
var match = function(location,gameJoinedCallback) {
	Meteor.call("findLocalGame",location,function(e,r) {
		if (r)
			Meteor.call("joinGame",r,gameJoinedCallback);
		else
			Meteor.call("findGameWithFewPlayers",function(e,r){
				if (r)
					Meteor.call("joinGame",r,gameJoinedCallback);
				else
					Meteor.call("createEmptyGame","","",location,function (e,r){
						if (r)
							Meteor.call("joinGame",r,gameJoinedCallback);
						else
							console.log(e);
					});
			});
	});
};

	// get a {userId, score} dictionary containing the current scores
var scores = function(gameId) {
	var scores = {};

    // get all the players
    Players.find({gameId:gameId}).forEach(function (p) {
        scores[p.userId] = {score:0,connected:p.connected};
    });

    // compute all the scores
	Votes.find({gameId:gameId}).forEach(function(voteDoc) {
	    scores[voteDoc.userId].score += 1;
	});

	return _.map(scores,function (value,key){
		return {userId:key,score:value.score,connected:value.connected};
	});
};

var createNewUserAndLogin = function(username,email,password,callback) {
	if (username && email && password) {
		Accounts.createUser({username:username,email:email,password:password},callback);
	} else {
		throw new Meteor.Error(403,"Please fill out: " + (username ? "" : " username") + (email ? "" : " email") + (password ? "" : " password")+".");
	}
};

var createNewAnonymousUser = function(nickname,callback) {
    var userIdPadding = Math.random().toString(36).slice(-8);
    var password = Math.random().toString(36).slice(-8);
    nickname = nickname || "REDACTED (" + userIdPadding + ")";
    Accounts.createUser({username:"Anonymous " + userIdPadding, password:password, profile:{name:nickname}},callback)
};


// Gets the current judge
// Use the user's number of times voted to fairly pick the next judge
// Use the user's index in the game.users array to pick the user who connected earliest
// Ensures that the selected judge is stable when users join, and automatically chooses a new judge when a user
// connects or disconnects.
var currentJudge = function(gameId) {
    // Get a list of all the players and whether or not they've judged and if they're connected
    var votes = Votes.find({gameId:gameId}).fetch();

    // Get all the players and sort by the time they joined
    var players = Players.find({gameId:gameId,connected:true}).fetch().superSort("created");

    var judges = {};

    // Initialize the judge calculation with the players. Votes is initialized with the first round the player played,
    // i.e., when they joined, in order to make the judging more fair and better emulating sitting around a table.
    for (var i = 0; i < players.length; i++) {
        judges[players[i].userId] = {userId:players[i].userId, userIndex:i,votes:players[i].firstRound};
    }

    // Count the number of times this user has voted
    _.each(votes,function(vote){
        judges[vote.judgeId].votes++;
    });

    // Find the player who has voted the greatest number of times, and use this as the starting vote for players
    // who have votes more than one time fewer (i.e., who have joined the game late).
    var maxVotes = _.max(judges,function(judge) {return judge.votes;}).votes;

    // Get the array of candidate judges
    var candidates = _.values(judges);

    // Filter out disconnected candidates.
    // Then, sort first by votes ascending, then by userIndex ascending. In other words, the player who has voted
    // the least and connected the earliest will be the next judge.
    candidates = candidates.superSort("votes","userIndex");

    return candidates[0].userId;
};

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
	// Draw hands for all players in the game.
	drawHands: function(gameId,handSize) {
        if (Meteor.isSimulation)
            return "";

		handSize = handSize || K_DEFAULT_HAND_SIZE;
		
		var game = Games.findOne({_id:gameId, open:true});

		if (!game)
			throw new Meteor.Error(404,"No game to draw hands from.");

        if (Players.find({gameId:gameId,userId:this.userId}).count() === 0)
            throw new Meteor.Error(403,"You are not in this game.");

        if (!_.has(game,"answerCards"))
            throw new Meteor.Error(500,"Why are there no answer cards?");
		
		// all answer cards exhausted, do not draw any more cards.
		if (game.answerCards.length < 1)
			throw new Meteor.Error(403,"The game is over.");
			
		if (!game.open)
			// the game is over. only score screen will display.
			throw new Meteor.Error(403,"This game is closed.");

        var users = _.pluck(Players.find({gameId:gameId}).fetch(),'userId');

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
		
		// all the hands associated with this game and the game's current round.
		var returns = [];
		// a list of users who have full hands.
		var fulfilledUsers = [];
		
		// update any existing hands
        _.each(Hands.find({gameId:gameId,round:game.round}).fetch(),function (handDoc) {
			// fill out the hand
			if (handDoc.hand.length < handSize) {
				Hands.update({_id:handDoc._id,hand:drawCards(handDoc.hand)});
			}
			
			// add the hand to the hands associated with this game
			returns.push(handDoc._id);
			// add this user to the fulfilled users
			fulfilledUsers.push(handDoc.userId);
		});
		
		var newlyFulfilledUsers = [];
		
		// insert new hands
		_.each(_.difference(users,fulfilledUsers),function(userId) {
			var oldHand = [];
			
			if (game.round > 0) {
				// get the old hand
				var oldHandDoc = Hands.findOne({gameId:gameId,round:game.round-1,userId:userId});
				if (oldHandDoc)
					oldHand = _.union(oldHand,oldHandDoc.hand);
			}
			
			// add the new hand
			returns.push(
				Hands.insert({gameId:gameId,round:game.round,userId:userId,hand:drawCards(oldHand)})
			);
			
			// this user is now fulfilled
			newlyFulfilledUsers.push(userId);
		});
		
		fulfilledUsers = _.union(fulfilledUsers,newlyFulfilledUsers);
		
		returns = _.compact(returns);
		
		if (!returns)
			throw new Meteor.Error(500,"No cards drawn.");

		
		// update the game
		Games.update({_id:gameId},{$pullAll:{answerCards:drawnCards},$set:{modified:new Date().getTime()}});

		// return calling user's hand for this round and game
		return Hands.findOne({gameId:gameId,round:game.round,userId:this.userId})._id;
	},
	
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
			
		if (this.userId == getJudgeId(game))
			throw new Meteor.Error(500,"You cannot submit a card. You're the judge!");

        // does this player have this card in his hand?
        var hand = Hands.find({userId:this.userId,gameId:gameId,round:game.round,hand:answerId}).count();

        if (!hand)
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
			
		var judgeId = getJudgeId(game);
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
        if (Meteor.isSimulation)
            return gameId;

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
        Submissions.find({gameId:gameId,round:game.round}).forEach(function(submission) {
            if (!submission.answerId || submission.answerId == "")
                throw new Meteor.Error(500,"Somebody submitted a redacted answer. Try again!");

            // does this player have this card in his hand?
            var hand = Hands.find({userId:submission.userId,gameId:gameId,round:game.round,hand:submission.answerId}).count();

            if (!hand)
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
        var nextJudge = currentJudge(game._id);
		
		// increment round
		Games.update({_id:gameId},{$set:{open:open,questionId:questionCardId,modified:new Date().getTime(),judge:nextJudge},$inc:{round:1},$pop:{questionCards:1}});
		
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
		Games.update({_id:gameId},{$inc: {players:-1}, $set:{modified:new Date().getTime()}});
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
		
		return Games.update({_id:gameId},{$inc: {players:-1}, $set:{open:open,ownerId:ownerId,modified:new Date().getTime()}});
	},
	
	// Join a game
	joinGame: function(gameId) {
        var g = Games.findOne({_id:gameId});

        if (!g)
            throw new Meteor.Error(404,"Cannot join nonexistent game.");

        if (!g.open)
            throw new Meteor.Error(403,"The game is closed, cannot join.");

        // If this user is already in the game, update the connected status and return.
        if (Players.find({gameId:gameId,userId:this.userId}).count() > 0) {
            Players.update({gameId:gameId,userId:this.userId},{$set:{connected:true}});
            return gameId;
        }

        // Otherwise, join the game by adding to the players list, updating the heartbeat, and incrementing the players
        // count.
        var p = new Player();

        p.userId = this.userId;
        p.gameId = gameId;
        p.firstRound = g.round;
        p.created = new Date().getTime();
        p.connected = true;

        Players.insert(p);

		Games.update({_id:gameId},{$inc: {players:1},$set:{modified:new Date().getTime()}});

        Meteor.users.update({_id:this.userId},{$set:{heartbeat:new Date().getTime()}});
		
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
	createEmptyGame: function(title,password,location) {
        console.log("Creating " + JSON.stringify([title,password,location]));
		password = password || "";
		location = location || null;

		if (title=="")
			title = "Game #" + Games.find({}).count().toString() + 1;
		
		if (Games.find({title:title,open:true}).count() > 0)
			throw new Meteor.Error(500,"A game by that name already exists!");
		
		var shuffledAnswerCards = _.shuffle(_.pluck(Cards.find({type:CARD_TYPE_ANSWER},{fields:{_id:1}}).fetch(),'_id'));
		
		if (!shuffledAnswerCards)
			throw new Meteor.Error(404,"No answer cards found.");
			
		var shuffledQuestionCards = _.shuffle(_.pluck(Cards.find({type:CARD_TYPE_QUESTION},{fields:{_id:1}}).fetch(),'_id'));
		
		if (!shuffledQuestionCards)
			throw new Meteor.Error(404,"No question cards found.");
		
		var firstQuestionCardId = shuffledQuestionCards.pop();

		return Games.insert({
			title:title, // game title
			password:password, // game password if any
            players:0, // number of players in the game
			round:0, // round number
			questionCards:shuffledQuestionCards,
			answerCards:shuffledAnswerCards,
			questionId:firstQuestionCardId,
			open:true,
			ownerId:this.userId,
			created: new Date().getTime(),
			modified: new Date().getTime(),
            judge:this.userId,
            location: location
		});
	},

    updateJudge: function(gameId) {
        Games.update({_id:gameId},{$set:{judge:currentJudge(gameId)}});
    },

    updateJudges: function(userId) {
        userId = userId || this.userId;
        _.each(Players.find({userId:userId}).fetch(),function(player){
            var gameId = player.gameId;
            var newJudge = currentJudge(gameId);
            Games.update({gameId:gameId},{$set:{judge:newJudge}});
        });
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
