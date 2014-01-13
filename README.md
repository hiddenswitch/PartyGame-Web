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

The password is `GoAdvo+1`.

API
===

#### Collections
`http://localhost:3000/api/cards` - Lists all the cards

```json
[{"deck":"Alex","category":"Sexual","type":2,"text":"Child pornography.","combo":false,"random":0.6748673671390861,"deckId":"HkcaBLQuuC5sYQQCZ","_id":"Q2XbNHZBTgd2TbKAG"},{"deck":"Alex","category":"Sexual","type":2,"text":"Consensual Beastiality.","combo":false,"random":0.8061031710822135,"deckId":"HkcaBLQuuC5sYQQCZ","_id":"rCB8W2vqax3njnWPM"},{"deck":"Alex","category":"Sexual","type":2,"text":"A fallatio filibuster.","combo":false,"random":0.14464191277511418,"deckId":"HkcaBLQuuC5sYQQCZ","_id":"urHkYEZbge9HLfRWZ"},{"deck":"Alex","category":"Sexual","type":2,"text":"A bunch of dicks.","combo":false,"random":0.056655434193089604,"deckId":"HkcaBLQuuC5sYQQCZ","_id":"oLiGTY8Xk6QdKrTC5"}
```