/* eslint-env node, mocha */

const assert = require("assert");
const utils = require("./utils");

describe.only("Simple Fake Tests", () => {
  it("should pass", () => {
    assert(true);
  });
  it("should fail", () => {
    assert(false);
  });
});

describe("Fake Tests", function() {
  // This gives Firefox time to start, and us a bit longer during some of the tests.
  this.timeout(15000);

  let driver;

  before(async() => {
    driver = await utils.promiseSetupDriver();
    // add the share-button to the toolbar
    await utils.addShareButton(driver);
  });

  after(async() => driver.quit());

  it("should have a share button", async() => {
    const button = await utils.promiseAddonButton(driver);
    const text = await button.getAttribute("tooltiptext");
    assert.equal(text, "Share this page");
  });

  it("this test should fail", async() => {
    assert(false);
  });

  it("this test should throw an error", async() => {
    throw new Error();
  });
});
