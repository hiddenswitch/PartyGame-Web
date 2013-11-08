/**
 * @author Benjamin Berman
 */


Meteor.methods({
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
        Games.update({_id:gameId},{$pullAll:{answerCards:drawnCards},$inc:{answerCardsCount:-drawnCards.length},$set:{open:open,modified:new Date().getTime()}});
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

    joinOrCreateGameWithTitle: function(title) {
        if (!this.userId) {
            throw new Meteor.Error(403, "Permission denied.");
        }

        if (title == null || title === "") {
            throw new Meteor.Error(500, "No title specified.");
        }

        var g = Games.findOne({title:title, open:true});

        if (g) {
            return Meteor.call("joinGame", g._id);
        } else {
            // create an empty game with the given title
            var u = Meteor.users.findOne({_id: this.userId});
            var location = u ? (u.location ? u.location : null) : null;
            var gameId = Meteor.call("createEmptyGame", title, null, location);
            return Meteor.call("joinGame",gameId);
        }
    },

    // Join a game
    joinGame: function(gameId,_userId) {
        if (!this.userId && !_userId) {
            throw new Meteor.Error(500,"When server calls" + " joinGame" + ", you must impersonate a user.");
        } else if (this.userId) {
            _userId = this.userId;
        }

        var g = Games.findOne({_id:gameId},{fields:{_id:1,open:1,userIds:1}});

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

        // Update local copy of game
        g.userIds.push(_userId);

        // Increment the player count and join the game.
        Games.update({_id:gameId},{$inc: {players:1}, $addToSet:{userIds:_userId,playerIds:playerId,playerNames: p.name}, $set:{modified:new Date().getTime()}});

        // Update the heartbeat and the game ID
        Meteor.users.update({_id: _userId}, {$set: {heartbeat: new Date().getTime()}, $addToSet: {gameIds: gameId}});

        // Update the ACLs for the users
        Meteor.users.update({gameIds: gameId}, {$addToSet: {acl: {$each: g.userIds}}}, {multi: true});

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

        var game = Games.findOne({open:true,location:{$within:{$center:[[location[0],location[1]],K_LOCAL_DISTANCE]}}},{fields:{_id:1}});

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

        var customTitle = true;

        if (title == null || title == "") {
            title = "Game #" + (Games.find({}).count() + 1).toString();
            customTitle = false;
        }

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
            location: location ? [location[0],location[1]] : null,
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

        console.log("Game stats: " + JSON.stringify({"Number of games":Games.find({open:true}).count(),"Last game created":gameId,"Players":Players.find().count()}));

        return gameId;
    },

    // Closes the game if it is valid to do so
    tryCloseGame:function(gameId) {
        return Games.update(
            gameId === null ?
                {open:true,$or:[{modified:{$lt:new Date().getTime() - K_HEARTBEAT*20}}, {questionCardsCount:0}, {answerCardsCount:0}]} :
                {_id:gameId},{$set:{open:false,modified:new Date().getTime()}},{multi:gameId === null});
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