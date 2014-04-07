/**
 * @author Benjamin Berman
 * © 2012 All Rights Reserved
 **/
Template.historyQuestion.rendered = defaultRendered;
Template.historyQuestion.created = defaultCreated;

Template.historyQuestion.text = function () {
    return cardIdToText(_.extend({questionCardId: null}, Session.get("history")).questionCardId);
};