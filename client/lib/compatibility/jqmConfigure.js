/**
 * @author Benjamin Berman
 * © 2012 All Rights Reserved
 **/
$(document).bind("mobileinit", function (event, data) {
    $.mobile.autoInitializePage = false;
    $.mobile.defaultPageTransition = 'slide';
    $.mobile.page.prototype.options.domCache = true;
});