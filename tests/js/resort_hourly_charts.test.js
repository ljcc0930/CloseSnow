const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const explorer = require("../../assets/js/hourly_explorer.js");

const metricContext = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../../assets/js/resort_hourly_metrics.js"), "utf8"), metricContext);
const metrics = metricContext.window.CloseSnowResortHourlyMetrics.metricDefs;
const metricFor = (key) => metrics.find((metric) => metric.key === key);
const timesFor = (count, hour = 0) => Array.from({ length: count }, (_, index) => new Date(Date.UTC(2026, 8, 12, hour + index)).toISOString().slice(0, 16));

class Element {
  constructor(tagName, document) {
    this.tagName = tagName;
    this.ownerDocument = document;
    this.children = [];
    this.attributes = {};
    this.events = {};
    this.text = "";
    this.style = { setProperty: (key, value) => { this.style[key] = value; } };
  }
  append(...children) { this.children.push(...children); }
  appendChild(child) { this.append(child); return child; }
  replaceChildren(...children) { this.children = children; }
  setAttribute(name, value) { this.attributes[name] = value; }
  getBoundingClientRect() { return this.rect || { left: 0, width: this.ownerDocument.width }; }
  addEventListener(name, listener) { this.events[name] = listener; }
  dispatch(name, event = {}) { this.events[name]?.(event); }
  focus() { this.ownerDocument.activeElement = this; this.dispatch("focus"); }
  blur() { this.ownerDocument.activeElement = null; this.dispatch("blur"); }
  scrollIntoView() { this.scrolledIntoView = true; }
  setPointerCapture(pointerId) { this.captured = pointerId; }
  hasPointerCapture(pointerId) { return this.captured === pointerId; }
  releasePointerCapture() { this.captured = null; }
  set textContent(value) { this.text = value; this.children = []; }
  get textContent() { return this.text + this.children.map((child) => child.textContent).join(""); }
  set innerHTML(value) { this.html = value; this.children = []; }
}
const descendants = (node) => [node, ...node.children.flatMap(descendants)];
const byClass = (node, name) => descendants(node).filter((child) => String(child.className || child.attributes.class || "").split(" ").includes(name));
const mount = (payload, width = 900) => {
  const document = { width, defaultView: {} };
  document.createElement = (tag) => new Element(tag, document);
  document.createElementNS = (_, tag) => new Element(tag, document);
  const root = new Element("section", document);
  const app = explorer.create(root, metrics);
  app.update(payload);
  return { app, root, document };
};
const payloadFor = (values, key = "snowfall") => ({ hourly: { time: timesFor(values.length), [key]: values } });
const clickMetric = (root, key) => descendants(root).find((node) => node.id === `hourly-metric-${key}`).dispatch("click");
const pressKey = (node, key, modifiers = {}) => {
  let prevented = false;
  node.dispatch("keydown", { key, ...modifiers, preventDefault: () => { prevented = true; } });
  return prevented;
};

test("normalization preserves missing source hours and rejects coercions to a fabricated zero", () => {
  const raw = [null, undefined, "", " ", false, [], {}, NaN, Infinity, "invalid", 0, "0", 0.04];
  const normalized = explorer.normalizeSeries({ time: timesFor(raw.length + 1), snowfall: raw }, "snowfall");
  assert.deepEqual(normalized.values, [null, null, null, null, null, null, null, null, null, null, 0, 0, 0.04, null]);
  assert.equal(normalized.times.length, raw.length + 1);
});

test("precipitation summaries distinguish dry, incomplete and all-missing forecasts", () => {
  const snow = metricFor("snowfall");
  assert.equal(explorer.summarize(snow, [0.1, 0.2]).primary, 0.3);
  assert.equal(explorer.summarize(snow, [0, 0]).primary, 0);
  assert.equal(explorer.summarize(snow, [null, null]).primary, null);
  const partial = explorer.summarize(snow, [null, 0.04, 0.12, null]);
  assert.equal(partial.primary, 0.16);
  assert.equal(partial.count, 2);
  assert.equal(partial.at, 2);
  const { root } = mount(payloadFor([null, 0.04, 0.12, null]));
  assert.match(byClass(root, "explorer-primary-caption")[0].textContent, /incomplete total/);
  assert.match(byClass(root, "explorer-coverage")[0].textContent, /2 of 4/);
});

test("line and area geometry uses exact observations and cannot bridge missing values or timestamp gaps", () => {
  const paths = explorer.pathsFor([0.04, 0.12, null, 0.2], timesFor(4), (index) => index * 10, (value) => 100 - value * 100, 100);
  assert.equal(paths.length, 2);
  assert.equal(paths[0].line, "M0.00 96.00 L10.00 88.00");
  assert.equal(paths[0].area, "M0.00 96.00 L10.00 88.00 L10.00 100.00 L0.00 100.00 Z");
  assert.equal(paths[1].line, "M30.00 80.00");
  assert.equal(paths[1].area, "", "A singleton must not fabricate a filled interval");
  assert.deepEqual(explorer.segmentsFor([1, 2, 3], ["2026-09-12T00:00", "2026-09-12T01:00", "2026-09-12T04:00"]).map((segment) => segment.map((point) => point.index)), [[0, 1], [2]]);
});

test("axes contain every value, keep precipitation above zero, and respect fixed probability and bearing bounds", () => {
  for (const key of ["snowfall", "rain", "wind_speed_10m", "visibility", "snow_depth"]) {
    for (const values of [[0, 0, 0], [0.04, null, 0.12], [11500, 16267], [1.2, 1.24]]) {
      const axis = explorer.axisFor(key, values);
      assert.ok(axis.max > axis.min);
      assert.ok(axis.min >= 0);
      for (const value of values.filter((value) => value !== null)) assert.ok(value >= axis.min && value <= axis.max);
      assert.equal(axis.ticks[0], axis.min);
      assert.equal(axis.ticks.at(-1), axis.max);
    }
  }
  assert.deepEqual(explorer.axisFor("precipitation_probability", [20, 95]).ticks, [0, 25, 50, 75, 100]);
  assert.deepEqual(explorer.axisFor("wind_direction_10m", [350, 10]).ticks, [0, 90, 180, 270, 360]);
});

test("calendar labels remain in resort-local time and get sparser on narrow plots", () => {
  const times = timesFor(72, 13);
  const narrow = explorer.clockTicks(times, 260);
  assert.deepEqual(narrow, [11, 35, 59]);
  assert.ok(explorer.clockTicks(times, 900).length > narrow.length);
  for (const index of narrow) assert.equal(explorer.timeLabel(times[index]).hour, "00:00");
  assert.equal(explorer.timeLabel("2026-09-12T23:00-07:00").full, "Sat, Sep 12 · 23:00");
  assert.deepEqual(explorer.dayBands(times).map((band) => [band.start, band.end]), [[0, 11], [11, 35], [35, 59], [59, 72]]);
});

test("the main chart uses amount bars, exact continuous lines, isolated points and unconnected compass observations", () => {
  const payload = payloadFor([0, 0.04, null, 0.12]);
  payload.hourly.snow_depth = [1.2, 1.24, null, 1.3];
  payload.hourly.wind_direction_10m = [350, 10, null, 360];
  const { root } = mount(payload);
  const bars = byClass(root, "explorer-bar");
  assert.equal(bars.length, 2);
  assert.deepEqual(bars.map((bar) => bar.attributes["data-hour"]), ["1", "3"]);
  assert.ok(Math.abs(Number(bars[1].attributes.height) / Number(bars[0].attributes.height) - 3) < 1e-9,
    "Relative bar heights retain the actual 0.04 / 0.12 ratio");
  assert.equal(byClass(root, "explorer-zero-mark").length, 1);
  assert.equal(byClass(root, "explorer-missing-mark").length, 1);
  clickMetric(root, "snow_depth");
  assert.equal(byClass(root, "explorer-line").length, 2);
  assert.equal(byClass(root, "explorer-isolated-point").length, 1);
  clickMetric(root, "wind_direction_10m");
  assert.equal(byClass(root, "explorer-bearing").length, 3);
  assert.equal(byClass(root, "explorer-line").length, 0, "350° to 10° never draws a false sweep across south");
  assert.equal(explorer.bearingLabel(360), "360° N");
});

test("the chart is the sole hour control and exposes exact tiny, missing and large values to keyboard users", () => {
  const payload = payloadFor([0.04, null, 0.12]);
  payload.hourly.visibility = [11500, 16267, 15000];
  const { root } = mount(payload);
  const chart = byClass(root, "explorer-chart")[0];
  assert.equal(descendants(root).filter((node) => node.attributes.role === "slider").length, 1);
  assert.equal(descendants(root).filter((node) => node.tagName === "input").length, 0, "No second visible or hidden time selector");
  assert.equal(chart.tabIndex, 0);
  assert.equal(chart.attributes["aria-orientation"], "horizontal");
  assert.equal(chart.attributes["aria-label"], "Snowfall, forecast hour");
  chart.focus();
  assert.equal(byClass(root, "explorer-inspect-value")[0].textContent, "0.04 cm");
  assert.equal(pressKey(chart, "ArrowRight"), true);
  assert.equal(byClass(root, "explorer-inspect-value")[0].textContent, "No data");
  assert.match(chart.attributes["aria-valuetext"], /01:00: No data/);
  assert.equal(byClass(root, "explorer-selected-point")[0].attributes.visibility, "hidden");
  clickMetric(root, "visibility");
  assert.equal(byClass(root, "explorer-inspect-value")[0].textContent, "16,267 m");
  assert.equal(chart.attributes["aria-valuenow"], "1", "Changing metric keeps the inspected forecast hour");
  assert.equal(chart.attributes["aria-label"], "Visibility, forecast hour");
});

test("chart Arrow, Home and End keys select bounded hours while other shortcuts keep their browser behavior", () => {
  const { root } = mount(payloadFor([0.04, 0.08, 0.12]));
  const chart = byClass(root, "explorer-chart")[0];
  chart.focus();
  for (const [key, hour] of [["End", "2"], ["ArrowRight", "2"], ["ArrowLeft", "1"], ["ArrowUp", "2"], ["ArrowDown", "1"], ["Home", "0"], ["ArrowLeft", "0"]]) {
    assert.equal(pressKey(chart, key), true);
    assert.equal(chart.attributes["aria-valuenow"], hour);
    assert.match(chart.attributes["aria-valuetext"], new RegExp(`0${hour}:00`));
  }
  for (const key of ["Tab", "Enter", "Escape"]) assert.equal(pressKey(chart, key), false);
  for (const modifier of ["ctrlKey", "metaKey", "altKey"]) assert.equal(pressKey(chart, "End", { [modifier]: true }), false);
  assert.equal(chart.attributes["aria-valuenow"], "0");
  assert.equal(byClass(root, "explorer-cursor")[0].attributes.visibility, "visible");
  chart.blur();
  assert.equal(byClass(root, "explorer-cursor")[0].attributes.visibility, "hidden");
  assert.equal(byClass(root, "explorer-inspect-value")[0].textContent, "0.04 cm");
});

test("pointer inspection accounts for scaled SVGs and touch capture ends cleanly", () => {
  const { root } = mount(payloadFor([0.04, null, 0.12]), 600);
  const svg = byClass(root, "explorer-svg")[0];
  const chart = byClass(root, "explorer-chart")[0];
  svg.rect = { left: 100, width: 1200 };
  chart.dispatch("pointerdown", { button: 0, pointerId: 12, clientX: 100 + 314 * 2 });
  assert.equal(byClass(root, "explorer-inspect-value")[0].textContent, "No data");
  assert.equal(chart.captured, 12);
  assert.equal(byClass(root, "explorer-tooltip")[0].hidden, false);
  chart.dispatch("pointercancel", { pointerId: 12 });
  assert.equal(chart.captured, null);
  chart.dispatch("pointerleave");
  assert.equal(byClass(root, "explorer-cursor")[0].attributes.visibility, "visible", "Focused chart retains the selected hour after touch ends");
  chart.blur();
  assert.equal(byClass(root, "explorer-tooltip")[0].hidden, true);
  assert.equal(byClass(root, "explorer-selected-point")[0].attributes.visibility, "hidden");
});

test("metric keyboard navigation, range updates and resize retain one stable workspace", () => {
  const payload = payloadFor([0.04, 0.12, 0.3]);
  payload.hourly.rain = [1, 2, 3];
  const { root, app, document } = mount(payload);
  const nav = byClass(root, "explorer-metrics")[0];
  const snow = descendants(root).find((node) => node.id === "hourly-metric-snowfall");
  let prevented = false;
  snow.dispatch("keydown", { key: "ArrowRight", preventDefault: () => { prevented = true; } });
  assert.equal(prevented, true);
  assert.equal(document.activeElement.id, "hourly-metric-rain");
  assert.equal(document.activeElement.attributes["aria-selected"], "true");
  const chart = byClass(root, "explorer-chart")[0];
  pressKey(chart, "End");
  app.update({ hourly: { time: timesFor(2), snowfall: [0, 0], rain: [5, 6] } });
  assert.equal(byClass(root, "explorer-inspect-value")[0].textContent, "6 mm");
  assert.equal(chart.attributes["aria-valuenow"], "1");
  assert.equal(chart.attributes["aria-valuemax"], "1");
  assert.equal(byClass(root, "explorer-metrics")[0], nav);
  chart.focus();
  document.width = 300;
  app.resize();
  assert.equal(document.activeElement, chart);
  assert.equal(byClass(root, "explorer-svg")[0].attributes.viewBox, "0 0 300 300");
  assert.equal(byClass(root, "explorer-inspect-value")[0].textContent, "6 mm");
});

test("an all-missing metric hides the plot and hourly selector without claiming dry conditions", () => {
  const { root } = mount(payloadFor([null, null]));
  assert.equal(byClass(root, "explorer-primary-value")[0].textContent, "—");
  assert.equal(byClass(root, "explorer-svg")[0].style.display, "none");
  assert.equal(byClass(root, "explorer-empty")[0].hidden, false);
  assert.equal(byClass(root, "explorer-inspection")[0].hidden, true);
  assert.equal(byClass(root, "explorer-bar").length, 0);
  const chart = byClass(root, "explorer-chart")[0];
  assert.equal(chart.tabIndex, -1);
  assert.equal(chart.attributes["aria-disabled"], "true");
  assert.equal(pressKey(chart, "End"), false);
  assert.equal(chart.attributes["aria-valuetext"], "No hourly data for this period");
});

test("single observations remain focusable and empty updates remove stale accessible readings", () => {
  const { root, app } = mount(payloadFor([0.04]));
  const chart = byClass(root, "explorer-chart")[0];
  assert.equal(chart.tabIndex, 0);
  chart.focus();
  for (const key of ["End", "Home", "ArrowRight", "ArrowLeft"]) {
    assert.equal(pressKey(chart, key), true);
    assert.equal(chart.attributes["aria-valuenow"], "0");
    assert.equal(chart.attributes["aria-valuemax"], "0");
  }
  app.update(payloadFor([]));
  assert.equal(chart.tabIndex, -1);
  assert.equal(chart.attributes["aria-disabled"], "true");
  assert.equal(chart.attributes["aria-valuetext"], "No hourly data for this period");
  chart.blur();
  assert.equal(chart.attributes["aria-valuetext"], "No hourly data for this period");
  app.update(payloadFor([0.08]));
  assert.equal(chart.tabIndex, 0);
  assert.equal(chart.attributes["aria-disabled"], "false");
  assert.match(chart.attributes["aria-valuetext"], /0.08 cm/);
});

test("the raw-data table agrees with precise chart readings instead of rounding small snowfall to zero", () => {
  const context = {
    URL,
    window: { location: { pathname: "/resort/test/" }, addEventListener: () => {}, CloseSnowHourlyExplorer: explorer },
    document: { getElementById: () => null },
  };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(__dirname, "../../assets/js/resort_hourly.js"), "utf8"), context);
  const formatValue = vm.runInContext("formatValue", context);
  assert.equal(formatValue(0.04), "0.04");
  assert.equal(formatValue(16267), "16,267");
  for (const value of [null, undefined, "", false, NaN]) assert.equal(formatValue(value), "—");
});

for (const delivery of ["static", "dynamic"]) {
  test(`${delivery} resort page boots its actual template scripts with overview, timeline and charts, then handles range and refresh`, async () => {
    const template = fs.readFileSync(path.join(__dirname, "../../src/web/templates/resort_hourly_page.html"), "utf8");
    const document = { width: 900, readyState: "complete", querySelectorAll: () => [], addEventListener: () => {} };
    document.createElement = (tag) => new Element(tag, document);
    document.createElementNS = (_, tag) => new Element(tag, document);
    document.createTextNode = (textContent) => ({ textContent, children: [] });
    document.documentElement = { dataset: {} };
    const nodes = Object.fromEntries([...template.matchAll(/\bid="([^"]+)"/g)].map(([, id]) => {
      const node = new Element("div", document);
      node.id = id;
      node.querySelector = () => null;
      return [id, node];
    }));
    document.getElementById = (id) => nodes[id] || null;
    const tableHead = new Element("thead", document);
    const tableBody = new Element("tbody", document);
    nodes["hourly-table"].querySelector = (selector) => ({ thead: tableHead, tbody: tableBody }[selector] || null);
    nodes["hours-select"].value = "72";
    const requests = [];
    const times = timesFor(30);
    const rawHourly = Object.fromEntries(metrics.map((metric) => [metric.key, times.map((_, index) => index === 10 ? null : metric.key === "snowfall" ? 0.04 : index)]));
    rawHourly.time = times;
    const daily = [{ date: "2026-09-12", temperature_max_c: -2, temperature_min_c: -8, snowfall_cm: 6, rain_mm: 0, weather_code: 73 }];
    const window = {
      document,
      location: { pathname: "/resort/test/", href: "https://example.com/resort/test/", origin: "https://example.com" },
      CLOSESNOW_HOURLY_CONTEXT: {
        resortId: "test",
        ...(delivery === "static" ? { hourlyDataUrl: "/data/test.hourly.json" } : {}),
        dailySummary: { daily, past14dDaily: [], nearbyAirports: [] },
      },
      addEventListener: () => {}, setInterval: () => 1, clearInterval: () => {},
      requestAnimationFrame: (callback) => { callback(); return 1; }, cancelAnimationFrame: () => {},
    };
    document.defaultView = window;
    const context = {
      URL, window, document, HTMLElement: Element,
      fetch: async (url) => {
        requests.push(url);
        const hours = delivery === "dynamic" ? Number(new URL(url).searchParams.get("hours")) : 30;
        return { ok: true, json: async () => ({
          display_name: "Test Mountain", timezone: "America/Denver", input_latitude: 40, input_longitude: -110,
          nearby_airports: [], hourly: Object.fromEntries(Object.entries(rawHourly).map(([key, values]) => [key, values.slice(0, hours)])),
        }) };
      },
    };
    vm.createContext(context);
    // Execute the actual script list and ordering from the template. Overview
    // and timeline nodes are present so their startup dependencies cannot hide
    // behind the early returns used in narrower chart-module tests.
    for (const [, script] of template.matchAll(/<script src="\{\{asset_prefix\}\}\/js\/([^"]+)"/g)) {
      vm.runInContext(fs.readFileSync(path.join(__dirname, "../../assets/js", script), "utf8"), context, { filename: script });
    }
    await new Promise(setImmediate);
    assert.equal(requests.length, 1);
    assert.equal(nodes["hourly-title"].textContent, "Test Mountain");
    assert.match(nodes["resort-snapshot"].html, /-2° \/ -8°/);
    assert.match(nodes["resort-timeline-root"].html, /compact-day-card/);
    assert.match(nodes["hourly-meta"].textContent, /America\/Denver/);
    assert.equal(nodes["hourly-error"].textContent, "");
    assert.equal(nodes["hourly-chart-error"].textContent, "");
    assert.equal(byClass(nodes["hourly-charts"], "explorer-metric").length, 7);
    assert.equal(byClass(nodes["hourly-charts"], "explorer-bar").length, 29);
    assert.match(tableBody.html, /<td>0\.04<\/td>/);
    nodes["hours-select"].value = "24";
    nodes["hours-select"].dispatch("change");
    await new Promise(setImmediate);
    assert.equal(requests.length, 2);
    assert.equal(byClass(nodes["hourly-charts"], "explorer-chart")[0].attributes["aria-valuemax"], "23");
    assert.equal((tableBody.html.match(/<tr>/g) || []).length, 24);
    nodes["hours-refresh-btn"].dispatch("click");
    await new Promise(setImmediate);
    assert.equal(requests.length, 3);
    assert.equal(nodes["hourly-error"].textContent, "");
    assert.equal(nodes["hourly-chart-error"].textContent, "");
    assert.equal(byClass(nodes["hourly-charts"], "explorer-metrics").length, 1);
  });
}

test("selecting an offscreen metric reveals only its navigation strip", () => {
  const payload = payloadFor([1, 2]);
  payload.hourly.visibility = [12000, 13000];
  const { root } = mount(payload, 300);
  const nav = byClass(root, "explorer-metrics")[0];
  nav.rect = { left: 100, width: 260 };
  nav.clientWidth = 260;
  nav.scrollWidth = 1200;
  nav.scrollLeft = 0;
  const visibility = descendants(root).find((node) => node.id === "hourly-metric-visibility");
  visibility.rect = { left: 500, width: 120 };
  visibility.scrollIntoView = () => { throw new Error("Do not move page ancestors"); };
  visibility.dispatch("click");
  assert.equal(nav.scrollLeft, 268);
  const snow = descendants(root).find((node) => node.id === "hourly-metric-snowfall");
  snow.rect = { left: 0, width: 120 };
  snow.scrollIntoView = () => { throw new Error("Do not move page ancestors"); };
  snow.dispatch("click");
  assert.equal(nav.scrollLeft, 160);
});
