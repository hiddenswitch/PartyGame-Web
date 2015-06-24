/**
 * @author Benjamin Berman
 * © 2014 All Rights Reserved
 **/
Meteor.startup(function() {
    Accounts.ui.config({
        requestPermissions: {facebook: ['email']},
        passwordSignupFields: 'USERNAME_AND_EMAIL'
    });
});