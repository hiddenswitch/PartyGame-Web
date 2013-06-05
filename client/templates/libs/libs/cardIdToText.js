/**
 * @author Benjamin Berman
 * © 2012 All Rights Reserved
 **/
cardIdToText = function (cardId) {
    return _.extend({text: null}, Cards.findOne({_id: cardId}, {fields: {text: 1}, limit: 1})).text;
};