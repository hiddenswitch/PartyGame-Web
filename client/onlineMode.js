/**
 * @author Benjamin Berman
 * © 2014 All Rights Reserved
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
    return Inventories.find({itemType: INVENTORY_ITEM_TYPE_CARD, 'card.type': CARD_TYPE_QUESTION, quantity: {$gt: 0}});
};

// Callback for friend selection
friendsSelectedCallback = null;

Template.questionSelection.events = {
    'click a': function (e) {
        var questionCardId = $(e.currentTarget).attr('id');
        friendsSelectedCallback = function (friendIds) {
            Meteor.call("sendQuestion", questionCardId, _.map(friendIds, function (id) {
                return {"services.facebook.id": id.toString()}
            }), setErrorAndGoHome);

            friendsSelectedCallback = null;
        };
    }
};


// Event handler for invite button on friends selected
friendSelected = function () {
    var invitedFriendIds = _.map($('.facebookFriendBox:checked()'), function (e) {
        return $(e).attr('data-facebook-id');
    });

    if (friendsSelectedCallback !== null) {
        friendsSelectedCallback(invitedFriendIds);
    }
};

// List friend selection friends
Template.friendSelection.friends = function () {
    return Friends.find();
};