#!/bin/sh


# Install latest node
sudo apt-get update
sudo apt-get install -y python-software-properties python g++ make
sudo add-apt-repository -y ppa:chris-lea/node.js
sudo apt-get update
sudo apt-get install nodejs
sudo apt-get install npm

# Install meteorite
sudo -H npm install -g meteorite

# Install meteor
curl https://install.meteor.com | /bin/sh

git clone git@github.com:hiddenswitch/Redacted-Web.git