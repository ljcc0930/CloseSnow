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


test("ribbons place exact unsmoothed peaks at day centers and close only to the baseline", () => {
  const values = [0, 10, 5, 0];
  const geometry = timeline.ribbonGeometry(values, { width: 400, height: 100, maxValue: 10 });
  assert.deepEqual(geometry.points.map(({ x, y }) => [x, y]), [[50, 100], [150, 0], [250, 50], [350, 100]]);
  assert.equal(geometry.segments.length, 1);
  assert.equal(geometry.segments[0].linePath, "M 50 100 L 150 0 L 250 50 L 350 100");
  assert.equal(geometry.segments[0].areaPath, "M 50 100 L 50 100 L 150 0 L 250 50 L 350 100 L 350 100 Z");
  assert.deepEqual(geometry.isolatedPoints, []);
  assert.deepEqual(geometry.missingIndices, []);
  assert.deepEqual(values, [0, 10, 5, 0], "Geometry must not alter source observations");
});

test("missing days split ribbons and isolated observations never fabricate neighboring area", () => {
  const geometry = timeline.ribbonGeometry([null, 4, null, 0, 2, null, 6], { width: 700, height: 60, maxValue: 6 });
  assert.deepEqual(geometry.missingIndices, [0, 2, 5]);
  assert.equal(geometry.points[0], null);
  assert.deepEqual(geometry.isolatedPoints.map((point) => point.index), [1, 6]);
  assert.equal(geometry.segments.length, 1);
  assert.deepEqual(geometry.segments[0].points.map((point) => point.index), [3, 4]);
  assert.equal(geometry.segments[0].linePath, "M 350 60 L 450 40");
  assert.ok(geometry.isolatedPoints.every((point) => point.value > 0));
  const loneZero = timeline.ribbonGeometry([null, 0, null]);
  assert.equal(loneZero.isolatedPoints[0].value, 0, "A known zero remains distinct from a missing day");
  assert.deepEqual(loneZero.segments, []);
});

test("all-zero ribbons are flat while empty, sparse, and invalid observations remain gaps", () => {
  const zero = timeline.ribbonGeometry([0, 0], { width: 200, height: 60 });
  assert.equal(zero.segments[0].linePath, "M 50 60 L 150 60");
  const invalid = timeline.ribbonGeometry([null, undefined, "", " ", false, Infinity, -1]);
  assert.deepEqual(invalid.segments, []);
  assert.deepEqual(invalid.isolatedPoints, []);
  assert.deepEqual(invalid.missingIndices, [0, 1, 2, 3, 4, 5, 6]);
  assert.deepEqual(timeline.ribbonGeometry(Array(3)).points, [null, null, null]);
  const empty = timeline.ribbonGeometry([]);
  assert.deepEqual(empty.points, []);
  assert.ok(Number.isFinite(empty.width) && Number.isFinite(empty.height) && empty.maxValue > 0);
});

test("shared scales preserve equal-value heights across resorts and never clip an exact peak", () => {
  const smaller = report([4, 8]);
  const larger = report([8, 16]);
  const scales = timeline.sharedScales([smaller, larger]);
  const options = { width: 200, height: 64, maxValue: scales.snow };
  const small = timeline.ribbonGeometry(timeline.seriesFor(smaller).values, options);
  const large = timeline.ribbonGeometry(timeline.seriesFor(larger).values, options);
  assert.equal(small.points[1].y, large.points[0].y);
  assert.equal(small.points[1].y, 32);
  assert.equal(large.points[1].y, 0);
  const staleScale = timeline.ribbonGeometry([3, 20], { maxValue: 5 });
  assert.equal(staleScale.maxValue, 20);
  assert.equal(staleScale.points[1].value, 20);
  assert.equal(staleScale.points[1].y, 0);
});

test("a single continuous precipitation period uses actual dated weekdays, never an assumed Today", () => {
  const snow = Array(14).fill(0);
  snow.splice(5, 3, 1, 2, 1);
  assert.equal(timeline.precipitationSummary(report(snow)), "Snow Tue 6–Thu 8");
  const rain = Array(14).fill(0);
  rain.splice(2, 2, 4, 5);
  assert.equal(timeline.precipitationSummary(report(Array(14).fill(0), rain)), "Rain Sat 3–Sun 4");
  assert.equal(timeline.precipitationSummary(report([2], [0]), 1), "Snow Thu 1");
});

test("separate wet periods and mixed precipitation describe counts without implying overlap", () => {
  const snow = Array(14).fill(0);
  snow[1] = 1;
  snow[8] = 2;
  assert.equal(timeline.precipitationSummary(report(snow)), "Snow on 2 days");
  const rain = Array(14).fill(0);
  rain[4] = 3;
  assert.equal(timeline.precipitationSummary(report(snow, rain)), "Snow on 2 days · rain on 1 day");
});

test("only complete known-zero precipitation can be called dry", () => {
  assert.equal(timeline.precipitationSummary(report(Array(14).fill(0))), "Dry forecast");
  assert.equal(timeline.precipitationSummary(report([0, null], [0, null]), 2), "Precipitation data incomplete");
  assert.equal(timeline.precipitationSummary(report([0], [0])), "Precipitation data incomplete");
  const sparse = report([0, 0], [0, 0]);
  delete sparse.daily[1];
  assert.equal(timeline.precipitationSummary(sparse, 2), "Precipitation data incomplete");
  assert.equal(timeline.precipitationSummary(report([null], [null]), 1), "Precipitation data unavailable");
  assert.equal(timeline.precipitationSummary(report([null], [0]), 1), "Snow data unavailable");
  assert.equal(timeline.precipitationSummary(report([0], [null]), 1), "Rain data unavailable");
  assert.equal(timeline.precipitationSummary(report([null, 0], [4, 0]), 2), "Rain on 1 day · partial data");
  assert.equal(timeline.precipitationSummary(report([2, null], [0, 0]), 2), "Snow on 1 day · partial data");
});

test("invalid, repeated, or nonconsecutive dates fall back to counts; later days stay outside the window", () => {
  for (const dates of [["bad", "2026-01-02"], ["2026-01-01", "2026-01-01"], ["2026-01-01", "2026-01-03"]]) {
    const data = report([1, 2]);
    data.daily.forEach((day, index) => { day.date = dates[index]; });
    assert.equal(timeline.precipitationSummary(data, 2), "Snow on 2 days");
  }
  assert.equal(timeline.precipitationSummary(report([...Array(14).fill(0), 20])), "Dry forecast");
});


test("shared day labels retain dates, precision and missing values when the unit system changes", () => {
  const { dayLabel } = require("../../assets/js/snow_timeline.js");
  const day = { date: "2026-01-14", rain_mm: 0.2, snowfall_cm: 2.54, temperature_max_c: 0, temperature_min_c: -10 };
  assert.equal(dayLabel(day, "snow", "imperial"), "Jan 14 · 1 in snow · 32° / 14°F");
  assert.equal(dayLabel(day, "rain", "imperial"), "Jan 14 · <0.01 in rain · 32° / 14°F");
  assert.match(dayLabel({ date: day.date, snowfall_cm: -5 }, "snow"), /No snow data · — \/ —C/);
});
