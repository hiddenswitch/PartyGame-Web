/**
 * @author Benjamin Berman
 * © 2012 All Rights Reserved
 **/

// URL handler
Meteor.Router.add({
    '/:gameTitle': function (gameTitle) {
        Session.set("invite", gameTitle);
        Meteor.defer(function () {
            $.mobile.changePage('#invitation');
        });
    }
});

// Template definition
Template.invitation.title = function () {
    return Session.get("invite");
};

Template.invitation.withPlayers = function() {
    var g = Games.findOne({title:Session.get("invite")});
    if (g && g.playerNames.length > 0) {

        return _(g.playerNames).reduce(function(text,name,i) {
            if (i === g.playerNames.length - 1) {
                return text + name;
            } else if (i === g.playerNames.length - 2) {
                return text + name + ' and ';
            } else {
                return text + name + ', ';
            }
        }," with ");
    } else {
        return "";
    }
};

// Client view event handlers
acceptInvite = function () {
    Meteor.call("joinOrCreateGameWithTitle", Session.get("invite"), function (e, r2) {
        if (r2) {
            Session.set(GAME, r2);
            $.mobile.changePage('#roundSummary');
        }
        if (e) {
            $.mobile.changePage('#home');
            setError(e);
        }
    });
};

loginAndAcceptInvite = function () {
    var nickname = $('#anonymousNicknameInvitation').attr('value');
    createNewAnonymousUser(nickname, function (e, r) {
        // Join game
        if (e) {
            return;
        }

        Meteor.call("joinOrCreateGameWithTitle", Session.get("invite"), function (e, r2) {
            if (r2) {
                Session.set(GAME, r2);
                $.mobile.changePage('#roundSummary');
            }
            if (e) {
                $.mobile.changePage('#home');
                setError(e);
            }
        });
    });

};