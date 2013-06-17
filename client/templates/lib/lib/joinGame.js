/**
 * @author Benjamin Berman
 * © 2012 All Rights Reserved
 **/

joinGameOnClick = function(e) {
    var gameId = $(e.currentTarget).attr('id');
    console.log(gameId);
    Meteor.call("joinGame",gameId,function(e,r) {
        if (r) {
            Session.set(GAME,r);
        }
        if (e) {
            setError(e);
        }
    });
};

joinGame = function(title) {
    Meteor.call("joinGameWithTitle",title,function(e,r) {
        if (r) {
            Session.set(GAME,r);
            $.mobile.changePage('#roundSummary');
        }
        if (e) {
            $.mobile.changePage('#home');
            setError(e);
        }
    });
};