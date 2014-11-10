/**
 * @author Benjamin Berman
 * © 2012 All Rights Reserved
 **/

$.fn.listview = function() {};
$.fn.button = function() {};
$.mobile = {
    initializePage: function() {},
    changePage: function() {}
};

defaultPreserve = {
    'li[id]': function (node) {
        return node.id;
    }
};

refreshListviews = function() {
    $('ul[data-role="listview"]:not(.ui-listview):visible').listview();
    $('.ui-listview[data-role="listview"]').listview("refresh");
};

defaultRendered = function () {
    this.autorun(function () {
        var data = Template.currentData();
        Deps.afterFlush(refreshListviews);
    });
};

defaultCreated = function () {
    $('ul[data-role="listview"]:not(.ui-listview):visible').listview();
};

createAndRefreshButtons = function () {
    $('[data-role="button"]:visible').button();
};

refreshListviewsAndCreateButtons = function () {
    defaultRendered.apply(this);
    createAndRefreshButtons.apply(this);
};

refreshAll = function () {
    refreshListviewsAndCreateButtons.apply({findAll: document.querySelectorAll});
};