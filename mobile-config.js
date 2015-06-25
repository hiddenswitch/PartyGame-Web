App.info({
    id: 'me.partyga.ios',
    name: 'PartyGame',
    description: 'Melts in your mouth, cuts off your hand.',
    author: 'Hidden Switch',
    email: 'benjamin.s.berman@gmail.com',
    website: 'https://partyga.me'
});

App.icons({
    ipad_2x: 'icons/icon-72-2x.png',
    iphone_2x: 'icons/icon-57-2x.png'
});

App.launchScreens({
    iphone5: 'splash/Default-568h@2x.png',
    iphone6: 'splash/iPhone6.png',
    iphone_2x: 'splash/Default@2x.png'
});

App.setPreference('BackgroundColor', '0xffffffff');

App.configurePlugin('com.phonegap.plugins.facebookconnect', {
    APP_ID: '214415182026572',
    APP_NAME: 'The Party Game'
});