# Share Button Study
![CircleCI badge](https://img.shields.io/circleci/project/github/marcrowo/share-button-study/master.svg?label=CircleCI)

The purpose of this extension is to visually highlight the share button in the browser toolbar when text from the URL bar is copied, and to serve as a template for new Shield studies.

## Overview
The share button study is a bootstrapped extension. See [Bootstrapped extensions](https://developer.mozilla.org/en-US/Add-ons/Bootstrapped_extensions) for more information.

As a starting point, you may want to read through `extension/bootstrap.js`.

## Setup

### Requirements
- [yarn](https://yarnpkg.com)
- Firefox version 55-56

### Install dependencies
The first step is to install dependencies with yarn by running `yarn install`. Yarn is used to ensure that all dependencies and their sub-dependencies are using the correct versions. If you do not use yarn, you may run into issues.

### Install extension

Once you have installed the dependencies, there are two main ways to add the extension to Firefox: manually or using the manual testing script.

#### Adding the extension manually
1. Go to `about:debugging`.
2. Click "Load Temporary Add-on".
3. Select any file in the `/extension` folder.

#### Using the manual testing script
The manual testing script (`npm run man`) uses the environment variable `FIREFOX_BINARY` to determine which version of Firefox to use. For example, a macOS user might run:

`export FIREFOX_BINARY='/Applications/Firefox Beta.app/Contents/MacOS/firefox' && npm run man`

## Testing
### Local testing
Once again, you must set the `FIREFOX_BINARY` variable to be the path of the Firefox binary you wish to use.

The functional test suite is run using `npm run test`.

The test harness, which can be run using `node test/test_harness.js`, runs the test suite multiple times and records the outcome to determine which tests are inconsistent. This is useful for improving consistency of Selenium tests, which often have timing issues.

### Docker container
- `Dockerfile`: the Dockerfile used on CircleCI. Also available on [Docker Hub](https://hub.docker.com/r/marcrowo/share-button-study-base/tags/).
- `docker_setup.sh`: Setup script for the Docker image to install dependencies etc. This is *not* used by CircleCI, which instead uses the CircleCI configuration files to install dependencies.