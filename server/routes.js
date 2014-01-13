/**
 * @author Benjamin Berman
 * © 2012 All Rights Reserved
 **/
// Define routes
Meteor.startup(function () {
    HTTP.publish(Cards, function () {
        return Cards.find({});
    });

    HTTP.publish(Games, function () {
        return Games.find({open: true}, {fields: {password: 0, questionCards: 0, answerCards: 0}});
    });

    HTTP.publish(Questions, function () {
        return Questions.find({$or: [
            {judgeId: this.userId},
            {userIds: this.userId}
        ]});
    });

    HTTP.publish(Histories, function () {
        return Histories.find({userId: this.userId});
    });

    HTTP.publish(Answers, function () {
        return Answers.find({userIds: this.userId});
    });

    HTTP.publish(Hands, function () {
        return Hands.find({userId: this.userId});
    });

    HTTP.publish(Players, function () {
        return Players.find({gameId: this.query.gameId});
    });

    HTTP.publish(Submissions, function (gameId) {
        return Submissions.find({gameId: this.query.gameId}, {fields: {_id: 1, gameId: 1, answerId: 1, round: 1}});
    });

    HTTP.publish(Votes, function () {
        return Votes.find({gameId: this.query.gameId});
    });

    HTTP.publish(Avatars, function () {
        return Avatars.find({userId: this.userId});
    });

    HTTP.publish(Inventories, function () {
        return Inventories.find({userId: this.userId});
    });
});
