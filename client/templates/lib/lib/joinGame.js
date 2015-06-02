/**
 * @author Benjamin Berman
 * © 2014 All Rights Reserved
 **/

joinGameOnClick = function (e) {
    var gameId = $(e.currentTarget).attr('id');
    Router.go('roundSummary', {gameId: gameId});
    Meteor.call("joinGame", gameId, function (e, r) {
        if (e) {
            setError(e);
            Router.go('home');
        }
    });
};

joinGame = function (title) {
    Meteor.call("joinGameWithTitle", title, function (e, joinGameWithTitleResponse) {
        if (joinGameWithTitleResponse) {
            Router.go('roundSummary', {gameId: joinGameWithTitleResponse.gameId});
        }
        if (e) {
            Router.go('home');
            setError(e);
        }
    });
};
