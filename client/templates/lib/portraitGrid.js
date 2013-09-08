/**
 * @author Benjamin Berman
 * © 2012 All Rights Reserved
 **/

Template.portraitGrid.friends = function() {
    return Friends.find({},{limit:70});
};
