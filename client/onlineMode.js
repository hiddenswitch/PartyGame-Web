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
        Session.set("questionCardToSendId", questionCardId);
    }
};

// Callback for friend selection
friendsSelectedCallback = null;

// Event handler for invite button on friends selected
friendSelected = function () {
    var invitedFriendIds = _.map($('.facebookFriendBox:checked()'), function (e) {
        return $(e).attr('data-facebook-id')
    });

    friendsSelectedCallback(invitedFriendIds);
};

// List friend selection friends
Template.friendSelection.friends = function () {
    return Friends.find();
};