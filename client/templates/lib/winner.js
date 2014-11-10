/**
 * @author Benjamin Berman
 * © 2014 All Rights Reserved
 **/
Template.winner.rendered = refreshListviewsAndCreateButtons;

Template.winner.winner = function() {
    if (Session.get(GAME)) {
        var _scores = scores(Session.get(GAME));
        if (_scores && _scores.length > 0) {
            _scores = _.sortBy(_scores,function(s) {return s.score;});
            return _scores[_scores.length-1].name;
        }
    }
    return null;
};