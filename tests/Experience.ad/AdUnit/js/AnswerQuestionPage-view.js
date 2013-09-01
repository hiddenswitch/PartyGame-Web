iAP.EventDelegate.registerViewEventDelegate('view', 'AnswerQuestionPage', function() {

this.onViewActivate = function (event) {
	this.viewController.startActionListWithSourceView('(null)', this);
}
});
