const test = require("node:test");
const assert = require("node:assert/strict");
const timeline = require("../../assets/js/snow_timeline.js");

const report = (snow, rain = snow.map(() => 0)) => ({
  daily: snow.map((value, index) => ({ snowfall_cm: value, rain_mm: rain[index], date: `2026-01-${String(index + 1).padStart(2, "0")}` })),
});

test("snow remains primary anywhere in the 14-day window; rain fallback never claims missing snow is zero", () => {
  assert.equal(timeline.seriesFor(report([0, 0, 2], [5, 8, 1])).kind, "snow");
  assert.equal(timeline.seriesFor(report([0, 0], [5, 8]), 2).kind, "rain");
  assert.equal(timeline.seriesFor(report([0, null], [5, 8]), 2).snowComplete, false);
  assert.equal(timeline.seriesFor(report([0, 0], [5, 8]), 2).snowComplete, true);
  assert.equal(timeline.seriesFor(report([0, 0])).kind, "snow");
  assert.equal(timeline.seriesFor(report([null, null], [null, null])).kind, "snow");
});

test("weekly totals preserve all-missing forecasts and identify incomplete weeks", () => {
  const missing = timeline.seriesFor(report(Array(14).fill(null)));
  assert.deepEqual(missing.weeks.map((week) => week.value), [null, null]);
  const zero = timeline.seriesFor(report(Array(14).fill(0)));
  assert.deepEqual(zero.weeks, [{ value: 0, partial: false }, { value: 0, partial: false }]);
  const partial = timeline.seriesFor(report([1, 2, null, 4, 0, 0, 0]));
  assert.deepEqual(partial.weeks, [{ value: 7, partial: true }, { value: null, partial: false }]);
  const sparse = timeline.seriesFor({ daily: [null, { snowfall_cm: 2 }] });
  assert.deepEqual(sparse.values, [null, 2]);
});

test("scales compare all filtered resorts in metric space and ignore data beyond day 14", () => {
  const smaller = report(Array(14).fill(2));
  const larger = report([...Array(14).fill(30), 1000]);
  const rainy = report(Array(14).fill(0), Array(14).fill(20));
  assert.deepEqual(timeline.sharedScales([smaller, larger, rainy]), { snow: 30, rain: 20 });
  assert.deepEqual(timeline.sharedScales([report([0, null])]), { snow: 5, rain: 10 });
  assert.equal(timeline.seriesFor(larger).days.length, 14);
  assert.equal(timeline.seriesFor(larger).weeks[1].value, 210);
});

test("imperial daily labels use separate snow and rain conversions without hiding traces or missing values", () => {
  assert.equal(timeline.formatValue("snow", 2.54, "imperial"), "1");
  assert.equal(timeline.formatValue("rain", 25.4, "imperial"), "1");
  assert.equal(timeline.formatValue("rain", 2.54, "imperial"), "0.1");
  assert.equal(timeline.formatValue("snow", 0.05), "<0.1");
  assert.equal(timeline.formatValue("rain", 0.01, "imperial"), "<0.01");
  for (const value of [null, undefined, "", " ", false, Infinity]) assert.equal(timeline.formatValue("snow", value), "—");
  assert.equal(timeline.formatValue("snow", 0), "0");
  assert.equal(timeline.formatValue("snow", 10), "10");
});

test("Today follows resort local date and never labels stale or invalid forecast dates as today", () => {
  const now = new Date("2026-01-02T02:00:00Z");
  const localDate = timeline.todayFor({ forecast_timezone: "America/Denver" }, now);
  assert.equal(localDate, "2026-01-01");
  assert.equal(timeline.dateParts("2026-01-01", 0, localDate).weekday, "Today");
  assert.equal(timeline.dateParts("2025-12-31", 0, localDate).isToday, false);
  assert.equal(timeline.dateParts("2026-02-31", 0, localDate).raw, "");
});
