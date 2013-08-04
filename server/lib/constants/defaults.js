/**
 * @author Benjamin Berman
 * © 2012 All Rights Reserved
 **/
if (_.isEmpty(Meteor.settings)) Meteor.settings = {
    "useBots":true,
    "facebook":{
        "appSecret":"***REMOVED***",
        "appId":"214415182026572"
    },
    "google":{
        "clientId":"253853968266.apps.googleusercontent.com",
        "clientSecret":"***REMOVED***"
    }
};

console.log("Meteor.settings: " + JSON.stringify(Meteor.settings));