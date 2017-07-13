/* eslint-env node, mocha */

const assert = require("assert");
const utils = require("./utils");
const clipboardy = require("clipboardy");
const firefox = require("selenium-webdriver/firefox");

const Context = firefox.Context;

// TODO create new profile per test?
// then we can test with a clean profile every time

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

  it("should have a URL bar", async() => {
    const urlBar = await utils.promiseUrlBar(driver);
    const text = await urlBar.getAttribute("placeholder");
    assert.equal(text, "Search or enter address");
  });

  it("should have a toolbar button", async() => {
    const button = await utils.promiseAddonButton(driver);
    const text = await button.getAttribute("tooltiptext");
    assert.equal(text, "Share this page");
  });

  it("should have copy paste working", async() => {
    // FIXME testText will automatically be treated as a URL
    // which means that it will be formatted and the clipboard
    // value will be different unless we pass in a URL text at
    // the start
    const testText = "about:test";

    // write dummy value just in case testText is already in clipboard
    await clipboardy.write("foobar");
    await utils.copyUrlBar(driver);
    const clipboard = await clipboardy.read();
    assert(clipboard === testText);
  });

  it("animation should not trigger on disabled page", async() => {
    // navigate to a disabled page
    driver.setContext(Context.CONTENT);
    await driver.get("about:blank");
    driver.setContext(Context.CHROME);

    await utils.copyUrlBar(driver);
    const { hasClass, hasColor } = await utils.testAnimation(driver);
    assert(!hasClass && !hasColor);
  });

  it("animation should trigger on regular page", async() => {
    // navigate to a regular page
    driver.setContext(Context.CONTENT);
    await driver.get("http://mozilla.org");
    driver.setContext(Context.CHROME);

    await utils.copyUrlBar(driver);
    const { hasClass, hasColor } = await utils.testAnimation(driver);
    assert(hasClass && hasColor);
  });

  it("popup should trigger on regular page", async() => {
    // navigate to a regular page
    driver.setContext(Context.CONTENT);
    await driver.get("http://github.com/mozilla");
    driver.setContext(Context.CHROME);

    await utils.copyUrlBar(driver);
    const panelOpened = await utils.testPanel(driver);
    assert(panelOpened);
  });

  it("should no longer trigger animation once uninstalled", async() => {
    await utils.uninstallAddon(driver, addonId);
    await utils.copyUrlBar(driver);
    const { hasClass, hasColor } = await utils.testAnimation(driver);
    assert(!hasClass && !hasColor);
  });

  it("should no longer trigger popup once uninstalled", async() => {
    await utils.copyUrlBar(driver);
    assert(!(await utils.testPanel(driver)));
  });
});
