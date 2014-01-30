/**
 * @author Benjamin Berman
 * © 2012 All Rights Reserved
 **/
Party = {
    _getPlayerId: function (gameId, userId) {
        if (!gameId || !userId)
            return null;

        var p = Players.find({gameId: gameId, userId: userId}, {reactive: false}).fetch();

        if (p && p[0]) {
            return p[0]._id;
        } else {
            return null;
        }
    },

    submitAnswerCard: function (gameId, answerId, userId) {
        var game = Games.findOne({_id: gameId});

        if (!game)
            throw new Meteor.Error(404, "No game found to submit answer card to.");

        if (!game.open)
        // the game is over. only score screen will display.
            return;

        var playerId = Party._getPlayerId(gameId, userId);

        if (Players.find({gameId: gameId}).count() < 2)
            throw new Meteor.Error(500, "Too few players to submit answer.");

        if (EJSON.equals(playerId, game.judgeId))
            throw new Meteor.Error(500, "You cannot submit a card. You're the judge!");

        // does this player have this card in his hand?
        var hasInHand = Hands.find({playerId: playerId, gameId: gameId, cardId: answerId}).count();

        if (!hasInHand) {
            var details = {hand: Hands.find({playerId: playerId, gameId: gameId}).fetch(), answerId: answerId, hasInHand: hasInHand};
            throw new Meteor.Error(501, "You can't submit a card you don't have! " + JSON.stringify(details));
        }

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

    pickWinner: function (gameId, submissionId, userId) {
        var game = Games.findOne({_id: gameId}, {fields: {_id: 1, open: 1, questionId: 1, round: 1}});

        if (!game)
            throw new Meteor.Error(404, "No game found to submit answer card to.");

        if (!game.open)
        // the game is over. only score screen will display.
            return E_GAME_OVER;

        var playerId = Party._getPlayerId(gameId, userId);

        var judgeId = Party.currentJudge(game._id);
        var judge = Players.findOne({_id: judgeId});

        if (!judge) {
            throw new Meteor.Error(404, "Judge with id " + judgeId.toString() + " not found.");
        }


        if (playerId != judgeId) {
            // Update the current judge.
            Games.update({_id: gameId}, {$set: {judgeId: judgeId}});
            throw new Meteor.Error(500, "It's not your turn to judge! Updating judge.");
        }


        var submission = Submissions.findOne({_id: submissionId});
        var submissionCount = Submissions.find({gameId: gameId, round: game.round}).count();
        var connectedCount = Players.find({gameId: gameId, connected: true}).count();

        if (submissionCount < connectedCount - 1) {
            throw new Meteor.Error(500, "Wait until everyone connected has submitted a card!");
        }


        if (!submission) {
            throw new Meteor.Error(404, "Submission not found.");
        }


        if (EJSON.equals(submission.playerId, judgeId)) {
            Submissions.remove({_id: submission._id});
            throw new Meteor.Error(500, "You cannot pick your own card as the winning card.");
        }

        if (!submission.answerId || (EJSON.equals(submission.answerId, ""))) {
            throw new Meteor.Error(500, "You can't pick a hidden answer! Wait until everyone has put in a card.");
        }

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

    finishRound: function (gameId) {
        var game = Games.findOne({_id: gameId}, {fields: {open: 1, round: 1, questionCards: 1, answerCards: 1, _id: 1}});

        if (!game)
            throw new Meteor.Error(404, "Game not found. Cannot finish round on nonexistent game.");

        if (!game.open)
        // the game is over. only score screen will display.
            return gameId;

        if (Votes.find({gameId: gameId, round: game.round}).count() < 1 && !this.isSimulation) {
            throw new Meteor.Error(500, "The judge hasn't voted yet. Cannot finish round.");
        }


        if (Submissions.find({gameId: gameId, round: game.round}).count() < Players.find({gameId: gameId, connected: true}).count() - 1) {
            throw new Meteor.Error(500, "Not enough players have submitted cards in order to finish a round.");
        }

        // remove the cards from the player's hands
        _.each(Submissions.find({gameId: gameId, round: game.round}, {fields: {_id: 1, answerId: 1, playerId: 1}}).fetch(), function (submission) {
            if (!submission.answerId || EJSON.equals(submission.answerId, "")) {
                throw new Meteor.Error(500, "Somebody submitted a redacted answer. Try again!");
            }

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

            // draw new cards
            Party.drawHands(gameId, K_DEFAULT_HAND_SIZE);
        } else {
            // Close the game
            Games.update({_id: gameId}, {$set: {open: false}});
            // Close the players
            Players.update({gameId: gameId}, {$set: {open: false}});
        }

        return gameId;
    },

    kickPlayer: function (gameId, kickId, userId) {
        var game = Games.findOne({_id: gameId});

        if (!game)
            throw new Meteor.Error(404, "No game found to kick from.");

        var kickId = Party._getPlayerId(gameId, kickId);
        var playerId = Party._getPlayerId(gameId, userId);

        var userIdOfKickedPlayer = Players.findOne({_id: kickId}).userId;

        if (!EJSON.equals(game.ownerId, playerId))
            throw new Meteor.Error(403, "You are not the owner of this game. Cannot kick players.");

        if (EJSON.equals(playerId, kickId))
            throw new Meteor.Error(403, "You cannot kick yourself from your own game.");

        Players.remove({_id: kickId});
        Games.update({_id: gameId}, {$inc: {players: -1}, $pullAll: {userIds: userIdOfKickedPlayer}, $set: {modified: new Date().getTime()}});
        return gameId;
    },

    quitGame: function (gameId, userId) {
        var game = Games.findOne({_id: gameId}, {fields: {_id: 1, open: 1, ownerId: 1, players: 1}});

        if (!game)
            throw new Meteor.Error(404, "No game found to quit from.");

        var open = game.open;

        if (Players.find({gameId: gameId}).count() === 1) {
            open = false;
        }

        var ownerId = game.ownerId;

        // If the owner is quitting his own game, assign a new player as the owner
        if (EJSON.equals(game.ownerId, userId) && game.players.length > 1) {
            ownerId = Players.findOne({gameId: gameId, _id: {$ne: game.ownerId}})._id;
        }

        Players.update({gameId: gameId, userId: userId}, {$set: {connected: false, open: false}});

        return Games.update({_id: gameId}, {$inc: {players: -1}, $pull: {userIds: userId}, $set: {open: open, judgeId: Party.currentJudge(gameId), ownerId: ownerId, modified: new Date().getTime()}});
    },

    // Gets the current judge
    // Use the user's number of times voted to fairly pick the next judge
    // Use the user's index in the game.users array to pick the user who connected earliest
    // Ensures that the selected judge is stable when users join, and automatically chooses a new judge when a user
    // connects or disconnects.
    currentJudge: function (gameId) {
        var players = Players.find({gameId: gameId, connected: true, open: true}, {fields: {_id: 1}, sort: {voted: 1}, limit: 1}).fetch();

        if (players && players.length > 0) {
            return players[0]._id;
        } else {
            if (!Party.tryCloseGame(gameId)) {
                throw new Meteor.Error("currentJudge: There are no players in this game!", {gameId: gameId});
            }
        }
    },

    // Close the game
    closeGame: function (gameId, userId) {
        var game = Games.findOne({_id: gameId});

        if (!game)
            throw new Meteor.Error(404, "closeGame: Cannot find game to end.", {gameId: gameId});

        var playerId = Party._getPlayerId(gameId, userId);

        if (!EJSON.equals(game.ownerId, playerId))
            throw new Meteor.Error(403, "You aren't the owner of the game. You can't close it.");

        if (!game.open)
            throw new Meteor.Error(500, "This game is already closed.");

        Games.update({_id: gameId}, {$set: {open: false, modified: new Date().getTime()}});
        return gameId;
    },

    heartbeat: function (currentLocation, userId) {
        currentLocation = currentLocation || null;

        var d = new Date().getTime();

        // update heartbeat for the given user
        Players.update({userId: userId, connected: false}, {$set: {connected: true, location: currentLocation ? [currentLocation[0], currentLocation[1]] : null}}, {multi: true});
        Meteor.users.update({_id: userId}, {$set: {heartbeat: new Date().getTime()}});
        if (currentLocation !== null && currentLocation.length > 0) {
            Meteor.users.update({_id: userId}, {$set: {location: [currentLocation[0], currentLocation[1]]}});
        }

        return d;
    },

    // Draw hands for all players in the game.
    drawHands: function (gameId, handSize) {
        handSize = handSize || K_DEFAULT_HAND_SIZE;

        var game = Games.findOne({_id: gameId, open: true}, {fields: {_id: 1, open: 1, answerCards: 1}});

        if (!game)
            throw new Meteor.Error(404, "No game to draw hands from.");

        if (game.open === false) {
            // the game is over. only score screen will display.
            throw new Meteor.Error(403, "This game is closed.");
        }

        var open = true;

        // all answer cards exhausted, do not draw any more cards.
        if (game.answerCards.length < 1) {
            Party.tryCloseGame(gameId);
            throw new Meteor.Error(405, "The game is over, the game is being closed.");
        }

        var drawnCards = [];

        var players = Players.find({gameId: gameId, connected: true}, {fields: {_id: 1, userId: 1}}).fetch();

        for (var i = 0; i < players.length; i++) {
            var player = players[i];
            var handCount = Hands.find({gameId: gameId, playerId: player._id}).count();

            // TODO: Atomize the operations on cards
            for (var j = 0; j < handSize - handCount; j++) {
                if (game.answerCards.length > 0) {
                    var cardId = this.isSimulation ? null : game.answerCards.pop();
                    Hands.insert({userId: player.userId, gameId: gameId, playerId: player._id, cardId: cardId});
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
        Games.update({_id: gameId}, {$pullAll: {answerCards: drawnCards}, $inc: {answerCardsCount: -drawnCards.length}, $set: {open: open, modified: new Date().getTime()}});
    },

    // Find the latest game a given player joined
    findGameWithUser: function (userId) {
        var p = Players.findOne({userId: userId});
        if (p !== null && _.has(p, 'gameId')) {
            return p.gameId;
        } else {
            return null;
        }
    },

    joinGameWithTitle: function (title, userId) {
        var g = Games.findOne({title: title});

        if (g) {
            return {playerId: Party.joinGame(g._id, userId), gameId: g._id};
        } else {
            throw new Meteor.Error(404, "A game named " + title + " was not found.");
        }
    },

    joinOrCreateGameWithTitle: function (title, userId) {
        if (title == null || title === "") {
            throw new Meteor.Error(500, "No title specified.");
        }

        var g = Games.findOne({title: title, open: true});

        if (g) {
            return {playerId: Party.joinGame(g._id, userId), gameId: g._id}
        } else {
            // create an empty game with the given title
            var u = Meteor.users.findOne({_id: userId});
            var location = u ? (u.location ? u.location : null) : null;
            var gameId = Meteor.call("createEmptyGame", title, null, location);
            return {playerId: Party.joinGame(gameId, userId), gameId: gameId}
        }
    },

    /**
     * Joins a game.
     * @param gameId
     * @param userId
     * @returns {String} Returns the player id.
     */
    joinGame: function (gameId, userId) {
        var g = Games.findOne({_id: gameId}, {fields: {_id: 1, open: 1, userIds: 1}});

        if (!g)
            throw new Meteor.Error(404, "Cannot join nonexistent game.");

        if (!g.open)
            throw new Meteor.Error(403, "The game is closed, cannot join.");

        // If this user is already in the game, update the connected status and return the playerId
        var thisPlayer = Players.findOne({gameId: gameId, userId: userId});

        if (thisPlayer != null) {
            Players.update({gameId: gameId, userId: userId}, {$set: {connected: true}});
            return thisPlayer._id;
        }


        // Otherwise, join the game by adding to the players list, updating the heartbeat, and incrementing the players
        // count.
        thisPlayer = new Player();

        thisPlayer.open = true;
        thisPlayer.userId = userId;
        thisPlayer.gameId = gameId;
        thisPlayer.voted = new Date().getTime();
        thisPlayer.connected = true;

        var getUserName = function (id) {
            var u = Meteor.users.findOne({_id: id});

            if (!u)
                return "Anomyous (" + id + ")";

            if (u.profile && u.profile.name)
                return u.profile.name;

            if (u.username)
                return u.username;

            if (u.emails && u.emails[0] && u.emails[0].address)
                return u.emails[0].address;

            return "Anomyous (" + id + ")";
        };

        thisPlayer.name = getUserName(userId);

        thisPlayer._id = Players.insert(thisPlayer);

        // If there is no owner, this first user is now the owner.
        Games.update({_id: gameId, creatorUserId: userId, $or: [
            {judgeId: null},
            {ownerId: null}
        ]}, {$set: {ownerId: thisPlayer._id, judgeId: thisPlayer._id}});

        // Update local copy of game
        g.userIds.push(userId);

        // Increment the player count and join the game.
        Games.update({_id: gameId}, {$inc: {players: 1}, $addToSet: {userIds: userId, playerIds: thisPlayer._id, playerNames: thisPlayer.name}, $set: {modified: new Date().getTime()}});

        // Update the heartbeat and the game ID
        Meteor.users.update({_id: userId}, {$set: {inGame: false, heartbeat: new Date().getTime()}, $addToSet: {gameIds: gameId}});

        // Update the ACLs for the users
        Meteor.users.update({gameIds: gameId}, {$addToSet: {acl: {$each: g.userIds}}}, {multi: true});

        // Draw hands for all users
        Party.drawHands(gameId, K_DEFAULT_HAND_SIZE);

        return thisPlayer._id;
    },

    findGameWithFewPlayers: function (gameSize) {
        // find the latest game with fewer than five players
        gameSize = gameSize || K_PREFERRED_GAME_SIZE;
        var game = Games.findOne({open: true, players: {$lt: gameSize}}, {fields: {_id: 1}});

        if (!game)
            return false;
        else
            return game._id;
    },

    findLocalGame: function (location) {
        location = location || null;

        if (!location)
            return false;

        var game = Games.findOne({open: true, location: {$within: {$center: [
            [location[0], location[1]],
            K_LOCAL_DISTANCE
        ]}}}, {fields: {_id: 1}});

        if (!game)
            return false;
        else
            return game._id;
    },

    findAnyGame: function () {
        var game = Games.findOne({open: true}, {fields: {_id: 1}});

        if (!game)
            return false;
        else
            return game._id;
    },

    // Create a new, empty game
    // required title
    // optional password
    createEmptyGame: function (title, password, location, userId) {
        password = password || "";
        location = location || null;

        var customTitle = true;

        if (title == null || title == "") {
            title = "Game #" + (Games.find({}).count() + 1).toString();
            customTitle = false;
        }

        var shuffledAnswerCards = _.shuffle(_.pluck(Cards.find({type: CARD_TYPE_ANSWER}, {fields: {_id: 1}}).fetch(), '_id'));

        if (shuffledAnswerCards === null || shuffledAnswerCards.length === 0) {
            throw new Meteor.Error(404, "Cards were not found. Did you forget to initialize cards?");
        }

        var shuffledQuestionCards = _.shuffle(_.pluck(Cards.find({type: CARD_TYPE_QUESTION}, {fields: {_id: 1}}).fetch(), '_id'));

        if (!shuffledQuestionCards)
            throw new Meteor.Error(404, "No question cards found.");

        var firstQuestionCardId = shuffledQuestionCards.pop();

        var gameId = Games.insert({
            title: title, // game title
            password: password, // game password if any
            players: 0, // number of players in the game
            round: 0, // round number
            questionCardsCount: shuffledQuestionCards.length,
            questionCards: shuffledQuestionCards,
            answerCardsCount: shuffledAnswerCards.length,
            answerCards: shuffledAnswerCards,
            questionId: firstQuestionCardId,
            open: true,
            creatorUserId: userId,
            ownerId: null,
            created: new Date().getTime(),
            modified: new Date().getTime(),
            judgeId: null,
            userIds: [],
            botLust: true,
            location: location ? [location[0], location[1]] : null,
            customTitle: customTitle,
            locationFriendly: null
        });

        // Update friendly location name
        if (location && location.length > 0 && location[0] && location[1]) {
            Meteor.http.get("http://nominatim.openstreetmap.org/reverse?format=json&lat={1}&lon={0}&zoom=18&addressdetails=1".format(location[0], location[1]), function (e, r) {
                if (r.statusCode === 200 && r.data != null) {
                    Games.update({_id: gameId}, {$set: {locationFriendly: r.data}});
                }
            });
        }

        console.log("Game stats: " + JSON.stringify({"Number of games": Games.find({open: true}).count(), "Last game created": gameId, "Players": Players.find().count()}));

        return gameId;
    },

    // Closes the game if it is valid to do so
    tryCloseGame: function (gameId) {
        return Games.update(
            gameId === null ?
            {open: true, $or: [
                {modified: {$lt: new Date().getTime() - K_HEARTBEAT * 20}},
                {questionCardsCount: 0},
                {answerCardsCount: 0}
            ]} :
            {_id: gameId}, {$set: {open: false, modified: new Date().getTime()}}, {multi: gameId === null});
    }
};

Meteor.methods({
    // Find the latest game a given player joined
    findGameWithUser: function (userId) {
        return Party.findGameWithUser(userId);
    },

    joinGameWithTitle: function (title) {
        if (!this.userId) {
            throw new Meteor.Error(403, "Permission denied.");
        }

        return Party.joinGameWithTitle(title, this.userId);
    },

    joinOrCreateGameWithTitle: function (title) {
        if (!this.userId) {
            throw new Meteor.Error(403, "Permission denied.");
        }

        return Party.joinOrCreateGameWithTitle(title, this.userId);
    },

    // Join a game
    joinGame: function (gameId) {
        if (!this.userId) {
            throw new Meteor.Error(403, "Permission denied.");
        }

        return Party.joinGame(gameId, this.userId);
    },

    findGameWithFewPlayers: function (gameSize) {
        return Party.findGameWithFewPlayers(gameSize);
    },

    findLocalGame: function (location) {
        return Party.findLocalGame(location);
    },

    findAnyGame: function () {
        return Party.findAnyGame();
    },

    // Create a new, empty game
    // required title
    // optional password
    createEmptyGame: function (title, password, location) {
        if (!this.userId) {
            throw new Meteor.Error(403, "Permission denied.");
        }

        return Party.createEmptyGame(title, password, location, this.userId)
    }
});