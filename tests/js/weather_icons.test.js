const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { iconForWeatherCode } = require("../../assets/js/weather_icons.js");

const knownCodes = [0, 1, 2, 3, 45, 48, 51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 71, 73, 75, 77, 80, 81, 82, 85, 86, 95, 96, 99];

test("missing or malformed input stays unknown and cannot become a sunny code zero", () => {
  const unknown = iconForWeatherCode(null);
  assert.match(unknown, /aria-label="Weather unavailable"/);
  for (const value of [undefined, "", "  ", NaN, Infinity, -1, 1.5, 100, false, true, [], [0], {}, Symbol("0")]) {
    assert.equal(iconForWeatherCode(value), unknown);
  }
  for (const value of [0, "0", " 0 "]) {
    assert.match(iconForWeatherCode(value), /aria-label="Clear sky"/);
    assert.notEqual(iconForWeatherCode(value), unknown);
  }
});

test("rain, snow, freezing precipitation and thunderstorms keep their WMO meanings", () => {
  const expectedGroups = [
    [[0], "Clear sky"], [[1], "Mainly clear"], [[2], "Partly cloudy"], [[3], "Overcast"],
    [[45, 48], "Fog"], [[51, 53, 55], "Drizzle"], [[56, 57], "Freezing drizzle"],
    [[61, 63, 65], "Rain"], [[66, 67], "Freezing rain"], [[71, 73, 75], "Snow"],
    [[77], "Snow grains"], [[80, 81, 82], "Rain showers"], [[85, 86], "Snow showers"],
    [[95], "Thunderstorm"], [[96, 99], "Thunderstorm with hail"],
  ];
  for (const [codes, description] of expectedGroups) {
    for (const code of codes) {
      const svg = iconForWeatherCode(code);
      assert.ok(svg.includes(`aria-label="${description}"`), `WMO ${code}`);
      assert.equal(iconForWeatherCode(String(code)), svg);
    }
  }
  for (const code of [71, 73, 75, 77, 85, 86]) {
    assert.match(iconForWeatherCode(code), /class="weather-icon__snow"/);
    assert.doesNotMatch(iconForWeatherCode(code), /class="weather-icon__rain"/,
      "Snow showers must not acquire a rain symbol");
  }
  for (const code of [61, 63, 65, 80, 81, 82]) {
    assert.match(iconForWeatherCode(code), /class="weather-icon__rain"/);
    assert.doesNotMatch(iconForWeatherCode(code), /class="weather-icon__snow"/);
  }
});

test("every output is self-contained, accessible and colored through inherited semantic classes", () => {
  for (const code of [...knownCodes, null]) {
    const svg = iconForWeatherCode(code);
    assert.match(svg, /^<svg\b[^>]*viewBox="0 0 24 24"/);
    assert.match(svg, /role="img"/);
    assert.match(svg, /focusable="false"/);
    const label = svg.match(/aria-label="([^"]+)"/)[1];
    assert.ok(svg.includes(`<title>${label}</title>`));
    assert.match(svg, /stroke="currentColor"/);
    assert.doesNotMatch(svg, /#[\da-f]{3,8}\b|(?:rgb|hsl)a?\(|\b(?:href|style|id|on\w+)\s*=/i);
    assert.equal((svg.match(/<svg\b/g) || []).length, 1);
    assert.ok(svg.endsWith("</svg>"));
  }
  const attack = '\"><script>alert(1)</script><svg onload="alert(1)">';
  assert.equal(iconForWeatherCode(attack), iconForWeatherCode(null), "Input never becomes SVG markup");
});

test("the same API loads as a standalone browser asset without CommonJS", () => {
  const browser = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../../assets/js/weather_icons.js"), "utf8"), browser);
  assert.equal(typeof browser.window.CloseSnowWeatherIcons.iconForWeatherCode, "function");
  for (const code of [...knownCodes, null]) {
    assert.equal(browser.window.CloseSnowWeatherIcons.iconForWeatherCode(code), iconForWeatherCode(code));
  }
});
