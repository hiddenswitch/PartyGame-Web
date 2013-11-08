/**
 * @author Benjamin Berman
 * © 2012 All Rights Reserved
 **/
Meteor.publish("localGames", function (location) {
    return Games.find(_.extend({open: true, location: null}, location ? {location: {$within: {$center: [
        [location[0], location[1]],
        K_LOCAL_DISTANCE
    ]}}} : null), {fields: {_id: 1, title: 1, customTitle: 1, players: 1, playerNames: 1, open: 1, round: 1, location: 1}});
});

Meteor.publish("questions", function () {
    return Questions.find({$or: [
        {judgeId: this.userId},
        {userIds: this.userId}
    ]});
});

Meteor.publish("histories", function () {
    return Histories.find({userId: this.userId});
});

Meteor.publish("myAnswers", function () {
    return Answers.find({userId: this.userId});
});

Meteor.publish("myJudges", function () {
    return Answers.find({judgeId: this.userId});
});

Meteor.publish("hand", function (gameId) {
    return Hands.find({userId: this.userId, gameId: gameId});
});

Meteor.publish("myGames", function () {
    return Games.find({userIds: this.userId}, {fields: {password: 0, questionCards: 0, answerCards: 0}});
});

Meteor.publish("players", function (gameId) {
    return Players.find({gameId: gameId});
});

Meteor.publish("submissions", function (gameId) {
    return Submissions.find({gameId: gameId}, {fields: {_id: 1, gameId: 1, answerId: 1, round: 1}});
});

Meteor.publish("votesInGame", function (gameId) {
    return Votes.find({gameId: gameId});
});

Meteor.publish("cards", function () {
    return Cards.find({});
});

Meteor.publish("myAvatars", function () {
    return Avatars.find({userId: this.userId});
});

Meteor.publish("inventories", function () {
    return Inventories.find({userId: this.userId});
});