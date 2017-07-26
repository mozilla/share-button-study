const { classes: Cc, interfaces: Ci, utils: Cu } = Components;
Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/Console.jsm");
Cu.import("resource://gre/modules/AppConstants.jsm");
Cu.import("resource://gre/modules/XPCOMUtils.jsm");
XPCOMUtils.defineLazyModuleGetter(this, "studyUtils",
  "resource://share-button-study/StudyUtils.jsm");
XPCOMUtils.defineLazyModuleGetter(this, "config",
  "resource://share-button-study/Config.jsm");

const REASONS = {
  APP_STARTUP: 1,      // The application is starting up.
  APP_SHUTDOWN: 2,     // The application is shutting down.
  ADDON_ENABLE: 3,     // The add-on is being enabled.
  ADDON_DISABLE: 4,    // The add-on is being disabled. (Also sent during uninstallation)
  ADDON_INSTALL: 5,    // The add-on is being installed.
  ADDON_UNINSTALL: 6,  // The add-on is being uninstalled.
  ADDON_UPGRADE: 7,    // The add-on is being upgraded.
  ADDON_DOWNGRADE: 8,  // The add-on is being downgraded.
};
// REASONS[str] = int and REASONS[int] = str
for (const key in REASONS) {
  if (Object.prototype.hasOwnProperty.call(REASONS, key)) {
    REASONS[REASONS[key]] = key;
  }
}

const SHAREBUTTON_CSS_URI = Services.io.newURI("resource://share-button-study/share_button.css");
const PANEL_CSS_URI = Services.io.newURI("resource://share-button-study/panel.css");
const browserWindowWeakMap = new WeakMap();

function doorhangerTreatment(browserWindow, shareButton) {
  studyUtils.telemetry({ treatment: "doorhanger" });
  let panel = browserWindow.window.document.getElementById("share-button-panel");
  if (panel === null) { // create the panel
    panel = browserWindow.window.document.createElement("panel");
    panel.setAttribute("id", "share-button-panel");
    panel.setAttribute("type", "arrow");
    panel.setAttribute("noautofocus", true);
    panel.setAttribute("level", "parent");

    const embeddedBrowser = browserWindow.window.document.createElement("browser");
    embeddedBrowser.setAttribute("id", "share-button-doorhanger");
    embeddedBrowser.setAttribute("src", "resource://share-button-study/doorhanger.html");
    embeddedBrowser.setAttribute("type", "content");
    embeddedBrowser.setAttribute("disableglobalhistory", "true");
    embeddedBrowser.setAttribute("flex", "1");

    panel.appendChild(embeddedBrowser);
    browserWindow.window.document.getElementById("mainPopupSet").appendChild(panel);
  }
  panel.openPopup(shareButton, "bottomcenter topright", 0, 0, false, false);
}

function highlightTreatment(browserWindow, shareButton) {
  studyUtils.telemetry({ treatment: "highlight" });
  // add the event listener to remove the css class when the animation ends
  shareButton.addEventListener("animationend", browserWindow.animationEndListener);
  shareButton.classList.add("social-share-button-on");
}

// define treatments as STRING: fn(browserWindow, shareButton)
const TREATMENTS = {
  DOORHANGER: doorhangerTreatment,
  HIGHLIGHT: highlightTreatment,
};

async function chooseVariation() {
  let variation;
  const sample = studyUtils.sample;

  if (config.study.variation) {
    variation = config.study.variation;
  } else {
    // this is the standard arm choosing method
    const clientId = await studyUtils.getTelemetryId();
    const hashFraction = await sample.hashFraction(config.study.studyName + clientId);
    variation = sample.chooseWeighted(config.study.weightedVariations, hashFraction);
  }
  return variation;
}

class CopyController {
  // See https://developer.mozilla.org/en-US/docs/Mozilla/Tech/XUL/Property/controllers
  constructor(browserWindow) {
    this.browserWindow = browserWindow;
    this.treatment = studyUtils.getVariation().name;
  }

  supportsCommand(cmd) { return cmd === "cmd_copy" || cmd === "share-button-study"; }

  isCommandEnabled(cmd) { return true; }

  doCommand(cmd) {
    if (cmd === "cmd_copy") {
      studyUtils.telemetry({ event: "copy" });
      const shareButton = this.browserWindow.shareButton;
      if (shareButton !== null && // the button exists
          shareButton.getAttribute("disabled") !== "true" && // the page we are on can be shared
          shareButton.getAttribute("cui-areatype") === "toolbar" && // the button is in the toolbar
          shareButton.getAttribute("overflowedItem") !== "true") { // but not in the overflow menu
        if (this.treatment === "ALL") {
          Object.keys(TREATMENTS).forEach((key, index) => {
            if (Object.prototype.hasOwnProperty.call(TREATMENTS, key)) {
              TREATMENTS[key](this.browserWindow, shareButton);
            }
          });
        } else {
          TREATMENTS[this.treatment](this.browserWindow, shareButton);
        }
      }
    }
    // Iterate over all other controllers and call doCommand on the first controller
    // that supports it
    // Skip until we reach the controller that we inserted
    let i = 0;
    const urlInput = this.browserWindow.urlInput;

    for (; i < urlInput.controllers.getControllerCount(); i++) {
      const curController = urlInput.controllers.getControllerAt(i);
      if (curController.supportsCommand("share-button-study")) {
        i += 1;
        break;
      }
    }
    for (; i < urlInput.controllers.getControllerCount(); i++) {
      const curController = urlInput.controllers.getControllerAt(i);
      if (curController.supportsCommand(cmd)) {
        curController.doCommand(cmd);
        break;
      }
    }
  }

  onEvent(e) {}
}

class BrowserWindow {
  constructor(window) {
    this.window = window;

    // bind functions that are called externally so that `this` will work
    this.animationEndListener = this.animationEndListener.bind(this);
    this.insertCopyController = this.insertCopyController.bind(this);
    this.removeCopyController = this.removeCopyController.bind(this);
    this.addCustomizeListener = this.addCustomizeListener.bind(this);
    this.removeCustomizeListener = this.removeCustomizeListener.bind(this);

    // initialize CopyController
    this.copyController = new CopyController(this);
  }

  get urlInput() {
    // Get the "DOM" elements
    const urlBar = this.window.document.getElementById("urlbar");
    if (urlBar === null) { return null; }
    // XUL elements are different than regular children
    return this.window.document.getAnonymousElementByAttribute(urlBar, "anonid", "input");
  }

  get shareButton() {
    return this.window.document.getElementById("social-share-button");
  }

  insertCopyController() {
    // refresh urlInput reference, this is potentially changed by the customize event
    this.urlInput.controllers.insertControllerAt(0, this.copyController);
  }

  removeCopyController() {
    // refresh urlInput reference, this is potentially changed by the customize event
    this.urlInput.controllers.removeController(this.copyController);
  }

  animationEndListener(e) {
    // When the animation is done, we want to remove the CSS class
    // so that we can add the class again upon the next copy and
    // replay the animation
    this.shareButton.classList.remove("social-share-button-on");
  }

  addCustomizeListener() {
    this.window.addEventListener("customizationending", this.insertCopyController);
  }

  removeCustomizeListener() {
    this.window.removeEventListener("customizationending", this.insertCopyController);
  }

  insertCSS() {
    const utils = this.window.QueryInterface(Ci.nsIInterfaceRequestor)
      .getInterface(Ci.nsIDOMWindowUtils);
    utils.loadSheet(SHAREBUTTON_CSS_URI, utils.AGENT_SHEET);
    utils.loadSheet(PANEL_CSS_URI, utils.AGENT_SHEET);
  }

  removeCSS() {
    const utils = this.window.QueryInterface(Ci.nsIInterfaceRequestor)
      .getInterface(Ci.nsIDOMWindowUtils);
    utils.removeSheet(SHAREBUTTON_CSS_URI, utils.AGENT_SHEET);
    utils.removeSheet(PANEL_CSS_URI, utils.AGENT_SHEET);
  }

  startup() {
    // if there is no urlBar / urlInput, we don't want to do anything
    // (ex. browser console window)
    if (this.urlInput === null) return;

    browserWindowWeakMap.set(this.window, this);

    // The customizationending event represents exiting the "Customize..." menu from the toolbar.
    // We need to handle this event because after exiting the customization menu, the copy
    // controller is removed and we can no longer detect text being copied from the URL bar.
    // See DXR:browser/base/content/browser-customization.js
    this.addCustomizeListener();

    // Load the CSS with the shareButton animation
    this.insertCSS();

    // insert the copy controller to detect copying from URL bar
    this.insertCopyController();
  }

  shutdown() {
    // Remove the customizationending listener
    this.removeCustomizeListener();

    // Remove the CSS
    this.removeCSS();

    // Remove the copy controller
    this.removeCopyController();

    // Remove the share-button-panel
    const sharePanel = this.window.document.getElementById("share-button-panel");
    if (sharePanel !== null) {
      sharePanel.remove();
    }

    // Remove modifications to shareButton (modified in CopyController)
    if (this.shareButton !== null) {
      // if null this means there is no shareButton on the page
      // so we don't have anything to remove
      this.shareButton.classList.remove("social-share-button-on");
      this.shareButton.removeEventListener("animationend", this.animationEndListener);
    }
  }
}

// see https://dxr.mozilla.org/mozilla-central/rev/53477d584130945864c4491632f88da437353356/xpfe/appshell/nsIWindowMediatorListener.idl
const windowListener = {
  onWindowTitleChange(window, title) { },
  onOpenWindow(xulWindow) {
    // xulWindow is of type nsIXULWindow, we want an nsIDOMWindow
    // see https://dxr.mozilla.org/mozilla-central/rev/53477d584130945864c4491632f88da437353356/browser/base/content/test/general/browser_fullscreen-window-open.js#316
    // for how to change XUL into DOM
    const domWindow = xulWindow.QueryInterface(Ci.nsIInterfaceRequestor)
      .getInterface(Ci.nsIDOMWindow);

    // we need to use a listener function so that it's injected
    // once the window is loaded / ready
    const onWindowOpen = (e) => {
      domWindow.removeEventListener("load", onWindowOpen);
      const browserWindow = new BrowserWindow(domWindow);
      browserWindow.startup();
    };

    domWindow.addEventListener("load", onWindowOpen, true);
  },
  onCloseWindow(window) { },
};

this.install = function(data, reason) {};

this.startup = async function(data, reason) {
  studyUtils.setup({
    studyName: config.study.studyName,
    endings: config.study.endings,
    addon: { id: data.id, version: data.version },
    telemetry: config.study.telemetry,
  });
  studyUtils.setLoggingLevel(config.log.studyUtils.level);
  const variation = await chooseVariation();
  studyUtils.setVariation(variation);

  // TODO Import config.modules?

  if ((REASONS[reason]) === "ADDON_INSTALL") {
    studyUtils.firstSeen(); // sends telemetry "enter"
    const eligible = await config.isEligible(); // addon-specific
    if (!eligible) {
      // uses config.endings.ineligible.url if any,
      // sends UT for "ineligible"
      // then uninstalls addon
      await studyUtils.endStudy({ reason: "ineligible" });
      return;
    }
  }
  // sets experiment as active and sends installed telemetry
  await studyUtils.startup({ reason });

  // iterate over all open windows
  const windowEnumerator = Services.wm.getEnumerator("navigator:browser");
  while (windowEnumerator.hasMoreElements()) {
    const window = windowEnumerator.getNext();
    const browserWindow = new BrowserWindow(window);
    browserWindow.startup();
  }

  // add an event listener for new windows
  Services.wm.addListener(windowListener);
};

this.shutdown = function(data, reason) {
  // remove event listener for new windows before processing WeakMap
  // to avoid race conditions (ie. new window added during shutdown)
  Services.wm.removeListener(windowListener);

  const windowEnumerator = Services.wm.getEnumerator("navigator:browser");
  while (windowEnumerator.hasMoreElements()) {
    const window = windowEnumerator.getNext();
    if (browserWindowWeakMap.has(window)) {
      const browserWindow = browserWindowWeakMap.get(window);
      browserWindow.shutdown();
    }
  }

  // TODO Unload modules?

  // are we uninstalling?
  // if so, user or automatic?
  if (reason === REASONS.ADDON_UNINSTALL || reason === REASONS.ADDON_DISABLE) {
    if (!studyUtils._isEnding) {
      // we are the first requestors, must be user action.
      studyUtils.endStudy({ reason: "user-disable" });
    }
  }
};

this.uninstall = function(data, reason) {};
