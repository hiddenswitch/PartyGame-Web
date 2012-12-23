/**
 * @author Benjamin S. Berman
 * Copyright 2012
 */


var THEME_URL = "http://jquerymobile.com/themeroller/?ver=1.2.0&style_id=20121211-131";

var K_DEFAULT_HAND_SIZE = 8; // default hand size
var K_HEARTBEAT = 8 * 1000; // default heartbeat length
var K_LOCAL_DISTANCE = 0.0003; // distance in lat-lon units, approximately 150 ft (?)
var K_PREFERRED_GAME_SIZE = 7; // the size of a game matchmaking prefers to make

var E_NO_MORE_CARDS = "No more cards.";
var E_GAME_OVER = "The game is over.";

var ROUNDS_SCHEMA = function() {
	return {
		gameId:"",
		round:0,
		submissions:[],
		questionId:"",
		winner:""
	}
}

var GAMES_SCHEMA = function() {
	return {
		title:"", // game title
		password:"", // game password if any
		users:[], // players in the game, stored as userId's
        connected:[], // players that have given heartbeats in the last 8 seconds
		round:-1, // round number
		questionId:0, // id of current question
		questionCards:[], // question cards
		answerCards:[], // answer cards
		submissions:[], // current submissions
		open:1, // is the game open
		ownerId:0, // owner of the game
		created: new Date(), // date created
		modified: new Date(), // date modified
        location:null // location of game
	}
}

var CARD_TYPE_QUESTION = 1; // card of type question
var CARD_TYPE_ANSWER = 2; // card of type answer

var CARD_SCHEMA = function() {
	return {
		type:CARD_TYPE_QUESTION, // question or answer card
		text:"" // text of the card
	}
}

var HAND_SCHEMA = function() {
	return {
		gameId:0,
		userId:0,
		round:0,
		hand:[]
	}
}

var VOTE_SCHEMA = function() {
	return {
		gameId:0,
		round:0,
		judgeId:0,
		userId:0,
		questionId:0,
		answerId:0
	}
}

var SUBMISSION_SCHEMA = function () {
	return {
		gameId:0,
		round:0,
		userId:0,
		answerId:0
	}
}

var CHAT_SCHEMA = function () {
	return {
		gameId:0,
		userId:0,
		dateTime:0,
		text:""
	}
}

var COLLECTIONS_CARDS = "cards";
var COLLECTIONS_GAMES = "games";
var COLLECTIONS_HANDS = "hands";
var COLLECTIONS_VOTES = "votes";
var COLLECTIONS_CHATS = "chats";
var COLLECTION_SUBMISSIONS = "submissions";

var Cards = new Meteor.Collection(COLLECTIONS_CARDS);
var Games = new Meteor.Collection(COLLECTIONS_GAMES);
var Hands = new Meteor.Collection(COLLECTIONS_HANDS);
var Votes = new Meteor.Collection(COLLECTIONS_VOTES);
var Submissions = new Meteor.Collection(COLLECTION_SUBMISSIONS);
var Chats = new Meteor.Collection(COLLECTIONS_CHATS);

// get the distance between two points
var distance = function(p1,p2) {
    return Math.sqrt(Math.pow(p1[0]-p2[0],2)+Math.pow(p1[1]-p2[1],2));
}

// Get the current judge id
var getJudgeId = function(g) {
    if (g && g.connected.length > 0) {
        return g && g.connected[g.round % g.connected.length];
    } else {
        return g && g.users[g.round % g.users.length];
    }
}

var getJudgeIdForGameId = function(id) {
    var g = Games.findOne({_id:id});
    return getJudgeId(g);
}

// Convert an id to a username, email address or facebook profile name
var userIdToName = function(id) {
	var u = Meteor.users.findOne({_id:id});
	
	if (!u)
		return "Loading user...";
	
	if (u.profile && u.profile.name)
		return u.profile.name;
	
	if (u.username)
		return u.username;
	
	if (u.emails && u.emails[0] && u.emails[0].address)
		return u.emails[0].address;
}

var submissionIdToCardId = function(id) {
	return Submissions.findOne({_id:id}).answerId;
}

var questionAndAnswerText = function(questionCardId,answerCardId) {
    var q = cardIdToText(questionCardId);
    var c = cardIdToText(answerCardId);

    if (!c || !q) {
        return "Loading card...";
    }

    var matches = [];
    var match = /(.{0,2})(__)(.+)/g;
    var isName = /^[A-Z]\w+\s+[A-Z]/;

    var beforeAndAfter = match.exec(q);

    // Handle multiple underscores
    while (beforeAndAfter) {
        // clone array into matches
        matches.push(beforeAndAfter.slice(0));
        beforeAndAfter = match.exec(q);
    }

    var replacements = _.map(matches, function (anUnderscore) {
        if (c && anUnderscore && anUnderscore[2]) {
            var before = anUnderscore[1];
            var startsWithPeriod = /[\.\?!]\s/;

            // check if the card text should be lowercase
            if (before != "" && !startsWithPeriod.exec(before) && !isName.exec(c)) {
                c = c.charAt(0).toLowerCase() + c.slice(1);
            }

            // check if the triple underscore ends with a punctuation

            var after = anUnderscore[3];

            // since there is stuff after, remove punctuation.
            if (after) {
                var punctuation = /[^\w\s]/;

                // if the card text ends in punctuation, remove any existing punctuation
                if (punctuation.exec(after))
                    c = c.slice(0,c.length-1);
            }

            return "<span style='font-style:italic;'>"+c+"</span>";
        }
    });

    if (replacements && replacements.length > 0) {
        return _.reduce(replacements,function(memo,text) {
            memo = memo.replace("__",text);
        },q);
    } else {
        return q + " " + "<span style='font-style:italic;'>"+c+"</span>";
    }

    return "Loading card...";
}

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
}

	// get a {userId, score} dictionary containing the current scores
var scores = function(gameId) {
	var scores = {};

	// compute all the scores
	Votes.find({gameId:gameId}).map(function(voteDoc) {
		if (!scores[voteDoc.userId]) {
			scores[voteDoc.userId] = 1;
		} else {
			scores[voteDoc.userId] += 1;
		}
	});
	
	var g = Games.findOne({_id:gameId});
	
	if (!g)
		return [];
	
	// Include players with scores of zero
	_.forEach(_.difference(g.users,_.keys(scores)),function(user){
		scores[user] = 0; 
	});
	
	return _.map(scores,function (value,key){
		return {userId:key,score:value,connected:_.contains(g.connected,key)};
	});
};

var createNewUserAndLogin = function(username,email,password,callback) {
	if (username && email && password) {
		Accounts.createUser({username:username,email:email,password:password},callback);
	} else {
		throw new Meteor.Error(403,"Please fill out: " + (username ? "" : " username") + (email ? "" : " email") + (password ? "" : " password")+".");
	}
}

var cardIdToText = function(cardId) {
	var c = Cards.findOne({_id:cardId});
	if (c)
		return c.text;
	else
		return "Loading card text...";
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
	// Draw hands for all players in the game.
	drawHands: function(gameId,handSize) {
		handSize = handSize || K_DEFAULT_HAND_SIZE;
		
		var game = Games.findOne({_id:gameId, open:true, users:this.userId});
		
		if (Meteor.isSimulation)
			return "";
		
		if (!game)
			throw new Meteor.Error(404,"No game to draw hands from.");
		
		// all answer cards exhausted, do not draw any more cards.
		if (!game.answerCards || game.answerCards.length < 1)
			return E_NO_MORE_CARDS;
			
		if (!game.open)
			// the game is over. only score screen will display.
			return E_GAME_OVER;
		
		// storing all the ids of drawn cards to remove from the game database entry
		var drawnCards = [];
		
		// a card drawing function
		var drawCards = function(oldHand) {
			oldHand = oldHand || [];
			var newHand = [];
			newHand = _.union(oldHand,newHand);
			
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
		Hands.find({gameId:gameId,round:game.round}).forEach(function (handDoc) {
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
		_.each(_.difference(game.users,fulfilledUsers),function(userId) {
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
		
		returns = _.without(returns,undefined);
		
		if (!returns)
			throw new Meteor.Error(500,"No cards drawn.");
		
		var unfulfilledUsers = _.difference(game.users,fulfilledUsers);
		
		if (unfulfilledUsers.length>0)
			throw new Meteor.Error(500,"Some users' hands were not fulfilled.");
		
		// update the game
		Games.update({_id:gameId},{$pullAll:{answerCards:drawnCards},$set:{modified:new Date()}});
		
		// return hands for this round and game
		return Hands.findOne({gameId:gameId,round:game.round,userId:this.userId})._id;
	},
	
	// Submit a card for voting
	submitAnswerCard: function(gameId,answerId) {
		var game = Games.findOne({_id:gameId, users:this.userId});

		if (!game)
			throw new Meteor.Error(404,"No game found to submit answer card to.");
		
		if (!game.open)
			// the game is over. only score screen will display.
			return;
		
		if (!_.contains(game.users,this.userId))
			throw new Meteor.Error(500,"You are not a player in this game: Cannot submit card.","userId: " + this.userid +", gameId: " + game._id);
		
		// if (game.users.length < 3)
			// throw new Meteor.Error(500,"Too few players to submit answer.");
			
		if (this.userId == getJudgeId(game))
			throw new Meteor.Error(500,"You canot submit a card. You're the judge!");
		
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
		var game = Games.findOne({_id:gameId, users:this.userId});
		
		if (!game)
			throw new Meteor.Error(404,"No game found to submit answer card to.");
	
		if (!game.open)
			// the game is over. only score screen will display.
			return E_GAME_OVER;

		if (!_.contains(game.users,this.userId))
			throw new Meteor.Error(500,"You are not a player in this game: Cannot judge card.","userId: " + this.userid +", gameId: " + game._id);
			
		var judgeId = getJudgeId(game);
		var judge = Meteor.users.findOne({_id:judgeId});
		
		if (!judge)
			throw new Meteor.Error(404,"Judge with id "+judgeId.toString()+" not found.")
		
		if (this.userId != judgeId)
			throw new Meteor.Error(500,"User " + judge.username + " is the judge for this round.");
		
		var submission = Submissions.findOne({_id:submissionId});
		
		if (!submission)
			throw new Meteor.Error(404,"Submission not found.");
		
		if (submission.userId == judgeId)
			throw new Meteor.Error("You cannot pick your own card as the winning card.");
		
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
		var game = Games.findOne({_id:gameId, users:this.userId});
		
		if (!game)
			throw new Meteor.Error(404,"Game not found. Cannot finish round on nonexistent game.");
		
		if (!game.open)
			// the game is over. only score screen will display.
			return gameId;
		
		if (!_.contains(game.users,this.userId) && Meteor.isClient)
			throw new Meteor.Error(500,"You are not a player in this game: Cannot finish round.","userId: " + this.userid +", gameId: " + game._id);
		
		if (Votes.find({gameId:gameId,round:game.round}).count()<1 && Meteor.isServer)
			throw new Meteor.Error(500,"The judge hasn't voted yet. Cannot finish round.");
				
		// remove the cards from the player's hands
		Submissions.find({gameId:gameId,round:game.round}).forEach(function(submission) {
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
		
		// increment round
		Games.update({_id:gameId},{$set:{open:open,questionId:questionCardId,modified:new Date()},$inc:{round:1},$pop:{questionCards:1}});
		
		// draw new cards
		Meteor.call("drawHands",gameId,K_DEFAULT_HAND_SIZE);
		
		return gameId;
	},
	
	// Kick a player
	kickPlayer: function(gameId,kickId) {
		var game = Games.findOne({_id:gameId});
		
		if (!game)
			throw new Meteor.Error(404,"No game found to kick from.");
			
		if (!_.contains(game.users,kickId))
			throw new Meteor.Error(404,"Player is not in the game.","kickId: " + kickId +", gameId: " + gameId);
		
		if (game.ownerId != this.userId)
			throw new Meteor.Error(403,"You are not the owner of this game. Cannot kick players.");
			
		if (this.userId == kickId)
			throw new Meteor.Error(403,"You cannot kick yourself from your own game.");
			
		Games.update({_id:gameId},{$pull:{users:kickId},$set:{modified:new Date()}});
		return gameId;
	},


	// Quit a game
	quitGame: function(gameId) {
		var game = Games.findOne({_id:gameId});
		
		if (!game)
			throw new Meteor.Error(404,"No game found to quit from.");
		
		var open = game.open;
		
		if (game.users.length == 1) {
			open = false;
		}
		
		var ownerId = game.ownerId;
		// If the owner is quitting his own game, assign a new player as the owner
		if (game.ownerId == this.userId && game.users.length > 1) {
			ownerId = _.difference(game.users,[this.userId])[0]
		}
		
		return Games.update({_id:gameId},{$pull: {users:this.userId}, $set:{open:open,ownerId:ownerId,modified:new Date()}});
	},
	
	// Join a game
	joinGame: function(gameId) {
		Games.update({_id:gameId},{$addToSet: {users:this.userId},$set:{modified:new Date()}});
		
		Meteor.call("drawHands",gameId,K_DEFAULT_HAND_SIZE);
		
		return gameId;
	},

	findGameWithFewPlayers: function() {
        // find the latest game with fewer than five players
		var game = Games.find({open:true, $where: "this.users.length < " + K_PREFERRED_GAME_SIZE.toString()}).fetch()[0];
		
		if (!game)
			return false;
		else
			return game._id;
	},

    findLocalGame: function(location) {
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

		var game = Games.findOne({open:true});;

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
			title = "Game #" + Games.find({}).count().toString();
		
		if (Games.find({title:title}).count() > 0)
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
			users:[], // players in the game, stored as userId's
            connected:[],
			round:0, // round number
			questionCards:shuffledQuestionCards,
			answerCards:shuffledAnswerCards,
			questionId:firstQuestionCardId,
			open:true,
			ownerId:this.userId,
			created: new Date(),
			modified: new Date(),
            location: location
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
			
		Games.update({_id:gameId},{$set:{open:false,modified:new Date()}});
		return gameId;
	},

    heartbeat: function(currentLocation) {
        if (!this.userId)
            return;
        if (this.isSimulation)
            return;

        currentLocation = currentLocation || null;

        var d = new Date();

        // update heartbeat for the given user
        Meteor.users.update({_id:this.userId},{$set:{heartbeat:d,location:currentLocation}});

        // update game connected info
        var updates = _.compact(Games.find({users:this.userId,open:true}).map(function(game){
            // for each game and each user, check the last heartbeat time
            var connectedUsers = _.compact(Meteor.users.find({_id:{$in:game.users}}).map(function(user){
                // if it has been less than 2*K_HEARTBEAT seconds since the last heartbeat, the user should be in the connected table
                if (d-user.heartbeat<2*K_HEARTBEAT)
                    return user._id;
                else
                    return undefined;
            }));
            console.log("Game " + game._id + " connected users: " + JSON.stringify(connectedUsers));
            if (_.difference(connectedUsers,game.connected).length + _.difference(game.connected,connectedUsers).length > 0) {
                return [{_id:game._id},{$set:{connected:connectedUsers}}];
            } else {
                return undefined;
            }
        }));

        _.each(updates,function(args){
            Games.update(args[0],args[1]);
        });

        return d;
    }
})
