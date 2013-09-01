iAP.EventDelegate.registerViewEventDelegate('button', 'AnswerQuestionPage', function() {

this.onViewActivate = function (event) {
	this.viewController.startActionListWithSourceView('AnswerQuestion Tutorialization', this);
}
});
