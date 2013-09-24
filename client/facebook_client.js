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

hasFacebook = function() {
    var u = Meteor.user();
    return u && u.services && u.services.facebook;
};

loginWithFacebook = function () {
////    if (Session.get(IS_CORDOVA)) {
//        $.mobile.loading('show');
//        loginWithFacebookNative();
////    } else {
        Meteor.loginWithFacebook({requestPermissions: ['xmpp_login']}, setErrorAndGoHome);
//    }
};

loginWithFacebookNative = function () {
    var login = function () {
        // init the FB JS SDK
        FB.init({
            appId: '524013571013561', // App ID from the App Dashboard
            channelUrl: Meteor.absoluteUrl('channel.html'), // Channel File for x-domain communication for localhost debug
            status: true, // check the login status upon init?
            cookie: true, // set sessions cookies to allow your server to access the session?
            xfbml: true,  // parse XFBML tags on this page?
            oauth: true
        });
        console.log("test");
        function callFacebookLogin(response) {
            FB.api('/me', function (fb_user) {
                console.log(fb_user);
                var accessToken = response.authResponse.accessToken;
                Meteor.call('facebookLoginWithAccessToken', fb_user, accessToken, function (error, r) {
                    console.log(error);
                    console.log(r);
                    if (r) {
                        Meteor.loginWithToken(r.token, function (e, r) {
                            $.mobile.loading('hide');
                        });
                    }
                    if (error) {
                        $.mobile.loading('hide');
                    }
                });
            });
        }

        FB.Event.subscribe('auth.authResponseChange', function(response) {
            console.log(response);
            if (response.status === 'connected') {
                callFacebookLogin(response);
            } else if (response.status === 'not_authorized') {
                FB.login(function (response) {
                    if (response.authResponse) {
                        console.log('Welcome!  Fetching your information.... ');
                        callFacebookLogin(response);
                    } else {
                        console.log('User cancelled login or did not fully authorize.');
                    }
                }, {scope: 'email,xmpp_login'});
            }
        });

        FB.login(function (response) {
            console.log("test2");
            if (response.authResponse) {
                console.log('Welcome!  Fetching your information.... ');
                callFacebookLogin(response);
            } else {
                console.log('User cancelled login or did not fully authorize.');
            }
        }, {scope: 'email,xmpp_login'});
    }

    if (window.fbAsyncInit) {
        login();
    } else {
        window.fbAsyncInit = login;
    }

    (function (d, debug) {
        var js, id = 'facebook-jssdk', ref = d.getElementsByTagName('script')[0];
        if (d.getElementById(id)) {
            return;
        }
        js = d.createElement('script');
        js.id = id;
        js.async = true;
        js.src = "//connect.facebook.net/en_US/all" + (debug ? "/debug" : "") + ".js";
        ref.parentNode.insertBefore(js, ref);
    }(document, /*debug*/ false));
};