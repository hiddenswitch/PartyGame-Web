/**
 * @author Benjamin Berman
 * © 2014 All Rights Reserved
 **/
AlchemyManager = {
    combineText: function (adjectiveCard, nounCard) {
        return adjectiveCard.text + " " + nounCard.text;
    },
    
    combineCardsForUser: function(adjectiveCardId, nounCardId, userId) {
        // Check that the cards are valid
        if (Cards.find({_id: adjectiveCardId, type: CARD_TYPE_ADJECTIVE}).count() === 0) {
            throw new Meteor.Error(500, "Card with id {0} cannot be found or is not an adjective".format(adjectiveCardId));
        }

        if (Cards.find({_id: nounCardId, type: CARD_TYPE_NOUN}).count() === 0) {
            throw new Meteor.Error(500, "Card with id {0} cannot be found or is not an adjective".format(adjectiveCardId));
        }

        // Check that the player has these cards in his inventory.
        var user = Meteor.users.findOne({_id: userId});

        if (!user) {
            throw new Meteor.Error(404, "User {0} not found.".format(userId));
        }

        // Check that the player owns these cards.
        if (Inventories.find({userId: userId, itemType: INVENTORY_ITEM_TYPE_CARD, itemId: adjectiveCardId}).count() === 0 ||
            Inventories.find({userId: userId, itemType: INVENTORY_ITEM_TYPE_CARD, itemId: nounCardId}).count() === 0) {
            throw new Meteor.Error(404, "User {0} does not own the cards {1} or {2}".format(userId));
        }

        // Credit the alchemy and debit the cards
        var combinedCard = Cards.findOne({combo: true, adjectiveCardId: adjectiveCardId, nounCardId: nounCardId});

        if (combinedCard == null) {
            throw new Meteor.Error(500, "A combination for these cards doesn't exist.");
        }

        Inventories.update({userId: userId, itemType: INVENTORY_ITEM_TYPE_CARD, itemId: adjectiveCardId}, {$inc: {quantity: -1}});
        Inventories.update({userId: userId, itemType: INVENTORY_ITEM_TYPE_CARD, itemId: nounCardId}, {$inc: {quantity: -1}});

        if (Inventories.find({userId: userId, itemType: INVENTORY_ITEM_TYPE_CARD, itemId: combinedCard._id}).count() === 0) {
            Inventories.insert({userId: userId, itemType: INVENTORY_ITEM_TYPE_CARD, itemId: combinedCard._id, quantity: 1});
        } else {
            Inventories.update({userId: userId, itemType: INVENTORY_ITEM_TYPE_CARD, itemId: combinedCard._id}, {$inc: {quantity: 1}});
        }

        // Return the combined card ID.
        return combinedCard._id;
    }
};

Meteor.methods({
    combineCardsForUser: function (adjectiveCardId, nounCardId) {
        if (this.userId == null) {
            throw new Meteor.Error(503, "Permission denied.");
        }
        
        return AlchemyManager.combineCardsForUser(adjectiveCardId, nounCardId, this.userId);
    }
});