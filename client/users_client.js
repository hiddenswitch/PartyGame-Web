/**
 * @author Benjamin Berman
 * © 2012 All Rights Reserved
 **/
Meteor.startup(function() {
    Accounts.ui.config({
        requestPermissions: {facebook: ['email','xmpp_login']},
        passwordSignupFields: 'USERNAME_AND_EMAIL'
    });
});