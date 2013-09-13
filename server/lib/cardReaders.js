/**
 * @author Benjamin Berman
 * © 2012 All Rights Reserved
 **/
var URL_TO_CARDS_TSV = "https://dl.dropboxusercontent.com/u/2891540/cards.tsv";

Meteor.methods({
    addCAHCards: function () {
        // Cards Against Humanity cards
        var CAHDeck = new Deck();
        CAHDeck.title = "Cards Against Humanity";
        CAHDeck.ownerId = "";
        CAHDeck.description = "The complete Cards Against Humanity questions and answers, licensed Creative Commons" +
            "2.0 BY-NC-SA.";
        CAHDeck.price = 0;

        var CAHId = Decks.insert(CAHDeck);

        _.each(CAH_QUESTION_CARDS, function (c) {
            Cards.insert({text: c.replace(/_+/g, K_BLANKS), type: CARD_TYPE_QUESTION, deckId: CAHId});
        });

        _.each(CAH_ANSWER_CARDS, function (c) {
            Cards.insert({text: c.replace(/_+/g, K_BLANKS), type: CARD_TYPE_ANSWER, deckId: CAHId});
        });

    },

    addGoogleCards: function () {
        Meteor.http.get(URL_TO_CARDS_TSV, function (e, r) {
            if (r) {
                var cardsCounted = 0;
                var cards = _.compact(_.map(r.content.split('\n').splice(1), function (o) {
                    o = o.split('\t');

                    if (o && o.length > 4 && o[0] !== 'Ignore') {
                        return {deck: o[1],
                            category: o[2],
                            type: o[3] == "Answer" ? CARD_TYPE_ANSWER : CARD_TYPE_QUESTION,
                            text: o[4],
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
                console.log(JSON.stringify({cardsCounted: 0}));
            }
            if (e) {
                console.log(e);
            }
        });
    }
});