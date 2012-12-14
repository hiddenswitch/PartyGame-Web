/**
 * @author Benjamin Berman
 */

Meteor.publish("openGames",function() {
	return Games.find({open:true},{fields:{password:0,questionCards:0,answerCards:0}});
});

Meteor.publish("myHands",function() {
	return Hands.find({userId:this.userId});
});

Meteor.publish("myGames",function() {
	return Games.find({users:this.userId},{fields:{password:0,questionCards:0,answerCards:0}});
});

Meteor.publish("myOwnedGames",function() {
	return Games.find({ownerId:this.userId},{fields:{password:0,questionCards:0,answerCards:0}});
});

Meteor.publish("submissions", function(gameId) {
	return Submissions.find({gameId:gameId},{fields:{_id:1,gameId:1,answerId:1,round:1}});
});

Meteor.publish("mySubmissions", function() {
	return Submissions.find({userId:this.userId});
});

Meteor.publish("votesInGame",function(gameId){
	return Votes.find({gameId:gameId});
});

Meteor.publish("cards",function() {
	return Cards.find({});
});

Meteor.publish("usersInGame",function(gameId) {
	return Meteor.users.find({},{fields:{_id:1,username:1,emails:1,profile:1}});
});

Meteor.startup(function () {
    // enable the geospatial index on games and users
    Games._ensureIndex({ location : "2d" });
    Meteor.users._ensureIndex({location:"2d"});


	
	if (Cards.find({}).count() < 1) {
		_.forEach(CAH_QUESTION_CARDS,function(c){
			Cards.insert({text:c,type:CARD_TYPE_QUESTION});
		});
		
		_.forEach(CAH_ANSWER_CARDS,function(c){
			Cards.insert({text:c,type:CARD_TYPE_ANSWER});
		});
	}

    // make sure users have full schema
    Meteor.users.update({heartbeat:{$exists:false},location:{$exists:false}},{$set:{heartbeat:new Date(),location:null}},{multi:true});

    // make sure games have full schema
    Games.update({connected:{$exists:false},modified:{$exists:false}},{$set:{connected:[],modified:new Date()}},{multi:true});

    // maintenance
    Meteor.autorun(function() {
        // close old games or games with no connected users
        Games.find({open:true,$or:
            [{$where:"new Date() - this.modified > 20*" + K_HEARTBEAT}, // close the game after 20 heartbeats
                {connected:{$size:0}}]}).forEach(function(game){ // close games with no connected users
                Games.update({_id:game._id},
                    {$set:{open:false}});
                console.log("Closed game "+game._id);
        });
    });
});
