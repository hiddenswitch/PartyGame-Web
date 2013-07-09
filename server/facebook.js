/**
 * @author Benjamin Berman
 * © 2012 All Rights Reserved
 **/
var Facebook = Meteor.require('facebook-node-sdk');

facebook = new Facebook({appID: Meteor.settings.facebook.appId, secret: Meteor.settings.facebook.appSecret});

