Package.describe({
    name: 'partygame-npm',
    summary: 'PartyGame NPM package dependencies',
    version: '1.0.0'
});

Package.onUse(function (api) {
    api.versionsFrom('1.0');
    api.addFiles('partygame-npm.js');
    api.export('PartyGameNpm', 'server');
});

Package.onTest(function (api) {
    api.use('tinytest');
    api.use('partygame-npm');
    api.addFiles('partygame-npm-tests.js');
});


Npm.depends({
    "facebook-node-sdk": "0.2.0",
    //"node-xmpp": "0.12.2",
    "apn": "1.4.3",
    "markdown": "0.5.0"
});
