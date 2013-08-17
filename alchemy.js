/**
 * @author Benjamin Berman
 * © 2012 All Rights Reserved
 **/

// Players need to see all possible alchemies.
Meteor.publish("alchemies",function(){
    return Alchemies.find();
});


AlchemyManager = {
    combineCards: function (adjectiveCard, nounCard) {
        return adjectiveCard.text + " " + nounCard.text;
    }
};

Meteor.methods({
    alchemyCombine: function (adjectiveCardId, nounCardId, _userId) {
        if (!this.userId && !_userId) {
            throw new Meteor.Error(500, "When server calls alchemyCombine, you must impersonate a user.");
        } else if (_userId == null && this.userId) {
            _userId = this.userId;
        } else {
            throw new Meteor.Error(403, "Permission denied.")
        }

        // Check that the cards are valid
        if (Cards.find({_id: adjectiveCardId, type: CARD_TYPE_ADJECTIVE}).count() === 0) {
            throw new Meteor.Error(500, "Card with id {0} cannot be found or is not an adjective".format(adjectiveCardId));
        }

        if (Cards.find({_id: nounCardId, type: CARD_TYPE_NOUN}).count() === 0) {
            throw new Meteor.Error(500, "Card with id {0} cannot be found or is not an adjective".format(adjectiveCardId));
        }

        // Check that the player has these cards in his inventory.
        var user = Meteor.users.findOne({_id: _userId});

        if (!user) {
            throw new Meteor.Error(404, "User {0} not found.".format(_userId));
        }

        // Check that the player owns these cards.
        if (!user.inventory || !user.inventory.cards || !_.contains(user.inventory.cards, adjectiveCardId) || !_.contains(user.inventory.cards, nounCardId)) {
            throw new Meteor.Error(404, "User {0} does not own the cards {1} or {2}".format(_userId));
        }

        // Check if the alchemy already exists
        var alchemy = Alchemies.findOne({adjectiveCardId:adjectiveCardId, nounCardId:nounCardId});

        if (!alchemy) {
            // Build the alchemy
            var adjectiveCard = Cards.findOne({_id: adjectiveCardId});
            var nounCard = Cards.findOne({_id: nounCardId});

            alchemy = {
                _id: Alchemies.insert({adjectiveCardId: adjectiveCardId, nounCardId: nounCardId, text: AlchemyManager.combineCards(adjectiveCard, nounCard)})
            };
        }
        // TODO: Replace all occurrences of the card in the inventory more correctly?
        // It might not like the array thing I did here.
        Meteor.users.update({_id: _userId}, {$unset: {"inventory.cards.$": [adjectiveCardId, nounCardId]}});
        // Insert alchemy and kill nulled.
        Meteor.users.update({_id: _userId}, {$pull: {"inventory.cards": null}, $push: {"inventory.cards": alchemy._id}});

        // Return the alchemy id.
        return alchemy._id;
    }
});