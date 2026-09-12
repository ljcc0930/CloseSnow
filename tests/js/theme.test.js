const test = require("node:test");
const assert = require("node:assert/strict");
const createThemeController = require("../../assets/js/theme.js");

function page({ saved = null, dark = false, blocked = false, loading = false, reducedMotion = false } = {}) {
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
  let motionListener;
  let now = 0;
  let nextTimer = 0;
  const timers = new Map();
  const media = {
    matches: dark,
    addEventListener: (_, listener) => { mediaListener = listener; },
  };
  const motion = {
    matches: reducedMotion,
    addEventListener: (_, listener) => { motionListener = listener; },
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
    matchMedia: (query) => query.includes("reduced-motion") ? motion : media,
    setTimeout(callback, delay) {
      const id = ++nextTimer;
      timers.set(id, { callback, deadline: now + delay });
      return id;
    },
    clearTimeout: (id) => { timers.delete(id); },
    addEventListener: (name, listener) => { windowEvents[name] = listener; },
  };
  createThemeController(window);
  return {
    theme: () => document.documentElement.dataset.theme,
    transitioning: () => document.documentElement.dataset.themeTransitioning === "true",
    pendingTimers: () => timers.size,
    attributes, storage, window,
    click: () => buttonEvents.click(),
    ready() { controlsReady = true; documentEvents.DOMContentLoaded(); },
    system(dark) { media.matches = dark; mediaListener(); },
    reduceMotion(enabled) { motion.matches = enabled; motionListener(); },
    sync(key, newValue, storageArea = localStorage) { windowEvents.storage({ key, newValue, storageArea }); },
    advance(milliseconds) {
      now += milliseconds;
      for (const [id, timer] of [...timers]) {
        if (timer.deadline <= now) {
          timers.delete(id);
          timer.callback();
        }
      }
    },
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

test("initial head application, control binding, and unchanged themes never animate", () => {
  const view = page({ saved: "dark", loading: true });
  assert.equal(view.theme(), "dark");
  assert.equal(view.transitioning(), false);
  view.system(true);
  view.ready();
  assert.equal(view.transitioning(), false);
  assert.equal(view.pendingTimers(), 0);
});

test("rapid choices apply immediately and replace rather than queue transition cleanup", () => {
  const view = page();
  view.click();
  assert.equal(view.theme(), "dark");
  assert.equal(view.transitioning(), true);
  view.advance(100);
  view.click();
  assert.equal(view.theme(), "light");
  assert.equal(view.pendingTimers(), 1);
  view.advance(150);
  assert.equal(view.transitioning(), true, "The earlier transition cannot cut off the newest choice");
  view.advance(100);
  assert.equal(view.transitioning(), false);
  assert.equal(view.theme(), "light");
  assert.equal(view.pendingTimers(), 0);
});

test("system and cross-tab changes animate only after initial binding", () => {
  const view = page({ loading: true });
  view.system(true);
  assert.equal(view.theme(), "dark");
  assert.equal(view.transitioning(), false);
  view.ready();
  view.system(false);
  assert.equal(view.transitioning(), true);
  view.advance(250);
  view.sync("closesnow_theme_v1", "dark");
  assert.equal(view.theme(), "dark");
  assert.equal(view.transitioning(), true);
});

test("reduced motion disables transitions and immediately cancels an active one", () => {
  const view = page({ reducedMotion: true });
  view.click();
  assert.equal(view.theme(), "dark");
  assert.equal(view.transitioning(), false);
  assert.equal(view.pendingTimers(), 0);
  view.reduceMotion(false);
  view.click();
  assert.equal(view.transitioning(), true);
  view.reduceMotion(true);
  assert.equal(view.transitioning(), false);
  assert.equal(view.pendingTimers(), 0);
  assert.equal(view.theme(), "light");
});
