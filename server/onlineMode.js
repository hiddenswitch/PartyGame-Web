/**
 * @author Benjamin Berman
 * © 2012 All Rights Reserved
 **/

K_ANSWERS_PER_QUESTION = 5;

Meteor.methods({
    writeAnswer: function (questionCardId, answerCardId, _userId) {
        if (!this.userId && !_userId) {
            throw new Meteor.Error(403, "Permission not granted.");
        } else if (this.userId) {
            _userId = this.userId;
        }

        // check that the question and answer cards exist
        if (Cards.find({_id:questionCardId}).count() === 0) {
            throw new Meteor.Error(404,"Question card with id {0} does not exist.".format(questionCardId));
        }

        if (Cards.find({_id:answerCardId}).count() === 0) {
            throw new Meteor.Error(404,"Answer card with id {0} does not exist.".format(answerCardId));
        }

        // Find or create this question with the given cardId which doesn't already have this answer
        var question = Questions.findOne({
            cardId: questionCardId,
            answerCount: {$lt: K_ANSWERS_PER_QUESTION},
            // The question doesn't already have this answer attached to it
            answerCardIds: {$nin: [answerCardId]}
        });

        // No question card was found, create one
        if (question === null) {
            question = {
                cardId: questionCardId,
                judgeId: null,
                created: Date.now(),
                modified: Date.now(),
                answerCardIds: [],
                answerCount: 0
            };

            question._id = Questions.insert(question);
        }

        // Assign the answer to the question
        var answer = {
            cardId: answerCardId,
            questionId: question._id,
            userId: _userId,
            created: Date.now(),
            modified: Date.now()
        };

        answer._id = Answers.insert(answer);

        // Update our local copy to avoid a database query.
        question.answerCardIds.push(answerCardId);
        question.answerCount++;
        question.modified = Date.now();

        Questions.update({_id: question._id}, {
            $push: {answerCardIds: answerCardId},
            $inc: {answerCount: 1},
            $set: {modified: Date.now()}
        });

        // if the question has reached the number of answers needed for judging, assign it a judge if it needs one
        if (question.answerCount >= K_ANSWERS_PER_QUESTION && question.judgeId === null) {
            Meteor.call("assignJudgeToQuestion", question._id);
        }

        // return the id of the answer
        return answer._id;
    }


});