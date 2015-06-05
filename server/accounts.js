/**
 * @author Benjamin Berman
 * © 2014 All Rights Reserved
 **/
if (Meteor.settings
    && Meteor.settings.facebook
    && Meteor.settings.facebook.appId) {
    ServiceConfiguration.configurations.remove({});
    ServiceConfiguration.configurations.insert({
        service: "facebook",
        appId: Meteor.settings.facebook.appId,
        secret: Meteor.settings.facebook.appSecret
    });
    ServiceConfiguration.configurations.insert({
        service: "google",
        clientId: Meteor.settings.google.clientId,
        secret: Meteor.settings.google.clientSecret
    });
} else {
    console.log("Account settings were not configured. Try running the following command:");
    console.log("mrt --settings tests/settings/settings.json");
    console.log("with a Facebook App and Google App configured.");
}

K_INITIAL_COINS = 100;

var MY_USER_FIELDS = {
    profile: 1,
    questionIds: 1,
    score: 1,
    coins: 1,
    services: 1,
    avatar: 1
};

var OTHER_USER_FIELDS = {
    score: 1,
    coins: 1,
    avatar: 1,
    'profile.name': 1,
    emails: 1,
    username: 1,
    _id: 1
};

Meteor.publish("thisUserData", function () {
    return Meteor.users.find({_id: this.userId}, {fields: MY_USER_FIELDS});
});

Meteor.publish("otherUserData", function () {
    return Meteor.users.find({acl: this.userId}, {fields: OTHER_USER_FIELDS});
});

/**
 * Sets up a new user, regardless of whether they are a real user or a bot.
 */
Accounts.onCreateUser(function (options, user) {
    var now = new Date().getTime();

    user.bored = false;
    user.heartbeat = now;
    user.lastAction = now;
    user.questionIds = [];
    user.score = 0;
    user.coins = K_INITIAL_COINS;
    user.matchingValue = 0;
    user.unansweredHistoriesCount = 0;
    user.unjudgedQuestionsCount = 0;
    user.pendingJudgeCount = 0;
    user.avatar = {url: _.first(_.shuffle(DefaultAvatars))};

    var currentLocation = null;
    if (options.profile) {
        user = _.extend(user, options.profile);
    } else {
        user.profile = {};
    }

    // Credit starting cards
    for (var i = 0; i < 6; i++) {
        InventoryManager.creditBoosterPack(user._id);
    }

    var isHuman = !_.has(options, "bot") || options.bot === false;
    if (isHuman) {
        // Schedule a bot to entertain this user
        var handle = Meteor.users.find({_id: user._id}, {fields: {_id: 1}}).observe({
            added: function () {
                Bots.botOnAccountCreation(user._id, options.profile.location);
                handle.stop();
            }
        });
    }


    return user;
});