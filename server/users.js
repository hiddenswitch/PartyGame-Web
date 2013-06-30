/**
 * @author Benjamin Berman
 * © 2012 All Rights Reserved
 **/

var K_INITIAL_COINS = 100;

Meteor.publish("userData",function() {
    return Meteor.users.find({_id:this.userId},{fields:{questionIds:1,score:1,coins:1}});
});

// Configure user profiles
Accounts.onCreateUser(function(options, user) {
    var bot = false;
    var currentLocation = null;
    if (options.profile) {
        if (_.has(options.profile,'bot') && options.profile.bot === true) {
            options.profile = _.omit(options.profile,'bot');
            bot = true;
        }

        if (_.has(options.profile,'location') && options.profile.location !== null) {
            currentLocation = options.profile.location;
        }

        user.profile = options.profile;
    } else {
        user.profile = {};
    }

    var now = new Date().getTime();

    user.bored = false;
    user.bot = bot;
    user.heartbeat = now;
    user.lastAction = now;
    user.questionIds = [];
    user.score = 0;
    user.coins = K_INITIAL_COINS;
    user.inventory = {decks:['Cards Against Humanity','Starter']};
    user.matchingValue = 0;
    user.unansweredHistoriesCount = 0;
    user.unjudgedQuestionsCount = 0;
    user.pendingJudgeCount = 0;
    user.location = currentLocation;


    console.log("new user: {0}".format(JSON.stringify(user)));

    return user;
});