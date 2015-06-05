/**
 * @author Benjamin Berman
 * © 2014 All Rights Reserved
 **/
Template.judgeQuestionDetail.rendered = defaultRendered;
Template.judgeQuestionDetail.created = defaultCreated;

Template.judgeQuestionDetail.text = function () {
    var cardId = _.extend({cardId: null}, Questions.findOne({_id: Session.get("questionId")}, {fields: {cardId: 1}})).cardId;
    return cardIdToText(cardId);
};