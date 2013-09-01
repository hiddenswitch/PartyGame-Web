iAP.EventDelegate.registerViewEventDelegate('view4', 'AnswerQuestionPage', function() {

this.onViewActivate = function (event) {
	this.viewController.startActionListWithSourceView('(null)', this);
}
});
