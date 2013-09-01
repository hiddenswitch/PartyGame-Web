iAP.EventDelegate.registerViewEventDelegate('view2', 'AnswerQuestionPage', function() {

this.onViewActivate = function (event) {
	this.viewController.startActionListWithSourceView('(null)', this);
}
});
