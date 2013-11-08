/**
 * @author Benjamin Berman
 * © 2012 All Rights Reserved
 **/
Accounts.loginServiceConfiguration.remove({});

Accounts.loginServiceConfiguration.insert({
  service: "facebook",
  appId: Meteor.settings.facebook.appId,
  clientId: Meteor.settings.facebook.appId,
  secret: Meteor.settings.facebook.appSecret,
  appSecret: Meteor.settings.facebook.appSecret
});

Accounts.loginServiceConfiguration.insert({
  service: "google",
  clientId: Meteor.settings.google.clientId,
  clientSecret: Meteor.settings.google.clientSecret
});

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
    return Meteor.users.find({_id: this.userId}, {fields: MY_USER_FIELDS });
});

Meteor.publish("otherUserData", function () {
    return Meteor.users.find({acl: this.userId}, {fields: OTHER_USER_FIELDS});
});

// Configure user profiles
Accounts.onCreateUser(function (options, user) {
    var bot = false;
    var currentLocation = null;
    if (options.profile) {
        if (_.has(options.profile, 'bot') && options.profile.bot === true) {
            options.profile = _.omit(options.profile, 'bot');
            bot = true;
        }

        if (_.has(options.profile, 'location') && options.profile.location !== null) {
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
    user.matchingValue = 0;
    user.unansweredHistoriesCount = 0;
    user.unjudgedQuestionsCount = 0;
    user.pendingJudgeCount = 0;
    user.location = currentLocation;
    user.avatar = {url: _.first(_.shuffle(DefaultAvatars))};

    // Credit starting cards
    for (var i = 0; i < 6; i++) {
        InventoryManager.creditBoosterPack(user._id);
    }

    return user;
});