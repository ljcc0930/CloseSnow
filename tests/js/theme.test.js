const test = require("node:test");
const assert = require("node:assert/strict");
const createThemeController = require("../../assets/js/theme.js");

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

const flushPromises = async () => { await Promise.resolve(); await Promise.resolve(); };

function page({
  saved = null, dark = false, blocked = false, loading = false, reducedMotion = false,
  viewTransitions = "unavailable", matchMedia = true,
} = {}) {
  const windowEvents = {};
  const documentEvents = {};
  const buttonEvents = {};
  const attributes = {};
  const button = {
    setAttribute: (name, value) => { attributes[name] = value; },
    addEventListener: (name, listener) => { buttonEvents[name] = listener; },
    getBoundingClientRect: () => ({ left: 100, right: 182, top: 10, bottom: 46 }),
  };
  let controlsReady = !loading;
  const storage = new Map(saved === null ? [] : [["closesnow_theme_v1", saved]]);
  const localStorage = {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => { storage.set(key, value); },
  };
  let mediaListener;
  let motionListener;
  const transitions = [];
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
  if (viewTransitions !== "unavailable") {
    document.startViewTransition = (update) => {
      if (viewTransitions === "throw") throw new Error("Snapshot unavailable");
      const ready = deferred();
      const finished = deferred();
      let updatePromise;
      const transition = {
        ready: ready.promise,
        finished: finished.promise,
        skipped: false,
        skipTransition() {
          transition.skipped = true;
          ready.reject(new Error("Transition skipped"));
        },
        // A skip does not cancel this callback. Keep its timing independent of
        // later requests so tests can deliver abandoned snapshots out of order.
        runUpdate() {
          updatePromise ??= Promise.resolve().then(update);
          return updatePromise;
        },
        async begin() {
          await transition.runUpdate();
          ready.resolve();
          await flushPromises();
        },
        async complete() {
          await transition.begin();
          finished.resolve();
          await flushPromises();
        },
        rejectReady() { ready.reject(new Error("Snapshot could not start")); },
        rejectFinished() { finished.reject(new Error("Transition update failed")); },
      };
      transitions.push(transition);
      return transition;
    };
  }
  const window = {
    document,
    get localStorage() {
      if (blocked) throw new Error("Storage is blocked");
      return localStorage;
    },
    addEventListener: (name, listener) => { windowEvents[name] = listener; },
  };
  if (matchMedia) window.matchMedia = (query) => query.includes("reduced-motion") ? motion : media;
  createThemeController(window);
  return {
    theme: () => document.documentElement.dataset.theme,
    transitioning: () => document.documentElement.dataset.themeTransitioning === "true",
    attributes, storage, transitions, window,
    click() {
      const event = { target: button, button: 0, clientX: 120, clientY: 20 };
      buttonEvents.click(event);
      documentEvents.click?.(event);
    },
    rootClick({ clientX = 120, clientY = 20, button = 0 } = {}) {
      documentEvents.click({ target: document.documentElement, button, clientX, clientY });
    },
    ready() { controlsReady = true; documentEvents.DOMContentLoaded(); },
    system(dark) { media.matches = dark; mediaListener(); },
    reduceMotion(enabled) { motion.matches = enabled; motionListener(); },
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
  const view = page({ matchMedia: false });
  assert.equal(view.theme(), "light");
  view.click();
  assert.equal(view.theme(), "dark");
});

test("initial head application, control binding, and unchanged themes never animate", () => {
  const view = page({ saved: "dark", loading: true, viewTransitions: "supported" });
  assert.equal(view.theme(), "dark");
  assert.equal(view.transitioning(), false);
  view.system(true);
  view.ready();
  assert.equal(view.transitioning(), false);
  assert.equal(view.transitions.length, 0);
});

test("rapid clicks toggle the desired state before snapshot callbacks have run", async () => {
  const view = page({ viewTransitions: "supported" });
  view.click();
  const first = view.transitions[0];
  assert.equal(view.theme(), "light", "The old palette remains until its snapshot is captured");
  assert.equal(view.storage.get("closesnow_theme_v1"), "dark");
  assert.equal(view.attributes["aria-checked"], "true");
  assert.equal(view.transitioning(), true);
  view.click();
  const newest = view.transitions[1];
  assert.equal(first.skipped, true);
  assert.equal(view.storage.get("closesnow_theme_v1"), "light");
  assert.equal(view.attributes["aria-checked"], "false");
  await newest.begin();
  assert.equal(view.theme(), "light");
  await first.complete();
  assert.equal(view.theme(), "light", "An old skipped callback cannot overwrite the latest choice");
  assert.equal(view.transitioning(), true, "Old cleanup cannot end the newer animation");
  await newest.complete();
  assert.equal(view.transitioning(), false);
});

test("a third rapid choice wins even if skipped callbacks finish after it", async () => {
  const view = page({ viewTransitions: "supported" });
  view.click();
  view.click();
  view.click();
  assert.equal(view.transitions.length, 3);
  assert.equal(view.storage.get("closesnow_theme_v1"), "dark");
  await view.transitions[2].complete();
  await view.transitions[1].complete();
  await view.transitions[0].complete();
  assert.equal(view.theme(), "dark");
  assert.equal(view.attributes["aria-checked"], "true");
  assert.equal(view.transitioning(), false);
});

test("a primary click retargeted to the root within the theme switch preserves the second choice", async () => {
  const view = page({ viewTransitions: "supported" });
  view.click();
  view.rootClick();
  assert.equal(view.transitions.length, 2);
  assert.equal(view.transitions[0].skipped, true);
  assert.equal(view.storage.get("closesnow_theme_v1"), "light");
  await view.transitions[1].complete();
  await view.transitions[0].complete();
  assert.equal(view.theme(), "light");
  assert.equal(view.transitioning(), false);
});

test("root clicks outside the switch, non-primary clicks, and clicks while idle do nothing", async () => {
  const view = page({ viewTransitions: "supported" });
  view.rootClick();
  assert.equal(view.transitions.length, 0);
  view.click();
  for (const point of [
    { clientX: 99 }, { clientX: 183 }, { clientY: 9 }, { clientY: 47 },
    { button: 1 }, { button: 2 },
  ]) view.rootClick(point);
  assert.equal(view.transitions.length, 1);
  assert.equal(view.storage.get("closesnow_theme_v1"), "dark");
  await view.transitions[0].complete();
  view.rootClick();
  assert.equal(view.transitions.length, 1);
  assert.equal(view.theme(), "dark");
});

test("ordinary button clicks bubbling to the document toggle only once", async () => {
  const view = page({ viewTransitions: "supported" });
  view.click();
  assert.equal(view.transitions.length, 1);
  assert.equal(view.storage.get("closesnow_theme_v1"), "dark");
  await view.transitions[0].begin();
  view.click();
  assert.equal(view.transitions.length, 2);
  assert.equal(view.storage.get("closesnow_theme_v1"), "light");
  await view.transitions[1].complete();
  await view.transitions[0].complete();
  assert.equal(view.theme(), "light");
});

test("system and cross-tab changes animate only after initial binding", async () => {
  const view = page({ loading: true, viewTransitions: "supported" });
  view.system(true);
  assert.equal(view.theme(), "dark");
  assert.equal(view.transitioning(), false);
  assert.equal(view.transitions.length, 0);
  view.ready();
  view.system(false);
  assert.equal(view.transitioning(), true);
  await view.transitions[0].complete();
  assert.equal(view.theme(), "light");
  view.sync("closesnow_theme_v1", "dark");
  assert.equal(view.transitioning(), true);
  await view.transitions[1].complete();
  assert.equal(view.theme(), "dark");
  assert.equal(view.transitioning(), false);
});

test("reduced motion disables transitions and finishes a pending snapshot immediately", async () => {
  const view = page({ reducedMotion: true, viewTransitions: "supported" });
  view.click();
  assert.equal(view.theme(), "dark");
  assert.equal(view.transitioning(), false);
  assert.equal(view.transitions.length, 0);
  view.reduceMotion(false);
  view.click();
  const pending = view.transitions[0];
  assert.equal(view.theme(), "dark", "No snapshot callback has painted the pending choice");
  assert.equal(view.transitioning(), true);
  view.reduceMotion(true);
  assert.equal(view.transitioning(), false);
  assert.equal(view.theme(), "light");
  assert.equal(pending.skipped, true);
  view.click();
  assert.equal(view.theme(), "dark");
  await pending.complete();
  assert.equal(view.theme(), "dark", "A skipped callback cannot undo a newer reduced-motion choice");
  assert.equal(view.transitioning(), false);
});

for (const viewTransitions of ["unavailable", "throw"]) {
  test(`${viewTransitions} View Transition API switches immediately without stale animation state`, () => {
    const view = page({ viewTransitions });
    view.click();
    assert.equal(view.theme(), "dark");
    assert.equal(view.attributes["aria-checked"], "true");
    assert.equal(view.transitioning(), false);
    view.click();
    assert.equal(view.theme(), "light");
    assert.equal(view.transitioning(), false);
  });
}

test("a rejected ready promise still allows the update and finished cleanup", async () => {
  const view = page({ viewTransitions: "supported" });
  view.click();
  const failedSnapshot = view.transitions[0];
  failedSnapshot.rejectReady();
  await failedSnapshot.complete();
  assert.equal(view.theme(), "dark");
  assert.equal(view.transitioning(), false);
  view.click();
  await view.transitions[1].complete();
  assert.equal(view.theme(), "light");
});

test("a rejected finished promise cleans up without leaving the page in animation mode", async () => {
  const view = page({ viewTransitions: "supported" });
  view.click();
  const failedTransition = view.transitions[0];
  await failedTransition.begin();
  failedTransition.rejectFinished();
  await flushPromises();
  assert.equal(view.transitioning(), false);
  assert.equal(view.theme(), "dark");
  view.click();
  await view.transitions[1].complete();
  assert.equal(view.theme(), "light");
});
