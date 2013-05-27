/**
 * @author Benjamin Berman
 * © 2012 All Rights Reserved
 **/
var URL_TO_CARDS_TSV = "https://dl.dropboxusercontent.com/u/2891540/cards.tsv";

Meteor.methods({
    updateCardsFromGoogle:function() {
        (function (e, r) {
            if (r) {
                if (Cards.find().count() === 0) {
                    var cardsCounted = 0;
                    var cards = _.compact(_.map(r.content.split('\n').splice(1), function (o) {
                        o = o.split('\t');

                        if (o && o.length > 4) {
                            return {deck: o[1],
                                category: o[2],
                                type: o[3] == "Answer" ? CARD_TYPE_ANSWER : CARD_TYPE_QUESTION,
                                text: o[4]};
                        } else {
                            return null;
                        }
                    }));

                    _.each(cards,function(c) {
                        var deckId = null;
                        if (Decks.find({title: c.deck}).count() === 0) {
                            deckId = Decks.insert({title: c.deck, description:"From the Redacted Team, a " + c.category.toLowerCase() + " deck."});
                        } else {
                            deckId = Decks.findOne({title: c.deck},{fields:{_id:1}})._id;
                        }

                        c.text = c.text.replace(/_+/,K_BLANKS);

                        Cards.insert(_.extend(c,{deckId:deckId}));
                        cardsCounted++;
                    });
                    console.log(JSON.stringify({cardsCounted:0}));
                }
            }
            if (e) {
                console.log(e);
            }
        })(null,Meteor.http.get(URL_TO_CARDS_TSV));
    }
});