/**
 * @author Benjamin S. Berman
 * Copyright 2012
 */

GAME = "currentGame";
ROUND = "currentRound";
SUBMISSION = "currentSubmission";
ERROR = "currentError";
PREVIEW_CARD = "currentPreviewCard";
LOCATION = "location";
IS_LOGGED_IN = "isLoggedIn";
K_HIDDEN_TEXT_STRING = "(Hidden)";

previewYes = function () {
};
previewNo = function () {
};


mutationObserver = {};

setError = function (err, r) {
    if (err) {
        Session.set(ERROR, err.reason);
        console.log(err);
        console.trace();
    }
};

setErrorAndGoHome = function (err, r) {
    setError(err, r);

    Router.go('home');
};

loggedIn = function () {
    return !!Meteor.userId();
};

requestLocation = function (callback) {
    if (navigator && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(function (r) {
            var callbackR = [r.coords.longitude, r.coords.latitude];
            Session.set(LOCATION, callbackR);
            if (callback)
                callback(undefined, callbackR);
        }, function (e) {
            if (callback)
                callback(new Meteor.Error(400, "Geolocation failed", e), null);
        });
    } else {
        if (callback)
            callback(new Meteor.Error(404, "Geolocation not supported."), null)
    }
};

closeThisGame = function () {
    if (!getCurrentGameId()) {
        console.log("Not in a game.");
        return;
    }

    Meteor.call("closeGame", getCurrentGameId(), setError);
};

kickThisPlayer = function (kickId) {
    if (!getCurrentGameId()) {
        console.log("Not in a game.");
        return;
    }

    Meteor.call("kickPlayer", getCurrentGameId(), kickId, function (err, r) {
        setError(err);
        if (r)
            setError({reason: "Player kicked."});
    });
};

quitThisGame = function () {
    if (!getCurrentGameId()) {
        console.log("Not in a game.");
        return;
    }

    Meteor.call("quitGame", getCurrentGameId(), setError);
};

login = function () {
    var loginUsernameOrEmail = $('#loginUsernameOrEmail').attr('value');
    var password = $('#loginPassword').attr('value');

    Meteor.loginWithPassword(loginUsernameOrEmail, password, setErrorAndGoHome);
};

loginAnonymouslyCallback = null;

loginAnonymously = function () {
    var nickname = $('#anonymousNickname').val();
    createNewAnonymousUser(nickname, loginAnonymouslyCallback || setErrorAndGoHome);
};

loginWithGoogle = function (callback) {
    callback = callback || setErrorAndGoHome;
    Meteor.loginWithGoogle({}, callback);
};

signUp = function () {
    if (Meteor.user()) {
        Session.set(ERROR, "You are already logged in!");
        return;
    }

    var username = $('#signUpUsername').attr('value');
    var email = $('#signUpEmail').attr('value');
    var password = $('#signUpPassword').attr('value');

    createNewUserAndLogin(username, email, password, function (err) {
        if (err) {
            Session.set(ERROR, err.reason);
            console.log(err);
        } else {
            Router.go('home');
        }
    });
};

matchMake = function () {

    match(Session.get(LOCATION), function (err, matchMakingResult) {
        var gameId = matchMakingResult.gameId;
        if (gameId) {
            Router.go('roundSummary', {gameId: gameId});
        }
        setError(err);
    });
};


createAndJoinGame = function () {
    var title = $('#gameTitle').val();
    var gameTitle = encodeURIComponent(title);
    var gamePassword = $('#gamePassword').val();

    if (!gameTitle || gameTitle == "") {
        Session.set(ERROR, "Cannot create a game with an empty title!");
        return;
    }

    function createAndJoinGameCallback(callbackOnCreateGame) {
        Meteor.call("createEmptyGame", gameTitle, "", Session.get(LOCATION), function (e, gameId) {
            if (gameId) { // new game id returned
                if (callbackOnCreateGame != null) {
                    callbackOnCreateGame(gameId);
                }

                Meteor.call("joinGame", gameId, function (e2, playerId) {
                    if (playerId) {
                        Router.go('roundSummary', {gameId: gameId});
                    }
                    if (e2) {
                        Session.set(ERROR, e2.reason || e.reason + ", " + e2.reason);
                        console.log(e2);
                        Router.go('home');
                    }
                });
            }
            if (e) {
                Router.go('home');
                setError(e);
            }
        });
    }

    if (hasFacebook()) {
        friendsSelectedCallback = function (facebookIds) {
            createAndJoinGameCallback(function (gameId) {
                Meteor.call("inviteFriendsToGame", facebookIds, "Hey, join my PartyGa.me: " + Meteor.absoluteUrl('g/' + gameTitle));
                console.log("Invited friends to " + gameId);
            });

            // Clear out the callback when done.
            friendsSelectedCallback = null;
        };

        Router.go('pickFriends');
    } else {
        createAndJoinGameCallback();
    }
};

currentGameId = function () {
    return getCurrentGameId();
};

playerIdForUserId = function (userId, gameId) {
    userId = userId || Meteor.userId();
    gameId = gameId || getCurrentGameId();
    var p = Players.find({gameId: gameId, userId: userId}, {reactive: false}).fetch();

    if (userId == null || gameId == null) {
        return "";
    }

    if (p && p[0]) {
        return p[0]._id;
    } else {
        return null;
        //throw new Meteor.Error(404,"Player not found for given userId " + userId.toString() + " and gameId " + gameId.toString());
    }
};

playerIdToName = function (id) {
    var p = Players.findOne({_id: id}, {reactive: false});

    if (!p)
        return "(Anonymous)";

    return p.name;
};

submissionIdToCardId = function (id) {
    var submission = Submissions.findOne({_id: id});
    if (submission.answerId)
        return submission.answerId;
    else
        return null;
};

// Match into an existing game, or create a new one to join into
match = function (location, gameJoinedCallback) {
    Meteor.call('match', {location: location}, gameJoinedCallback);
};

// get a {playerId, score} dictionary containing the current scores
scores = function (gameId) {
    var scores = {};

    try {
        Players.find({gameId: gameId}).forEach(function (p) {
            scores[p._id] = {score: 0, connected: p.connected, name: p.name};
        });

        // compute all the scores
        Votes.find({gameId: gameId}).forEach(function (voteDoc) {
            scores[voteDoc.playerId].score += 1;
        });

        return _.map(scores, function (value, key) {
            return {playerId: key, score: value.score, connected: value.connected, name: value.name};
        });
    } catch (e) {
        return false;
    }
};

createNewUserAndLogin = function (username, email, password, callback) {
    if (username && email && password) {
        Accounts.createUser({
            username: username,
            email: email,
            password: password,
            profile: {location: Session.get(LOCATION)}
        }, callback);
    } else {
        throw new Meteor.Error(403, "Please fill out: " + (username ? "" : " username") + (email ? "" : " email") + (password ? "" : " password") + ".");
    }
};

createNewAnonymousUser = function (nickname, callback) {
    var userIdPadding = Math.random().toString(10).slice(-8);
    var password = Math.random().toString(36).slice(-8);
    nickname = nickname || "Anonymous (" + userIdPadding + ")";
    Accounts.createUser({
        username: nickname + " (Guest " + userIdPadding + ")",
        password: password,
        profile: {name: nickname, location: Session.get(LOCATION)}
    }, callback)
};

questionAndAnswerText = function (questionCardId, answerCardId) {
    var q = cardIdToText(questionCardId);
    var c = cardIdToText(answerCardId);

    if (!c || !q || q === K_HIDDEN_TEXT_STRING || c === K_HIDDEN_TEXT_STRING) {
        return K_HIDDEN_TEXT_STRING;
    }

    q = q.replace(/_+/, "████");

    var matches = [];
    var match = /(.{0,2})(█+)(.+)/g;
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
                    c = c.slice(0, c.length - 1);
            }

            return "<span style='font-style:italic;'>" + c + "</span>";
        }
    });

    if (replacements && replacements.length > 0) {
        return _.reduce(replacements, function (memo, text) {
            return memo.replace(/█+/, text);
        }, q);
    } else {
        return q + " " + "<span style='font-style:italic;'>" + c + "</span>";
    }
};

canPlay = function (g) {
    g = g || Games.findOne({_id: getCurrentGameId()}, {fields: {open: 1, players: 1}});
    var playersConnected = Players.find({gameId: getCurrentGameId(), connected: true}).count();
    if (g && g.open === true && playersConnected >= 2) {
        return true;
    } else {
        return false;
    }
};

function fastclickSetup() {
    window.addEventListener('load', function () {
        FastClick.attach(document.body);
    }, false);
}

registerTemplates = function () {
    Template.registerHelper('userId', function () {
        return Meteor.userId();
    });
    Template.registerHelper('currentGameId', currentGameId);
    Template.registerHelper('getCurrentGameId', getCurrentGameId);
    Template.registerHelper("cardIdToText", cardIdToText);
    Template.registerHelper("questionAndAnswerText", questionAndAnswerText);
    Template.registerHelper("playerIdToName", playerIdToName);
    Template.registerHelper("loggedIn", loggedIn);
    Template.registerHelper("connectionStatus", function () {
        var status = Meteor.status().status;
        if (status == "connected") {
            return false;
        } else if (status == "connecting") {
            return "Connecting to server...";
        } else if (status == "waiting") {
            return "Failed to connect. Retrying connection...";
        }
    });
    Template.registerHelper("canPlay", canPlay);

    Template.error.error = function () {
        return Session.get(ERROR);
    };

    Template.question.question = function () {
        var gameDoc = Games.findOne({_id: getCurrentGameId()});
        if (gameDoc) {
            return cardIdToText(gameDoc.questionId);
        } else {
            return "REDACTED.";
        }
    };

    Template.question.rendered = defaultRendered;

    Template.scores.scores = function () {
        if (!getCurrentGameId())
            return [];

        return scores(getCurrentGameId());
    };

    Template.scores.rendered = defaultRendered;
    Template.scores.created = defaultCreated;


    Template.myGames.games = function () {
        if (Session.equals("currentPage", "myGames")) {
            return Games.find({open: true, userIds: Meteor.userId()});
        } else {
            return null;
        }
    };

    Template.myGames.events = {
        'click a': joinGameOnClick
    };

    Template.myGames.rendered = defaultRendered;
    Template.myGames.created = defaultCreated;


    Template.submissions.events = {
        'click .submission': function (e) {
            var submissionId = $(e.target).attr('id');
            Session.set(PREVIEW_CARD, submissionIdToCardId(submissionId));

            previewNo = function () {
                Router.go('waitForPlayers', {gameId: getCurrentGameId()});
            };

            previewYes = function () {
                Meteor.call("pickWinner", getCurrentGameId(), submissionId, function (e, r) {
                    if (r) {
                        Router.go('roundSummary', {gameId: getCurrentGameId()});
                    }
                    if (e) {
                        console.log(e);
                        Session.set(ERROR, e.reason);
                        Router.go('waitForPlayers', {gameId: getCurrentGameId()});
                    }
                });
            };
        }
    }


    Template.hand.isJudge = isJudge;

    Template.hand.hand = function () {
        return Hands.find({userId: Meteor.userId(), gameId: getCurrentGameId()});
    };

    Template.hand.events = {
        'click .card': function (e) {
            var answerId = $(e.target).attr('id');
            Session.set(PREVIEW_CARD, answerId);

            previewNo = function () {
                Router.go('chooseCardFromHand', {gameId: getCurrentGameId()});
            };

            previewYes = function () {
                Meteor.call("submitAnswerCard", getCurrentGameId(), answerId, function (e, r) {
                    if (r) {
                        console.log(r);
                        Session.set(SUBMISSION, r);
                        Router.go('waitForPlayers', {gameId: getCurrentGameId()});
                    }
                    if (e) {
                        console.log(e);
                        Session.set(ERROR, e.reason);
                        Router.go('chooseCardFromHand', {gameId: getCurrentGameId()});
                    }
                });
            };
        }
    };

    Template.hand.rendered = defaultRendered;

    Template.nextButtons.isJudge = isJudge;
    Template.nextButtons.rendered = createAndRefreshButtons;
    Template.nextButtons.created = createAndRefreshButtons;

    Template.hand.created = defaultCreated;

    Template.preview.text = function () {
        var gameDoc = Games.findOne({_id: getCurrentGameId()});
        if (gameDoc)
            return questionAndAnswerText(gameDoc.questionId, Session.get(PREVIEW_CARD));
        else
            return "REDACTED.";
    };

    Template.preview.rendered = defaultRendered;
    Template.preview.created = defaultCreated;

    Template.gamesList.events({
        'click [href]': function (event) {
            Router.go($(event.currentTarget).attr('href'));
        }
    });
};

Meteor.startup(function () {
    Session.set(ERROR, null);

    // clear error after 5 seconds
    Deps.autorun(function () {
        var currentError = Session.get(ERROR);
        if (currentError !== null) {
            Meteor.setTimeout(function () {
                Session.set(ERROR, null);
            }, 5000);
        }
    });

    // update last login time
    Meteor.setInterval(function () {
        if (Meteor.userId()) {
            Meteor.call("heartbeat", Session.get(LOCATION) ? Session.get(LOCATION) : null, function (err, r) {
                setError(err);
            });
        }
    }, K_HEARTBEAT);

    // refresh listviews when transition is done
    $(document).on('pageshow', function () {
        //More stuff to do
        refreshListviews.apply({findAll: $});
        createAndRefreshButtons.apply({findAll: $});
        Session.set("currentPage", $.mobile.activePage.attr('id'));
    });

    requestLocation(setError);

    $.mobile.initializePage();

});

registerTemplates();
fastclickSetup();