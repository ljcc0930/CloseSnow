// Data and formatting for comparable resort timelines, independent of the DOM.
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.CloseSnowSnowTimeline = api;
}(typeof window !== "undefined" ? window : null, function () {
  "use strict";

  const numeric = (value) => {
    if (value === null || value === undefined || typeof value === "boolean" || String(value).trim() === "") return null;
    const result = Number(value);
    return Number.isFinite(result) ? result : null;
  };
  const daysFor = (report, limit = 14) => (Array.isArray(report?.daily) ? report.daily : [])
    .slice(0, Math.max(0, Math.min(14, limit)))
    .map((day) => day && typeof day === "object" ? day : {});
  const total = (days, key, start, end) => {
    const values = days.slice(start, end).map((day) => numeric(day[key]));
    const known = values.filter((value) => value !== null);
    return {
      value: known.length ? known.reduce((sum, value) => sum + value, 0) : null,
      partial: known.length > 0 && known.length < end - start,
    };
  };
  const seriesFor = (report, limit = 14) => {
    const days = daysFor(report, limit);
    const hasSnow = days.some((day) => (numeric(day.snowfall_cm) || 0) > 0);
    const hasRain = days.some((day) => (numeric(day.rain_mm) || 0) > 0);
    const kind = !hasSnow && hasRain ? "rain" : "snow";
    const key = kind === "snow" ? "snowfall_cm" : "rain_mm";
    return {
      days, kind, key,
      values: days.map((day) => numeric(day[key])),
      weeks: [total(days, key, 0, 7), total(days, key, 7, 14)],
      snowComplete: days.length >= limit && days.every((day) => numeric(day.snowfall_cm) !== null),
    };
  };
  const sharedScales = (reports, limit = 14) => {
    const maxima = { snow: 5, rain: 10 };
    reports.forEach((report) => daysFor(report, limit).forEach((day) => {
      maxima.snow = Math.max(maxima.snow, numeric(day.snowfall_cm) || 0);
      maxima.rain = Math.max(maxima.rain, numeric(day.rain_mm) || 0);
    }));
    return maxima;
  };
  const formatValue = (kind, value, mode = "metric") => {
    const raw = numeric(value);
    if (raw === null) return "—";
    const converted = mode === "imperial" ? raw / (kind === "rain" ? 25.4 : 2.54) : raw;
    const precision = mode === "imperial" && kind === "rain" ? 2 : 1;
    const step = 10 ** -precision;
    if (converted > 0 && converted < step) return `<${step}`;
    return converted.toFixed(precision).replace(/\.?0+$/, "") || "0";
  };
  const dateParts = (rawDate, index, today = "") => {
    const raw = String(rawDate || "").trim();
    const date = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? new Date(`${raw}T12:00:00Z`) : null;
    if (!date || Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== raw) {
      return { raw: "", weekday: `Day ${index + 1}`, date: "", isToday: false };
    }
    const isToday = raw === today;
    return {
      raw, isToday,
      weekday: isToday ? "Today" : date.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" }),
      date: date.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }),
    };
  };
  const todayFor = (report, now = new Date()) => {
    try {
      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: report?.forecast_timezone || "UTC", year: "numeric", month: "2-digit", day: "2-digit",
      }).formatToParts(now);
      const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
      return `${values.year}-${values.month}-${values.day}`;
    } catch (_error) {
      return now.toISOString().slice(0, 10);
    }
  };
  return { daysFor, seriesFor, sharedScales, formatValue, dateParts, todayFor };
}));
