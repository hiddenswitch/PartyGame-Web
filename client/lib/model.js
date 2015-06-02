/**
 * @author Benjamin Berman
 * © 2014 All Rights Reserved
 **/
getCurrentGameId = function () {
    var current = Router.current();
    return current && current.params && current.params.gameId;
};