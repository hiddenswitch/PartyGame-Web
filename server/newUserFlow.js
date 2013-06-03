/**
 * @author Benjamin Berman
 * © 2012 All Rights Reserved
 **/

var K_INITIAL_COINS = 100;

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

    return user;
});