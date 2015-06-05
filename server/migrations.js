/**
 * @author Benjamin Berman
 * © 2014 All Rights Reserved
 **/

Migrations.add({
    name: 'Load first version of cards',
    version: 1,
    up: function () {
        try {
            // Retrieve a specific version of the cards
            var cardSource = HTTP.get('https://raw.githubusercontent.com/hiddenswitch/PartyGame-Web/2f85e6abb255aa0f11ebd9f022f3430494f52f69/cards.js').content;
            // Load cards
            eval(cardSource);
        } catch (e) {
            console.error('Could not load cards from web.');
            console.error(e);
        }

        // Insert new cards
        _.each(CardsSource, function (card) {
            Cards.insert(card);
        });
    }
});

Meteor.startup(function () {
    Migrations.migrateTo(1);
});