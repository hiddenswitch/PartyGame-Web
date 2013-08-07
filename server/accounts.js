/**
 * @author Benjamin Berman
 * © 2012 All Rights Reserved
 **/
Accounts.loginServiceConfiguration.remove({});

Accounts.loginServiceConfiguration.insert({
  service: "facebook",
  clientId: Meteor.settings.facebook.appId,
  secret: Meteor.settings.facebook.appSecret
});

Accounts.loginServiceConfiguration.insert({
  service: "google",
  clientId: Meteor.settings.google.clientId,
  secret: Meteor.settings.google.clientSecret
});