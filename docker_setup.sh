# Script for setting up the share-button-study Docker image from scratch.
#!/usr/bin/env bash
rm -r share-button-study/
git clone https://github.com/marcrowo/share-button-study.git
cd /share-button-study
yarn install
export FIREFOX_BINARY=/firefox/firefox
export DISPLAY=:10
Xvfb -ac $DISPLAY
openbox