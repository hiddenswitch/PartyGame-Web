/**
 * @author Benjamin Berman
 * © 2012 All Rights Reserved
 **/

var K_INITIAL_COINS = 100;

Meteor.publish("userData",function() {
    return Meteor.users.find({_id:this.userId},{fields:{questionIds:1,score:1,coins:1,lastAction:1,heartbeat:1}});
});

// Configure user profiles
Accounts.onCreateUser(function(options, user) {
    if (options.profile) {
        user.profile = options.profile;
    } else {
        user.profile = {};
    }

    var now = new Date().getTime();

    user.heartbeat = now;
    user.lastAction = now;
    user.questionIds = [];
    user.score = 0;
    user.coins = K_INITIAL_COINS;
    user.inventory = {decks:['Cards Against Humanity','Starter']};
    user.matchingValue = 0;

    console.log("new user: {0}".format(JSON.stringify(user)));

    return user;
});