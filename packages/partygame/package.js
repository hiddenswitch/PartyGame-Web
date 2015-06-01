Package.describe({
    name: 'partygame',
    summary: ' /* Fill me in! */ ',
    version: '1.0.0',
    git: ' /* Fill me in! */ '
});

Package.onUse(function (api) {
    api.versionsFrom('1.0');
    api.use('partygame-npm', 'server');
    api.addFiles('partygame.js');
});

Package.onTest(function (api) {
    api.use('tinytest');
    api.use('partygame');
    api.addFiles('partygame-tests.js');
});
