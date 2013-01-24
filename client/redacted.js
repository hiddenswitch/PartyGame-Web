/**
 * @author Benjamin S. Berman
 * Copyright 2012
 */

var SESSION_CURRENT_GAME = SESSION_CURRENT_GAME || "currentGame";
var SESSION_CURRENT_ROUND = SESSION_CURRENT_ROUND || "currentRound";
var SESSION_CURRENT_HAND = SESSION_CURRENT_HAND || "currentHand";
var SESSION_CURRENT_SUBMISSION = SESSION_CURRENT_SUBMISSION || "currentSubmission";
var SESSION_CURRENT_ERROR = SESSION_CURRENT_ERROR || "currentError";
var SESSION_CURRENT_PREVIEW_CARD = SESSION_CURRENT_PREVIEW_CARD || "currentPreviewCard";
var SESSION_CURRENT_LOCATION = SESSION_CURRENT_LOCATION || "currentLocation";

var previewYes = function () {};
var previewNo = function () {};

var mutationObserver = {};

var questionAndAnswerText = function(questionCardId,answerCardId) {
    var q = cardIdToText(questionCardId);
    var c = cardIdToText(answerCardId);

    if (!c || !q || q == "REDACTED." || c == "REDACTED.") {
        return "REDACTED.";
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
            return memo.replace("__",text);
        },q);
    } else {
        return q + " " + "<span style='font-style:italic;'>"+c+"</span>";
    }

    return "REDACTED.";
};

var refreshListviews = function() {
	$('.ui-listview[data-role="listview"]').listview("refresh");
	$('[data-role="button"]:visible').button();
};

var createListviews = function() {
	$('[data-role="listview"]').listview();
};

var setError = function(err,r) {
	if (err) {
		Session.set(SESSION_CURRENT_ERROR,err.reason);
		console.log(err);
	}
};

var setErrorAndGoHome = function (err,r) {
	setError(err,r);
	
	$.mobile.changePage('#home');
};

var requestLocation = function(callback) {
    if (navigator && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(function(r){
            var callbackR = [r.coords.latitude, r.coords.longitude];
            Session.set(SESSION_CURRENT_LOCATION,callbackR);
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

var closeThisGame = function() {
	if (!Session.get(SESSION_CURRENT_GAME)) {
		console.log("Not in a game.");
		return;
	}
	
	Meteor.call("closeGame",Session.get(SESSION_CURRENT_GAME),setError);
};

var kickThisPlayer = function(kickId) {
	if (!Session.get(SESSION_CURRENT_GAME)) {
		console.log("Not in a game.");
		return;
	}
	
	Meteor.call("kickPlayer",Session.get(SESSION_CURRENT_GAME),kickId,function(err,r) {
		setError(err);
		if (r)
			setError({reason:"Player kicked."});
	});
};

var quitThisGame = function() {
	if (!Session.get(SESSION_CURRENT_GAME)) {
		console.log("Not in a game.");
		return;
	}
	
	Meteor.call("quitGame",Session.get(SESSION_CURRENT_GAME),setError);
};

var login = function() {
	var loginUsernameOrEmail = $('#loginUsernameOrEmail').attr('value');
	var password = $('#loginPassword').attr('value');
	
	Meteor.loginWithPassword(loginUsernameOrEmail,password,setErrorAndGoHome);
};

var loginAnonymously = function() {
    var nickname = $('#anonymousNickname').attr('value');
    createNewAnonymousUser(nickname,setErrorAndGoHome);
};

var loginWithFacebook = function() {
	Meteor.loginWithFacebook({},setErrorAndGoHome)
};

var loginWithGoogle = function() {
	Meteor.loginWithGoogle({},setErrorAndGoHome)
};

var signUp = function() {
	if (Meteor.user()) {
		Session.set(SESSION_CURRENT_ERROR,"You are already logged in!");
		return;
	}
	
	var username = $('#signUpUsername').attr('value');
	var email = $('#signUpEmail').attr('value');
	var password = $('#signUpPassword').attr('value');

	createNewUserAndLogin(username,email,password,function(err){
		if (err) {
			Session.set(SESSION_CURRENT_ERROR,err.reason);
			console.log(err);
		} else {
			$.mobile.changePage('#home');
		}
	});
};

var matchMake = function() {
    requestLocation(function (locationE,locationR){
        match(locationR,function (err,r){
            if (r) {
                Session.set(SESSION_CURRENT_GAME,r);
            }
            setError(err);
        });
    });
};

var submissionCount = function () {
    return Submissions.find({gameId:Session.get(SESSION_CURRENT_GAME),round:Session.get(SESSION_CURRENT_ROUND)}).count();
};

var maxSubmissionsCount = function () {
    var g = Games.findOne({_id:Session.get(SESSION_CURRENT_GAME)});
    if (g && g.connected)
        return Games.findOne({_id:Session.get(SESSION_CURRENT_GAME)}).connected.length-1;
    else
        return 0;
};

var playersCount = function () {
    var g = Games.findOne({_id:Session.get(SESSION_CURRENT_GAME)});
    if (g && g.users)
        return Games.findOne({_id:Session.get(SESSION_CURRENT_GAME)}).users.length;
    else
        return 0;
};

var playersRemainingCount = function () {
    var _maxSubmissionsCount = maxSubmissionsCount();
    if (_maxSubmissionsCount > 0)
        return "(" + submissionCount().toString() + "/" + _maxSubmissionsCount.toString() + ")";
    else
        return "";
};

var createAndJoinGame = function() {
	var gameTitle = $('#gameTitle').attr('value');
	var gamePassword = $('#gamePassword').attr('value');
	
	if (!gameTitle || gameTitle == "") {
		Session.set(SESSION_CURRENT_ERROR,"Cannot create a game with an empty title!");
		return;
	}
	
	// reenable password when there's a way to join a game with passwords
	Meteor.call("createEmptyGame",gameTitle,"",Session.get(SESSION_CURRENT_LOCATION),function(e,r){
		if (r) { // new game id returned
			Meteor.call("joinGame",r,function(e2,r2){
				if (r2) {
					Session.set(SESSION_CURRENT_GAME,r2);
					$.mobile.changePage('#game');
				}
				if (e2) {
					Session.set(SESSION_CURRENT_ERROR,e2.reason || e.reason + ", " + e2.reason);
					console.log(e2);
				}
			});
		}
		setError(e);
	});
};

var userIdToName = function(id) {
	var u = Meteor.users.findOne({_id:id});
	
	if (!u)
		return "REDACTED.";
	
	if (u.profile && u.profile.name)
		return u.profile.name;
	
	if (u.username)
		return u.username;
	
	if (u.emails && u.emails[0] && u.emails[0].address)
		return u.emails[0].address;

    return "REDACTED.";
};

var joinGameOnClick = function(e) {
	var gameId = $(e.target).attr('id');
	Meteor.call("joinGame",gameId,function(e,r) {
		if (r) {
			Session.set(SESSION_CURRENT_GAME,r);
		}
		setError(e);
	});
};

var isJudge = function() {
    var theUserId = Meteor.userId();
    var currentGameId = Session.get(SESSION_CURRENT_GAME);
    return (theUserId == getJudgeIdForGameId(currentGameId));
};

var defaultPreserve = {
    '[id]':function(node) {
        return node.id;
    }
};

var joinGameFromHash = function() {
    // TODO Create dialog to ask for nickname, then join into game.
    var url = window.location.href;
    var gameId = /\?([A-z0-9\-])#+/.exec(url)[1];
    if (!Meteor.user()) {};
};

var registerTemplates = function() {	
	Handlebars.registerHelper("questionAndAnswerText",questionAndAnswerText);
	Handlebars.registerHelper("userIdToName",userIdToName);
	Handlebars.registerHelper("refreshListviews",refreshListviews);
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
	
	Template.error.error = function() {
		return Session.get(SESSION_CURRENT_ERROR);
	};
	
	Template.game.game = function () {
		return Games.findOne({_id:Session.get(SESSION_CURRENT_GAME)});
	};
	
	Template.game.title = function() {
		var g = Games.findOne({_id:Session.get(SESSION_CURRENT_GAME)});
		if (g)
			return g.title;
		else
			return "REDACTED.";
	};
	
	Template.game.round = function() {
		var g = Games.findOne({_id:Session.get(SESSION_CURRENT_GAME)});
		if (g)
			return g.round+1;
		else
			return 1;
	};
	
	Template.game.isOpen = function() {
		var g = Games.findOne({_id:Session.get(SESSION_CURRENT_GAME)});
		if (g) {
			return g.open || true;
		} else {
			return false;
		}
	};
	
	Template.game.isOwner = function() {
		var g = Games.findOne({_id:Session.get(SESSION_CURRENT_GAME)});
		if (g) {
			if (g.ownerId) {
				return g.ownerId == Meteor.userId();
			} else {
				return false;
			}
		} else {
			return false;
		}
	};
	
	Template.game.lastVote = function() {
		return Votes.findOne({gameId:Session.get(SESSION_CURRENT_GAME),round:Session.get(SESSION_CURRENT_ROUND)-1});
	};
	
	Template.game.rendered = refreshListviews;
	Template.game.created = createListviews;
    Template.game.preserve(defaultPreserve);

	Handlebars.registerHelper("gameGame",Template.game.game);
	Handlebars.registerHelper("gameTitle",Template.game.title);
	Handlebars.registerHelper("gameIsOpen",Template.game.isOpen);
	Handlebars.registerHelper("gameRound",Template.game.round);
	Handlebars.registerHelper("gameIsOwner",Template.game.isOwner);
	Handlebars.registerHelper("gameLastVote",Template.game.lastVote);
	
	Template.judge.isJudge = isJudge;
	
	Template.judge.judge = function() {
		return Meteor.users.findOne({_id:getJudgeIdForGameId(Session.get(SESSION_CURRENT_GAME))});
	}
	
	Template.judge.judgeEmailAddress = function() {
        if (playersCount() > 1) {
            if (isJudge())
                return "You are the judge!";
            else
                return userIdToName(getJudgeIdForGameId(Session.get(SESSION_CURRENT_GAME)));
        } else
            return "Waiting for more players...";
    }
	
	Template.judge.rendered = function () {
        if (isJudge() && playersCount() > 1)
            $('#judgeText').addClass('magic');
        else
            $('#judgeText').removeClass('magic');
    };

	Template.judge.created = createListviews;
    Template.judge.preserve(defaultPreserve);
	
	Template.question.question = function() {
		var gameDoc = Games.findOne({_id:Session.get(SESSION_CURRENT_GAME)});
		if (gameDoc) {
			return cardIdToText(gameDoc.questionId);
		} else {
			return "REDACTED.";
		}
	};

    Template.question.preserve(defaultPreserve);
	
	Template.players.players = function () {
		var gameDoc = Games.findOne({_id:Session.get(SESSION_CURRENT_GAME)});
		return _.map(gameDoc.users, function (o) {return Meteor.users.findOne({_id:o})});
	};
	
	Template.players.rendered = refreshListviews;
	Template.players.created = createListviews;
    Template.players.preserve(defaultPreserve);
	
	Template.scores.scores = function() {
		if (!Session.get(SESSION_CURRENT_GAME))
			return [];
		
		return scores(Session.get(SESSION_CURRENT_GAME));
	};
	
	Template.scores.rendered = refreshListviews;
	Template.scores.created = createListviews;
    Template.scores.preserve(defaultPreserve);
	
	Template.browse.games = function() {
		return Games.find({open:true}).fetch();
	};
	
	Template.browse.events = {
		'click a': joinGameOnClick
	};
	
	Template.browse.rendered = refreshListviews;
	Template.browse.created = createListviews;
    Template.browse.preserve(defaultPreserve);
	
	Template.myGames.games = function() {
		return Games.find({open:true,users:Meteor.userId()}).fetch();
	};
	
	Template.myGames.events = {
		'click a': joinGameOnClick
	};
	
	Template.myGames.rendered = refreshListviews;
	Template.myGames.created = createListviews;
    Template.myGames.preserve(defaultPreserve);

    Template.submissions.isJudge = isJudge;
	Template.submissions.submissions = function () {
		var submissions = Submissions.find({gameId:Session.get(SESSION_CURRENT_GAME),round:Session.get(SESSION_CURRENT_ROUND)}).fetch();
		return _.map(submissions, function(o) {
            return _.extend({text:cardIdToText(o.answerId)},o)
        });
	};

    Template.submissions.count = function () {
        return "(" + submissionCount().toString() + "/" + maxSubmissionsCount().toString() + ")";
    };
	
	Template.submissions.events = {
		'click .submission':function(e) {
			var submissionId = $(e.target).attr('id');
			Session.set(SESSION_CURRENT_PREVIEW_CARD,submissionIdToCardId(submissionId));
			previewYes = function () {
				Meteor.call("pickWinner",Session.get(SESSION_CURRENT_GAME),submissionId,function(e,r){
					if (r) {
						Meteor.call("finishRound",Session.get(SESSION_CURRENT_GAME),function (e,r){
							if (e) {
								console.log(e);
								Session.set(SESSION_CURRENT_ERROR,e.reason);
							}
						});
					}
					if (e) {
						console.log(e);
						Session.set(SESSION_CURRENT_ERROR,e.reason);
					}
				});
			};
		}
	}
	
	Template.submissions.rendered = function() {
        refreshListviews();
        if (isJudge() && playersCount() > 1) {
            $('#submissionsCollapsible h3 a').addClass('magic');
        } else {
            $('#submissionsCollapsible h3 a').removeClass('magic');
        }
    };

	Template.submissions.created = createListviews;
    Template.submissions.preserve(defaultPreserve);

    Template.hand.isJudge = isJudge;
	
	Template.hand.hand = function () {
		return Hands.findOne({_id:Session.get(SESSION_CURRENT_HAND)});
	};
	  
	Template.hand.cardsInHand = function() {
		var handDoc = Hands.findOne({_id:Session.get(SESSION_CURRENT_HAND)});
		return _.map(handDoc.hand, function (o) {return Cards.findOne({_id:o})});
	};
	
	Template.hand.events = {
		'click .card':function(e) {
			var answerId = $(e.target).attr('id');
			Session.set(SESSION_CURRENT_PREVIEW_CARD,answerId);
			previewYes = function() {
				Meteor.call("submitAnswerCard",Session.get(SESSION_CURRENT_GAME),answerId,function(e,r) {
					if (r) {
						Session.set(SESSION_CURRENT_SUBMISSION,r);
					}
					if (e) {
						console.log(e);
						Session.set(SESSION_CURRENT_ERROR,e.reason);
					}
				});
			};
		}
	};
	
	Template.hand.rendered = function() {
        refreshListviews();
        if (isJudge()) {
            $('#handHeader').text("Your Hand");
            $('#handCollapsible h3 a').removeClass('magic');
        } else {
            $('#handHeader').text("Play a Card");
            $('#handCollapsible h3 a').addClass('magic');
        }
    };

	Template.hand.created = createListviews;
    Template.hand.preserve(defaultPreserve);
	
	Template.preview.text = function() {
		var gameDoc = Games.findOne({_id:Session.get(SESSION_CURRENT_GAME)});
		if (gameDoc)
			return questionAndAnswerText(gameDoc.questionId,Session.get(SESSION_CURRENT_PREVIEW_CARD));
		else
			return "REDACTED.";
	};

    Template.menu.rendered = refreshListviews;
    Template.menu.created = createListviews;
};

Meteor.subscribe("openGames");
Meteor.subscribe("myHands");
Meteor.subscribe("myGames");
Meteor.subscribe("myOwnedGames");
Meteor.subscribe("cards");	

Meteor.startup(function() {
	Session.set(SESSION_CURRENT_ERROR,null);
	
	Meteor.autosubscribe(function() {
		var currentGameId = Session.get(SESSION_CURRENT_GAME);
        var currentRound = Session.get(SESSION_CURRENT_ROUND);
		if (currentGameId) {
			Meteor.subscribe("submissions",currentGameId,currentRound);
			Meteor.subscribe("votesInGame",currentGameId);
			Meteor.subscribe("usersInGame",currentGameId);
		}
	});

	Accounts.ui.config({
		requestPermissions: {facebook: ['user_likes']},
		passwordSignupFields: 'USERNAME_AND_EMAIL'
	});
		
	// update current round
	Meteor.autorun(function() {
		var currentGameId = Session.get(SESSION_CURRENT_GAME);
		var currentGame = Games.findOne({_id:currentGameId});
		if (currentGame)
			Session.set(SESSION_CURRENT_ROUND,currentGame.round);
	});
	
	// update current hand
	Meteor.autorun(function () {
		var currentGameId = Session.get(SESSION_CURRENT_GAME);
		var currentRound = Session.get(SESSION_CURRENT_ROUND);
		var currentHand = Hands.findOne({userId:Meteor.userId(),gameId:currentGameId,round:currentRound});
		if (currentHand)
			Session.set(SESSION_CURRENT_HAND,currentHand._id);
	});
	
	// clear error after 5 seconds
	Meteor.autorun(function () {
		var currentError = Session.get(SESSION_CURRENT_ERROR);
		if (currentError) {
			console.log(currentError);
			Meteor.setTimeout(function(){
				Session.set(SESSION_CURRENT_ERROR,null);
			},5000);
		}
	});

	// update last login time
	Meteor.setInterval(function () {
        if (Meteor.userId()) {
            Meteor.call("heartbeat",Session.get(SESSION_CURRENT_LOCATION) ? Session.get(SESSION_CURRENT_LOCATION) : null,function(err,r){
                setError(err);
            });
        }
    },K_HEARTBEAT);

	mutationObserver = new MutationSummary({
		queries: [{element:'[data-role="page"]',elementAttributes:'class'},{element:'[data-role="listview"]'},{element:'li'},{element:'[data-role="button"]'}],
		callback: function(summaries) {
			refreshListviews();
		}
	});
});

registerTemplates();

