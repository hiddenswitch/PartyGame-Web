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

        var game = Games.findOne({_id: gameId});
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
        } else {
            winner = {_id: Votes.insert({gameId: gameId, round: game.round, judgeId: judgeId, playerId: submission.playerId, questionId: game.questionId, answerId: submission.answerId})};
        }

        // Finish round
        // remove the cards from the player's hands
        _.each(Submissions.find({gameId: gameId, round: game.round}, {fields: {_id: 1, answerId: 1, playerId: 1}}).fetch(), function (submission) {
            if (!submission.answerId || EJSON.equals(submission.answerId, ""))
                throw new Meteor.Error(500, "Somebody submitted a redacted answer. Try again!");

            Hands.remove({gameId: gameId, playerId: submission.playerId, cardId: submission.answerId});
        });

        if (Meteor.isClient
            || (game.questionCards.length > 0 && game.answerCards.length > 0)) {
            var nextJudge = Players.find({gameId: gameId, connected: true, open: true}, {fields: {_id: 1, userId: 1}, sort: {voted: 1}, limit: 1}).findOne();
            // increment round
            Games.update({_id: gameId}, {$set: {modified: new Date().getTime(), judgeId: nextJudge._id, judgeUserId: nextJudge.userId}, $inc: {round: 1, questionCardsCount: -1}});
        } else {
            // Close the game
            Games.update({_id: gameId}, {$set: {open: false}});
            // Close the players
            Players.update({gameId: gameId}, {$set: {open: false}});
        }

        return winner._id;
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
