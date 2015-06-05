/**
 * @author Benjamin Berman
 * © 2014 All Rights Reserved
 **/
// Define routes

Meteor.startup(function () {
    // Collections
//    HTTP.publish(Cards, function () {
//        return Cards.find({});
//    });
//
//    HTTP.publish(Games, function () {
//        return Games.find({open: true}, {fields: {password: 0, questionCards: 0, answerCards: 0}});
//    });
//
//    HTTP.publish(Questions, function () {
//        return Questions.find({$or: [
//            {judgeId: this.userId},
//            {userIds: this.userId}
//        ]});
//    });
//
//    HTTP.publish(Histories, function () {
//        return Histories.find({userId: this.userId});
//    });
//
//    HTTP.publish(Answers, function () {
//        return Answers.find({userIds: this.userId});
//    });
//
//    HTTP.publish(Hands, function () {
//        return Hands.find({userId: this.userId});
//    });
//
//    HTTP.publish(Players, function () {
//        return Players.find({gameId: this.query.gameId});
//    });
//
//    HTTP.publish(Submissions, function (gameId) {
//        return Submissions.find({gameId: this.query.gameId}, {fields: {_id: 1, gameId: 1, answerId: 1, round: 1}});
//    });
//
//    HTTP.publish(Votes, function () {
//        return Votes.find({gameId: this.query.gameId});
//    });
//
//    HTTP.publish(Avatars, function () {
//        return Avatars.find({userId: this.userId});
//    });
//
//    HTTP.publish(Inventories, function () {
//        return Inventories.find({userId: this.userId});
//    });

    //// Get the function's parameter name
    //var argumentNames = function (func) {
    //    var fnStr = func.toString().replace(/((\/\/.*$)|(\/\*[\s\S]*?\*\/))/mg, '');
    //    var result = fnStr.slice(fnStr.indexOf('(') + 1, fnStr.indexOf(')')).match(/([^\s,]+)/g);
    //    if (result === null) {
    //        result = [];
    //    }
    //    return result;
    //};
    //
    //HTTP.methods(_.object(_.map(Party, function (method, methodName) {
    //    return ["/api/" + methodName, function (data) {
    //        data = _.extend(data, {userId: this.userId});
    //        var methodArgumentNames = argumentNames(method);
    //        var args = _.map(methodArgumentNames, function (argumentName) {
    //            return data[argumentName];
    //        });
    //
    //        try {
    //            return JSON.stringify({result: method.apply(this, args), error: null});
    //        } catch (e) {
    //            return JSON.stringify({result: null, error: e});
    //        }
    //    }];
    //})));
    //
    //HTTP.methods({
    //    "/api/docs": function () {
    //        var out = "API Summary\n" +
    //            "===========\n" +
    //            "\n" +
    //            _.map(Party, function (method, methodName) {
    //                var methodArgumentNames = argumentNames(method);
    //
    //                return "`/api/" + methodName + "?" + _.map(methodArgumentNames, function (argumentName) {
    //                    argumentName = argumentName == "userId" ? "token" : argumentName;
    //                    return argumentName + "=" + argumentName.toUpperCase();
    //                }).join('&') + '`';
    //            }).join('\n\n');
    //        var markdown = Meteor.require("markdown").markdown;
    //        return markdown.toHTML(out);
    //    }
    //});

});
