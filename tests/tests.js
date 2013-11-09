/**
 * @author Benjamin Berman
 * © 2012 All Rights Reserved
 **/

// In browser to send questions to friends
Meteor.call("sendQuestion",Cards.findOne({type:CARD_TYPE_QUESTION})._id, _.map(_.pluck(Friends.find().fetch(),'_id'),function(u) {return {"services.facebook.id":u};}));
