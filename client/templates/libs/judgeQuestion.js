/**
 * @author Benjamin Berman
 * © 2012 All Rights Reserved
 **/
Template.judgeQuestion.rendered = defaultRendered;
Template.judgeQuestion.created = defaultCreated;
Template.judgeQuestion.preserve({
    'li[id]': function (node) {
        return node.id;
    },
    'h2[id]': function (node) {
        return node.id;
    }
});

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
