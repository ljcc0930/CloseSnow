const test = require("node:test");
const assert = require("node:assert/strict");
const { createController } = require("../../assets/js/weather_table_layout.js");

const fixture = () => {
  const frames = new Map();
  let frameId = 0;
  const classChanges = [];
  const stickyRoots = [];
  const observed = [];
  let disconnects = 0;
  const contentRoot = { querySelector: () => null, querySelectorAll: () => [] };
  const document = {
    body: { classList: { toggle: (...args) => classChanges.push(args) } },
    documentElement: { clientWidth: 400 },
    querySelector: () => { throw new Error("Table queries must stay inside the supplied content root"); },
  };
  const window = {
    innerWidth: 400,
    requestAnimationFrame: (callback) => { frames.set(++frameId, callback); return frameId; },
    cancelAnimationFrame: (id) => frames.delete(id),
    ResizeObserver: class {
      constructor(callback) { this.callback = callback; }
      observe(element) { observed.push(element); }
      disconnect() { disconnects += 1; }
    },
  };
  const state = { layoutMode: "desktop" };
  const controller = createController({
    state, window, document, contentRoot,
    stickySingleTableLayout: { applyFromDom: ({ root }) => stickyRoots.push(root) },
  });
  return { controller, frames, state, window, contentRoot, classChanges, stickyRoots, observed, disconnects: () => disconnects };
};

test("responsive mode updates only supplied page state and body", () => {
  const { controller, state, classChanges } = fixture();
  assert.equal(controller.getLayoutModeForWidth(553), "compact");
  assert.equal(controller.getLayoutModeForWidth(554), "desktop");
  assert.equal(controller.updateLayoutMode(), "compact");
  assert.equal(state.layoutMode, "compact");
  assert.deepEqual(classChanges, [["mobile-simple", true]]);
});

test("layout scheduling coalesces repeated changes and scopes sticky layout to active content", () => {
  const { controller, frames, stickyRoots, contentRoot } = fixture();
  controller.applyLayout();
  controller.applyLayout();
  controller.applyLayout();
  assert.equal(frames.size, 1);
  [...frames.values()][0]();
  assert.deepEqual(stickyRoots, [contentRoot]);
});

test("rerender replaces observer subscriptions and observes each table container once", () => {
  const { controller, contentRoot, observed, disconnects } = fixture();
  const wrap = {};
  contentRoot.querySelector = () => wrap;
  contentRoot.querySelectorAll = () => [wrap];
  controller.observeLayoutContainers();
  assert.deepEqual(observed, [wrap]);
  controller.observeLayoutContainers();
  assert.equal(disconnects(), 1);
  assert.deepEqual(observed, [wrap, wrap]);
});
