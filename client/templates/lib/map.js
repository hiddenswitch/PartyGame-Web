/**
 * @author Benjamin Berman
 * © 2012 All Rights Reserved
 **/
(function leafletSetup() {
    L.Icon.Default.imagePath = 'packages/leaflet/images';
})();

Template.map.rendered = refreshListviewsAndCreateButtons;

Template.map.url = function(long,lat,width,height) {
    var zoom = 13;
    if (window.devicePixelRatio === 2) {
        width*=2;
        height*=2;
        zoom = 15;
    }
    return "http://staticmap.openstreetmap.de/staticmap.php?center={0},{1}&zoom={2}&size={3}x{4}&maptype=mapnik&markers={0},{1},lightblue".format(lat,long,zoom,width,height);
};

Template.map.local = function() {
    var location = Session.get("location");
    if (location && location.length == 2) {
        return Template.map.url(location[0],location[1],72,72);
    } else {
        return '/themes/images/redacted_72.png';
    }
};

Handlebars.registerHelper("mapUrl",function(location,width,height){
    if (location && location.length > 0) {
        return Template.map.url(location[0],location[1],width,height);
    } else {
        return '/themes/images/redacted_72.png';
    }
});