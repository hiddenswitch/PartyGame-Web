/**
 * @author Benjamin Berman
 * © 2012 All Rights Reserved
 **/

// Event handler for answer question onclick
answerQuestion = function () {
    Meteor.call("getQuestionForUser", function (e, r) {
        if (e) {
            $.mobile.changePage('#home');
        }
        if (r) {
            Session.set("history", Histories.findOne({_id: r}));
        }
    });
};