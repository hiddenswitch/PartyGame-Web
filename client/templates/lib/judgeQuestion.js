/**
 * @author Benjamin Berman
 * © 2014 All Rights Reserved
 **/
Template.judgeQuestion.rendered = defaultRendered;
Template.judgeQuestion.created = defaultCreated;

Template.judgeQuestion.events = {
    'click a': function (e) {
        var questionId = $(e.currentTarget).attr('id');
        Session.set("questionId", questionId);
    }
};

Template.judgeQuestion.questions = function () {
    var questions = Questions.find({judgeId: Meteor.userId(), answerId: null}).fetch();

    return _.map(questions, function (question) {
        return _.extend(question, {text: cardIdToText(question.cardId)});
    });
};
