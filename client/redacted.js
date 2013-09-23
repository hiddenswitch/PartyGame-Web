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
            var callbackR = [r.coords.longitude, r.coords.latitude];
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

loginWithGoogle = function() {
	Meteor.loginWithGoogle({},setErrorAndGoHome);
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

createAndJoinGame = function() {
	var gameTitle = $('#gameTitle').attr('value');
	var gamePassword = $('#gamePassword').attr('value');
	
	if (!gameTitle || gameTitle == "") {
		Session.set(ERROR,"Cannot create a game with an empty title!");
		return;
	}
	
	// reenable password when there's a way to join a game with passwords
    var location = Session.get(LOCATION);

	Meteor.call("createEmptyGame",gameTitle,"",location,function(e,r){
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

playerIdToName = function(id) {
    var p = Players.findOne({_id:id},{reactive:false});

    if (!p)
        return "(Anonymous)";

    return p.name;
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
        Accounts.createUser({username:username,email:email,password:password,profile:{location:Session.get(LOCATION)}},callback);
    } else {
        throw new Meteor.Error(403,"Please fill out: " + (username ? "" : " username") + (email ? "" : " email") + (password ? "" : " password")+".");
    }
};

createNewAnonymousUser = function(nickname,callback) {
    var userIdPadding = Math.random().toString(36).slice(-8);
    var password = Math.random().toString(36).slice(-8);
    nickname = nickname || "Anonymous (" + userIdPadding + ")";
    Accounts.createUser({username:nickname + " (Guest " + userIdPadding + ")", password:password, profile:{name:nickname,location:Session.get(LOCATION)}},callback)
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

canPlay = function(){
    var g = Games.findOne({_id:Session.get(GAME)},{fields:{open:1,players:1}});
    var playersConnected = Players.find({gameId:Session.get(GAME),connected:true}).count();
    if (g && g.open === true & playersConnected >= 2) {
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
    Handlebars.registerHelper("canPlay",canPlay);

	Template.error.error = function() {
		return Session.get(ERROR);
	};

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

	Template.hand.rendered = defaultRendered;

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

    Template.gamesList.rendered = refreshListviewsAndCreateButtons;
    Template.gamesList.created = defaultCreated;
};

cordovaSetup = function() {
    // Startup for Cordova
    document.addEventListener('deviceready', function(e) {
        if (window.isCordova) {
            Session.set(IS_CORDOVA,true);

//            window.oldWindowOpen = window.open;
//            window.open = function(strUrl, strWindowName, strWindowFeatures) {
//                var _browser = window.oldWindowOpen(strUrl, strWindowName, strWindowFeatures);
//                _browser.addEventListener("loaderror",function(event){
//                    _browser.closed = true;
//                });
//                return _browser;
//            }
        }
    }, false);
};


//Meteor.subscribe("myOwnedGames");
Meteor.subscribe("cards");

Meteor.startup(function() {
	Session.set(ERROR,null);
		
	// update current round
    Deps.autorun(function () {
        var game = Games.findOne({_id:Session.get(GAME)},{fields:{round:1,judgeId:1}});
        if (game != null) {
            if (game.open === false) {
                $.mobile.changePage('#gameOver');
            } else if (!canPlay()) {
                if ($.mobile.activePage && _.contains(['waitForPlayers','chooseCardFromHand'],$.mobile.activePage.attr('id'))) {
                    $.mobile.changePage('#roundSummary');
                }
            } else if (!Session.equals(ROUND,game.round)) {
                Session.set(ROUND,game.round);
                if ($.mobile.activePage && $.mobile.activePage.attr('id') === 'waitForPlayers') {
                    $.mobile.changePage('#roundSummary');
                }
            } else if (!Session.equals("judge",game.judgeId) && playerIdForUserId(Meteor.userId()) === game.judgeId) {
                Session.set("judge",game.judgeId);
                if ($.mobile.activePage && _.contains(['waitForPlayers','chooseCardFromHand'],$.mobile.activePage.attr('id'))) {
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

    $.mobile.initializePage();

});

registerTemplates();

cordovaSetup();


fastclickSetup();