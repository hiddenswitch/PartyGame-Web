/**
 * Created with JetBrains WebStorm.
 * User: bberman
 * Date: 5/26/13
 * Time: 7:07 PM
 * To change this template use File | Settings | File Templates.
 */

Template.browse.rendered = defaultRendered;
Template.browse.created = defaultCreated;
Template.browse.preserve(defaultPreserve);

Template.browse.games = function () {
    return Games.find({open: true}, {limit: 10, sort: {players: -1}, fields: {_id: 1, players: 1, title: 1, open: 1}});
};

Template.browse.events = {
    'click a': joinGameOnClick
};
