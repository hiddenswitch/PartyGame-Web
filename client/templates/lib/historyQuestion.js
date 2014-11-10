/**
 * @author Benjamin Berman
 * © 2014 All Rights Reserved
 **/
Template.historyQuestion.rendered = defaultRendered;
Template.historyQuestion.created = defaultCreated;

Template.historyQuestion.text = function () {
    return cardIdToText(_.extend({questionCardId: null}, Session.get("history")).questionCardId);
};