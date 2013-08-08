cordova.define('cordova/plugin_list', function(require, exports, module) {
module.exports = window.isCordova ? [
    {
        "file": "/InAppBrowser.js",
        "id": "org.apache.cordova.core.inappbrowser.InAppBrowser",
        "clobbers": [
            "window.open"
        ]
    }
] : []
});