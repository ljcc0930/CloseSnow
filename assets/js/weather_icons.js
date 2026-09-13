// Small inline weather symbols. WMO groups follow weather_code_emoji.js and
// https://open-meteo.com/en/docs#weathervariables (including freezing rain).
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.CloseSnowWeatherIcons = api;
}(typeof window !== "undefined" ? window : null, function () {
  "use strict";

  const path = (className, d) => `<path class="weather-icon__${className}" d="${d}"/>`;
  const sun = '<g class="weather-icon__sun"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></g>';
  const cloud = path("cloud", "M6.8 14.5h10.1a3.6 3.6 0 0 0 .3-7.2 5.4 5.4 0 0 0-10.4-.9 4.1 4.1 0 0 0 0 8.1Z");
  const partlyCloudy = path("sun", "M5.3 9.2a3.3 3.3 0 1 1 5.9-2.8M8 1.5v1M1.5 7h1M3.4 2.4l.8.8m8.4-.8-.8.8")
    + path("cloud", "M8 17h10a3.5 3.5 0 0 0 .2-7 5 5 0 0 0-9.6-1 4 4 0 0 0-.6 8Z");
  const rain = path("rain", "M8 17l-1 3m5-3-1 3m5-3-1 3");
  const drizzle = path("rain", "M8 17.5v.1m4-.1v.1m4-.1v.1M6.5 20v.1m4-.1v.1m4-.1v.1");
  const snow = path("snow", "M7.5 17v4m-1.7-3 3.4 2m-3.4 0 3.4-2M16.5 17v4m-1.7-3 3.4 2m-3.4 0 3.4-2");
  const freezing = path("rain", "M7.5 17l-1 3")
    + path("snow", "m15.5 17 2 2-2 2-2-2Z");
  const showers = partlyCloudy + path("rain", "M8 19l-.7 2m5-2-.7 2m5-2-.7 2");
  const fog = path("cloud", "M5 11.5a4 4 0 0 1 1.8-5.1 5.4 5.4 0 0 1 10.4.9 3.6 3.6 0 0 1 2.5 4.2")
    + path("fog", "M3 14h18M5 17h14M3 20h18");
  const thunder = cloud + path("thunder", "m13.5 14.5-3.5 4.5h3l-1 3.5 5-6h-3l1-2");
  const unknown = '<g class="weather-icon__unknown"><circle cx="12" cy="12" r="8.5"/><path d="M9.7 9a2.3 2.3 0 1 1 3.7 1.8c-.9.6-1.4 1-1.4 2.2M12 16.8v.1"/></g>';
  const groups = [
    [[0], "clear", "Clear sky", sun],
    [[1], "partly-cloudy", "Mainly clear", partlyCloudy],
    [[2], "partly-cloudy", "Partly cloudy", partlyCloudy],
    [[3], "cloud", "Overcast", cloud],
    [[45, 48], "fog", "Fog", fog],
    [[51, 53, 55], "drizzle", "Drizzle", cloud + drizzle],
    [[56, 57], "freezing", "Freezing drizzle", cloud + freezing],
    [[61, 63, 65], "rain", "Rain", cloud + rain],
    [[66, 67], "freezing", "Freezing rain", cloud + freezing],
    [[71, 73, 75], "snow", "Snow", cloud + snow],
    [[77], "snow", "Snow grains", cloud + snow],
    [[80, 81, 82], "showers", "Rain showers", showers],
    [[85, 86], "snow", "Snow showers", cloud + snow],
    [[95], "thunder", "Thunderstorm", thunder],
    [[96, 99], "thunder", "Thunderstorm with hail", thunder + path("snow", "M6 18v.1m12 1.9v.1")],
  ];
  const escapeLabel = (label) => label.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[character]));

  const iconForWeatherCode = (rawCode) => {
    const numericInput = typeof rawCode === "number" || (typeof rawCode === "string" && rawCode.trim() !== "");
    const code = numericInput ? Number(rawCode) : NaN;
    const group = Number.isInteger(code) ? groups.find(([codes]) => codes.includes(code)) : null;
    const [, kind, description, shape] = group || [[], "unknown", "Weather unavailable", unknown];
    const label = escapeLabel(description);
    return `<svg xmlns="http://www.w3.org/2000/svg" class="weather-icon weather-icon--${kind}" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" role="img" aria-label="${label}" focusable="false"><title>${label}</title>${shape}</svg>`;
  };
  return { iconForWeatherCode };
}));
