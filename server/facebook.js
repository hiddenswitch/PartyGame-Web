/**
 * @author Benjamin Berman
 * © 2012 All Rights Reserved
 **/
FacebookManager = {
    facebookNpm: Meteor.require('facebook-node-sdk'),
    fb: function (accessToken) {
        if (accessToken == null) return null;
        return new FacebookManager.facebookNpm({
            appID: Meteor.settings.facebook.appId,
            secret: Meteor.settings.facebook.appSecret
        }).setAccessToken(accessToken);
    },
    accessToken: function (userId) {
        if (userId == null) return null;
        var u = Meteor.users.findOne({_id: userId});
        if (u && u.services && u.services.facebook) {
            return u.services.facebook.accessToken;
        } else {
            return null;
        }
    }
};

Meteor.publish('fbFriends', function () {
    var self = this;
    var fb = FacebookManager.fb(FacebookManager.accessToken(this.userId));

    if (fb == null) {
        self.ready();
        return;
    }

    var query = Meteor.sync(function (done) {
        fb.api('/me/friends?fields=name,id,picture', done);
    });

    _.each(query.result.data, function (friend) {
        self.added('fbFriends', friend.id, _.omit(friend, 'id'));
    });

    self.ready();
});