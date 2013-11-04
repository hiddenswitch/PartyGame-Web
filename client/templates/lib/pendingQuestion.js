/**
 * @author Benjamin Berman
 * © 2012 All Rights Reserved
 **/
Template.pendingQuestion.rendered = defaultRendered;
Template.pendingQuestion.created = defaultCreated;
Template.pendingQuestion.preserve(defaultPreserve);

Template.pendingQuestion.pendingAnswers = function () {
    var answers = Answers.find({userId: Meteor.userId(), winner: null}).fetch();

    return _.map(answers, function (answer) {
        return _.extend(answer, {
            questionText: cardIdToText(Questions.findOne({_id: answer.questionId}, {fields: {cardId: 1}, reactive: false}).cardId),
            answerText: cardIdToText(answer.cardId)});
    });
};