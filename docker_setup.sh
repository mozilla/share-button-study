# Script for setting up the share-button-study Docker image from scratch.
#!/usr/bin/env bash
cd /share-button-study
yarn install
export FIREFOX_BINARY=/firefox/firefox
export DISPLAY=:10
Xvfb -ac $DISPLAY
openbox