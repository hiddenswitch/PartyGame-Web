/**
 * @author Benjamin Berman
 * © 2012 All Rights Reserved
 **/
Template.game.game = function () {
    return Games.findOne({_id:Session.get(GAME)});
};

Template.game.title = function() {
    var g = Games.findOne({_id:Session.get(GAME)});
    if (g)
        return g.title;
    else
        return "REDACTED.";
};

Template.game.round = function() {
    var g = Games.findOne({_id:Session.get(GAME)});
    if (g)
        return g.round+1;
    else
        return 1;
};

Template.game.isOpen = function() {
    var g = Games.findOne({_id:Session.get(GAME)});
    if (g) {
        return g.open || true;
    } else {
        return false;
    }
};

Template.game.isOwner = function() {
    return false;
//		var g = Games.findOne({_id:Session.get(GAME)});
//		if (g) {
//			if (g.ownerId) {
//				return EJSON.equals(g.ownerId, playerIdForUserId(Session.get(GAME),Meteor.userId()));
//			} else {
//				return false;
//			}
//		} else {
//			return false;
//		}
};

Template.game.lastVote = function() {
    return Votes.findOne({gameId:Session.get(GAME),round:Session.get(ROUND)-1});
};

Template.game.rendered = refreshListviewsAndCreateButtons;
Template.game.created = defaultCreated;

Handlebars.registerHelper("gameGame",Template.game.game);
Handlebars.registerHelper("gameTitle",Template.game.title);
Handlebars.registerHelper("gameIsOpen",Template.game.isOpen);
Handlebars.registerHelper("gameRound",Template.game.round);
Handlebars.registerHelper("gameIsOwner",Template.game.isOwner);
Handlebars.registerHelper("gameLastVote",Template.game.lastVote);