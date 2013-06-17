/**
 * @author Benjamin Berman
 * © 2012 All Rights Reserved
 **/
Template.answerQuestion.rendered = defaultRendered;
Template.answerQuestion.created = defaultCreated;
Template.answerQuestion.preserve(defaultPreserve);

Template.answerQuestion.events = {
    'click a': function (e) {
        var historyId = $(e.currentTarget).attr('id');
        Session.set("history", Histories.findOne({_id: historyId}));
    }
};

Template.answerQuestion.histories = function () {
    var histories = Histories.find({userId: Meteor.userId(), answerId: null}).fetch();

    return _.map(histories, function (history) {
        return _.extend(history, {text: cardIdToText(history.questionCardId)});
    });
};
