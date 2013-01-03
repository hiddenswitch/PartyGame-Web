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

var refreshAllListviews = function() {
	$('[data-role="listview"]').listview("refresh");
}

var refreshListviews = function() {
	$('.ui-listview[data-role="listview"]').listview("refresh");
	$('[data-role="button"]:visible').button();
}

var createListviews = function() {
	$('[data-role="listview"]').listview();
	//$.mobile.initializePage('[data-role="page"]');
}

var setError = function(err,r) {
	if (err) {
		Session.set(SESSION_CURRENT_ERROR,err.reason);
		console.log(err);
	}
}

var setErrorAndGoHome = function (err,r) {
	setError(err,r);
	
	$.mobile.changePage('#home');
}

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
}

var closeThisGame = function() {
	if (!Session.get(SESSION_CURRENT_GAME)) {
		console.log("Not in a game.");
		return;
	}
	
	Meteor.call("closeGame",Session.get(SESSION_CURRENT_GAME),setError);
}

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
}

var quitThisGame = function() {
	if (!Session.get(SESSION_CURRENT_GAME)) {
		console.log("Not in a game.");
		return;
	}
	
	Meteor.call("quitGame",Session.get(SESSION_CURRENT_GAME),setError);
}

var login = function() {
	var loginUsernameOrEmail = $('#loginUsernameOrEmail').attr('value');
	var password = $('#loginPassword').attr('value');
	
	Meteor.loginWithPassword(loginUsernameOrEmail,password,setErrorAndGoHome);
}

var loginWithFacebook = function() {
	Meteor.loginWithFacebook({requestPermissions:['user_likes']},setErrorAndGoHome)
}

var loginWithGoogle = function() {
	Meteor.loginWithGoogle({},setErrorAndGoHome)
}

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
}

var matchMake = function() {
    requestLocation(function (locationE,locationR){
        match(locationR,function (err,r){
            if (r) {
                Session.set(SESSION_CURRENT_GAME,r);
            }
            setError(err);
        });
    });
}

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
}

var userIdToName = function(id) {
	var u = Meteor.users.findOne({_id:id});
	
	if (!u)
		return "Loading username...";
	
	if (u.profile && u.profile.name)
		return u.profile.name;
	
	if (u.username)
		return u.username;
	
	if (u.emails && u.emails[0] && u.emails[0].address)
		return u.emails[0].address;
}

var joinGameOnClick = function(e) {
	var gameId = $(e.target).attr('id');
	Meteor.call("joinGame",gameId,function(e,r) {
		if (r) {
			Session.set(SESSION_CURRENT_GAME,r);
		}
		setError(e);
	});
}

var registerTemplates = function() {	
	Handlebars.registerHelper("questionAndAnswerText",questionAndAnswerText);
	Handlebars.registerHelper("userIdToName",userIdToName);
	Handlebars.registerHelper("refreshListviews",refreshListviews);
	Handlebars.registerHelper("connectionStatus",function () {
		var status = Meteor.status().status;
		if (status == "connected") {
			return false;
		} else if (status == "connecting") {
			return "Connecting to server..."
		} else if (status == "waiting") {
			return "Failed to connect. Retrying connection...";
		}
	});
	
	Template.error.error = function() {
		return Session.get(SESSION_CURRENT_ERROR);
	}
	
	Template.game.game = function () {
		return Games.findOne({_id:Session.get(SESSION_CURRENT_GAME)});
	};
	
	Template.game.title = function() {
		var g = Games.findOne({_id:Session.get(SESSION_CURRENT_GAME)});
		if (g)
			return g.title
		else
			return "Loading Game"
	}
	
	Template.game.round = function() {
		var g = Games.findOne({_id:Session.get(SESSION_CURRENT_GAME)});
		if (g)
			return g.round+1;
		else
			return 1;
	}
	
	Template.game.isOpen = function() {
		var g = Games.findOne({_id:Session.get(SESSION_CURRENT_GAME)});
		if (g) {
			return g.open || true;
		} else {
			return false;
		}
	}
	
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
	}
	
	Template.game.lastVote = function() {
		return Votes.findOne({gameId:Session.get(SESSION_CURRENT_GAME),round:Session.get(SESSION_CURRENT_ROUND)-1});
	}
	
	Template.game.rendered = refreshListviews;
	Template.game.created = createListviews;
	
	Handlebars.registerHelper("gameGame",Template.game.game);
	Handlebars.registerHelper("gameTitle",Template.game.title);
	Handlebars.registerHelper("gameIsOpen",Template.game.isOpen);
	Handlebars.registerHelper("gameRound",Template.game.round);
	Handlebars.registerHelper("gameIsOwner",Template.game.isOwner);
	Handlebars.registerHelper("gameLastVote",Template.game.lastVote);
	
	Template.judge.isJudge = function() {
		var theUserId = Meteor.userId();
		var currentGameId = Session.get(SESSION_CURRENT_GAME);
		return (theUserId == getJudgeIdForGameId(currentGameId));
	}
	
	Template.judge.judge = function() {
		return Meteor.users.findOne({_id:getJudgeIdForGameId(Session.get(SESSION_CURRENT_GAME))});
	}
	
	Template.judge.judgeEmailAddress = function() {
		return userIdToName(getJudgeIdForGameId(Session.get(SESSION_CURRENT_GAME)));
	}
	
	Template.judge.rendered = refreshListviews;
	Template.judge.created = createListviews;
	
	Handlebars.registerHelper("judgeIsJudge",Template.judge.judge);
	
	Template.question.question = function() {
		var gameDoc = Games.findOne({_id:Session.get(SESSION_CURRENT_GAME)});
		if (gameDoc) {
			return cardIdToText(gameDoc.questionId);
		} else {
			return "Loading question...";
		}
	}
	
	Template.question.rendered = refreshListviews;
	Template.question.created = createListviews;  
	
	Template.players.players = function () {
		var gameDoc = Games.findOne({_id:Session.get(SESSION_CURRENT_GAME)});
		return _.map(gameDoc.users, function (o) {return Meteor.users.findOne({_id:o})});
	}
	
	Template.players.rendered = refreshListviews;
	Template.players.created = createListviews;
	
	Template.scores.scores = function() {
		if (!Session.get(SESSION_CURRENT_GAME))
			return [];
		
		return scores(Session.get(SESSION_CURRENT_GAME));
	};
	
	Template.scores.rendered = refreshListviews;
	Template.scores.created = createListviews;
	
	Template.browse.games = function() {
		return Games.find({open:true}).fetch();
	};
	
	Template.browse.events = {
		'click a': joinGameOnClick
	}
	
	Template.browse.rendered = refreshListviews;
	Template.browse.created = createListviews;
	
	Template.myGames.games = function() {
		return Games.find({open:true,users:Meteor.userId()}).fetch();
	}
	
	Template.myGames.events = {
		'click a': joinGameOnClick
	}
	
	Template.myGames.rendered = refreshListviews;
	Template.myGames.created = createListviews;
	
	Template.submissions.submissions = function () {
		var submissions = Submissions.find({gameId:Session.get(SESSION_CURRENT_GAME),round:Session.get(SESSION_CURRENT_ROUND)}).fetch();
		return _.map(submissions, function(o) {return _.extend(Cards.findOne({_id:o.answerId},{fields:{_id:0}}),o)});
	}
	
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
	
	Template.submissions.rendered = refreshListviews;
	Template.submissions.created = createListviews;
	
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
	}
	
	Template.hand.rendered = refreshListviews;
	Template.hand.created = createListviews;
	
	Template.preview.text = function() {
		var gameDoc = Games.findOne({_id:Session.get(SESSION_CURRENT_GAME)});
		if (gameDoc)
			return questionAndAnswerText(gameDoc.questionId,Session.get(SESSION_CURRENT_PREVIEW_CARD));
		else
			return "Loading card...";
	}
	
	Template.preview.rendered = refreshListviews;
	Template.preview.created = createListviews;
}

Meteor.subscribe("openGames");
Meteor.subscribe("myHands");
Meteor.subscribe("myGames");
Meteor.subscribe("myOwnedGames");
Meteor.subscribe("cards");	

Meteor.startup(function() {
	Session.set(SESSION_CURRENT_ERROR,null);
	
	Meteor.autosubscribe(function() {
		var currentGameId = Session.get(SESSION_CURRENT_GAME);
		if (currentGameId) {
			Meteor.subscribe("submissions",currentGameId);
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
	
	// refresh listviews when logging in and out
	Meteor.autorun(function () {
		var loggingIn = Meteor.loggingIn();
		if (loggingIn) {
			refreshListviews();
		} else {
			refreshListviews();
		}
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
		queries: [{element:'[data-role="page"]',elementAttributes:'class'},{element:'[data-role="listview"]'},{element:'[data-role="button"]'}],
		callback: function(summaries) {
			refreshListviews();
		}
	});
});

registerTemplates();
