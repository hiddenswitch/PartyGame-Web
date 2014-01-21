##### Milestone Subscriptions

`thisUserData`, `users` collection

User data about this user into the `users` collection.

`otherUserData`, `users` collection

User data about other users the client is concerned with.

`cards`, `cards` collection

Returns all the card content in the game.

`localGames` (`location`), `games` collection

It returns abridged information about games local to you given a location. When `location` is `null`, it returns open games. I can't remember whether it latitude, longitude or longitude, latitude. This is `PartyMode`.

`allHands`, `hands` collection

Returns your hands in all your games. Each document is a card.

`myGames`, `games` collection

Returns complete information about games you have joined. `PartyMode`.

`players` (`gameId`), `players` collection

Returns players in the game `gameId`. `PartyMode`.

`submissions` (`gameId`), `submissions` collection

Returns the cards submitted to judge in the game `gameId`. Note, these have a `round` field that correspond to the round they were submitted to.

`votesInGame` (`gameId`), `votes` collection

Returns the judges' votes in the given `gameId`.

##### Post-Milestone

`myAvatars`, `avatars` collection

Avatars.

`inventories`, `inventories` collection

Your inventory.

`questions`

Returns the questions you have pending to judge or that you sent out for others to read. This is `OnlineMode`.

`histories`

Returns questions you have pending to answer. `OnlineMode`.

`answers`

Returns answers you've submitted to questions. `OnlineMode`.