const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { execFileSync } = require("node:child_process");
const colors = require("../../assets/js/weather_colors.js");

const repoRoot = path.resolve(__dirname, "../..");
const browser = { window: {} };
vm.createContext(browser);
for (const file of ["weather_colors.js", "weather_page_formatters.js", "compact_daily_summary.js", "resort_hourly_metrics.js"]) {
  vm.runInContext(fs.readFileSync(path.join(repoRoot, "assets/js", file), "utf8"), browser);
}

const cases = [
  ["snowColor", -1, "background:var(--heat-surface);"],
  ["snowColor", 0, "background:var(--heat-surface);"],
  ["snowColor", 1.5, "background:color-mix(in srgb, var(--heat-surface), var(--heat-snow) 10%);"],
  ["snowColor", 7.5, "background:color-mix(in srgb, var(--heat-surface), var(--heat-snow) 50%);"],
  ["snowColor", 15, "background:var(--heat-snow);"],
  ["snowColor", 15.1, "background:var(--heat-snow-heavy);"],
  ["rainColor", -1, "background:var(--heat-surface);"],
  ["rainColor", 0, "background:var(--heat-surface);"],
  ["rainColor", 3.8, "background:color-mix(in srgb, var(--heat-surface), var(--heat-rain) 50%);"],
  ["rainColor", 7.6, "background:var(--heat-rain);"],
  ["rainColor", 50, "background:var(--heat-rain);"],
  ["tempColor", -20, "background:var(--heat-cold);"],
  ["tempColor", -10, "background:var(--heat-cold);"],
  ["tempColor", -5, "background:color-mix(in srgb, var(--heat-cold), var(--heat-freezing) 50%);"],
  ["tempColor", 0, "background:var(--heat-surface);"],
  ["tempColor", 4, "background:var(--heat-surface);"],
  ["tempColor", 12, "background:color-mix(in srgb, var(--heat-surface), var(--heat-warm) 50%);"],
  ["tempColor", 20, "background:var(--heat-warm);"],
  ["tempColor", 20.1, "background:var(--heat-hot);"],
];

test("weather heatmaps retain zero and severity thresholds using live palette references", () => {
  for (const [kind, value, expected] of cases) {
    assert.equal(colors[kind](value), expected, `${kind}(${value})`);
  }
  for (const kind of ["snowColor", "rainColor", "tempColor"]) {
    for (const value of [null, undefined, "", "invalid", NaN, Infinity, -Infinity]) {
      assert.equal(colors[kind](value), "", `${kind}(${value})`);
    }
  }
});

test("homepage tables and both daily summary views use the same weather palette", () => {
  const shared = browser.window.CloseSnowWeatherColors;
  const formatters = browser.window.CloseSnowWeatherPageFormatters;
  const summary = browser.window.CloseSnowCompactDailySummary;
  for (const kind of ["snowColor", "rainColor", "tempColor"]) {
    assert.equal(formatters[kind], shared[kind]);
  }
  for (const snowfall of [null, 0, 1.5, 7.5, 15, 15.1]) {
    for (const temperature of [null, -20, -5, 0, 4, 12, 20.1]) {
      const day = { snowfall_cm: snowfall, temperature_max_c: temperature };
      const expected = snowfall > 0 ? shared.snowColor(snowfall) : shared.tempColor(temperature);
      assert.equal(summary.dayStyle(day), expected);
      const html = summary.renderSingleResortHtml([day]);
      if (expected) assert.ok(html.includes(`style='${expected}'`));
      else assert.doesNotMatch(html, /style=/);
    }
  }
});

test("Python compatibility tables match the canonical browser heatmap policy", () => {
  const samples = cases.map(([kind, value]) => [kind, value]);
  for (const kind of ["snowColor", "rainColor", "tempColor"]) {
    for (const value of [null, "", "invalid", "2.5", 0.01, 2.333333, -0.1]) samples.push([kind, value]);
  }
  const output = execFileSync("python3", ["-c", [
    "import json, sys",
    "from src.web.weather_table_styles import snow_color, rain_color, temp_color",
    "functions = {'snowColor': snow_color, 'rainColor': rain_color, 'tempColor': temp_color}",
    "print(json.dumps([functions[kind](value) for kind, value in json.load(sys.stdin)]))",
  ].join("\n")], { cwd: repoRoot, input: JSON.stringify(samples), encoding: "utf8" });
  assert.deepEqual(JSON.parse(output), samples.map(([kind, value]) => colors[kind](value)));
});

test("all hourly chart metrics inherit semantic chart colors", () => {
  const metrics = browser.window.CloseSnowResortHourlyMetrics.metricDefs;
  assert.equal(metrics.length, 7);
  for (const metric of metrics) assert.match(metric.color, /^var\(--chart-[a-z]+\)$/);
});
