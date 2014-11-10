/**
 * @author Benjamin Berman
 * © 2014 All Rights Reserved
 **/
Template.pendingQuestion.rendered = defaultRendered;
Template.pendingQuestion.created = defaultCreated;

Template.pendingQuestion.pendingAnswers = function () {
    var answers = Answers.find({userId: Meteor.userId(), winner: null}).fetch();

    return _.compact(_.map(answers, function (answer) {
        var question = Questions.findOne({_id: answer.questionId});
        if (question == null) {
            return null;
        } else {
            return _.extend(answer, {
                questionText: cardIdToText(question.cardId),
                answerText: cardIdToText(answer.cardId)});
        }
    }));
};