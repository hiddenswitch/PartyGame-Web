/**
 * @author Benjamin Berman
 * © 2012 All Rights Reserved
 **/

K_SERVER = "server";
K_BOOSTER_PACK_SIZE = 15;

InventoryManager = {
    openBoosterPacks: function (count) {
        return CardManager.getCardIdMix(K_BOOSTER_PACK_SIZE*count);
    }
};

Meteor.methods({
    creditBoosterPack: function (_userId) {
        if (!this.userId && !_userId) {
            throw new Meteor.Error(500, "When server calls alchemyCombine, you must impersonate a user.");
        } else if (_userId == null && this.userId) {
            _userId = this.userId;
        } else {
            throw new Meteor.Error(403, "Permission denied.");
        }

        var user = Meteor.users.findOne({_id: _userId});

        if (user == null) {
            throw new Meteor.Error(404, "User {0} not found.".format(_userId));
        }

        var cardIds = CardManager.getCardIdMix(K_BOOSTER_PACK_SIZE);

        Meteor.users.update({_id: _userId}, {$push: {"inventory.cards": cardIds}});
    }
});