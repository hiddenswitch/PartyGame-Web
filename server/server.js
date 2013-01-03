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

Meteor.publish("votesInGame",function(gameId){
	return Votes.find({gameId:gameId});
});

Meteor.publish("cards",function() {
	return Cards.find({});
});

Meteor.publish("usersInGame",function(gameId) {
    // privacy concerns. but does not update correctly when gameId changes.
	return Meteor.users.find({},{fields:{_id:1,username:1,emails:1,profile:1,location:1}});
});

Meteor.startup(function () {
    // enable the geospatial index on games and users
    try {
        Games._ensureIndex({location:"2d",modified:-1});
        Meteor.users._ensureIndex({location:"2d"});
    } catch (e) {
        console.log("Indexing failure. " + e);
    }

    try {
        // Add a blank answer card.
        var blankAnswerCard = Cards.findOne(CARD_BLANK_ANSWER_CARD);

        if (blankAnswerCard)
            K_BLANK_ANSWER_CARD = blankAnswerCard._id;
        else
            K_BLANK_ANSWER_CARD = Cards.insert(CARD_BLANK_ANSWER_CARD)

        if (Cards.find({}).count() < 1) {
            _.forEach(CAH_QUESTION_CARDS,function(c){
                Cards.insert({text:c,type:CARD_TYPE_QUESTION});
            });

            _.forEach(CAH_ANSWER_CARDS,function(c){
                Cards.insert({text:c,type:CARD_TYPE_ANSWER});
            });
        }
    } catch (e) {
        console.log("Card creation failure.");
    }


    // make sure users have full schema
    try {
        Meteor.users.update({heartbeat:{$exists:false},location:{$exists:false}},{$set:{heartbeat:new Date(),location:null}},{multi:true});
    } catch (e) {
        console.log("User schema extension failure.");
    }


    // make sure games have full schema
    try {
        Games.update({connected:{$exists:false},modified:{$exists:false}},{$set:{connected:[],modified:new Date()}},{multi:true});
    } catch (e) {
        console.log("Game schema extension failure.");
    }


    // maintenance
    Meteor.autorun(function () {
        Games.find({open:true,$or:
            [{$where:"new Date() - this.modified > 20*" + K_HEARTBEAT}, // close the game after 20 heartbeats
                {connected:{$size:0}}]}).forEach(function(game){ // close games with no connected users
                Games.update({_id:game._id},
                    {$set:{open:false}});
                console.log("Closed game "+game._id);
        });
    });
});
