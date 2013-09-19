/**
 * @author Benjamin Berman
 * © 2012 All Rights Reserved
 **/

// URL handler
Meteor.Router.add({
    '/:gameTitle': function(gameTitle) {
        Session.set("invite",gameTitle);
        Meteor.defer(function() {
            $.mobile.changePage('#invitation');
        });
    }
});

// Template definition
Template.invitation.title = function() {
    return Session.get("invite");
};

// Client view event handlers
acceptInvite = function() {
    Meteor.call("joinOrCreateGameWithTitle",Session.get("invite"),function(e,r2) {
        if (r2) {
            Session.set(GAME,r2);
            $.mobile.changePage('#roundSummary');
        }
        if (e) {
            $.mobile.changePage('#home');
            setError(e);
        }
    });
};

loginAndAcceptInvite = function() {
    var nickname = $('anonymousNicknameInvitation').attr('value');
    createNewAnonymousUser(nickname,function(e,r) {
        // Join game
        if (r) {
            Meteor.call("joinOrCreateGameWithTitle",Session.get("invite"),function(e,r2) {
                if (r2) {
                    Session.set(GAME,r2);
                    $.mobile.changePage('#roundSummary');
                }
                if (e) {
                    $.mobile.changePage('#home');
                    setError(e);
                }
            });
        }
    });

};