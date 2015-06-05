/**
 * @author Benjamin Berman
 * © 2014 All Rights Reserved
 **/

K_SERVER = "server";
K_BOOSTER_PACK_SIZE = 15;

InventoryManager = {
    adjustInventoryQuantity: function (userId, itemType, itemId, deltaQuantity, card) {
        var item = {userId: userId, itemType: INVENTORY_ITEM_TYPE_CARD, card: card, itemId: itemId};
        if (Inventories.find(item).count() === 0) {
            item._id = Inventories.insert(_(item).extend({quantity: deltaQuantity}));
        } else {
            Inventories.update(item, {$inc: {quantity: deltaQuantity}});
        }
    },

    openBoosterPacks: function (count) {
        return CardManager.getCardMix(K_BOOSTER_PACK_SIZE * count);
    },

    creditBoosterPack: function (userId) {
        var cards = CardManager.getCardMix(K_BOOSTER_PACK_SIZE);

        _.each(cards, function (card) {
            InventoryManager.adjustInventoryQuantity(userId, INVENTORY_ITEM_TYPE_CARD, card._id, 1, card);
        });
    },

    /**
     * Returns true if the user owns the specified card
     * @param userId
     * @param cardId
     */
    userOwnsCard: function(userId, cardId) {
        return Inventories.find({userId: userId, itemType: INVENTORY_ITEM_TYPE_CARD, itemId: cardId, quantity: {$gt: 0}}).count() > 0;
    }
};