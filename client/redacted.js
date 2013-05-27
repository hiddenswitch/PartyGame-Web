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
IS_CORDOVA = "isCordova";

K_HIDDEN_TEXT_STRING = "(Hidden)";

previewYes = function () {};
previewNo = function () {};


mutationObserver = {};

setError = function(err,r) {
	if (err) {
		Session.set(ERROR,err.reason);
		console.log(err);
	}
};

setErrorAndGoHome = function (err,r) {
	setError(err,r);
	
	$.mobile.changePage('#home');
};

loggedIn = function() {
    return Session.get(IS_LOGGED_IN) !== null;
};

requestLocation = function(callback) {
    if (navigator && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(function(r){
            var callbackR = [r.coords.latitude, r.coords.longitude];
            Session.set(LOCATION,callbackR);
            if (callback)
                callback(undefined,callbackR);
        }, function(e){
            if (callback)
                callback(new Meteor.Error(400,"Geolocation failed",e),null);
        });
    } else {
        if (callback)
            callback(new Meteor.Error(404,"Geolocation not supported."),null)
    }
};

closeThisGame = function() {
	if (!Session.get(GAME)) {
		console.log("Not in a game.");
		return;
	}
	
	Meteor.call("closeGame",Session.get(GAME),setError);
};

kickThisPlayer = function(kickId) {
	if (!Session.get(GAME)) {
		console.log("Not in a game.");
		return;
	}
	
	Meteor.call("kickPlayer",Session.get(GAME),kickId,function(err,r) {
		setError(err);
		if (r)
			setError({reason:"Player kicked."});
	});
};

quitThisGame = function() {
	if (!Session.get(GAME)) {
		console.log("Not in a game.");
		return;
	}
	
	Meteor.call("quitGame",Session.get(GAME),setError);
};

login = function() {
	var loginUsernameOrEmail = $('#loginUsernameOrEmail').attr('value');
	var password = $('#loginPassword').attr('value');
	
	Meteor.loginWithPassword(loginUsernameOrEmail,password,setErrorAndGoHome);
};

loginAnonymously = function() {
    var nickname = $('#anonymousNickname').attr('value');
    createNewAnonymousUser(nickname,setErrorAndGoHome);
};

loginWithFacebook = function() {
	Meteor.loginWithFacebook({},setErrorAndGoHome)
};

loginWithGoogle = function() {
	Meteor.loginWithGoogle({},setErrorAndGoHome)
};

signUp = function() {
	if (Meteor.user()) {
		Session.set(ERROR,"You are already logged in!");
		return;
	}
	
	var username = $('#signUpUsername').attr('value');
	var email = $('#signUpEmail').attr('value');
	var password = $('#signUpPassword').attr('value');

	createNewUserAndLogin(username,email,password,function(err){
		if (err) {
			Session.set(ERROR,err.reason);
			console.log(err);
		} else {
			$.mobile.changePage('#home');
		}
	});
};

matchMake = function() {
    match(Session.get(LOCATION),function (err,r){
        if (r) {
            Session.set(GAME,r);
        }
        setError(err);
    });
};

submissionCount = function () {
    return Submissions.find({gameId:Session.get(GAME),round:Session.get(ROUND)}).count();
};

maxSubmissionsCount = function () {
    var gameId = Session.get(GAME);
    if (gameId) {
        return Players.find({gameId:gameId,connected:true}).count()-1;
    } else {
        return 0;
    }
};

playersCount = function () {
    var gameId = Session.get(GAME);
    if (gameId)
        return Players.find({gameId:gameId}).count();
    else
        return 0;
};

playersRemainingCount = function () {
    var _maxSubmissionsCount = maxSubmissionsCount();
    if (_maxSubmissionsCount > 0)
        return "(" + submissionCount().toString() + "/" + _maxSubmissionsCount.toString() + ")";
    else
        return "";
};

createAndJoinGame = function() {
	var gameTitle = $('#gameTitle').attr('value');
	var gamePassword = $('#gamePassword').attr('value');
	
	if (!gameTitle || gameTitle == "") {
		Session.set(ERROR,"Cannot create a game with an empty title!");
		return;
	}
	
	// reenable password when there's a way to join a game with passwords
	Meteor.call("createEmptyGame",gameTitle,"",Session.get(LOCATION),function(e,r){
		if (r) { // new game id returned
			Meteor.call("joinGame",r,function(e2,r2){
				if (r2) {
					Session.set(GAME,r2);
				}
				if (e2) {
					Session.set(ERROR,e2.reason || e.reason + ", " + e2.reason);
					console.log(e2);
                    $.mobile.changePage('#home');
				}
			});
		}
        if (e) {
            $.mobile.changePage('#home');
            setError(e);
        }
	});
    $.mobile.changePage('#roundSummary');
};

playerIdForUserId = function(userId,gameId) {
    userId = userId || Meteor.userId();
    gameId = gameId || Session.get(GAME);
    var p = Players.find({gameId:gameId,userId:userId},{reactive:false}).fetch();

    if (p && p[0]) {
        return p[0]._id;
    } else {
        throw new Meteor.Error(404,"Player not found for given userId " + userId.toString() + " and gameId " + gameId.toString());
    }
};

playerIdToName = function(id) {
    var p = Players.findOne({_id:id},{reactive:false});

    if (!p)
        return "(Anonymous)";

    return p.name;
};

cardIdToText = function(cardId) {
    var c = null;
    if (cardId !== null && cardId !== "") {
        c = Cards.findOne({_id:cardId});
    }
    if (c)
        return c.text;
    else
        return K_HIDDEN_TEXT_STRING;
};

submissionIdToCardId = function(id) {
    var submission = Submissions.findOne({_id:id});
    if (submission.answerId)
        return submission.answerId;
    else
        return null;
};

// Match into an existing game, or create a new one to join into
match = function(location,gameJoinedCallback) {
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

// get a {playerId, score} dictionary containing the current scores
scores = function(gameId) {
    var scores = {};

    try {
        Players.find({gameId:gameId}).forEach(function (p) {
            scores[p._id] = {score:0,connected:p.connected,name: p.name};
        });

        // compute all the scores
        Votes.find({gameId:gameId}).forEach(function(voteDoc) {
            scores[voteDoc.playerId].score += 1;
        });

        return _.map(scores,function (value,key){
            return {playerId:key,score:value.score,connected:value.connected,name:value.name};
        });
    } catch(e) {
        return false;
    }
};

createNewUserAndLogin = function(username,email,password,callback) {
    if (username && email && password) {
        Accounts.createUser({username:username,email:email,password:password},callback);
    } else {
        throw new Meteor.Error(403,"Please fill out: " + (username ? "" : " username") + (email ? "" : " email") + (password ? "" : " password")+".");
    }
};

createNewAnonymousUser = function(nickname,callback) {
    var userIdPadding = Math.random().toString(36).slice(-8);
    var password = Math.random().toString(36).slice(-8);
    nickname = nickname || "Anonymous (" + userIdPadding + ")";
    Accounts.createUser({username:"Anonymous " + userIdPadding, password:password, profile:{name:nickname}},callback)
};

questionAndAnswerText = function(questionCardId,answerCardId) {
    var q = cardIdToText(questionCardId);
    var c = cardIdToText(answerCardId);

    if (!c || !q || q === K_HIDDEN_TEXT_STRING || c === K_HIDDEN_TEXT_STRING) {
        return K_HIDDEN_TEXT_STRING;
    }

    q = q.replace(/_+/,"████");

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
                    c = c.slice(0,c.length-1);
            }

            return "<span style='font-style:italic;'>"+c+"</span>";
        }
    });

    if (replacements && replacements.length > 0) {
        return _.reduce(replacements,function(memo,text) {
            return memo.replace(/█+/,text);
        },q);
    } else {
        return q + " " + "<span style='font-style:italic;'>"+c+"</span>";
    }
};


isJudge = function() {
    var currentGameId = Session.get(GAME);
    var playerId = getPlayerId(currentGameId,Meteor.userId());
    var g = Games.findOne({_id:currentGameId});

    if (g && playerId)
        return (EJSON.equals(playerId, g.judgeId));
    else
        return false;
};

acceptInvite = function() {

};

loginAndAcceptInvite = function() {

};

joinGameFromHash = function() {
    // TODO Create dialog to ask for nickname, then join into game.
    var url = window.location.href;
    var gameId = /\?([A-z0-9\-])#+/.exec(url)[1];

    if (!Meteor.user()) {

    }
};

function fastclickSetup() {
    window.addEventListener('load', function () {
        FastClick.attach(document.body);
    }, false);
}

registerTemplates = function() {
    Handlebars.registerHelper("toCard",cardIdToText);
	Handlebars.registerHelper("questionAndAnswerText",questionAndAnswerText);
	Handlebars.registerHelper("playerIdToName",playerIdToName);
    Handlebars.registerHelper("loggedIn",loggedIn);
	Handlebars.registerHelper("connectionStatus",function () {
		var status = Meteor.status().status;
		if (status == "connected") {
			return false;
		} else if (status == "connecting") {
			return "Connecting to server...";
		} else if (status == "waiting") {
			return "Failed to connect. Retrying connection...";
		}
	});
	Handlebars.registerHelper("isCordova",function () {
        if (Session.get(IS_CORDOVA))
            return true;
        else
            return false;
    });

	Template.error.error = function() {
		return Session.get(ERROR);
	};


	Template.judge.isJudge = isJudge;

	Template.judge.judge = function() {
        var g = Games.findOne({_id:Session.get(GAME)});
        if (g)
		    return Meteor.users.findOne({_id:g.judgeId});
        else
            return null;
	}

	Template.judge.judgeEmailAddress = function() {
        if (playersCount() > 1) {
            if (isJudge())
                return "You are the judge!";
            else {
                var g = Games.findOne({_id:Session.get(GAME)});
                if (g)
                    return playerIdToName(g.judgeId);
                else
                    return "";
            }
        } else
            return "Waiting for more players...";
    }

	Template.judge.rendered = function () {
        defaultRendered.apply(this);
        if (isJudge() && playersCount() > 1) {
            $('#submissionsCollapsible h3 a').addClass('magic');
        } else {
            $('#submissionsCollapsible h3 a').removeClass('magic');
        }
    }
	Template.judge.created = defaultCreated;
    Template.judge.preserve(defaultPreserve);

	Template.question.question = function() {
		var gameDoc = Games.findOne({_id:Session.get(GAME)});
		if (gameDoc) {
			return cardIdToText(gameDoc.questionId);
		} else {
			return "REDACTED.";
		}
	};

    Template.question.preserve(defaultPreserve);
    Template.question.rendered = defaultRendered;

	Template.players.players = function () {
		var players = _.pluck(Players.find({gameId:Session.get(CURRENT_GAME)}),"userId");
		return _.map(players, function (o) {return Meteor.users.findOne({_id:o})});
	};

	Template.players.rendered = defaultRendered;
	Template.players.created = defaultCreated;
    Template.players.preserve(defaultPreserve);

	Template.scores.scores = function() {
		if (!Session.get(GAME))
			return [];

		return scores(Session.get(GAME));
	};

	Template.scores.rendered = defaultRendered;
	Template.scores.created = defaultCreated;
    Template.scores.preserve(defaultPreserve);



	Template.myGames.games = function() {
        if (Session.equals("currentPage","myGames")) {
            return Games.find({open:true,userIds:Meteor.userId()});
        } else  {
            return null;
        }
	};

	Template.myGames.events = {
		'click a': joinGameOnClick
	};

	Template.myGames.rendered = defaultRendered;
	Template.myGames.created = defaultCreated;
    Template.myGames.preserve(defaultPreserve);

    Template.submissions.isJudge = isJudge;
    Template.submissions.count = function () {
        return Submissions.find({gameId:Session.get(GAME),round:Session.get(ROUND)}).count();
    };
	Template.submissions.submissions = function () {
		return Submissions.find({gameId:Session.get(GAME),round:Session.get(ROUND)});
	};

    Template.submissions.remaining = function() {
        return playersCount() - submissionCount();
    }

    Template.submissions.count = function () {
        return "(" + submissionCount().toString() + "/" + maxSubmissionsCount().toString() + ")";
    };

	Template.submissions.events = {
		'click .submission':function(e) {
			var submissionId = $(e.target).attr('id');
			Session.set(PREVIEW_CARD,submissionIdToCardId(submissionId));

            previewNo = function () {
                $.mobile.changePage('#waitForPlayers');
            };

			previewYes = function () {
				Meteor.call("pickWinner",Session.get(GAME),submissionId,function(e,r){
					if (r) {
						Meteor.call("finishRound",Session.get(GAME),function (e,r){
							if (e) {
								console.log(e);
								Session.set(ERROR,e.reason);
                                $.mobile.changePage('#waitForPlayers');
							}
                            if (r) {
                                $.mobile.changePage('#roundSummary');
                            }
						});
					}
					if (e) {
						console.log(e);
						Session.set(ERROR,e.reason);
                        $.mobile.changePage('#waitForPlayers');
					}
				});
			};
		}
	}

	Template.submissions.rendered = defaultRendered;

	Template.submissions.created = defaultCreated;
    Template.submissions.preserve(defaultPreserve);

    Template.hand.isJudge = isJudge;

	Template.hand.hand = function () {
		return Hands.find({userId:Meteor.userId(),gameId:Session.get(GAME)});
	};

	Template.hand.events = {
		'click .card':function(e) {
			var answerId = $(e.target).attr('id');
			Session.set(PREVIEW_CARD,answerId);

            previewNo = function() {
                $.mobile.changePage('#chooseCardFromHand');
            };

			previewYes = function() {
				Meteor.call("submitAnswerCard",Session.get(GAME),answerId,function(e,r) {
					if (r) {
						Session.set(SUBMISSION,r);
                        $.mobile.changePage('#waitForPlayers');
					}
					if (e) {
						console.log(e);
						Session.set(ERROR,e.reason);
                        $.mobile.changePage('#chooseCardFromHand');
					}
				});
			};
		}
	};

	Template.hand.rendered = function() {
        if (isJudge()) {
            $('#handHeader').text("Your Hand");
            $('#handCollapsible h3 a').removeClass('magic');
        } else {
            $('#handHeader').text("Play a Card");
            $('#handCollapsible h3 a').addClass('magic');
        }
    };

    Template.nextButtons.isJudge = isJudge;
    Template.nextButtons.rendered = createAndRefreshButtons;
    Template.nextButtons.created = createAndRefreshButtons;

	Template.hand.created = defaultCreated;
    Template.hand.preserve(defaultPreserve);

	Template.preview.text = function() {
		var gameDoc = Games.findOne({_id:Session.get(GAME)});
		if (gameDoc)
			return questionAndAnswerText(gameDoc.questionId,Session.get(PREVIEW_CARD));
		else
			return "REDACTED.";
	};

    Template.preview.rendered = defaultRendered;
    Template.preview.created = defaultCreated;

    Template.menu.rendered = defaultRendered;
    Template.menu.created = defaultCreated;
};

cordovaSetup = function() {
    // Startup for Cordova
    document.addEventListener('online', function(e) {
        Session.set(IS_CORDOVA,true);
    }, false);
};


//Meteor.subscribe("myOwnedGames");
Meteor.subscribe("cards");

Meteor.startup(function() {
	Session.set(ERROR,null);
	
	Deps.autorun(function() {
        Meteor.subscribe("submissions",Session.get(GAME));
        Meteor.subscribe("votesInGame",Session.get(GAME));
        Meteor.subscribe("usersInGame",Session.get(GAME));
        Meteor.subscribe("players",Session.get(GAME));
        Meteor.subscribe("myGames");
        Meteor.subscribe("localGames",Session.get(LOCATION));
        Meteor.subscribe("hand",Session.get(GAME));
	});

	Accounts.ui.config({
		requestPermissions: {facebook: ['user_likes']},
		passwordSignupFields: 'USERNAME_AND_EMAIL'
	});
		
	// update current round
    Deps.autorun(function () {
        var game = Games.findOne({_id:Session.get(GAME)},{fields:{round:1}});
        if (game != null) {
            if (game.open === false) {
                $.mobile.changePage('#gameOver');
            } else if (!Session.equals(ROUND,game.round)) {
                Session.set(ROUND,game.round);

                if ($.mobile.activePage && $.mobile.activePage.attr('id') === 'waitForPlayers') {
                    $.mobile.changePage('#roundSummary');
                }
            }
        }
    });

    // Update logged in status (workaround for constant menu refreshing
    Deps.autorun(function () {
        if (Session.get(IS_LOGGED_IN) !== Meteor.userId()) {
            Session.set(IS_LOGGED_IN,Meteor.userId())
        };
    });
	
	// clear error after 5 seconds
    Deps.autorun(function () {
		var currentError = Session.get(ERROR);
		if (currentError !== null) {
			Meteor.setTimeout(function(){
				Session.set(ERROR,null);
			},5000);
		}
	});

	// update last login time
	Meteor.setInterval(function () {
        if (Meteor.userId()) {
            Meteor.call("heartbeat",Session.get(LOCATION) ? Session.get(LOCATION) : null,function(err,r){
                setError(err);
            });
        }
    },K_HEARTBEAT);

    // cordova setup
    Deps.autorun(function () {
        if (Session.equals(IS_CORDOVA,true)) {
            console.log("Redacted Cordova detected.");
        }
    });

    // refresh listviews when transition is done
    $(document).live('pageshow', function(){
        //More stuff to do
        defaultRendered.apply({findAll:$});
        createAndRefreshButtons.apply({findAll:$});
        Session.set("currentPage", $.mobile.activePage.attr('id'));
    });

    requestLocation(setError);
});

registerTemplates();

cordovaSetup();


fastclickSetup();