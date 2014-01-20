##### Milestone Subscriptions

`cards`

Returns all the card content in the game.

`localGames` - `location`

Returns abridged information about games local to you given a location. When `location` is `null`, it returns open games. I can't remember whether it latitude, longitude or longitude, latitude. This is `PartyMode`.

`allHands`

Returns your hands in all your games. Each document is a card.

`myGames`

Returns complete information about games you have joined. `PartyMode`.

`players` - `gameId`

Returns players in the game `gameId`. `PartyMode`.

`submissions` - `gameId`

Returns the cards submitted to judge in the game `gameId`. Note, these have a `round` field that correspond to the round they were submitted to.

`votesInGame` - `gameId`

Returns the judges' votes in the given `gameId`.

##### Post-Milestone

`myAvatars`

Avatars.

`inventories`

Your inventory.

`questions`

Returns the questions you have pending to judge or that you sent out for others to read. This is `OnlineMode`.

`histories`

Returns questions you have pending to answer. `OnlineMode`.

`answers`

Returns answers you've submitted to questions. `OnlineMode`.