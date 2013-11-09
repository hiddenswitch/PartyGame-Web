/**
 * @author Benjamin Berman
 * © 2012 All Rights Reserved
 **/

K_SERVER = "server";
K_BOOSTER_PACK_SIZE = 15;

InventoryManager = {
    adjustInventoryQuantity: function (userId, itemType, itemId, deltaQuantity) {
        var item = {userId: userId, itemType: INVENTORY_ITEM_TYPE_CARD, itemId: itemId};
        if (Inventories.find(item).count() === 0) {
            item._id = Inventories.insert(_(item).extend({quantity: deltaQuantity}));
        } else {
            Inventories.update(item, {$inc: {quantity: deltaQuantity}});
        }
    },

    openBoosterPacks: function (count) {
        return CardManager.getCardIdMix(K_BOOSTER_PACK_SIZE * count);
    },

    creditBoosterPack: function (userId) {
        var cardIds = CardManager.getCardIdMix(K_BOOSTER_PACK_SIZE);

        _.each(cardIds, function (cardId) {
            InventoryManager.adjustInventoryQuantity(userId, INVENTORY_ITEM_TYPE_CARD, cardId, 1);
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