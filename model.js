/**
 * @author Benjamin S. Berman
 * Copyright 2012
 */

// Old theme URL
THEME_URL = "http://jquerymobile.com/themeroller/?ver=1.2.0&style_id=20121211-131";

// Card type enum
CARD_TYPE_QUESTION = 1; // card of type question
CARD_TYPE_ANSWER = 2; // card of type answer
CARD_TYPE_ADJECTIVE = 10;
CARD_TYPE_NOUN = 20;

// Error messages.
E_NO_MORE_CARDS = "No more cards.";
E_GAME_OVER = "The game is over.";

var Game = function() {
    this.title = ""; // game title.
    this.password = ""; // game password if any.
    this.round = -1; // round number.
    this.questionId = 0; // id of current question.
    this.questionCardsCount = 0; // number of question cards
    this.questionCards = []; // question cards.
    this.answerCardsCount = 0; // number of answer cards
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




getPlayerId = function(gameId,userId) {
    if (!gameId || !userId)
        return null;

    var p = Players.find({gameId:gameId,userId:userId},{reactive:false}).fetch();

    if (p && p[0]) {
        return p[0]._id;
    } else {
        return null;
    }
}

cardIdToText = function(cardId) {
    var c = Cards.findOne({_id:cardId});
    if (c)
        return c.text;
    else
        return "(Waiting for players to submit...)";
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
	// Submit a card for voting
	submitAnswerCard: function(gameId, answerId, playerId, _userId) {
        if (!this.userId && !_userId) {
            throw new Meteor.Error(500,"When server calls" + " submitAnswerCard"+ ", you must impersonate a user. userId: "
                + (this.userId ? this.userId.toString() : "none") + ", _userId: " + (_userId ? _userId.toString() : "none"));
        } else if (this.userId) {
            _userId = this.userId;
        }

		var game = Games.findOne({_id:gameId});

		if (!game)
			throw new Meteor.Error(404,"No game found to submit answer card to.");
		
		if (!game.open)
			// the game is over. only score screen will display.
			return;

        playerId = playerId || getPlayerId(gameId,_userId);

		if (Players.find({gameId:gameId}).count() < 2)
			throw new Meteor.Error(500,"Too few players to submit answer.");
			
		if (EJSON.equals(playerId,game.judgeId))
			throw new Meteor.Error(500,"You cannot submit a card. You're the judge!");

        // does this player have this card in his hand?
        var hasInHand = Hands.find({playerId:playerId,gameId:gameId,cardId:answerId}).count();

        if (!hasInHand) {
            var details = {hand:Hands.find({playerId:playerId,gameId:gameId}).fetch(),answerId:answerId,hasInHand:hasInHand};
            throw new Meteor.Error(501,"You can't submit a card you don't have! " + JSON.stringify(details));
        }

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
            throw new Meteor.Error(500,"When server calls" + " pickWinner"+ ", you must impersonate a user.");
        } else if (this.userId) {
            _userId = this.userId;
        }

		var game = Games.findOne({_id:gameId},{fields:{_id:1,open:1,questionId:1,round:1}});
		
		if (!game)
			throw new Meteor.Error(404,"No game found to submit answer card to.");
	
		if (!game.open)
			// the game is over. only score screen will display.
			return E_GAME_OVER;

        var playerId = getPlayerId(gameId,_userId);

		var judgeId = Meteor.call("currentJudge",game._id);
		var judge = Players.findOne({_id:judgeId});
		
		if (!judge)
			throw new Meteor.Error(404,"Judge with id "+judgeId.toString()+" not found.");
		
		if (playerId != judgeId) {
            // Update the current judge.
            Games.update({_id:gameId},{$set:{judgeId:judgeId}});
            throw new Meteor.Error(500,"It's not your turn to judge! Updating judge.");
        }

		
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
			return Votes.insert({gameId:gameId,round:game.round,judgeId:judgeId,playerId:submission.playerId,questionId:game.questionId,answerId:submission.answerId});
		}
	},

	// Remove submitted hands from the committed round and increment the round number.
	// Close the game if there are no more question cards left.
	finishRound: function(gameId) {
		var game = Games.findOne({_id:gameId},{fields:{open:1,round:1,questionCards:1,answerCards:1,_id:1}});

		if (!game)
			throw new Meteor.Error(404,"Game not found. Cannot finish round on nonexistent game.");
		
		if (!game.open)
			// the game is over. only score screen will display.
			return gameId;

		if (Votes.find({gameId:gameId,round:game.round}).count() < 1 && !this.isSimulation)
			throw new Meteor.Error(500,"The judge hasn't voted yet. Cannot finish round.");

        if (Submissions.find({gameId:gameId,round:game.round}).count() < Players.find({gameId:gameId,connected:true}).count()-1) {
            throw new Meteor.Error(500,"Not enough players have submitted cards in order to finish a round.");
        }

		// remove the cards from the player's hands
        _.each(Submissions.find({gameId:gameId,round:game.round},{fields:{_id:1,answerId:1,playerId:1}}).fetch(),function(submission) {
            if (!submission.answerId || EJSON.equals(submission.answerId,""))
                throw new Meteor.Error(500,"Somebody submitted a redacted answer. Try again!");

            // does this player have this card in his hand?
            var hand = Hands.find({playerId:submission.playerId,gameId:gameId,cardId:submission.answerId}).count();

            if (hand === 0) {
                var details = {hand:Hands.find({playerId:submission.playerId,gameId:gameId}).fetch(),answerId:submission.answerId,hasInHand:hand};
                throw new Meteor.Error(505,"You can't submit a card you don't have! " + JSON.stringify(details));
            }

			Hands.remove({gameId:gameId,playerId:submission.playerId,cardId:submission.answerId});
		});
		
		// put in a new question card

		
		if (game.questionCards && game.questionCards.length > 0 && game.answerCards && game.answerCards.length > 0) {
            var questionCardId = game.questionCards.pop();

            var nextJudge = Meteor.call("currentJudge",game._id);

            // increment round
            Games.update({_id:gameId},{$set:{questionId:questionCardId,modified:new Date().getTime(),judgeId:nextJudge},$inc:{round:1,questionCardsCount:-1},$pop:{questionCards:1}});

            // draw new cards
            Meteor.call("drawHands",gameId,K_DEFAULT_HAND_SIZE);
		} else {
            // Close the game
            Games.update({_id:gameId},{$set:{open:false}});
            // Close the players
            Players.update({gameId:gameId},{$set:{open:false}});
		}

		return gameId;
	},
	
	// Kick a player
	kickPlayer: function(gameId,kickId,_userId) {
        if (!this.userId && !_userId) {
            throw new Meteor.Error(500,"When server calls" + " kickPlayer" + ", you must impersonate a user.");
        } else if (this.userId) {
            _userId = this.userId;
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
            throw new Meteor.Error(500,"When server calls" + " quitGame" + ", you must impersonate a user.");
        } else if (this.userId) {
            _userId = this.userId;
        }

		var game = Games.findOne({_id:gameId},{fields:{_id:1,open:1,ownerId:1,players:1}});
		
		if (!game)
			throw new Meteor.Error(404,"No game found to quit from.");
		
		var open = game.open;
		
		if (Players.find({gameId:gameId}).count() === 1) {
			open = false;
		}
		
		var ownerId = game.ownerId;

		// If the owner is quitting his own game, assign a new player as the owner
		if (EJSON.equals(game.ownerId,_userId) && game.players.length > 1) {
			ownerId = Players.findOne({gameId:gameId,_id:{$ne:game.ownerId}})._id;
		}

        Players.update({gameId:gameId,userId:_userId},{$set:{connected:false,open:false}});

		return Games.update({_id:gameId},{$inc: {players:-1}, $pull:{userIds:_userId}, $set:{open:open,judgeId:Meteor.call("currentJudge",gameId),ownerId:ownerId,modified:new Date().getTime()}});
	},

    // Gets the current judge
    // Use the user's number of times voted to fairly pick the next judge
    // Use the user's index in the game.users array to pick the user who connected earliest
    // Ensures that the selected judge is stable when users join, and automatically chooses a new judge when a user
    // connects or disconnects.
    currentJudge: function(gameId) {
        var players = Players.find({gameId:gameId,connected:true,open:true},{fields:{_id:1},sort:{voted:1},limit:1}).fetch();

        if (players && players.length > 0) {
            return players[0]._id;
        } else {
            if (!Meteor.call("tryCloseGame",gameId)) {
                throw new Meteor.Error("currentJudge: There are no players in this game!",{gameId:gameId});
            }
        }
    },
	
	// Close the game
	closeGame: function(gameId,_userId) {
        if (!this.userId && !_userId) {
            throw new Meteor.Error(500,"When server calls" + " closeGame" + ", you must impersonate a user.");
        } else if (this.userId) {
            _userId = this.userId;
        }

		var game = Games.findOne({_id:gameId});
		
		if (!game)
			throw new Meteor.Error(404,"closeGame: Cannot find game to end.",{gameId:gameId});

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
        Players.update({userId:this.userId,connected:false},{$set:{connected:true,location:currentLocation ? [currentLocation[0],currentLocation[1]] : null}},{multi:true});
        Meteor.users.update({_id:this.userId},{$set:{heartbeat:new Date().getTime()}});
        if (currentLocation !== null && currentLocation.length > 0) {
            Meteor.users.update({_id:this.userId},{$set:{location:[currentLocation[0],currentLocation[1]]}});
        }

        return d;
    }
});
