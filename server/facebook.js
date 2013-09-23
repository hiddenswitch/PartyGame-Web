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
    },
    friends: function(fb) {
        var query = Meteor.sync(function (done) {
            fb.api('/me/friends?fields=name,id,picture', done);
        });

        return query.result.data;
    }
};

Meteor.publish('fbFriends', function () {
    var self = this;
    var fb = FacebookManager.fb(FacebookManager.accessToken(this.userId));

    if (fb == null) {
        self.ready();
        return;
    }

    var fqlQuery = Meteor.sync(function (done) {
        var mutualFriendQuery = encodeURIComponent('SELECT uid, name, pic_square, mutual_friend_count FROM user WHERE uid IN (SELECT uid1 FROM friend WHERE uid2 = me()) ORDER BY mutual_friend_count DESC LIMIT 25').replace(/%20/g,'+');
        fb.api('/fql?q=' + mutualFriendQuery, done);
    });

    _.each(fqlQuery.result.data, function (friend) {
        self.added('fbFriends', friend.uid, _.omit(friend, 'uid'));
    });

    self.ready();
});