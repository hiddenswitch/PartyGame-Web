/**
 * @author Benjamin Berman
 * © 2012 All Rights Reserved
 **/

// URL handler
invitedHistoryId = null;
Meteor.Router.add({
    /**
     * Handle a game invitation
     * @param gameTitle
     */
    '/g/:gameTitle': function (gameTitle) {
        Session.set("invite", gameTitle);
        Meteor.defer(function () {
            $.mobile.changePage('#invitation');
        });
    },
    /**
     * Handle a history invite.
     * @param historyId
     */
    '/i/:historyId': function (historyId) {
        invitedHistoryId = historyId;
        loginAnonymouslyCallback = backToHistory;
        Session.set("history", Histories.findOne({_id: historyId}) || {_id: historyId});
        Meteor.defer(function () {
            $.mobile.changePage('#history');
        });
    }
});

// Template definition
Template.invitation.title = function () {
    return Session.get("invite");
};

Template.invitation.gameExists = function () {
    return Games.find({title: Session.get("invite")}).count() > 0;
};

Template.invitation.tagLine = function () {
    return _(_(["For drinking alone or with friends.",
        "Mobile, unless you're driving.",
        "Frequently asked questions. Infrequently given answers.",
        "Free as in speech. Free as in beer.",
        "A word game for people who can't spell."]).shuffle()).first();
};

Template.invitation.withPlayers = function () {
    var g = Games.findOne({title: Session.get("invite")});
    if (g && g.playerNames.length > 0) {

        return _(g.playerNames).reduce(function (text, name, i) {
            if (i === g.playerNames.length - 1) {
                return text + name;
            } else if (i === g.playerNames.length - 2) {
                return text + name + ' and ';
            } else {
                return text + name + ', ';
            }
        }, " with ");
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

/**
 * Go back to history on successful login.
 * @param e
 * @param r
 */
backToHistory = function (e, r) {
    if (r) {
        Session.set("history", Histories.findOne({_id: invitedHistoryId}))
        $.mobile.changePage('#history');
        loginAnonymouslyCallback = null;
    } else {
        setErrorAndGoHome(e, r);
    }
}