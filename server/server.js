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
    return Games.find({userIds:this.userId},{fields:{password:0,questionCards:0,answerCards:0}});
});

Meteor.publish("myOwnedGames",function() {
	return Games.find({ownerId:this.userId},{fields:{password:0,questionCards:0,answerCards:0}});
});

Meteor.publish("players",function(gameId) {
    return Players.find({gameId:gameId});
});

Meteor.publish("submissions", function(gameId,round) {
    var recordset = this;
    var game = Games.findOne({_id:gameId});
    var submissions = [];

    var updateSubmissions = function () {
        // get all the submissions for a particular game and round
        submissions = Submissions.find({gameId:gameId,round:round},{fields:{_id:1,gameId:1,answerId:1,round:1}}).fetch();
        connectedPlayersCount = Players.find({gameId:gameId,connected:true}).count();
        // if we have sufficient submissions, reveal them
        if (submissions.length >= connectedPlayersCount-1) {
            _.each(submissions,function(submission){
                recordset.set("submissions",submission._id, _.omit(submission,'_id'));
            });

        // otherwise, keep them hidden
        } else {
            _.each(submissions,function(submission){
                recordset.set("submissions",submission._id, _.omit(submission,['_id','answerId']));
            });
        }

        recordset.flush();
    };

    var submissionHandle = Submissions.find({gameId:gameId,round:round},{fields:{_id:1,gameId:1,answerId:1,round:1}}).observe({
        added: updateSubmissions,
        removed: updateSubmissions,
        changed: updateSubmissions
    });

    var gameHandle = Games.find({_id:gameId}).observe({
        changed: function(document,index,oldDocument) {
            game = document;
            updateSubmissions();
        }
    });

    recordset.complete();
    recordset.flush();

    recordset.onStop(function () {
        submissionHandle.stop();
        gameHandle.stop();
    });
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
    Accounts.onCreateUser(function(options, user) {
        if (options.profile)
            user.profile = options.profile;
        else
            user.profile = {};
        user.profile.heartbeat = new Date().getTime();
        return user;
    });

    // enable the geospatial index on games and users
    try {
        Games._ensureIndex({location:"2d",modified:-1});
        Votes._ensureIndex({gameId:1});
        Hands._ensureIndex({gameId:1});
        Cards._ensureIndex({deck:1});
        Cards._ensureIndex({type:1});
        Players._ensureIndex({gameId:1,userId:1,connected:1});
        Submissions._ensureIndex({gameId:1});
        Meteor.users._ensureIndex({'profile.heartbeat':1});
        Meteor.users._ensureIndex({'profile.location':"2d"});
    } catch (e) {
        console.log("Indexing failure. " + e);
    }

    try {
        if (Cards.find({}).count() < 1) {
            _.forEach(CAH_QUESTION_CARDS,function(c){
                Cards.insert({text:c,type:CARD_TYPE_QUESTION,deck:"Cards Against Humanity"});
            });

            _.forEach(CAH_ANSWER_CARDS,function(c){
                Cards.insert({text:c,type:CARD_TYPE_ANSWER,deck:"Cards Against Humanity"});
            });
        }
    } catch (e) {
        console.log("Card creation failure.");
    }


    // make sure users have full schema
    try {
        Meteor.users.update({heartbeat:{$exists:false},location:{$exists:false}},{$set:{heartbeat:new Date().getTime(),location:null}},{multi:true});
    } catch (e) {
        console.log("User schema extension failure.");
    }


    // make sure games have full schema
    try {
        Games.update({connected:{$exists:false},modified:{$exists:false}},{$set:{connected:[],modified:new Date().getTime()}},{multi:true});
    } catch (e) {
        console.log("Game schema extension failure.");
    }

    // Close games that haven't seen any activity for a while
    Meteor.setInterval(function () {
        Games.update({open:true,modified:{$lt:new Date().getTime() - K_HEARTBEAT*20}},{$set:{open:false}},{multi:true});
    },40*K_HEARTBEAT);

    // Update player connected status
    Meteor.setInterval(function () {
        var disconnectedUsers = Meteor.users.find({'profile.heartbeat':{$lt:new Date().getTime() - K_HEARTBEAT*2}}).fetch();

        // Set the connected attribute of the Players collection documents to false for disconnected users
        _.each(disconnectedUsers,function(disconnectedUser){
            Players.update({userId:disconnectedUser._id,connected:true},{$set:{connected:false}},{multi:true});
        });

        // Update the judges
        _.each(Games.find({open:true}).fetch(),function(g){
            var gameCurrentJudge = currentJudge(g._id);
            if (g.judge !== gameCurrentJudge) {
                Games.update({_id:g._id},{$set:{judge:gameCurrentJudge}});
            }
        });

    },2*K_HEARTBEAT);
});

var clearDatabase = function() {
    Games.remove({});
    Hands.remove({});
    Players.remove({});
    Votes.remove({});
    Cards.remove({});
    Submissions.remove({});
    Meteor.users.remove({});
};