/**
 * @author Benjamin Berman
 * © 2012 All Rights Reserved
 **/
Decks = new Meteor.Collection("decks");
Cards = new Meteor.Collection("cards");
Games = new Meteor.Collection("games");
Hands = new Meteor.Collection("hands");
Votes = new Meteor.Collection("votes");
Submissions = new Meteor.Collection("submissions");
Players = new Meteor.Collection("players");
Chats = new Meteor.Collection("chats");

// Online-only collections
Questions = new Meteor.Collection("questions");
Answers = new Meteor.Collection("answers");
Histories = new Meteor.Collection("history");

Question = function () {
    this.judgeId = null;
    this.cardId = null;
    this.created = new Date().getTime();
    this.modified = new Date().getTime();
    this.answerCount = 0;
    this.answerId = null;
    this.minimumAnswerCount = 5;
};

History = function () {
    this.userId = null;
    this.questionCardId = null;
    this.answerId = false;
    this.available = false;
    this.judged = false;
};

Answer = function () {
    this.userId = null;
    this.cardId = null;
    this.created = new Date().getTime();
    this.modified = new Date().getTime();
    this.winner = false;
    this.score = null;
    this.winningAnswerId = null;
};

Card = function () {
    this.type = CARD_TYPE_QUESTION;  // question or answer card
    this.deckId = ""; // The id of the deck
    this.text = ""; // text of the card
};

Deck = function () {
    this.title = "";
    this.ownerId = "";
    this.description = "";
    this.price = 0;
    this.storeData = {};
};

Hand = function () {
    this.gameId = null;
    this.playerId = 0;
    this.userId = null;
    this.round = 0; // round number of this hand
    this.hand = []; // Array of card Ids
};

Vote = function () {
    this.gameId = 0;
    this.round = 0;
    this.judgeId = 0;
    this.playerId = 0;
    this.questionId = 0;
    this.answerId = 0;
};

Submission = function () {
    this.gameId = 0;
    this.round = 0;
    this.playerId = 0;
    this.answerId = 0;
};

Player = function () {
    this.name = "";
    this.gameId = null;
    this.userId = null;
    this.voted = new Date().getTime();
    this.connected = false;
    this.location = "";
};

Chat = function () {
    this.gameId = 0;
    this.playerId = 0;
    this.dateTime = 0;
    this.text = "";
};