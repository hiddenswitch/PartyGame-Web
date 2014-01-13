/**
 * @author Benjamin Berman
 * © 2012 All Rights Reserved
 **/
// Define routes
Meteor.startup(function () {
    // Collections
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

//    var methods = [
//        ['submitAnswerCard', 'gameId', 'answerId', 'playerId'],
//        ['pickWinner', 'gameId', 'submissionId'],
//        ['finishRound', 'gameId'],
//        ['kickPlayer', 'gameId', 'kickId'],
//        ['quitGame', 'gameId'],
//        ['currentJudge', 'gameId'],
//        ['closeGame', 'gameId'],
//        ['heartbeat', 'currentLocation'],
//        ['drawHands', 'gameId', 'handSize'],
//        ['findGameWithUser', 'userId'],
//        ['joinGameWithTitle', 'title'],
//        ['joinOrCreateGameWithTitle', 'title'],
//        ['joinGame', 'gameId'],
//        ['findGameWithFewPlayers', 'gameSize'],
//        ['findLocalGame', 'location'],
//        ['findAnyGame'],
//        ['createEmptyGame', 'title', 'password', 'location'],
//        ['sendQuestion', 'questionCardId', 'toUserIds'],
//        ['writeAnswer', 'historyId', 'answerCardId'],
//        ['getQuestionForUser'],
//        ['pickAnswer', 'answerId'],
//        ['registerForPush', 'runtimePlatform', 'deviceToken'],
//        ['inviteFriendsToGame', 'fbIds', 'message'],
//        ['facebookLoginWithAccessToken', 'id', 'email', 'name', 'accessToken'],
//        /*
//         * options: {profile, email, password, username}
//         * */
//        ['createUser', 'options'],
//        /*
//         * options: {resume: token}
//         * or
//         * options: {password, user: {username}}
//         * */
//        ['login', 'options']
//    ];
//
//    // Define stub impersonation methods
//    var secretKey = Meteor.uuid() + Meteor.uuid();
//    Meteor.methods(_.object(_.map(methods,function(m) {
//        return [secretKey + m[0],function(args,userId) {
//            this.setUserId(userId);
//            console.log(userId);
//            console.log("executed");
//            return Meteor.call.apply(this,[m[0]].concat(args));
//        }];
//    })));
//
//    // Methods
//    HTTP.methods(_.object(_.map(methods, function (m) {
//        return ['/api/' + m[0], function (data) {
////            try {
//                console.log(this.userId);
//                console.log(JSON.stringify(data));
//                console.log(secretKey+m[0]);
//                var r = Meteor.call(secretKey+m[0],data,this.userId);
//                console.log(JSON.stringify(r));
//                return JSON.stringify({result: r,
//                    error: null});
////            } catch (e) {
////                console.log(JSON.stringify(e));
////                return JSON.stringify({result: null,
////                    error: e});
////            }
//        }];
//    })));
});
