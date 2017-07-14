/* eslint-env node, mocha */

const assert = require("assert");
const utils = require("./utils");
const clipboardy = require("clipboardy");
const firefox = require("selenium-webdriver/firefox");

const Context = firefox.Context;

// TODO create new profile per test?
// then we can test with a clean profile every time

async function urlBarTest(driver) {
  const urlBar = await utils.promiseUrlBar(driver);
  const text = await urlBar.getAttribute("placeholder");
  assert.equal(text, "Search or enter address");
}

async function toolbarTest(driver) {
  const button = await utils.promiseAddonButton(driver);
  const text = await button.getAttribute("tooltiptext");
  assert.equal(text, "Share this page");
}

async function copyPasteTest(driver) {
  // FIXME testText will automatically be treated as a URL
  // which means that it will be formatted and the clipboard
  // value will be different unless we pass in a URL text at
  // the start
  const testText = "about:test";

  // write dummy value just in case testText is already in clipboard
  await clipboardy.write("foobar");
  const urlBar = await utils.promiseUrlBar(driver);
  await urlBar.sendKeys(testText);

  await utils.copyUrlBar(driver);
  const clipboard = await clipboardy.read();
  assert(clipboard === testText);
}

async function disabledPageAnimationTest(driver) {
  // navigate to a disabled page
  driver.setContext(Context.CONTENT);
  await driver.get("about:blank");
  driver.setContext(Context.CHROME);

  await utils.copyUrlBar(driver);
  const { hasClass, hasColor } = await utils.testAnimation(driver);
  assert(!hasClass && !hasColor);
}

async function disabledPagePopupTest(driver) {
  // navigate to a regular page
  driver.setContext(Context.CONTENT);
  await driver.get("about:blank");
  driver.setContext(Context.CHROME);

  await utils.copyUrlBar(driver);
  const panelOpened = await utils.testPanel(driver);
  assert(!panelOpened);
}

async function regularPageAnimationTest(driver) {
  // navigate to a regular page
  driver.setContext(Context.CONTENT);
  await driver.get("http://mozilla.org");
  driver.setContext(Context.CHROME);

  await utils.copyUrlBar(driver);
  const { hasClass, hasColor } = await utils.testAnimation(driver);
  assert(hasClass && hasColor);
}

async function regularPagePopupTest(driver) {
  // navigate to a regular page
  driver.setContext(Context.CONTENT);
  await driver.get("http://mozilla.org");
  driver.setContext(Context.CHROME);

  await utils.copyUrlBar(driver);
  const panelOpened = await utils.testPanel(driver);
  assert(panelOpened);
}

async function overflowMenuTest(driver) {
  const window = driver.manage().window();
  const currentSize = await window.getSize();
  await window.setSize(640, 480);
  await utils.copyUrlBar(driver);
  assert(!(await utils.testPanel(driver)));
  await window.setSize(currentSize.width, currentSize.height);
}

async function uninstallAddonAnimationTest(driver, addonId) {
  await utils.uninstallAddon(driver, addonId);
  await utils.copyUrlBar(driver);
  const { hasClass, hasColor } = await utils.testAnimation(driver);
  assert(!hasClass && !hasColor);
}

async function uninstallAddonPopupTest(driver) {
  await utils.copyUrlBar(driver);
  assert(!(await utils.testPanel(driver)));
}

describe("Add-on Functional Tests", function() {
  // This gives Firefox time to start, and us a bit longer during some of the tests.
  this.timeout(15000);

  let driver;
  let addonId;

  before(async() => {
    driver = await utils.promiseSetupDriver();
    // install the addon
    addonId = await utils.installAddon(driver);
    // add the share-button to the toolbar
    await utils.addShareButton(driver);
  });

  after(() => driver.quit());

  afterEach(async() => {
    // wait for the animation to end before running subsequent tests
    await utils.waitForAnimationEnd(driver);
    // close the popup
    await utils.closePanel(driver);
  });

  it("should have a URL bar", async() => urlBarTest(driver));

  it("should have a toolbar button", async() => toolbarTest(driver));

  it("should have copy paste working", async() => copyPasteTest(driver));

  it("animation should not trigger on disabled page",
    async() => disabledPageAnimationTest(driver));

  it("popup should not trigger on disabled page", async() => disabledPagePopupTest(driver));

  it("animation should trigger on regular page", async() => regularPageAnimationTest(driver));

  it("popup should trigger on regular page", async() => regularPagePopupTest(driver));

  it("should not trigger treatments if the share button is in the overflow menu",
    async() => overflowMenuTest(driver));

  // ADDON UNINSTALLED
  it("should no longer trigger animation once uninstalled",
    async() => uninstallAddonAnimationTest(driver, addonId));

  it("should no longer trigger popup once uninstalled",
    async() => uninstallAddonPopupTest(driver));
});

describe("Multiple Window Add-on Functional Tests", function() {
  // This gives Firefox time to start, and us a bit longer during some of the tests.
  this.timeout(15000);

  let driver;
  let addonId;

  before(async() => {
    driver = await utils.promiseSetupDriver();
    // install the addon
    addonId = await utils.installAddon(driver);
    // add the share-button to the toolbar
    await utils.addShareButton(driver);

    // open a new window and switch to it this will test
    // the new window listener since this window was opened
    // *after* the addon was installed
    await utils.openWindow(driver);
  });

  after(() => driver.quit());

  afterEach(async() => {
    // wait for the animation to end before running subsequent tests
    await utils.waitForAnimationEnd(driver);
    // close the popup
    await utils.closePanel(driver);
  });

  it("should have a URL bar", async() => urlBarTest(driver));

  it("should have a toolbar button", async() => toolbarTest(driver));

  it("should have copy paste working", async() => copyPasteTest(driver));

  it("animation should not trigger on disabled page",
    async() => disabledPageAnimationTest(driver));

  it("popup should not trigger on disabled page", async() => disabledPagePopupTest(driver));

  it("animation should trigger on regular page", async() => regularPageAnimationTest(driver));

  it("popup should trigger on regular page", async() => regularPagePopupTest(driver));

  it("should not trigger treatments if the share button is in the overflow menu",
    async() => overflowMenuTest(driver));

  // ADDON UNINSTALLED
  it("should no longer trigger animation once uninstalled",
    async() => uninstallAddonAnimationTest(driver, addonId));

  it("should no longer trigger popup once uninstalled",
    async() => uninstallAddonPopupTest(driver));
});
