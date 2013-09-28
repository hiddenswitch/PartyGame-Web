/**
 * @author Benjamin Berman
 * © 2012 All Rights Reserved
 **/
var URL_TO_CARDS_TSV = "https://dl.dropboxusercontent.com/u/2891540/cards.tsv";

Meteor.methods({
    addCAHCards: function () {
        _.each(CAH_QUESTION_CARDS, function (c) {
            var card = {text: c.replace(/_+/g, K_BLANKS), type: CARD_TYPE_QUESTION, combo: false};
            if (Cards.find({text: card.text}).count() === 0) {
                Cards.insert(card);
            }
        });

        _.each(CAH_ANSWER_CARDS, function (c) {
            var card = {text: c.replace(/_+/g, K_BLANKS), type: CARD_TYPE_ANSWER, combo: false};
            if (Cards.find({text: card.text}).count() === 0) {
                Cards.insert(card);
            }
        });

    },

    addComboDecks: function () {
        var deck = _(Assets.getText('deck_sex_combos.tsv').split('\n')).map(function (row) {
            return _(['adjective', 'noun', 'result']).object(row.split('\t'));
        });

        _(deck).each(function (record) {
            var adjective = Cards.findOne({text: record.adjective});
            if (adjective == null) {
                adjective = {
                    deck: "Alchemy",
                    category: "Sex",
                    type: CARD_TYPE_ADJECTIVE,
                    text: record.adjective,
                    combo: false,
                    random: Math.random()
                };

                adjective._id = Cards.insert(adjective);
            }

            var noun = Cards.findOne({text: record.noun});
            if (noun == null) {
                noun = {
                    deck: "Alchemy",
                    category: "Sex",
                    type: CARD_TYPE_NOUN,
                    text: record.noun,
                    combo: false,
                    random: Math.random()
                };

                noun._id = Cards.insert(noun);
            }


            // Create special combos
            var result = Cards.findOne({text: record.result});
            if (result == null) {
                result = {
                    deck: "Alchemy",
                    category: "Sex",
                    type: CARD_TYPE_NOUN,
                    text: record.result,
                    adjectiveId: adjective._id,
                    nounId: noun._id,
                    combo: true,
                    generic: false,
                    random: Math.random()
                };

                result._id = Cards.insert(result);
            }
        });

        // Create generic combos
        var nouns = Cards.find({type: CARD_TYPE_NOUN, combo: false}).fetch();
        var adjectives = Cards.find({type: CARD_TYPE_ADJECTIVE}).fetch();
        _.each(nouns, function (noun) {
            _.each(adjectives, function (adjective) {
                var result = {
                    deck: "Alchemy",
                    category: "Sex",
                    type: CARD_TYPE_NOUN,
                    text: adjective.text + " " + noun.text,
                    adjectiveId: adjective._id,
                    nounId: noun._id,
                    combo: true,
                    generic: true,
                    random: Math.random()
                };

                // If there does not exist a combo for these cards, insert.
                if (Cards.find({combo: true, adjectiveId: adjective._id, nounId: noun._id}).count() === 0) {
                    result._id = Cards.insert(result);
                }
            });
        });
    },

    addGoogleCards: function () {
        var cardsCounted = 0;
        var cards = _.compact(_.map(Assets.getText('base_cards.tsv').split('\n').splice(1), function (o) {
            o = o.split('\t');

            if (o && o.length > 4 && o[0] !== 'Ignore') {
                return {deck: o[1],
                    category: o[2],
                    type: o[3] == "Answer" ? CARD_TYPE_ANSWER : CARD_TYPE_QUESTION,
                    text: o[4],
                    combo: false,
                    random: Math.random()
                };
            } else {
                return null;
            }
        }));

        _.each(cards, function (c) {
            var formattedText = c.text.replace(/_+/g, K_BLANKS);
            if (Cards.find({text: formattedText}).count() === 0) {
                var deckId = null;
                if (Decks.find({title: c.deck}).count() === 0) {
                    deckId = Decks.insert({title: c.deck, description: "From the Redacted Team, a " + c.category.toLowerCase() + " deck."});
                } else {
                    deckId = Decks.findOne({title: c.deck}, {fields: {_id: 1}})._id;
                }

                c.text = formattedText;

                Cards.insert(_.extend(c, {deckId: deckId}));
                cardsCounted++;
            }
        });
    }
});