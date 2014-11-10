/**
 * @author Benjamin Berman
 * © 2014 All Rights Reserved
 **/
cardIdToText = function (cardId) {
    return _.extend({text: "(Finding card...)"}, Cards.findOne({_id: cardId}, {fields: {text: 1}})).text;
};