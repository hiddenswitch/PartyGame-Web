/**
 * @author Benjamin Berman
 * © 2012 All Rights Reserved
 **/
Meteor.startup(function() {
    // Close games that haven't seen any activity for a while, delete games that have been closed for a while
    Meteor.setInterval(function () {
        Games.update({open:true,$or:[{modified:{$lt:new Date().getTime() - K_HEARTBEAT*20}},{questionCardsCount:0},{answerCardsCount:0}]},{$set:{open:false}},{multi:true});
        Meteor.call("clean");
    },40*K_HEARTBEAT);

    // Update player connected status. Bots are always connected
    Meteor.setInterval(function () {
        var disconnectedUsers = Meteor.users.find({'profile.bot':false,'profile.heartbeat':{$lt:new Date().getTime() - K_HEARTBEAT*2}}).fetch();

        // Set the connected attribute of the Players collection documents to false for disconnected users
        Players.update({userId:{$in:_.pluck(disconnectedUsers,'_id')},connected:true},{$set:{connected:false}},{multi:true});

        // Update the judges
        _.each(Games.find({open:true},{fields:{_id:1,judgeId:1}}).fetch(),function(g){
            var gameCurrentJudge = Meteor.call("currentJudge",g._id);
            if (g.judgeId !== gameCurrentJudge) {
                Games.update({_id:g._id},{$set:{judgeId:gameCurrentJudge}});
            }
        });

    },2*K_HEARTBEAT);
});

Meteor.methods({
    clean:function() {
        if (this.userId) {
            throw new Meteor.Error(503,"You must be an administrator to call this function.");
        }

        var closedGames = _.pluck(Games.find({open:false},{fields:{_id:1}}).fetch(),"_id");

        Hands.remove({gameId:{$in:closedGames}});
        Submissions.remove({gameId:{$in:closedGames}});
        Votes.remove({gameId:{$in:closedGames}});
        Players.remove({$or:[{gameId:{$in:closedGames}},{open:false}]});
    }
});