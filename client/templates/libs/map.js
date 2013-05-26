/**
 * @author Benjamin Berman
 * © 2012 All Rights Reserved
 **/
(function leafletSetup() {
    L.Icon.Default.imagePath = 'packages/leaflet/images'
})();

Template.map.created = function() {
    // Get the current location
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(function (position) {
            Session.set("location",[position.coords.latitude,position.coords.longitude]);
        });
    }
}

Template.map.url = function(lat,long,width,height) {
    return "http://staticmap.openstreetmap.de/staticmap.php?center=" + [lat,long].join(',') + "&zoom=13&size="+[width,height].join('x')+"&maptype=mapnik";
}

Template.map.local = function() {
    var location = Session.get("location");
    return Template.map.url(location[0],location[1],72,72);
}