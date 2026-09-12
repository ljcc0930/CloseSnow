const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

class Element {
  constructor(tagName, document) {
    this.tagName = tagName;
    this.document = document;
    this.children = [];
    this.attributes = {};
    this.events = {};
    this.text = "";
    this.style = { setProperty: (name, value) => { this.style[name] = value; } };
    this.rect = { left: 0, width: 400 };
  }
  appendChild(child) { this.children.push(child); return child; }
  setAttribute(name, value) { this.attributes[name] = value; }
  getBoundingClientRect() { return this.rect; }
  addEventListener(name, listener) { this.events[name] = listener; }
  dispatch(name, event = {}) { this.events[name]?.(event); }
  focus() { this.document.activeElement = this; this.dispatch("focus"); }
  set textContent(value) { this.text = value; this.children = []; }
  get textContent() { return this.text + this.children.map((child) => child.textContent).join(""); }
}

const loadCharts = () => {
  const document = { getElementById: () => null };
  document.createElement = (tag) => new Element(tag, document);
  document.createElementNS = (_, tag) => new Element(tag, document);
  const context = {
    URL, document,
    window: { location: { pathname: "/resort/test/" }, addEventListener: () => {} },
  };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(__dirname, "../../assets/js/resort_hourly.js"), "utf8"), context);
  return {
    ...vm.runInContext("({renderMetricChartCard, chartYBounds, chartTimeTickIndices, toFiniteNumber})", context),
    document,
  };
};

const descendants = (element) => [element, ...element.children.flatMap(descendants)];
const byClass = (element, name) => descendants(element).filter((child) =>
  String(child.className || child.attributes.class || "").split(" ").includes(name));
const metric = { key: "snowfall", title: "Snowfall", unit: "cm", color: "var(--chart-snow)" };
const timesFor = (count) => Array.from({ length: count }, (_, idx) =>
  new Date(Date.UTC(2026, 8, 12, idx)).toISOString().slice(0, 16));
const render = (values, width = 400, definition = metric) => {
  const api = loadCharts();
  const times = timesFor(values.length);
  return { ...api, times, card: api.renderMetricChartCard(definition, times, values, width) };
};

test("chart geometry retains every exact hourly observation and breaks at missing hours", () => {
  const { card } = render([0, 0.12, 0.04, null, 0.2]);
  const line = byClass(card, "chart-line")[0];
  assert.equal(line.attributes.d,
    "M34.00 144.00 L123.00 63.60 L212.00 117.20 M390.00 10.00");
  assert.equal(byClass(card, "chart-isolated-point").length, 1,
    "A single hour after a gap remains visible without marking every connected hour");
  assert.equal(byClass(card, "chart-isolated-point")[0].attributes.cx, "390.00");
  assert.equal(byClass(card, "chart-reading")[0].textContent, "0–0.2");
});

test("all-missing charts do not fabricate a zero line; dry hours keep a nonnegative axis", () => {
  const { card } = render([null, null, null]);
  assert.equal(byClass(card, "chart-empty")[0].textContent, "No data");
  assert.equal(byClass(card, "chart-line").length, 0);
  const { chartYBounds, toFiniteNumber } = loadCharts();
  for (const value of [null, undefined, "", "not-a-number", Infinity]) {
    assert.equal(toFiniteNumber(value), null);
  }
  assert.equal(toFiniteNumber("0"), 0);
  for (const key of ["snowfall", "rain", "snow_depth", "wind_speed_10m", "visibility"]) {
    const bounds = chartYBounds(key, [0, 0, 0]);
    assert.equal(bounds.min, 0);
    assert.ok(bounds.max > 0);
  }
  const dry = render([0, 0, 0]).card;
  assert.equal(byClass(dry, "chart-line")[0].attributes.d,
    "M34.00 144.00 L212.00 144.00 L390.00 144.00");
});

test("north crossings never draw an invented wind-direction ramp through south", () => {
  const { card } = render([350, 10, 30, null, 270], 400,
    { key: "wind_direction_10m", title: "Wind Direction 10m", unit: "deg", color: "var(--chart-direction)" });
  assert.equal(byClass(card, "chart-line")[0].attributes.d,
    "M34.00 13.72 M123.00 140.28 L212.00 132.83 M390.00 43.50");
  assert.equal(byClass(card, "chart-isolated-point").length, 2);
});

test("keyboard inspection reads exact values and missing hours and clamps at the forecast ends", () => {
  const { card } = render([0.04, null, 0.12]);
  const plot = byClass(card, "chart-svg-wrap")[0];
  const reading = byClass(card, "chart-reading")[0];
  const point = byClass(card, "chart-selected-point")[0];
  let prevented = 0;
  const press = (key) => plot.dispatch("keydown", { key, preventDefault: () => { prevented += 1; } });
  plot.focus();
  assert.equal(reading.textContent, "0.04", "Do not round small snowfall amounts down to zero");
  assert.match(plot.attributes["aria-valuetext"], /Sep 12, 00:00: 0.04 cm/);
  press("ArrowRight");
  assert.equal(reading.textContent, "No data");
  assert.equal(byClass(card, "chart-unit")[0].hidden, true);
  assert.equal(point.attributes.visibility, "hidden");
  assert.equal(plot.attributes["aria-valuenow"], "1");
  press("End");
  assert.equal(reading.textContent, "0.12");
  assert.equal(point.attributes.visibility, "visible");
  press("ArrowRight");
  assert.equal(plot.attributes["aria-valuenow"], "2");
  press("Home");
  press("ArrowLeft");
  assert.equal(plot.attributes["aria-valuenow"], "0");
  press("Tab");
  assert.equal(prevented, 5, "Unrelated keys retain their browser behavior");
  plot.dispatch("blur");
  assert.equal(reading.textContent, "0.04–0.12");
  assert.equal(byClass(card, "chart-selection")[0].attributes.visibility, "hidden");
  assert.equal(point.attributes.visibility, "hidden", "An explicitly visible SVG child must also be hidden on blur");
});

test("mouse and touch inspection map to source hours even when the SVG is scaled", () => {
  const { card, document } = render([0.04, null, 0.12]);
  const plot = byClass(card, "chart-svg-wrap")[0];
  const svg = byClass(card, "chart-svg")[0];
  const reading = byClass(card, "chart-reading")[0];
  svg.rect = { left: 100, width: 800 };
  plot.dispatch("pointermove", { clientX: 100 + 212 * 2, pointerType: "mouse" });
  assert.equal(reading.textContent, "No data");
  plot.dispatch("pointerleave");
  assert.equal(reading.textContent, "0.04–0.12");
  plot.dispatch("pointerdown", { clientX: 100 + 390 * 2, pointerType: "touch", button: 0 });
  assert.equal(reading.textContent, "0.12");
  assert.equal(plot.attributes["aria-valuenow"], "2");
  assert.equal(document.activeElement, plot);
  plot.dispatch("pointerleave");
  assert.equal(reading.textContent, "0.12", "The selected touch/keyboard reading persists until blur");
  plot.dispatch("pointerdown", { clientX: 0, button: 2 });
  assert.equal(plot.attributes["aria-valuenow"], "2", "A secondary click does not change the selection");
});

test("narrow charts reduce label density without dropping any forecast hours", () => {
  const values = Array.from({ length: 168 }, (_, idx) => idx / 10);
  const desktop = render(values, 640).card;
  const phone = render(values, 250).card;
  assert.equal(byClass(desktop, "chart-time-tick").length, 4);
  assert.equal(byClass(phone, "chart-time-tick").length, 3);
  for (const card of [desktop, phone]) {
    assert.equal(byClass(card, "chart-line")[0].attributes.d.match(/[ML]/g).length, 168);
    assert.equal(byClass(card, "chart-isolated-point").length, 0);
    const ticks = byClass(card, "chart-time-tick");
    assert.equal(ticks[0].attributes["text-anchor"], "start");
    assert.match(ticks.at(-1).textContent, /^00:00/, "The last tick remains on a local clock boundary");
  }
});

test("time labels align to resort calendar boundaries and omit awkward range endpoints", () => {
  const { chartTimeTickIndices } = loadCharts();
  const times = timesFor(85).slice(13); // 72 hours starting at resort-local 13:00.
  const desktopIndices = [...chartTimeTickIndices(times, 450)];
  assert.deepEqual(desktopIndices, [11, 35, 59]);
  for (const idx of desktopIndices) assert.equal(times[idx].slice(11), "00:00");
  assert.ok(!desktopIndices.includes(times.length - 1), "Do not add a crowded 12:00 end label");
  assert.deepEqual([...chartTimeTickIndices(timesFor(24), 450)], [0, 6, 12, 18]);
  assert.deepEqual([...chartTimeTickIndices(timesFor(168), 206)], [0, 72, 144]);
});

test("large readings use separators and wind direction uses degrees with compass ticks", () => {
  const visibility = render([11500, 16267], 400,
    { key: "visibility", title: "Visibility", unit: "m", color: "var(--chart-visibility)" }).card;
  assert.equal(byClass(visibility, "chart-reading")[0].textContent, "11,500–16,267");
  byClass(visibility, "chart-svg-wrap")[0].focus();
  assert.equal(byClass(visibility, "chart-reading")[0].textContent, "11,500");
  const wind = render([0, 180, 360], 400,
    { key: "wind_direction_10m", title: "Wind Direction 10m", unit: "deg", color: "var(--chart-direction)" }).card;
  assert.equal(byClass(wind, "chart-unit")[0].textContent, "°");
  assert.deepEqual(byClass(wind, "chart-tick-text").slice(0, 5).map((tick) => tick.textContent),
    ["N", "E", "S", "W", "N"]);
});
