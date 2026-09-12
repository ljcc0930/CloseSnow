const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const weatherColors = require("../../assets/js/weather_colors.js");

const assets = path.join(__dirname, "../../assets");
const css = fs.readFileSync(path.join(assets, "css/design_system.css"), "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, "");

function declarations(blockPattern) {
  const block = css.match(blockPattern);
  assert.ok(block, "The shared stylesheet must define both theme roots");
  return Object.fromEntries([...block[1].matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)]
    .map(([, name, value]) => [name, value.trim()]));
}

const light = declarations(/:root\s*\{([^}]+)\}/);
const palettes = {
  light,
  dark: { ...light, ...declarations(/:root\[data-theme="dark"\]\s*\{([^}]+)\}/) },
};

function resolveColor(palette, name, seen = new Set()) {
  assert.ok(Object.hasOwn(palette, name), `Missing palette token ${name}`);
  assert.ok(!seen.has(name), `Cyclic palette alias ${name}`);
  seen.add(name);
  const value = palette[name];
  const alias = value.match(/^var\((--[\w-]+)\)$/);
  if (alias) return resolveColor(palette, alias[1], seen);
  assert.match(value, /^#(?:[\da-f]{3}|[\da-f]{6})$/i,
    `${name} must resolve to an opaque color understood by the contrast check`);
  return value;
}

function luminance(hex) {
  const full = hex.length === 4 ? hex.slice(1).split("").map((c) => c + c).join("") : hex.slice(1);
  const linear = [0, 2, 4].map((offset) => {
    const channel = parseInt(full.slice(offset, offset + 2), 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
}

function contrast(foreground, background) {
  const [low, high] = [luminance(foreground), luminance(background)].sort((a, b) => a - b);
  return (high + 0.05) / (low + 0.05);
}

test("every heatmap and hourly chart color resolves in both effective themes", () => {
  const references = new Set();
  function collect(style) {
    if (style) {
      assert.match(style, /var\(--(?:heat|chart)-[\w-]+\)/, "Weather colors must use the shared palette");
      assert.doesNotMatch(style, /#[\da-f]{3,8}\b|\b(?:rgb|rgba|hsl|hsla)\s*\(/i,
        "Weather colors must not override the theme with raw color literals");
    }
    for (const [, name] of style.matchAll(/var\((--(?:heat|chart)-[\w-]+)\)/g)) references.add(name);
  }

  // Exercise a broad weather range, including missing data and extremes, without
  // prescribing the value-to-color thresholds used by the forecast renderer.
  const values = [null, undefined, "", -1000, 1000];
  for (let value = -100; value <= 100; value += 0.5) values.push(value);
  for (const color of Object.values(weatherColors)) {
    for (const value of values) collect(color(value));
  }
  const browser = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(assets, "js/resort_hourly_metrics.js"), "utf8"), browser);
  for (const metric of browser.window.CloseSnowResortHourlyMetrics.metricDefs) {
    assert.match(metric.color, /^var\(--chart-[\w-]+\)$/, `${metric.key} must use the shared chart palette`);
    collect(metric.color);
  }
  assert.ok([...references].some((name) => name.startsWith("--heat-")), "Exercise heatmap colors");
  assert.ok([...references].some((name) => name.startsWith("--chart-")), "Exercise chart colors");
  for (const palette of Object.values(palettes)) {
    for (const name of references) resolveColor(palette, name);
  }
});

for (const [theme, palette] of Object.entries(palettes)) {
  test(`${theme} heatmap values and secondary text maintain 4.5:1 contrast`, () => {
    const backgrounds = Object.keys(palette).filter((name) => name.startsWith("--heat-") && !name.startsWith("--heat-ink-"));
    assert.ok(backgrounds.includes("--heat-surface"), "The unshaded heatmap surface must be checked");
    for (const foreground of ["--ink-800", "--heat-ink-muted"]) {
      for (const background of backgrounds) {
        const ratio = contrast(resolveColor(palette, foreground), resolveColor(palette, background));
        assert.ok(ratio >= 4.5,
          `${theme}: ${foreground} on ${background} has ${ratio.toFixed(3)}:1 contrast; requires at least 4.5:1`);
      }
    }
  });
}
