/**
 * @author Benjamin Berman
 * © 2014 All Rights Reserved
 **/
RouteControllers = {};

RouteControllers.home = {
    path: '/'
};
RouteControllers.accountLogin = {};
RouteControllers.anonymousLogin = {};
RouteControllers.browse = {};
RouteControllers.chooseCardFromHand = {
    path: '/g/:gameId/hand'
};
RouteControllers.createGame = {
    path: '/cg/'
};
RouteControllers.gameOver = {
    path: '/g/:gameId/over'
};
RouteControllers.history = {};
RouteControllers.invitation = {};
RouteControllers.judge = {
    path: '/g/:gameId/judge'
};
RouteControllers.login = {};
RouteControllers.myGames = {};
RouteControllers.news = {};
RouteControllers.pickFriends = {};
RouteControllers.pickQuestion = {};
RouteControllers.preview = {
    path: '/g/:gameId/preview'
};
RouteControllers.roundSummary = {
    path: '/g/:gameId'
};
RouteControllers.waitForPlayers = {
    path: '/g/:gameId/w'
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
