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

// List of questions you can select from
Template.questionSelection.questions = function () {
    return Cards.find({type: CARD_TYPE_QUESTION});
};

Template.questionSelection.events = {
    'click a': function (e) {
        var questionCardId = $(e.currentTarget).attr('id');
        Session.set("questionCardToSendId",questionCardId);
    }
};

Template.friendSelection.friends = function() {
    return Friends.find();
};