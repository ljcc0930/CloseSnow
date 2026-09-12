const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const sections = require("../../assets/js/weather_sections.js");
const reportModel = require("../../assets/js/weather_report_model.js");
const snowTimeline = require("../../assets/js/snow_timeline.js");

const browser = { window: {} };
vm.createContext(browser);
for (const file of ["weather_colors.js", "weather_page_formatters.js", "compact_daily_summary.js", "weather_code_emoji.js"]) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, "../../assets/js", file), "utf8"), browser);
}
const create = (overrides = {}) => {
  const state = {
    payload: { forecast_days: 4 }, forecastTab: "summary", layoutMode: "desktop",
    favoriteResortIds: new Set(), compactSummaryUnitMode: "metric", sunTimeToggleMode: "metric",
    ...overrides,
  };
  return { state, renderer: sections.createRenderer({
    state, reportModel, snowTimeline, formatters: browser.window.CloseSnowWeatherPageFormatters,
    compactDailySummary: browser.window.CloseSnowCompactDailySummary,
    weatherCode: browser.window.CloseSnowWeatherCode,
  }) };
};
const reports = [{
  resort_id: "test", query: "Test <Mountain>", city: "Tahoe", admin1: "CA", week1_total_snowfall_cm: 12.5,
  week2_total_snowfall_cm: 4, week1_total_rain_mm: 1,
  daily: [{ date: "2026-09-12", snowfall_cm: 2.5, temperature_min_c: -4, temperature_max_c: 3, weather_code: 71, sunrise_local_hhmm: "06:30", sunset_local_hhmm: "19:15" }],
}];

test("overview cards and all six table views render a complete accessible tab set", () => {
  const { state, renderer } = create();
  for (const { key } of sections.FORECAST_TABS) {
    state.forecastTab = key;
    const html = renderer.render(reports);
    assert.equal((html.match(/<table\b/g) || []).length, key === "overview" ? 0 : 1, key);
    assert.equal((html.match(/role="tab"/g) || []).length, 7);
    assert.equal((html.match(/role="tabpanel"/g) || []).length, 7);
    assert.equal((html.match(/aria-selected="true"/g) || []).length, 1);
    assert.match(html, new RegExp(`id="forecast-tab-${key}"[^>]*aria-selected="true"`));
    assert.match(html, /Test &lt;Mountain&gt;/);
  }
});

test("tab navigation wraps and supports Home and End", () => {
  assert.equal(sections.tabForKey("overview", "ArrowLeft"), "daylight");
  assert.equal(sections.tabForKey("daylight", "ArrowRight"), "overview");
  assert.equal(sections.tabForKey("rainfall", "Home"), "overview");
  assert.equal(sections.tabForKey("summary", "End"), "daylight");
  assert.equal(sections.tabForKey("summary", "Tab"), null);
  assert.equal(sections.resolveTab("unknown"), "overview");
});

test("rendering reads current explicit state while preserving selected view", () => {
  const { state, renderer } = create({ forecastTab: "daylight" });
  state.sunTimeToggleMode = "imperial";
  state.favoriteResortIds.add("test");
  const html = renderer.render(reports);
  assert.match(html, /6:30 AM/);
  assert.match(html, /7:15 PM/);
  assert.match(html, /data-resort-id='test' data-favorite-active='1'/);
  assert.match(html, /id="forecast-tab-daylight"[^>]*aria-selected="true"/);
  assert.match(renderer.render([], "No saved resorts."), /No saved resorts\./);
  assert.equal(state.forecastTab, "daylight");
});

test("mobile precipitation keeps one leading resort column and exact forecast metrics", () => {
  const { renderer } = create({ forecastTab: "snowfall", layoutMode: "compact" });
  const html = renderer.render(reports);
  assert.match(html, /data-sticky-leading-cols="1"/);
  assert.match(html, /data-metric-value='12\.500000'/);
  assert.match(html, /data-metric-value='2\.500000'/);
  assert.match(html, /data-favorite-all='1'/);
});

test("overview uses sorted filtered input, limits cards without changing the shared scale, and keeps favorites", () => {
  const { state, renderer } = create({ forecastTab: "overview", payload: { forecast_days: 15 } });
  const many = Array.from({ length: 8 }, (_, index) => ({
    ...reports[0], resort_id: `resort-${index}`, query: `Resort ${index}`,
    daily: Array.from({ length: 14 }, () => ({ snowfall_cm: index === 7 ? 40 : 4, rain_mm: 0 })),
  }));
  state.favoriteResortIds.add("resort-0");
  const first = renderer.render(many);
  assert.equal((first.match(/data-timeline-card /g) || []).length, 6);
  assert.equal((first.match(/data-timeline-scale="40"/g) || []).length, 6);
  assert.match(first, /data-resort-id='resort-0' data-favorite-active='1'/);
  assert.ok(first.indexOf("Resort 0") < first.indexOf("Resort 1"));
  state.timelineLimit = 12;
  const expanded = renderer.render(many);
  assert.equal((expanded.match(/data-timeline-card /g) || []).length, 8);
  assert.equal((expanded.match(/data-timeline-scale="40"/g) || []).length, 8);
  assert.doesNotMatch(expanded, /data-show-more-timelines/);
  assert.match(expanded, /height:10\.0000%/);
});

test("rain fallback, missing forecasts, and imperial card temperatures remain distinct", () => {
  const { renderer } = create({ forecastTab: "overview", compactSummaryUnitMode: "imperial" });
  const html = renderer.render([{ ...reports[0], daily: [
    { snowfall_cm: null, rain_mm: 25.4, temperature_max_c: 0, temperature_min_c: -10 },
    { snowfall_cm: 0, rain_mm: 0 },
    { snowfall_cm: null, rain_mm: null },
  ] }]);
  assert.match(html, /data-metric-kind="rain"/);
  assert.match(html, /Snow data incomplete/);
  assert.doesNotMatch(html, /No snow forecast/);
  assert.match(html, /data-compact-metric-value="25\.400000">1<\/span>/);
  assert.match(html, /data-compact-metric-value="0\.000000">32<\/span>/);
  assert.match(html, /is-missing/);
  assert.match(html, /partial/);
});
