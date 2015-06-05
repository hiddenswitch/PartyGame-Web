/**
 * @author Benjamin Berman
 * © 2014 All Rights Reserved
 **/
// Adapted from http://stackoverflow.com/a/4673436/1757994
if (!String.prototype.format) {
    String.prototype.format = function () {
        var args = arguments;
        return this.replace(/{(\d+)}/g, function (match, number) {
            return typeof args[number] != 'undefined'
                ? args[number]
                : match
                ;
        });
    };
}