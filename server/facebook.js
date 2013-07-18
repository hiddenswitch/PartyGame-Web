/**
 * @author Benjamin Berman
 * © 2012 All Rights Reserved
 **/
var FacebookManager = {
    facebookNpm: Meteor.require('facebook-node-sdk')
};

FacebookManager.facebook = new FacebookManager.facebookNpm({
    appID: Meteor.settings.facebook.appId,
    secret: Meteor.settings.facebook.appSecret
});

Meteor.methods({
    'facebookQuery':function() {
        var query = Meteor.sync(function(done) {
            FacebookManager.facebook.api('/benjamin.berman.16', done);
        });

        return query;
    }
});