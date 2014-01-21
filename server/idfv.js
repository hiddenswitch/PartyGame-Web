/**
 * @author Benjamin Berman
 * © 2012 All Rights Reserved
 **/

Accounts.addAutopublishFields({
    forLoggedInUser: ["services.idfv"]
});

Meteor.methods({
    /**
     * Login to Meteor with a IDFV from the device, considered a secret.
     * @param idfvToken The result of [[UIDevice currentDevice] identifierForVendor];
     * @returns A {id, token} dictionary.
     */
    loginWithIDFV: function (idfvToken) {
        var email = "-" + idfvToken + "@device.partyga.me";
        var options, serviceData;
        serviceData = {
            id: idfvToken,
            email: email
        };
        options = {
            profile: {
                name: "Device " + Meteor.uuid()
            }
        };

        // Returns a token you can use to login
        var loginResult = Accounts.updateOrCreateUserFromExternalService('idfv', serviceData, options);

        // Login the user
        this.setUserId(loginResult.id);

        // Return the token and the user id
        return loginResult;
    }
});