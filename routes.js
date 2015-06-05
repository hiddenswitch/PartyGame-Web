/**
 * @author Benjamin Berman
 * © 2014 All Rights Reserved
 **/
RouteControllers = {};

var gameAction = function () {
    var gameId = getCurrentGameId();
    var game = Games.findOne(gameId, {fields: {judgeId: 1, round: 1, open: 1, players: 1}});
    if (_.isUndefined(this.currentRound)) {
        this.currentRound = game.round;
    }

    var myPlayerId = playerIdForUserId(Meteor.userId());
    if (_.isUndefined(this.isCurrentJudgeMe)) {
        this.isCurrentJudgeMe = myPlayerId === game.judgeId;
    }

    var currentRouteName = this.route.getName();
    if (this.currentRound !== game.round
        && currentRouteName !== 'roundSummary') {
        // If the round has changed, go to the round summary
        this.currentRound = game.round;
        this.redirect('roundSummary', {gameId: gameId});
    } else if (!canPlay(game)
        && currentRouteName !== 'roundSummary') {
        // If I can't play, redirect to waiting
        this.redirect('roundSummary', {gameId: gameId});
    } else if (myPlayerId === game.judgeId
        && !this.isCurrentJudgeMe) {
        // If I became the judge due to a drop out, switch views
        this.isCurrentJudgeMe = true;
        this.redirect('roundSummary', {gameId: gameId});
    } else if (myPlayerId !== game.judgeId
        && this.isCurrentJudgeMe) {
        // If I am not currently the judge but previously I was, record so. No changing of views necessary.
        this.isCurrentJudgeMe = false;
    } else if (game.open === false
        && currentRouteName !== 'gameOver') {
        // If the game is over, redirect to game over
        this.redirect('gameOver', {gameId: gameId});
    } else {
        this.render();
    }
};

RouteControllers.home = {
    path: '/'
};

RouteControllers.accountLogin = {};
RouteControllers.anonymousLogin = {};
RouteControllers.browse = {};
RouteControllers.chooseCardFromHand = {
    path: '/g/:gameId/hand',
    action: gameAction
};
RouteControllers.createGame = {
    path: '/cg/'
};
RouteControllers.gameOver = {
    path: '/g/:gameId/over',
    action: gameAction
};
RouteControllers.history = {};
RouteControllers.invitation = {};
RouteControllers.judge = {
    path: '/g/:gameId/judge',
    action: gameAction
};
RouteControllers.login = {};
RouteControllers.myGames = {};
RouteControllers.news = {};
RouteControllers.pickFriends = {};
RouteControllers.pickQuestion = {};
RouteControllers.preview = {
    path: '/g/:gameId/p/:cardId',
    action: gameAction
};
RouteControllers.roundSummary = {
    path: '/g/:gameId',
    action: gameAction
};
RouteControllers.waitForPlayers = {
    path: '/g/:gameId/w',
    action: gameAction
};

_.each(RouteControllers, function (routeController, routeName) {
    if (!routeController.path) {
        routeController.path = '/' + routeName;
    }
    if (!routeController.template) {
        routeController.template = routeName + 'View';
    }
    if (!routeController.yieldRegions) {
        routeController.yieldRegions = {
            'navbar': {to: 'navbar'}
        };
    }

    if (!routeController.layoutTemplate) {
        routeController.layoutTemplate = 'layout';
    }

    Router.route(routeName, routeController);
});

if (Meteor.isClient) {
    $.mobile = {
        initializePage: function () {
        },
        // Shim for jQuqeryMobile
        changePage: function (destination) {
            Router.go(destination.slice(1));
        },
        activePage: {
            attr: function () {
                return Router.current().route.getName();
            }
        }
    };
}
