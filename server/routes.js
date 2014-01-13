/**
 * @author Benjamin Berman
 * © 2012 All Rights Reserved
 **/
// Define routes
Meteor.startup(function () {
    HTTP.publish(Cards, function () {
        return Cards.find({});
    });
});
