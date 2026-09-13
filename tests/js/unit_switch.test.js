const test = require("node:test");
const assert = require("node:assert/strict");
const { sync, requestFor } = require("../../assets/js/unit_switch.js");

function control(attributes, legacy = false) {
  const values = new Map(Object.entries({ "data-mode": "metric", role: legacy ? "group" : "switch", ...attributes }));
  const options = ["metric", "imperial"].map((mode) => {
    const attrs = new Map([["data-unit-mode", mode]]);
    const classes = new Set();
    return {
      tagName: legacy ? "BUTTON" : "SPAN",
      textContent: mode === "metric" ? "Metric" : "Imperial",
      getAttribute: (key) => attrs.get(key) ?? null,
      setAttribute: (key, value) => attrs.set(key, value),
      classList: { toggle(name, active) { if (active) classes.add(name); else classes.delete(name); } },
      isActive: () => classes.has("is-active"),
    };
  });
  const toggle = {
    disabled: false,
    getAttribute: (key) => values.get(key) ?? null,
    setAttribute: (key, value) => values.set(key, value),
    hasAttribute: (key) => values.has(key),
    querySelectorAll: () => options,
  };
  toggle.closest = (selector) => selector === ".unit-toggle" ? toggle : null;
  options.forEach((option) => { option.closest = toggle.closest; });
  return { toggle, options };
}

test("every unit family reverses the whole control regardless of which label is clicked", () => {
  const groups = [
    [{ "data-compact-summary-toggle": "1" }, { scope: "summary" }],
    [{ "data-sun-time-toggle": "1" }, { scope: "sun" }],
    ...["snow", "rain", "temp"].map((kind) => [{ "data-target-kind": kind }, { scope: "metric", kind }]),
  ];
  for (const [attributes, scope] of groups) {
    for (const legacy of [false, true]) {
      const { toggle, options } = control(attributes, legacy);
      for (const current of ["metric", "imperial"]) {
        sync(toggle, current);
        const expected = { ...scope, mode: current === "metric" ? "imperial" : "metric" };
        for (const target of [toggle, ...options]) assert.deepEqual(requestFor(target), expected);
      }
    }
  }
});

test("synchronization exposes the native switch state and preserves legacy button accessibility", () => {
  const current = control({ "data-target-kind": "temp" });
  sync(current.toggle, "imperial");
  assert.equal(current.toggle.getAttribute("aria-checked"), "true");
  assert.equal(current.toggle.getAttribute("title"), "Switch to Metric");
  assert.deepEqual(current.options.map((option) => option.isActive()), [false, true]);
  assert.equal(current.options[1].getAttribute("aria-pressed"), null, "Decorative spans do not acquire button states");
  sync(current.toggle, "metric");
  assert.equal(current.toggle.getAttribute("aria-checked"), "false");
  const old = control({ "data-compact-summary-toggle": "1" }, true);
  sync(old.toggle, "imperial");
  assert.deepEqual(old.options.map((option) => option.getAttribute("aria-pressed")), ["false", "true"]);
  assert.equal(old.toggle.getAttribute("aria-checked"), null, "A legacy group is not exposed as a switch");
});

test("rapid repeated presses alternate from the latest synchronized state", () => {
  const { toggle, options } = control({ "data-target-kind": "rain" });
  for (let press = 0; press < 9; press += 1) {
    const request = requestFor(options[0]);
    assert.equal(request.mode, press % 2 ? "metric" : "imperial");
    sync(toggle, request.mode);
  }
  assert.equal(toggle.getAttribute("data-mode"), "imperial");
  assert.equal(toggle.getAttribute("aria-checked"), "true");
});

test("disabled controls, unrelated targets, and unsupported groups do not change units", () => {
  const { toggle } = control({ "data-target-kind": "snow" });
  toggle.disabled = true;
  assert.equal(requestFor(toggle), null);
  assert.equal(requestFor(control({ "data-target-kind": "unknown" }).toggle), null);
  assert.equal(requestFor({ closest: () => null }), null);
  assert.equal(requestFor(null), null);
});
