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