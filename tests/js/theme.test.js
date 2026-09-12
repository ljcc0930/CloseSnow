const test = require("node:test");
const assert = require("node:assert/strict");
const createThemeController = require("../../assets/js/theme.js");

function page({ saved = null, dark = false, blocked = false, loading = false } = {}) {
  const windowEvents = {};
  const documentEvents = {};
  const buttonEvents = {};
  const attributes = {};
  const button = {
    setAttribute: (name, value) => { attributes[name] = value; },
    addEventListener: (name, listener) => { buttonEvents[name] = listener; },
  };
  let controlsReady = !loading;
  const storage = new Map(saved === null ? [] : [["closesnow_theme_v1", saved]]);
  const localStorage = {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => { storage.set(key, value); },
  };
  let mediaListener;
  const media = {
    matches: dark,
    addEventListener: (_, listener) => { mediaListener = listener; },
  };
  const document = {
    documentElement: { dataset: {} },
    readyState: loading ? "loading" : "complete",
    querySelectorAll: () => controlsReady ? [button] : [],
    addEventListener: (name, listener) => { documentEvents[name] = listener; },
  };
  const window = {
    document,
    get localStorage() {
      if (blocked) throw new Error("Storage is blocked");
      return localStorage;
    },
    matchMedia: () => media,
    addEventListener: (name, listener) => { windowEvents[name] = listener; },
  };
  createThemeController(window);
  return {
    theme: () => document.documentElement.dataset.theme,
    attributes, storage, window,
    click: () => buttonEvents.click(),
    ready() { controlsReady = true; documentEvents.DOMContentLoaded(); },
    system(dark) { media.matches = dark; mediaListener(); },
    sync(key, newValue, storageArea = localStorage) { windowEvents.storage({ key, newValue, storageArea }); },
  };
}

test("sets the system theme before controls or styles load, then binds the switch", () => {
  const view = page({ dark: true, loading: true });
  assert.equal(view.theme(), "dark");
  view.ready();
  assert.equal(view.attributes["aria-checked"], "true");
  view.click();
  assert.equal(view.theme(), "light");
  assert.equal(view.attributes["aria-checked"], "false");
});

test("follows system changes until the user chooses a theme", () => {
  const view = page();
  view.system(true);
  assert.equal(view.theme(), "dark");
  view.click();
  assert.equal(view.storage.get("closesnow_theme_v1"), "light");
  view.system(false);
  view.system(true);
  assert.equal(view.theme(), "light");
  assert.equal(view.attributes.title, "Switch to night theme");
});

test("restores either saved preference on a new page regardless of system theme", () => {
  assert.equal(page({ saved: "light", dark: true }).theme(), "light");
  assert.equal(page({ saved: "dark", dark: false }).theme(), "dark");
  assert.equal(page({ saved: "invalid", dark: true }).theme(), "dark");
});

test("blocked storage still allows both system defaults and manual switching", () => {
  const view = page({ blocked: true, dark: true });
  assert.equal(view.theme(), "dark");
  view.click();
  assert.equal(view.theme(), "light");
  view.system(true);
  assert.equal(view.theme(), "light");
});

test("syncs other tabs and resumes following the system when preference is cleared", () => {
  const view = page({ saved: "dark" });
  view.sync("unrelated-key", "light");
  assert.equal(view.theme(), "dark");
  view.sync("closesnow_theme_v1", "light", {});
  assert.equal(view.theme(), "dark");
  view.sync("closesnow_theme_v1", "light");
  assert.equal(view.theme(), "light");
  view.sync("closesnow_theme_v1", null);
  view.system(true);
  assert.equal(view.theme(), "dark");
  view.click();
  assert.equal(view.theme(), "light");
  view.sync(null, null);
  assert.equal(view.theme(), "dark");
});

test("browsers without matchMedia still have a working day/night switch", () => {
  const view = page();
  delete view.window.matchMedia;
  createThemeController(view.window);
  assert.equal(view.theme(), "light");
  view.click();
  assert.equal(view.theme(), "dark");
});
