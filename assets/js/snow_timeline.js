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
  // Straight segments preserve each daily peak. Missing observations never get
  // bridged, and a lone observation remains a point rather than an invented area.
  const ribbonGeometry = (values, options = {}) => {
    const observations = Array.from(Array.isArray(values) ? values : [], (raw) => {
      const value = numeric(raw);
      return value !== null && value >= 0 ? value : null;
    });
    const positiveOption = (value, fallback) => {
      const parsed = numeric(value);
      return parsed !== null && parsed > 0 ? parsed : fallback;
    };
    const width = positiveOption(options.width, Math.max(1, observations.length) * 48);
    const height = positiveOption(options.height, 64);
    // A caller normally passes sharedScales()[kind]. Preserve exact peaks even
    // if an outdated scale is supplied instead of clipping observations to it.
    const maxValue = Math.max(positiveOption(options.maxValue, 1), ...observations.filter((value) => value !== null));
    const points = observations.map((value, index) => value === null ? null : {
      index, value,
      x: (index + 0.5) * width / observations.length,
      y: height - (value / maxValue) * height,
    });
    const segments = [];
    const isolatedPoints = [];
    let run = [];
    const finishRun = () => {
      if (run.length === 1) isolatedPoints.push(run[0]);
      if (run.length > 1) {
        const first = run[0];
        const last = run[run.length - 1];
        const coordinates = run.map((point) => `${point.x} ${point.y}`);
        segments.push({
          points: run,
          linePath: `M ${coordinates.join(" L ")}`,
          areaPath: `M ${first.x} ${height} L ${coordinates.join(" L ")} L ${last.x} ${height} Z`,
        });
      }
      run = [];
    };
    points.forEach((point) => {
      if (point) run.push(point);
      else finishRun();
    });
    finishRun();
    return {
      width, height, maxValue, points, segments, isolatedPoints,
      missingIndices: observations.flatMap((value, index) => value === null ? [index] : []),
    };
  };
  const precipitationSummary = (report, limit = 14) => {
    const count = Math.max(0, Math.min(14, Math.floor(numeric(limit) ?? 14)));
    const days = daysFor(report, count);
    const metric = (key) => {
      const values = Array.from(days, (day) => {
        const value = numeric(day?.[key]);
        return value !== null && value >= 0 ? value : null;
      });
      return {
        wet: values.flatMap((value, index) => value !== null && value > 0 ? [index] : []),
        known: values.filter((value) => value !== null).length,
        complete: count > 0 && values.length === count && values.every((value) => value !== null),
      };
    };
    const snow = metric("snowfall_cm");
    const rain = metric("rain_mm");
    const incomplete = !snow.complete || !rain.complete;
    const dayCount = (amount) => `${amount} ${amount === 1 ? "day" : "days"}`;
    if (snow.wet.length && rain.wet.length) {
      return `Snow on ${dayCount(snow.wet.length)} · rain on ${dayCount(rain.wet.length)}${incomplete ? " · partial data" : ""}`;
    }
    const selected = snow.wet.length ? snow : rain.wet.length ? rain : null;
    if (selected) {
      const label = selected === snow ? "Snow" : "Rain";
      const dates = selected.wet.map((index) => dateParts(days[index].date, index));
      const contiguous = selected.wet.every((index, position) => position === 0 || index === selected.wet[position - 1] + 1);
      const consecutiveDates = dates.every((date, position) => date.raw && (position === 0
        || Date.parse(`${date.raw}T00:00:00Z`) - Date.parse(`${dates[position - 1].raw}T00:00:00Z`) === 86400000));
      if (!incomplete && contiguous && consecutiveDates) {
        const dayLabel = (date) => `${date.weekday} ${Number(date.raw.slice(-2))}`;
        const first = dayLabel(dates[0]);
        const last = dayLabel(dates[dates.length - 1]);
        return `${label} ${first}${dates.length > 1 ? `–${last}` : ""}`;
      }
      return `${label} on ${dayCount(selected.wet.length)}${incomplete ? " · partial data" : ""}`;
    }
    if (snow.complete && rain.complete) return "Dry forecast";
    if (!snow.known && !rain.known) return "Precipitation data unavailable";
    if (!snow.known) return "Snow data unavailable";
    if (!rain.known) return "Rain data unavailable";
    return "Precipitation data incomplete";
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
  const dayLabel = (day, kind, mode = "metric", index = 0) => {
    const raw = numeric(day?.[kind === "rain" ? "rain_mm" : "snowfall_cm"]);
    const value = raw !== null && raw >= 0 ? raw : null;
    const unit = mode === "imperial" ? "in" : kind === "rain" ? "mm" : "cm";
    const date = dateParts(day?.date, index);
    const temperature = (rawTemp) => {
      const number = numeric(rawTemp);
      return number === null ? "—" : `${Math.round(mode === "imperial" ? number * 9 / 5 + 32 : number)}°`;
    };
    const high = temperature(day?.temperature_max_c);
    const low = temperature(day?.temperature_min_c);
    return `${date.date || date.weekday} · ${value === null ? `No ${kind} data` : `${formatValue(kind, value, mode)} ${unit} ${kind}`} · ${high} / ${low}${mode === "imperial" ? "F" : "C"}`;
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
  return { daysFor, seriesFor, sharedScales, ribbonGeometry, precipitationSummary, formatValue, dateParts, dayLabel, todayFor };
}));
