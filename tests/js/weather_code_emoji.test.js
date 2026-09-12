const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const browser = { window: {} };
vm.createContext(browser);
vm.runInContext(fs.readFileSync(path.join(__dirname, "../../assets/js/weather_code_emoji.js"), "utf8"), browser);
const { emojiForWeatherCode, descriptionForWeatherCode } = browser.window.CloseSnowWeatherCode;

test("missing weather codes remain unknown instead of becoming sunny code zero", () => {
  for (const value of [null, undefined, "", " ", "\t\n", NaN, Infinity, "invalid", 100]) {
    assert.equal(emojiForWeatherCode(value), "❓", String(value));
    assert.equal(descriptionForWeatherCode(value), "Weather unavailable", String(value));
  }
});

test("explicit zero and other valid numeric weather codes retain their icons", () => {
  for (const value of [0, "0", " 0 "]) {
    assert.equal(emojiForWeatherCode(value), "☀️");
    assert.equal(descriptionForWeatherCode(value), "Clear sky");
  }
  for (const [value, icon] of [[1, "🌤️"], [2, "⛅"], [3, "☁️"], [48, "🌫️"], [55, "🌦️"], [63, "🌧️"], [75, "❄️"], [99, "⛈️"]]) {
    assert.equal(emojiForWeatherCode(value), icon);
    assert.equal(emojiForWeatherCode(String(value)), icon);
  }
});
