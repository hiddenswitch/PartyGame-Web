Redacted
========

An online Cards Against Humanity clone for network play.
Built on Meteor 0.7.0.1, from http://www.meteor.com

Installation
============

To run:

    ruby -e "$(curl -fsSL https://raw.github.com/mxcl/homebrew/go)"
    brew install node
    brew install npm
    curl https://install.meteor.com/ | sh
    sudo -H npm install -g meteorite
    git clone git@github.com:hiddenswitch/Redacted-Web.git
    cd Redacted-Web
    mrt --settings tests/settings/local.json

Visit [localhost](http://localhost:3000).

If you'd like to run it on the Internet, try

    mrt deploy --settings tests/settings/beta.json beta.partyga.me

The password is `***REMOVED***1`.

API
===

### Authentication
Use the token `uYkbutYituNjGcLyP` for API calls to play as `doctorpangloss`. For now, to get other login tokens, login to http://beta.partyga.me, open a Javascript console and execute `Accounts._storedLoginToken()`. This string is the token for the logged in user.

### Encoding
The response headers have the wrong encoding. Interpret the bytes as `UTF-8`.

#### Collections Methods
* `GET` - `/api/collection_name?token=user_token` *- all published data*
* `GET` - `/api/collection_name/:id?token=user_token` *- find one published document*

#### Collection Names

`/api/cards` - The full library of cards

###### Card Type Enums
```javascript
CARD_TYPE_QUESTION = 1; // card of type question
CARD_TYPE_ANSWER = 2; // card of type answer
CARD_TYPE_ADJECTIVE = 10;
CARD_TYPE_NOUN = 20;
```

###### Sample Data
```json
[
    {
        "deck": "Alex",
        "category": "Sexual",
        "type": 2,
        "text": "Child pornography.",
        "combo": false,
        "random": 0.6748673671390861,
        "deckId": "HkcaBLQuuC5sYQQCZ",
        "_id": "Q2XbNHZBTgd2TbKAG"
    },
    {
        "deck": "Alex",
        "category": "Sexual",
        "type": 2,
        "text": "Consensual Beastiality.",
        "combo": false,
        "random": 0.8061031710822135,
        "deckId": "HkcaBLQuuC5sYQQCZ",
        "_id": "rCB8W2vqax3njnWPM"
    },
    {
        "deck": "Alex",
        "category": "Sexual",
        "type": 2,
        "text": "A fallatio filibuster.",
        "combo": false,
        "random": 0.14464191277511418,
        "deckId": "HkcaBLQuuC5sYQQCZ",
        "_id": "urHkYEZbge9HLfRWZ"
    },
    {
        "deck": "Alchemy",
        "category": "Sex",
        "type": 20,
        "text": "DJ Filthy Phallus",
        "adjectiveId": "ao6QC7BRuxErRE4aJ",
        "nounId": "LdsytGQRpJxgaHrDW",
        "combo": true,
        "generic": false,
        "random": 0.04903906746767461,
        "_id": "vQKf9si6BQMNN5yoW"
    },
    {
        "deck": "Alchemy",
        "category": "Sex",
        "type": 20,
        "text": "live-action tentacle porn",
        "adjectiveId": "NWLwHYqCLwSggsAmS",
        "nounId": "zY3fc6egoC6gmp4qa",
        "combo": true,
        "generic": false,
        "random": 0.7377745481207967,
        "_id": "TZDMBgJZ34KSXFMHp"
    },
    {
        "deck": "Alchemy",
        "category": "Sex",
        "type": 10,
        "text": "Japanese",
        "combo": false,
        "random": 0.22870140755549073,
        "_id": "ZnoT3httRQzFtKdDu"
    },
    {
        "deck": "Alchemy",
        "category": "Sex",
        "type": 20,
        "text": "groping on the subway",
        "adjectiveId": "ZnoT3httRQzFtKdDu",
        "nounId": "eumXpQwCjbX3z5z2Y",
        "combo": true,
        "generic": false,
        "random": 0.07821978675201535,
        "_id": "kHZdGdpcQvKRKtsCK"
    },
    {
        "deck": "Alex",
        "category": "Sexual",
        "type": 1,
        "text": "What did I just try for the first time in bed?",
        "combo": false,
        "random": 0.968256761552766,
        "deckId": "aZLtZp4DcD2EZT5Ff",
        "_id": "h3HGedmnCHd433jqw"
    },
    {
        "deck": "Alex",
        "category": "Sexual",
        "type": 1,
        "text": "How do I know things are getting serious with my girlfriend?",
        "combo": false,
        "random": 0.641185819869861,
        "deckId": "aZLtZp4DcD2EZT5Ff",
        "_id": "JiSJongcB8EncsXXb"
    },
    {
        "deck": "Alex",
        "category": "Sexual",
        "type": 1,
        "text": "â–ˆâ–ˆâ–ˆâ–ˆ is a nickname for a Vagina in Africa.",
        "combo": false,
        "random": 0.2511931585613638,
        "deckId": "aZLtZp4DcD2EZT5Ff",
        "_id": "weshFGaSQuYKM8oiS"
    }
]
```

`/api/games?token=user_token` - Lists all the available games.
Only the server knows which cards are in the deck.

```json
[
    {
        "_id": "B4yfaCasQ8edNHP6m",
        "answerCardsCount": 920,
        "botLust": true,
        "created": 1389590716875,
        "creatorUserId": "AYYkdSNqct5ziX7FK",
        "customTitle": false,
        "judgeId": "LMcRz7sn74arDf7ZH",
        "location": [
            -118.38831373213597,
            34.0135182148905
        ],
        "locationFriendly": {
            "place_id": "9145685209",
            "licence": "Data Â© OpenStreetMap contributors, ODbL 1.0. http://www.openstreetmap.org/copyright",
            "osm_type": "way",
            "osm_id": "241764184",
            "lat": "34.0116375",
            "lon": "-118.3897425",
            "display_name": "Jefferson Boulevard, Culver City, Los Angeles County, California, 90232, United States of America",
            "address": {
                "road": "Jefferson Boulevard",
                "city": "Culver City",
                "county": "Los Angeles County",
                "state": "California",
                "postcode": "90232",
                "country": "United States of America",
                "country_code": "us"
            }
        },
        "modified": 1389590719230,
        "open": true,
        "ownerId": "LMcRz7sn74arDf7ZH",
        "playerIds": [
            "LMcRz7sn74arDf7ZH",
            "E89pNHejdTXy8qfru",
            "XD7c2DXhDJFjzte9Y",
            "jCiQ2GrYHma5zZZwJ",
            "yX5dMC4AZfuwRSv6P",
            "z9FGXz5MsbjYs7qdR"
        ],
        "playerNames": [
            "aerospacemodeler",
            "165",
            "stanlyn",
            "mollo",
            "bergaelster1234",
            "vacha2010"
        ],
        "players": 6,
        "questionCardsCount": 242,
        "questionId": "NzfGbXrHqwCs3asSB",
        "round": 0,
        "title": "Game #1",
        "userIds": [
            "AYYkdSNqct5ziX7FK",
            "XGdhT4oXyj57sycXC",
            "xQsE864sxuwckBKsc",
            "eKfwZ73qpX9Ranm57",
            "hNfBxH2ES7iZdPTeN",
            "hviHFh5LvzAyPNtED"
        ]
    }
]

```

`/api/hands?token=user_token` - Lists all the cards in the user's hands across all games.

```json
[
    {
        "userId": "3wgLDA4WKzMc8q8co",
        "gameId": "B4yfaCasQ8edNHP6m",
        "playerId": "jSfbh3qMiGa6c6Bxa",
        "cardId": "96E38x7RdMM9tCZcc",
        "_id": "WhcHrry4ENFN9m6qd"
    },
    {
        "userId": "3wgLDA4WKzMc8q8co",
        "gameId": "B4yfaCasQ8edNHP6m",
        "playerId": "jSfbh3qMiGa6c6Bxa",
        "cardId": "bFXth56adBcZGhjYa",
        "_id": "YEayzrxktJQ3RPJ7t"
    },
    {
        "userId": "3wgLDA4WKzMc8q8co",
        "gameId": "B4yfaCasQ8edNHP6m",
        "playerId": "jSfbh3qMiGa6c6Bxa",
        "cardId": "3hm3LftXwy53DBF5m",
        "_id": "YnPnwZdxYuXt6RSsp"
    },
    {
        "userId": "3wgLDA4WKzMc8q8co",
        "gameId": "B4yfaCasQ8edNHP6m",
        "playerId": "jSfbh3qMiGa6c6Bxa",
        "cardId": "AeRJoZBq5pPK5ExYS",
        "_id": "sbvakdHck8oNzffsC"
    },
    {
        "userId": "3wgLDA4WKzMc8q8co",
        "gameId": "B4yfaCasQ8edNHP6m",
        "playerId": "jSfbh3qMiGa6c6Bxa",
        "cardId": "4tvJp23GN6Mv4Q55A",
        "_id": "kL3JFiyjYzEj5ezyg"
    },
    {
        "userId": "3wgLDA4WKzMc8q8co",
        "gameId": "B4yfaCasQ8edNHP6m",
        "playerId": "jSfbh3qMiGa6c6Bxa",
        "cardId": "j7r3Ws7ZDGHBp65iY",
        "_id": "FErxy7sEEFd222hbe"
    },
    {
        "userId": "3wgLDA4WKzMc8q8co",
        "gameId": "B4yfaCasQ8edNHP6m",
        "playerId": "jSfbh3qMiGa6c6Bxa",
        "cardId": "PbRiqRRR5pRb7iEDm",
        "_id": "NvRS9ueRhG3TxdR5f"
    },
    {
        "userId": "3wgLDA4WKzMc8q8co",
        "gameId": "B4yfaCasQ8edNHP6m",
        "playerId": "jSfbh3qMiGa6c6Bxa",
        "cardId": "CnvBCGisRTefRmFiN",
        "_id": "Fpuy8rTHfEnxooMdv"
    }
]
```

`/api/players?gameId=the_game_id&token=user_token` - Lists all the players in the specified game.

```json
[
    {
        "name": "doctorpangloss",
        "gameId": "6u2p5KwWZMjkbkj2b",
        "userId": "3wgLDA4WKzMc8q8co",
        "voted": 1389592720581,
        "connected": true,
        "location": "",
        "open": true,
        "_id": "y2Zx9GDkHP5i3pL4J"
    },
    {
        "name": "gd",
        "gameId": "6u2p5KwWZMjkbkj2b",
        "userId": "Fu9jPvJbxXYP8JoWk",
        "voted": 1389592678554,
        "connected": true,
        "location": "",
        "open": true,
        "_id": "uRrFW5tXueKGEWoKm"
    },
    {
        "name": "lio",
        "gameId": "6u2p5KwWZMjkbkj2b",
        "userId": "LPcJ3Jtfcomm5TEnW",
        "voted": 1389592678355,
        "connected": true,
        "location": "",
        "open": true,
        "_id": "rrYTXuf7yc6WADj59"
    },
    {
        "name": "megawati",
        "gameId": "6u2p5KwWZMjkbkj2b",
        "userId": "SyiDEkWD9zHLtc9TE",
        "voted": 1389592678300,
        "connected": true,
        "location": "",
        "open": true,
        "_id": "3NzmxArg8trjCPAzK"
    },
    {
        "name": "freienwalde00",
        "gameId": "6u2p5KwWZMjkbkj2b",
        "userId": "q5GxrtrAvtEsCXgMC",
        "voted": 1389592678502,
        "connected": true,
        "location": "",
        "open": true,
        "_id": "PTFwjWFLsJi7zC27z"
    },
    {
        "name": "liebstadt2009",
        "gameId": "6u2p5KwWZMjkbkj2b",
        "userId": "xyfrGntGhxoMChymF",
        "voted": 1389592678400,
        "connected": true,
        "location": "",
        "open": true,
        "_id": "PgqShZHojRMSzXuc8"
    },
    {
        "name": "stingl",
        "gameId": "6u2p5KwWZMjkbkj2b",
        "userId": "y6Z5cHKo7FcwZvEzd",
        "voted": 1389592678450,
        "connected": true,
        "location": "",
        "open": true,
        "_id": "M3MxwAyLj9C5oSXyo"
    }
]
```

