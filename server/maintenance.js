/**
 * @author Benjamin Berman
 * © 2012 All Rights Reserved
 **/
Meteor.startup(function() {
    // Close games that haven't seen any activity for a while, delete games that have been closed for a while
    Meteor.setInterval(function () {
        Games.update({open:true,$or:[{modified:{$lt:new Date().getTime() - K_HEARTBEAT*20}},{questionCardsCount:{$lt:1}},{answerCardsCount:{$lt:1}}]},{$set:{open:false}},{multi:true},function(e) {
            if (e) {
                console.log(e);
            }
        });

        Meteor.call("clean",function(e,r){
            if (r) {
                console.log(r);
            }
            if (e) {
                console.log(e);
            }
        });
    },10*K_HEARTBEAT);

    // Update player connected status. Bots are always connected
    Meteor.setInterval(function () {
        var disconnectedUsers = Meteor.users.find({bot:{$ne:true},heartbeat:{$lt:new Date().getTime() - K_HEARTBEAT*2}}).fetch();

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
        console.log("Cleaning...");
        var o = {};
        var closedGames = _.pluck(Games.find({open:false},{fields:{_id:1}}).fetch(),"_id");
        o.closedGames = closedGames.length;

        Hands.remove({gameId:{$in:closedGames}});
        Submissions.remove({gameId:{$in:closedGames}});
        Votes.remove({gameId:{$in:closedGames}});

        o.closedPlayers = Players.find({}).count();

        Players.remove({$or:[{gameId:{$in:closedGames}},{open:false}]});

        o.closedPlayers -= Players.find({}).count();

        Games.remove({$or:[{_id:{$in:closedGames}},{open:false}]});

        console.log(JSON.stringify(o));

        return o;
    }
});