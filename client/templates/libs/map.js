/**
 * @author Benjamin Berman
 * © 2012 All Rights Reserved
 **/
(function leafletSetup() {
    L.Icon.Default.imagePath = 'packages/leaflet/images'
})();

Template.map.rendered = refreshListviewsAndCreateButtons;

Template.map.url = function(lat,long,width,height) {
    return "http://staticmap.openstreetmap.de/staticmap.php?center=" + [lat,long].join(',') + "&zoom=13&size="+[width,height].join('x')+"&maptype=mapnik";
};

Template.map.local = function() {
    var location = Session.get("location");
    if (location && location.length == 2) {
        return Template.map.url(location[0],location[1],72,72);
    }
};

Handlebars.registerHelper("mapUrl",function(location,width,height){
    if (location && location.length > 0) {
        return Template.map.url(location[0],location[1],width,height);
    } else {
        return '/themes/images/redacted_72.png';
    }
});