/**
 * @author Benjamin Berman
 * © 2012 All Rights Reserved
 **/
Template.historyAnswers.rendered = defaultRendered;
Template.historyAnswers.created = defaultCreated;
Template.historyAnswers.preserve(defaultPreserve);

Template.historyAnswers.answers = function () {
    return _.map(_.extend({answerCardIds: []}, Session.get("history")).answerCardIds, function (answerCardId) {
        return {_id: answerCardId, text: cardIdToText(answerCardId)};
    });
};

Template.historyAnswers.events = {
    'click a': function (e) {
        var answerCardId = $(e.currentTarget).attr('id');
        var history = Session.get("history");
        Meteor.call("writeAnswer", history._id, answerCardId);
        $.mobile.changePage('#gamesList');
    }
};
