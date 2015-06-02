/**
 * @author Benjamin Berman
 * © 2014 All Rights Reserved
 **/
Meteor.startup(function() {
    Deps.autorun(function() {
        Meteor.subscribe("localGames",Session.get(LOCATION));
    });

    Deps.autorun(function() {
        Meteor.subscribe("submissions",getCurrentGameId());
        Meteor.subscribe("votesInGame",getCurrentGameId());
        Meteor.subscribe("players",getCurrentGameId());
        Meteor.subscribe("hand",getCurrentGameId());
    });

    Deps.autorun(function() {
        Meteor.subscribe("thisUserData");
        Meteor.subscribe("otherUserData");
        Meteor.subscribe("histories");
        Meteor.subscribe("questions");
        Meteor.subscribe("answers");
        Meteor.subscribe("myGames");
        Meteor.subscribe("fbFriends");
        Meteor.subscribe("inventories");
    });
});