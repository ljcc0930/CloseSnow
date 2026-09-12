// Forecast values select semantic palette tokens; CSS owns day and night colors.
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.CloseSnowWeatherColors = api;
}(typeof window !== "undefined" ? window : null, function () {
  "use strict";

  const asFiniteNumber = (value) => {
    if (value === null || value === undefined || value === "") return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  };
  const background = (token) => `background:var(--heat-${token});`;
  const mix = (from, to, fraction) => {
    if (fraction <= 0) return background(from);
    if (fraction >= 1) return background(to);
    const percentage = (fraction * 100).toFixed(4).replace(/\.?0+$/, "");
    return `background:color-mix(in srgb, var(--heat-${from}), var(--heat-${to}) ${percentage}%);`;
  };

  const snowColor = (value) => {
    const number = asFiniteNumber(value);
    if (number === null) return "";
    if (number > 15) return background("snow-heavy");
    return mix("surface", "snow", Math.max(number, 0) / 15);
  };

  const rainColor = (value) => {
    const number = asFiniteNumber(value);
    if (number === null) return "";
    return mix("surface", "rain", number / 7.6);
  };

  const tempColor = (value) => {
    const number = asFiniteNumber(value);
    if (number === null) return "";
    if (number < -10) return background("cold");
    if (number < 0) return mix("cold", "freezing", (number + 10) / 10);
    if (number <= 4) return background("surface");
    if (number <= 20) return mix("surface", "warm", (number - 4) / 16);
    return background("hot");
  };

  return { snowColor, rainColor, tempColor };
}));
