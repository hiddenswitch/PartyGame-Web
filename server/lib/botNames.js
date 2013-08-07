/**
 * @author Benjamin Berman
 * © 2012 All Rights Reserved
 **/
ShuffledBotNames = [];

Meteor.startup(function () {
    // Get bot names, erasing stuff that already exists.
    if (Usernames && Usernames.length > 0) {
        var existingUserNames = Meteor.users.find({}, {fields: {username: 1}}).fetch();
        existingUserNames = existingUserNames || [];
        ShuffledBotNames = _.shuffle(_.without(Usernames, existingUserNames));
        // Clear memory.
        Usernames = null;
    }
});