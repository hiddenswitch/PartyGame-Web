/**
 * @author Benjamin Berman
 * © 2012 All Rights Reserved
 **/

CardManager = {
    questionCards: [],
    answerCards: [],
    nounCards: [],
    adjectiveCards: [],
    allAnswerCards: [],
    updateAndShuffleCards: function () {
        var self = this;
        self.questionCards = _.shuffle(Cards.find({type: CARD_TYPE_QUESTION}).fetch());
        self.answerCards = _.shuffle(Cards.find({type: CARD_TYPE_ANSWER}).fetch());
        self.adjectiveCards = _.shuffle(Cards.find({type: CARD_TYPE_ADJECTIVE}).fetch());
        self.nounCards = _.shuffle(Cards.find({type: CARD_TYPE_NOUN}).fetch());
    },
    getQuestionCardsExcluding: function (exclusionIds) {
        var self = this;
        return _.filter(self.questionCards, function (card) {
            return !_.contains(exclusionIds, card._id);
        });
    },
    getRandomQuestionCardExcluding: function (exclusionIds) {
        var self = this;
        return _.first(_.shuffle(_.filter(self.questionCards, function (card) {
            return !_.contains(exclusionIds, card._id);
        })));
    },
    getAnswerCardsExcluding: function (exclusionIds) {
        var self = this;
        return _.filter(self.answerCards, function (card) {
            return !_.contains(exclusionIds, card._id);
        });
    },
    getCardMixExcluding: function(exclusionIds) {
        var self = this;
        return _.filter(_.union(nou))
    },
    getSomeAnswerCardsExcluding: function (exclusionIds, count) {
        var self = this;
        count = count || K_OPTIONS;
        var eligibleAnswerCards = null;

        if (self.answerCards.length - exclusionIds.length < count || exclusionIds == null || exclusionIds.length === 0) {
            eligibleAnswerCards = self.answerCards;
        } else {
            eligibleAnswerCards = _.shuffle(_.filter(self.answerCards, function (card) {
                return !_.contains(exclusionIds, card._id);
            }));
        }

        return eligibleAnswerCards.slice(0, 3);
    },
    getUnavailableQuestionCardIdsForUser: function (userId) {
        var unavailableQuestionCardIds = _.uniq(_.pluck(Histories.find({userId: userId, questionAvailable: false}, {fields: {questionCardId: 1}}).fetch(), 'questionCardId')) || [];

        if (unavailableQuestionCardIds.length >= Cards.find({type: CARD_TYPE_QUESTION}).count()) {
            unavailableQuestionCardIds = [];

            Histories.update({userId: _userId, questionAvailable: false}, {$set: {questionAvailable: true}}, {multi: true});
        }

        return unavailableQuestionCardIds;
    },
    getUnavailableAnswerCardIdsForUser: function (userId) {
        var unavailableAnswerCardIds = _.uniq(_.flatten(_.pluck(Histories.find({userId: userId, answersAvailable: false}, {fields: {answerCardIds: 1}}).fetch(), 'answerCardIds'))) || [];

        if (unavailableAnswerCardIds.length >= CardManager.answerCards.length - K_OPTIONS) {
            unavailableAnswerCardIds = [];

            Histories.update({userId: _userId, answersAvailable: false}, {$set: {answersAvailable: true}}, {multi: true});
        }

        return unavailableAnswerCardIds;
    },
    initializeCards: function () {
        CardManager.updateAndShuffleCards();
        Meteor.setInterval(CardManager.updateAndShuffleCards, K_10_MINUTES);
    }
};