/**
 * @author Benjamin Berman
 * © 2014 All Rights Reserved
 **/

Template.registerHelper('$active', function(string) {
    return Router.current().route.getName() === string ? 'active' : undefined;
});

Template.navbar.events({
    'click [href]': function(event) {
        Router.go($(event.currentTarget).attr('href'));
    }
});