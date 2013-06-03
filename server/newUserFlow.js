/**
 * @author Benjamin Berman
 * © 2012 All Rights Reserved
 **/
// Configure user profiles
Accounts.onCreateUser(function(options, user) {
    if (options.profile)
        user.profile = options.profile;
    else
        user.profile = {};
    user.heartbeat = new Date().getTime();
    return user;
});