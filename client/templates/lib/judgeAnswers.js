/**
 * @author Benjamin Berman
 * © 2014 All Rights Reserved
 **/
Template.judgeAnswers.rendered = defaultRendered;
Template.judgeAnswers.created = defaultCreated;

Template.judgeAnswers.answers = function () {
    return _.map(Answers.find({questionId: Session.get("questionId")}, {fields: {_id: 1, cardId: 1}}).fetch(), function (answer) {
        return _.extend(answer, {text: cardIdToText(answer.cardId)});
    });
};

Template.judgeAnswers.events = {
    'click a':function(e) {
        Router.go('home');
        var answerId = $(e.currentTarget).attr('id');
        Meteor.call("pickAnswer", answerId,function(e,r) {
            setError(e);
        });
    }
};