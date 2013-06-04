/**
 * @author Benjamin Berman
 * © 2012 All Rights Reserved
 **/
cardIdToText = function (cardId) {
    return _.extend({text: null}, Cards.findOne({_id: cardId})).text;
};