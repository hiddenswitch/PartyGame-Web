iAP.EventDelegate.registerViewEventDelegate('view3', 'AnswerQuestionPage', function() {

this.onViewActivate = function (event) {
	this.viewController.startActionListWithSourceView('(null)', this);
}
});
