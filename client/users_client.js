/**
 * @author Benjamin Berman
 * © 2012 All Rights Reserved
 **/
Meteor.startup(function() {
    Accounts.ui.config({
        requestPermissions: {facebook: ['user_likes']},
        passwordSignupFields: 'USERNAME_AND_EMAIL'
    });
});