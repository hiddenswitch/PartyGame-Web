/**
 * @author Benjamin Berman
 * © 2014 All Rights Reserved
 **/
Meteor.startup(function() {
    Deps.autorun(function() {
        Meteor.subscribe("localGames",Session.get(LOCATION));
    });

    Deps.autorun(function() {
        Meteor.subscribe("submissions",Session.get(GAME));
        Meteor.subscribe("votesInGame",Session.get(GAME));
        Meteor.subscribe("players",Session.get(GAME));
        Meteor.subscribe("hand",Session.get(GAME));
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