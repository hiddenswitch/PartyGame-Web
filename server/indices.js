/**
 * @author Benjamin Berman
 * © 2012 All Rights Reserved
 **/
Meteor.startup(function () {
    // enable the geospatial index on games and users
    Games._ensureIndex({location: "2d"});
    Games._ensureIndex({open: 1, modified: -1, userIds: 1});
    Votes._ensureIndex({gameId: 1});
    Hands._ensureIndex({gameId: 1});
    Hands._ensureIndex({userId: 1});
    Cards._ensureIndex({deckId: 1});
    Decks._ensureIndex({title: 1});
    Cards._ensureIndex({type: 1});
    Players._ensureIndex({userId: 1});
    Players._ensureIndex({gameId: 1, userId: 1, connected: 1});
    Submissions._ensureIndex({gameId: 1});
    Meteor.users._ensureIndex({heartbeat: -1});
    Meteor.users._ensureIndex({openGameIds: 1});
    Meteor.users._ensureIndex({acl: 1});
    Meteor.users._ensureIndex({location: "2d"});
    Meteor.users._ensureIndex({bot: 1});
    Answers._ensureIndex({questionId: 1});
    Histories._ensureIndex({questionId: 1});
    Inventories._ensureIndex({userId: 1, itemType: 1, itemId: 1});
});