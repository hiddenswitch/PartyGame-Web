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

INVENTORY_ITEM_TYPE_CARD = 1;

// Error messages.
E_NO_MORE_CARDS = "No more cards.";
E_GAME_OVER = "The game is over.";

var Game = function () {
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
    this.created = new Date().getTime(); // date created.
    this.modified = new Date().getTime(); // date modified.
    this.location = null; // location of game.
    this.players = 0; // number of players.
    this.userIds = []; // user Ids of players (to identify games you're in).
    this.deckIds = []; // List of decks used in this game.
};


getPlayerId = function (gameId, userId) {
    if (!gameId || !userId)
        return null;

    var p = Players.find({gameId: gameId, userId: userId}, {reactive: false}).fetch();

    if (p && p[0]) {
        return p[0]._id;
    } else {
        return null;
    }
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
    submitAnswerCard: function (gameId, answerId) {
        if (this.userId == null) {
            throw new Meteor.Error(503, "Permission denied.");
        }

        if (Meteor.isServer) {
            return Party.submitAnswerCard(gameId, answerId, this.userId);
        }

        var game = Games.findOne({_id: gameId});

        if (!game.open)
            return;

        var playerId = getPlayerId(gameId, this.userId);

        var submission = Submissions.findOne({gameId: gameId, playerId: playerId, round: game.round});

        if (submission) {
            Submissions.update({_id: submission._id}, {$set: {answerId: answerId}});
            return submission._id;
        } else {
            return Submissions.insert({
                gameId: gameId,
                round: game.round,
                playerId: playerId,
                answerId: answerId
            });
        }
    },


    // Pick a winner
    pickWinner: function (gameId, submissionId) {
        if (this.userId == null) {
            throw new Meteor.Error(503, "Permission denied.");
        }

        if (Meteor.isServer) {
            return Party.pickWinner(gameId, submissionId, this.userId);
        }

        var game = Games.findOne({_id: gameId}, {fields: {_id: 1, open: 1, questionId: 1, round: 1}});
        var playerId = getPlayerId(gameId, this.userId);

        var judgeId = game.judgeId;
        var judge = Players.findOne({_id: judgeId});

        var submission = Submissions.findOne({_id: submissionId});
        var submissionCount = Submissions.find({gameId: gameId, round: game.round}).count();
        var connectedCount = Players.find({gameId: gameId, connected: true}).count();

        if (submissionCount < connectedCount - 1)
            throw new Meteor.Error(500, "Wait until everyone connected has submitted a card!");

        if (!submission)
            throw new Meteor.Error(404, "Submission not found.");

        if (EJSON.equals(submission.playerId, judgeId)) {
            Submissions.remove({_id: submission._id});
            throw new Meteor.Error(500, "You cannot pick your own card as the winning card.");
        }

        if (!submission.answerId || (EJSON.equals(submission.answerId, "")))
            throw new Meteor.Error(500, "You can't pick a hidden answer! Wait until everyone has put in a card.");

        var winner = Votes.findOne({gameId: gameId, round: game.round});

        // Mark that this user just voted
        Players.update({_id: playerId}, {$set: {voted: new Date().getTime()}});

        if (winner) {
            Votes.update({_id: winner._id}, {$set: {playerId: submission.playerId, questionId: game.questionId, answerId: submission.answerId}});
            return winner._id;
        } else {
            return Votes.insert({gameId: gameId, round: game.round, judgeId: judgeId, playerId: submission.playerId, questionId: game.questionId, answerId: submission.answerId});
        }
    },

    // Remove submitted hands from the committed round and increment the round number.
    // Close the game if there are no more question cards left.
    finishRound: function (gameId) {
        if (Meteor.isServer) {
            return Party.finishRound(gameId);
        }

        var game = Games.findOne({_id: gameId}, {fields: {open: 1, round: 1, questionCards: 1, answerCards: 1, _id: 1}});

        if (!game)
            throw new Meteor.Error(404, "Game not found. Cannot finish round on nonexistent game.");

        if (!game.open)
        // the game is over. only score screen will display.
            return gameId;

        if (Votes.find({gameId: gameId, round: game.round}).count() < 1 && Meteor.isServer)
            throw new Meteor.Error(500, "The judge hasn't voted yet. Cannot finish round.");

        if (Submissions.find({gameId: gameId, round: game.round}).count() < Players.find({gameId: gameId, connected: true}).count() - 1) {
            throw new Meteor.Error(500, "Not enough players have submitted cards in order to finish a round.");
        }

        // remove the cards from the player's hands
        _.each(Submissions.find({gameId: gameId, round: game.round}, {fields: {_id: 1, answerId: 1, playerId: 1}}).fetch(), function (submission) {
            if (!submission.answerId || EJSON.equals(submission.answerId, ""))
                throw new Meteor.Error(500, "Somebody submitted a redacted answer. Try again!");

            // does this player have this card in his hand?
            var hand = Hands.find({playerId: submission.playerId, gameId: gameId, cardId: submission.answerId}).count();

            if (hand === 0) {
                var details = {hand: Hands.find({playerId: submission.playerId, gameId: gameId}).fetch(), answerId: submission.answerId, hasInHand: hand};
                throw new Meteor.Error(505, "You can't submit a card you don't have! " + JSON.stringify(details));
            }

            Hands.remove({gameId: gameId, playerId: submission.playerId, cardId: submission.answerId});
        });

        // put in a new question card


        if (game.questionCards && game.questionCards.length > 0 && game.answerCards && game.answerCards.length > 0) {
            var questionCardId = game.questionCards.pop();

            var nextJudge = Party.currentJudge(game._id);

            // increment round
            Games.update({_id: gameId}, {$set: {questionId: questionCardId, modified: new Date().getTime(), judgeId: nextJudge}, $inc: {round: 1, questionCardsCount: -1}, $pop: {questionCards: 1}});
        } else {
            // Close the game
            Games.update({_id: gameId}, {$set: {open: false}});
            // Close the players
            Players.update({gameId: gameId}, {$set: {open: false}});
        }

        return gameId;
    },

    // Kick a player
    kickPlayer: function (gameId, kickId) {
        if (this.userId == null) {
            throw new Meteor.Error(503, "Permission denied.");
        }

        if (Meteor.isServer) {
            return Party.kickPlayer(gameId, kickId, this.userId);
        }
    },


    // Quit a game
    quitGame: function (gameId) {
        if (this.userId == null) {
            throw new Meteor.Error(503, "Permission denied.");
        }

        if (Meteor.isServer) {
            return Party.quitGame(gameId, this.userId);
        }
    },

    // Close the game
    closeGame: function (gameId) {
        if (this.userId == null) {
            throw new Meteor.Error(503, "Permission denied.");
        }

        if (Meteor.isServer) {
            return Party.closeGame(gameId, this.userId);
        }
    },

    heartbeat: function (currentLocation) {
        if (!this.userId)
            return;

        if (Meteor.isServer) {
            Party.heartbeat(currentLocation, this.userId);
        }
    }
});
