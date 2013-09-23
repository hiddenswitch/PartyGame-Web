/**
 * @author Benjamin Berman
 * © 2012 All Rights Reserved
 **/
FacebookManager = {
    renderToCanvas: function (width, height, renderFunction) {
        var buffer = document.createElement('canvas');
        buffer.width = width;
        buffer.height = height;
        renderFunction(buffer.getContext('2d'));
        return buffer;
    },
    portraitWallRenderFunction: function (ctx) {
        var i = 0;
        _.each(Friends.find().fetch(), function (friend) {
            var portrait = new Image();
            var columns = Math.ceil(document.width / 50);
            var y = Math.floor(i / columns);
            var x = i % columns;
            portrait.onload = function () {
                ctx.drawImage(this, x * 50, y * 50);
            };
            portrait.src = friend.pic_square;
            i++;
        });
    },

    createPortraitWall: function () {
        return FacebookManager.renderToCanvas(document.width, 960, FacebookManager.portraitWallRenderFunction);
    }
};

loginWithFacebook = function() {
    Meteor.loginWithFacebook({requestPermissions:['xmpp_login']},setErrorAndGoHome);
};
