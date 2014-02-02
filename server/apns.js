/**
 * @author Benjamin Berman
 * © 2012 All Rights Reserved
 **/
var apn = Meteor.require("apn");
var options = {
    certData: Assets.getText(Meteor.settings.apns.certificate),
    keyData: Assets.getText(Meteor.settings.apns.key),
    gateway: Meteor.settings.apns.gateway,
    fastMode: !Meteor.settings.apns.debug
};

var connection = new apn.Connection(options);


var feedback = new apn.Feedback(_.extend(options, {
    "batchFeedback": true,
    "interval": 300
}));

feedback.on("feedback", function (devices) {
    devices.forEach(function (item) {
        console.log("APNS Feedback: " + JSON.stringify(item));
    });
});

Notifications = {
    /**
     * Send a notification to a given query of users
     * @param {object} query The query to execute on the Meteor.users collection for the users to message
     * @param {object} notification A notification to send, extended from defaults
     */
    sendNotification: function (query, notification) {
        notification = _.extend(new apn.Notification(), _.extend({expiry: Math.floor(Date.now() / 1000) + 3600, sound: "default"}, notification));
        var users = Meteor.users.find(query).fetch();
        Meteor.sync(function (done) {
            _(users).each(function (user) {
                if (user.runtimePlatform == "IPhonePlayer" && user.deviceToken != null) {
                    connection.pushNotification(notification, new apn.Device(user.deviceToken));
                }
            });

            done();
        });
    },

    /**
     * Register for push notifications. Returns true if successful.
     * @param runtimePlatform
     * @param deviceToken
     * @returns {boolean}
     */
    registerForPush: function (runtimePlatform, deviceToken, userId) {
        Meteor.users.update({_id: this.userId}, {$set: {
            runtimePlatform: runtimePlatform,
            deviceToken: deviceToken
        }});

        return true;
    }
}

Meteor.methods({
    /**
     * Register for push notifications. Returns true if successful.
     * @param runtimePlatform
     * @param deviceToken
     * @returns {boolean}
     */
    registerForPush: function (runtimePlatform, deviceToken) {
        if (this.userId == null) {
            throw new Meteor.Error(503, "Permission denied.");
        }

        return Notifications.registerForPush(runtimePlatform, deviceToken, this.userId);
    }
});