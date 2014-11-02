/**
 * @author Benjamin Berman
 * © 2012 All Rights Reserved
 **/

joinGameOnClick = function(e) {
    var gameId = $(e.currentTarget).attr('id');
    Meteor.call("joinGame",gameId,function(e,r) {
        if (r) {
            Session.set(GAME,gameId);
        }
        if (e) {
            setError(e);
        }
    });
};

joinGame = function(title) {
    Meteor.call("joinGameWithTitle",title,function(e,joinGameWithTitleResponse) {
        if (joinGameWithTitleResponse) {
            Session.set(GAME,joinGameWithTitleResponse.gameId);
            $.mobile.changePage('#roundSummary');
        }
        if (e) {
            $.mobile.changePage('#home');
            setError(e);
        }
    });
};
