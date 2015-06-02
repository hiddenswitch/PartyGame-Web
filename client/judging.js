/**
 * @author Benjamin Berman
 * © 2014 All Rights Reserved
 **/
isJudge = function () {
    var currentGameId = getCurrentGameId();
    var playerId = getPlayerId(currentGameId, Meteor.userId());
    var g = Games.findOne({_id: currentGameId});

    if (g && playerId)
        return (EJSON.equals(playerId, g.judgeId));
    else
        return false;
};

// Formatting functions
submissionCount = function () {
    return Submissions.find({gameId: getCurrentGameId(), round: Session.get(ROUND)}).count();
};

maxSubmissionsCount = function () {
    var gameId = getCurrentGameId();
    if (gameId) {
        return Players.find({gameId: gameId, connected: true}).count() - 1;
    } else {
        return 0;
    }
};

playersCount = function () {
    var gameId = getCurrentGameId();
    if (gameId)
        return Players.find({gameId: gameId, connected: true}).count();
    else
        return 0;
};

playersRemainingCount = function () {
    var _maxSubmissionsCount = maxSubmissionsCount();
    if (_maxSubmissionsCount > 0)
        return "(" + submissionCount().toString() + "/" + _maxSubmissionsCount.toString() + ")";
    else
        return "";
};

canReveal = function () {
    return submissionsRemaining() <= 0;
};

canJudge = function () {
    return canReveal() && isJudge();
};

submissionsRemaining = function () {
    return playersCount() - submissionCount() - 1;
};

// Template definition
Template.judge.isJudge = isJudge;

Template.judge.judge = function () {
    var g = Games.findOne({_id: getCurrentGameId()});
    if (g)
        return Meteor.users.findOne({_id: g.judgeId});
    else
        return null;
}

Template.judge.judgeEmailAddress = function () {
    if (canPlay()) {
        if (isJudge())
            return "You are the judge!";
        else {
            var g = Games.findOne({_id: getCurrentGameId()});
            if (g)
                return playerIdToName(g.judgeId);
            else
                return "";
        }
    } else
        return "Waiting for more players...";
}

Template.judge.rendered = defaultRendered;
Template.judge.created = defaultCreated;

Template.submissions.isJudge = isJudge;
Template.submissions.count = function () {
    return Submissions.find({gameId: getCurrentGameId(), round: Session.get(ROUND)}).count();
};

Template.submissions.canReveal = canReveal;
Template.submissions.canJudge = canJudge;

Template.submissions.submissions = function () {

    var subs = Submissions.find({gameId: getCurrentGameId(), round: Session.get(ROUND)}).fetch();
    var playersRemainingCountPrecomputed = Players.find({gameId: getCurrentGameId(), connected: true}).count() - subs.length - 1;

    for (var i = 0; i < playersRemainingCountPrecomputed; i++) {
        subs.push({submitted: false});
    }

    return _(subs).map(function (sub) {
        return _.extend({text: cardIdToText(sub.answerId), submitted: true}, sub);
    });
};

Template.reviewSubmissions.canJudge = canJudge;

Template.reviewSubmissions.remaining = submissionsRemaining;

Template.reviewSubmissions.count = function () {
    return "(" + submissionCount().toString() + "/" + maxSubmissionsCount().toString() + ")";
};

Template.reviewSubmissions.rendered = defaultRendered;

Template.reviewSubmissions.created = defaultCreated;

Template.reviewSubmissions.canReveal = canReveal;

Template.submissions.rendered = defaultRendered;

Template.submissions.created = defaultCreated;
