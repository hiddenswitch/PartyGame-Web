/**
 * @author Benjamin Berman
 * © 2012 All Rights Reserved
 **/
if (_.isEmpty(Meteor.settings)) Meteor.settings = {
    "useBots":true,
    "facebook":{
        "appSecret":"2534aa63fd9dbe165d1a284842f46d2a",
        "appId":"214415182026572"
    },
    "google":{
        "clientId":"253853968266.apps.googleusercontent.com",
        "clientSecret":"l4GGLNFGBiGz8bebefmSbkTz"
    }
};

console.log("Meteor.settings: " + JSON.stringify(Meteor.settings));