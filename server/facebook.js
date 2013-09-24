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
    friends: function (fb) {
        var query = Meteor.sync(function (done) {
            fb.api('/me/friends?fields=name,id,picture', done);
        });

        return query.result.data;
    },
    sendMessageToUsers: function (fb, message, userId, fbUids) {
        // Get xmpp credentials
        if (userId == null) return null;
        var u = Meteor.users.findOne({_id: userId});
        if (!u || !u.services || !u.services.facebook) {
            throw new Meteor.Error(500, "You're not connected to Facebook!");
        }

        var accessToken = u.services.facebook.accessToken;
        var uid = u.services.facebook.id;

        Meteor.sync(function(done) {
            // Create client
            try {
                var xmpp = Meteor.require('node-xmpp');
                var client = new xmpp.Client({
                    jid: '-' + uid + '@chat.facebook.com',
                    api_key: Meteor.settings.facebook.appId,
                    secret_key: Meteor.settings.facebook.appSecret,
                    access_token: accessToken
                });

                client.on('online', function () {
                    // Send messages
                    client.send(new xmpp.Element('presence'));

                    _.each(fbUids, function (toUid) {
                        client.send(FacebookManager.messageStanza(xmpp, "-" + toUid + "@chat.facebook.com", message));
                    });

                    client.end();
                });
            } catch (e) {
                console.log(e);
                console.trace();
            } finally {
                done();
            }
        });
    },
    messageStanza: function (xmpp, to, message) {
        var stanza = new xmpp.Element('message', { to: to, type: 'chat' });
        stanza.c('body').t(message);
        return stanza;
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
        var mutualFriendQuery = encodeURIComponent('SELECT uid, name, pic_square, mutual_friend_count FROM user WHERE uid IN (SELECT uid1 FROM friend WHERE uid2 = me()) ORDER BY mutual_friend_count DESC LIMIT 80').replace(/%20/g, '+');
        fb.api('/fql?q=' + mutualFriendQuery, done);
    });

    _.each(fqlQuery.result.data, function (friend) {
        self.added('fbFriends', friend.uid, _.omit(friend, 'uid'));
    });

    self.ready();
});

Meteor.methods({
    inviteFriendsToGame:function(fbIds,message) {
        FacebookManager.sendMessageToUsers(FacebookManager.fb(FacebookManager.accessToken(this.userId)),message,this.userId,fbIds);
    }
});