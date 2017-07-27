/* eslint-env node, mocha */

const assert = require("assert");
const utils = require("./utils");
const clipboardy = require("clipboardy");
const firefox = require("selenium-webdriver/firefox");

const Context = firefox.Context;
const MAX_TIMES_TO_SHOW = 5; // this must match MAX_TIMES_TO_SHOW in bootstrap.js

// TODO create new profile per test?
// then we can test with a clean profile every time

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
    // reset the counter pref to 0 so that the treatment is always shown
    await driver.executeAsyncScript((callback) => {
      Components.utils.import("resource://gre/modules/Preferences.jsm");
      if (Preferences.has("extensions.sharebuttonstudy.counter")) {
        Preferences.set("extensions.sharebuttonstudy.counter", 0);
      }
      callback();
    });
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
    const urlBar = await utils.promiseUrlBar(driver);
    await urlBar.sendKeys(testText);

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

  it("popup should not trigger on disabled page", async() => {
    // navigate to a regular page
    driver.setContext(Context.CONTENT);
    await driver.get("about:blank");
    driver.setContext(Context.CHROME);

    await utils.copyUrlBar(driver);
    const panelOpened = await utils.testPanel(driver);
    assert(!panelOpened);
  });

  it("animation should trigger on regular page", () => regularPageAnimationTest(driver));

  it("should send telemetry pings for animation, doorhanger, and copy", async() => {
    // navigate to a regular page
    driver.setContext(Context.CONTENT);
    await driver.get("http://mozilla.org");
    driver.setContext(Context.CHROME);

    await utils.copyUrlBar(driver);
    const pings = await utils.getMostRecentPingsByType(driver, "shield-study-addon");

    let highlightTelemetrySent = false;
    let doorHangerTelemetrySent = false;
    let copyTelemetrySent = false;
    for (const ping of pings) {
      if (ping.payload.data.attributes.treatment === "highlight") {
        highlightTelemetrySent = true;
      }
      if (ping.payload.data.attributes.treatment === "doorhanger") {
        doorHangerTelemetrySent = true;
      }
      if (ping.payload.data.attributes.event === "copy") {
        copyTelemetrySent = true;
      }
      if (highlightTelemetrySent && doorHangerTelemetrySent && copyTelemetrySent) break;
    }
    assert(highlightTelemetrySent && doorHangerTelemetrySent && copyTelemetrySent);
  });

  it("popup should trigger on regular page", () => regularPagePopupTest(driver));

  it("should not trigger treatments if the share button is in the overflow menu", async() => {
    const window = driver.manage().window();
    const currentSize = await window.getSize();
    await window.setSize(640, 480);
    await utils.copyUrlBar(driver);
    assert(!(await utils.testPanel(driver)));
    await window.setSize(currentSize.width, currentSize.height);
  });

  it(`should only trigger MAX_TIMES_TO_SHOW = ${MAX_TIMES_TO_SHOW} times`, async() => {
    // NOTE: if this test failes, make sure MAX_TIMES_TO_SHOW has the correct value.

    // navigate to a regular page
    driver.setContext(Context.CONTENT);
    await driver.get("http://mozilla.org");
    driver.setContext(Context.CHROME);

    for (let i = 0; i < MAX_TIMES_TO_SHOW; i++) {
      /* eslint-disable no-await-in-loop */
      await utils.copyUrlBar(driver);
      // wait for the animation to end
      await utils.waitForAnimationEnd(driver);
      // close the popup
      await utils.closePanel(driver);
      /* eslint-enable no-await-in-loop */
    }
    // try to open the panel again, this should fail
    await utils.copyUrlBar(driver);
    const panelOpened = await utils.testPanel(driver);
    const { hasClass, hasColor } = await utils.testAnimation(driver);

    assert(!panelOpened && !hasClass && !hasColor);
  });

  // These tests uninstall the addon before and install the addon after.
  // This lets us assume the addon is installed at the start of each test.
  describe("Addon uninstall tests", () => {
    before(async() => utils.uninstallAddon(driver, addonId));

    after(async() => utils.installAddon(driver));

    it("should no longer trigger animation once uninstalled", async() => {
      await utils.copyUrlBar(driver);
      const { hasClass, hasColor } = await utils.testAnimation(driver);
      assert(!hasClass && !hasColor);
    });

    it("should no longer trigger popup once uninstalled", async() => {
      await utils.copyUrlBar(driver);
      assert(!(await utils.testPanel(driver)));
    });
  });
});

describe("New Window Add-on Functional Tests", function() {
  // This gives Firefox time to start, and us a bit longer during some of the tests.
  this.timeout(15000);

  let driver;

  before(async() => {
    driver = await utils.promiseSetupDriver();
    // install the addon
    await utils.installAddon(driver);
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

  it("animation should trigger on regular page", async() => regularPageAnimationTest(driver));

  it("popup should trigger on regular page", async() => regularPagePopupTest(driver));
});
