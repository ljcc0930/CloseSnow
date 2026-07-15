(function () {
  "use strict";

  /*
   * Public contract: window.CloseSnowFieldGuide.{weather,copy,units}.
   * weather.*Html methods return escaped inline markup; condition/copy methods return plain text.
   * units.setMode() emits `closesnow:unitschange` with the normalized mode in event.detail.mode.
   */
  const UNIT_STORAGE_KEY = "closesnow_unit_system_v1";
  const LEGACY_UNIT_STORAGE_KEYS = [
    "closesnow_unit_mode_compact_summary",
    "closesnow_unit_mode_temp",
    "closesnow_unit_mode_snow",
    "closesnow_unit_mode_rain",
  ];

  const asFiniteNumber = (value) => {
    if (value === null || value === undefined || typeof value === "boolean") return null;
    if (typeof value === "string" && !value.trim()) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const escapeHtml = (value) => String(value === null || value === undefined ? "" : value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");

  const normalizeUnitMode = (value) => (value === "imperial" ? "imperial" : "metric");
  const validUnitMode = (value) => value === "metric" || value === "imperial";

  const defaultStorage = () => {
    try {
      return window.localStorage || null;
    } catch (_error) {
      return null;
    }
  };

  const storageGet = (storage, key) => {
    try {
      return storage && typeof storage.getItem === "function" ? storage.getItem(key) : null;
    } catch (_error) {
      return null;
    }
  };

  const storageSet = (storage, key, value) => {
    try {
      if (storage && typeof storage.setItem === "function") storage.setItem(key, value);
    } catch (_error) {
      // Storage can be unavailable in private or embedded browsing contexts.
    }
  };

  const readPreference = (storage = defaultStorage()) => {
    const saved = storageGet(storage, UNIT_STORAGE_KEY);
    if (validUnitMode(saved)) return saved;

    for (const legacyKey of LEGACY_UNIT_STORAGE_KEYS) {
      const legacyValue = storageGet(storage, legacyKey);
      if (!validUnitMode(legacyValue)) continue;
      storageSet(storage, UNIT_STORAGE_KEY, legacyValue);
      return legacyValue;
    }
    return "metric";
  };

  const unitKind = (kind) => {
    const normalized = String(kind || "").trim().toLowerCase();
    if (normalized === "temp") return "temperature";
    return normalized;
  };

  const unitLabel = (kind, mode = readPreference()) => {
    const normalizedKind = unitKind(kind);
    const normalizedMode = normalizeUnitMode(mode);
    const labels = {
      temperature: normalizedMode === "imperial" ? "°F" : "°C",
      snow: normalizedMode === "imperial" ? "in" : "cm",
      rain: normalizedMode === "imperial" ? "in" : "mm",
      distance: normalizedMode === "imperial" ? "mi" : "km",
    };
    return labels[normalizedKind] || "";
  };

  const convertValue = (kind, rawValue, mode = readPreference()) => {
    const value = asFiniteNumber(rawValue);
    if (value === null) return null;
    if (normalizeUnitMode(mode) !== "imperial") return value;
    const normalizedKind = unitKind(kind);
    if (normalizedKind === "temperature") return (value * 9 / 5) + 32;
    if (normalizedKind === "snow") return value / 2.54;
    if (normalizedKind === "rain") return value / 25.4;
    if (normalizedKind === "distance") return value / 1.609344;
    return value;
  };

  const defaultDigits = (kind, mode) => {
    const normalizedKind = unitKind(kind);
    if (normalizedKind === "temperature" || normalizedKind === "distance") return 0;
    if (normalizedKind === "rain" && normalizeUnitMode(mode) === "imperial") return 2;
    return 1;
  };

  const formatValue = (kind, rawValue, mode = readPreference(), options = {}) => {
    const normalizedMode = normalizeUnitMode(mode);
    const converted = convertValue(kind, rawValue, normalizedMode);
    if (converted === null) return options.fallback === undefined ? "—" : String(options.fallback);
    const requestedDigits = Number(options.digits);
    const digits = Number.isInteger(requestedDigits) && requestedDigits >= 0
      ? Math.min(requestedDigits, 3)
      : defaultDigits(kind, normalizedMode);
    const formatted = converted.toFixed(digits);
    if (options.withUnit === false) return formatted;
    const label = unitLabel(kind, normalizedMode);
    return label ? `${formatted} ${label}` : formatted;
  };

  const formatTemperature = (value, mode, options) => formatValue("temperature", value, mode, options);
  const formatSnow = (value, mode, options) => formatValue("snow", value, mode, options);
  const formatRain = (value, mode, options) => formatValue("rain", value, mode, options);
  const formatDistance = (value, mode, options) => formatValue("distance", value, mode, options);

  const CONDITIONS = Object.freeze([
    { codes: [0], label: "Clear sky", kind: "clear", icon: "clear" },
    { codes: [1], label: "Mostly clear", kind: "partly-cloudy", icon: "partly-cloudy" },
    { codes: [2], label: "Partly cloudy", kind: "partly-cloudy", icon: "partly-cloudy" },
    { codes: [3], label: "Overcast", kind: "cloudy", icon: "cloud" },
    { codes: [45, 48], label: "Fog", kind: "fog", icon: "fog" },
    { codes: [51, 53, 55], label: "Drizzle", kind: "drizzle", icon: "drizzle" },
    { codes: [56, 57], label: "Freezing drizzle", kind: "drizzle", icon: "drizzle" },
    { codes: [61, 63, 65], label: "Rain", kind: "rain", icon: "rain" },
    { codes: [66, 67], label: "Freezing rain", kind: "rain", icon: "rain" },
    { codes: [71, 73, 75, 77], label: "Snow", kind: "snow", icon: "snow" },
    { codes: [80, 81, 82], label: "Rain showers", kind: "rain", icon: "rain" },
    { codes: [85, 86], label: "Snow showers", kind: "snow", icon: "snow" },
    { codes: [95], label: "Thunderstorm", kind: "thunderstorm", icon: "thunder" },
    { codes: [96, 99], label: "Thunderstorm with hail", kind: "thunderstorm", icon: "thunder" },
  ]);

  const UNKNOWN_CONDITION = Object.freeze({
    codes: [],
    label: "Conditions unavailable",
    kind: "unknown",
    icon: "unknown",
  });

  const conditionForCode = (rawCode) => {
    const code = asFiniteNumber(rawCode);
    if (code === null) return UNKNOWN_CONDITION;
    return CONDITIONS.find((condition) => condition.codes.includes(code)) || UNKNOWN_CONDITION;
  };

  const conditionName = (rawCode) => conditionForCode(rawCode).label;

  const WEATHER_ICON_PATHS = Object.freeze({
    clear: "<circle cx='12' cy='12' r='3.5'></circle><path d='M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M18.7 5.3l-1.4 1.4M6.7 17.3l-1.4 1.4'></path>",
    "partly-cloudy": "<circle cx='8.5' cy='8' r='3'></circle><path d='M8.5 2.5v1.2M3.2 8h1.2M4.7 4.2l.9.9M13.1 4.2l-.9.9'></path><path d='M7 18.5h10.2a3.3 3.3 0 0 0 .2-6.6 5.1 5.1 0 0 0-9.7 1.3A2.7 2.7 0 0 0 7 18.5Z'></path>",
    cloud: "<path d='M5.7 18.3h11.5a3.8 3.8 0 0 0 .2-7.6A5.8 5.8 0 0 0 6.5 12a3.2 3.2 0 0 0-.8 6.3Z'></path>",
    fog: "<path d='M6.5 14.5h10.1a3.2 3.2 0 0 0 .2-6.4 5.1 5.1 0 0 0-9.6 1.2 2.7 2.7 0 0 0-.7 5.2Z'></path><path d='M4 18h15M6 21h11'></path>",
    drizzle: "<path d='M5.7 14.8h11.5a3.8 3.8 0 0 0 .2-7.6A5.8 5.8 0 0 0 6.5 8.5a3.2 3.2 0 0 0-.8 6.3Z'></path><path d='M8 18.2l-.6 1M12.5 18.2l-.6 1M17 18.2l-.6 1'></path>",
    rain: "<path d='M5.7 14.2h11.5a3.8 3.8 0 0 0 .2-7.6A5.8 5.8 0 0 0 6.5 7.9a3.2 3.2 0 0 0-.8 6.3Z'></path><path d='M8.5 17.2 7.4 20M13 17.2 11.9 20M17.5 17.2 16.4 20'></path>",
    snow: "<path d='M5.7 13.8h11.5a3.8 3.8 0 0 0 .2-7.6A5.8 5.8 0 0 0 6.5 7.5a3.2 3.2 0 0 0-.8 6.3Z'></path><path d='M8.5 17v4M6.8 18l3.4 2M10.2 18l-3.4 2M16 17v4M14.3 18l3.4 2M17.7 18l-3.4 2'></path>",
    thunder: "<path d='M5.7 13.8h11.5a3.8 3.8 0 0 0 .2-7.6A5.8 5.8 0 0 0 6.5 7.5a3.2 3.2 0 0 0-.8 6.3Z'></path><path d='m13 15.5-2.2 3h2l-1 3 3.5-4.4h-2.2l1.4-1.6'></path>",
    unknown: "<circle cx='12' cy='12' r='8.5'></circle><path d='M9.7 9.3A2.5 2.5 0 0 1 12 7.8c1.5 0 2.7.9 2.7 2.3 0 1.8-2.7 2-2.7 4.1M12 17.4h.01'></path>",
    "metric-snow": "<path d='M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9M8.8 4.8 12 7l3.2-2.2M8.8 19.2 12 17l3.2 2.2'></path>",
    "metric-rain": "<path d='M12 3.2s5.2 6.3 5.2 10.7A5.2 5.2 0 1 1 6.8 14C6.8 9.5 12 3.2 12 3.2Z'></path><path d='M9.3 15.2c.4 1.1 1.3 1.7 2.5 1.9'></path>",
    "metric-temperature": "<path d='M9.5 5.5a2.5 2.5 0 0 1 5 0v8.1a4.2 4.2 0 1 1-5 0V5.5Z'></path><path d='M12 7v8'></path>",
    "metric-distance": "<path d='M12 21s6-5.6 6-11a6 6 0 1 0-12 0c0 5.4 6 11 6 11Z'></path><circle cx='12' cy='10' r='2'></circle>",
  });

  const svgIconHtml = ({ path, label, dataAttribute, dataValue, className = "" }) => {
    const renderedClass = ["field-guide-weather-icon", className].filter(Boolean).join(" ");
    return `<span class="${escapeHtml(renderedClass)}" role="img" aria-label="${escapeHtml(label)}" ${dataAttribute}="${escapeHtml(dataValue)}"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${path}</svg></span>`;
  };

  const iconHtml = (rawCode, options = {}) => {
    const condition = conditionForCode(rawCode);
    const label = String(options.label || condition.label);
    return svgIconHtml({
      path: WEATHER_ICON_PATHS[condition.icon] || WEATHER_ICON_PATHS.unknown,
      label,
      dataAttribute: "data-weather-kind",
      dataValue: condition.kind,
      className: String(options.className || ""),
    });
  };

  const METRIC_ICON_LABELS = Object.freeze({
    snow: "Snowfall",
    rain: "Rainfall",
    temperature: "Temperature",
    distance: "Distance",
  });

  const metricIconHtml = (rawKind, options = {}) => {
    const kind = unitKind(rawKind);
    const safeKind = Object.prototype.hasOwnProperty.call(METRIC_ICON_LABELS, kind) ? kind : "distance";
    return svgIconHtml({
      path: WEATHER_ICON_PATHS[`metric-${safeKind}`],
      label: String(options.label || METRIC_ICON_LABELS[safeKind]),
      dataAttribute: "data-metric-kind",
      dataValue: safeKind,
      className: String(options.className || ""),
    });
  };

  const asDailyList = (daily, limit = 7) => (Array.isArray(daily) ? daily : [])
    .filter((item) => item && typeof item === "object")
    .slice(0, Math.max(1, Number(limit) || 7));

  const precipitationOutlook = (daily, options = {}) => {
    const days = asDailyList(daily, options.days);
    const mode = normalizeUnitMode(options.mode || readPreference());
    const snowValues = days.map((day) => asFiniteNumber(day.snowfall_cm)).filter((value) => value !== null);
    const rainValues = days.map((day) => asFiniteNumber(day.rain_mm)).filter((value) => value !== null);
    if (!snowValues.length && !rainValues.length) return "Snow and rain estimates are not available yet.";
    const snow = snowValues.reduce((total, value) => total + value, 0);
    const rain = rainValues.reduce((total, value) => total + value, 0);
    const horizon = days.length === 1 ? "today" : `over the next ${days.length} days`;
    if (snow > 0 && rain > 0) {
      return `Expect ${formatSnow(snow, mode)} of snow and ${formatRain(rain, mode)} of rain ${horizon}.`;
    }
    if (snow > 0) return `Expect ${formatSnow(snow, mode)} of snow ${horizon}.`;
    if (rain > 0) return `Expect ${formatRain(rain, mode)} of rain ${horizon}.`;
    return `Little to no snow or rain is expected ${horizon}.`;
  };

  const temperatureOutlook = (day, options = {}) => {
    if (!day || typeof day !== "object") return "Temperature details are not available yet.";
    const mode = normalizeUnitMode(options.mode || readPreference());
    const high = asFiniteNumber(day.temperature_max_c);
    const low = asFiniteNumber(day.temperature_min_c);
    if (high === null && low === null) return "Temperature details are not available yet.";
    if (high === null) return `Low near ${formatTemperature(low, mode)}.`;
    if (low === null) return `High near ${formatTemperature(high, mode)}.`;
    return `High ${formatTemperature(high, mode)}, low ${formatTemperature(low, mode)}.`;
  };

  const dailyOutlook = (daily, options = {}) => {
    const days = asDailyList(daily, options.days);
    if (!days.length) return "Forecast details are not available yet.";
    const condition = conditionName(days[0].weather_code);
    const conditionSentence = condition === UNKNOWN_CONDITION.label ? "" : `${condition} today.`;
    return [
      conditionSentence,
      precipitationOutlook(days, options),
      temperatureOutlook(days[0], options),
    ].filter(Boolean).join(" ");
  };

  const syncUnitSwitches = (mode = readPreference()) => {
    if (typeof document === "undefined") return;
    const normalizedMode = normalizeUnitMode(mode);
    document.querySelectorAll("[data-field-guide-unit-toggle]").forEach((button) => {
      button.setAttribute("data-mode", normalizedMode);
      button.setAttribute("aria-pressed", normalizedMode === "imperial" ? "true" : "false");
      button.setAttribute(
        "aria-label",
        normalizedMode === "imperial" ? "Switch to metric units" : "Switch to imperial units",
      );
      button.querySelectorAll("[data-field-guide-unit-label]").forEach((label) => {
        label.textContent = normalizedMode === "imperial" ? "Imperial" : "Metric";
      });
    });
  };

  const dispatchUnitChange = (mode) => {
    if (typeof window.dispatchEvent !== "function" || typeof window.CustomEvent !== "function") return;
    // Shared page contract: listeners read the normalized mode from event.detail.mode.
    window.dispatchEvent(new window.CustomEvent("closesnow:unitschange", { detail: { mode } }));
  };

  const setPreference = (mode, storage = defaultStorage(), options = {}) => {
    const normalizedMode = normalizeUnitMode(mode);
    storageSet(storage, UNIT_STORAGE_KEY, normalizedMode);
    syncUnitSwitches(normalizedMode);
    if (options.dispatch !== false) dispatchUnitChange(normalizedMode);
    return normalizedMode;
  };

  const togglePreference = () => {
    const current = readPreference();
    return setPreference(current === "imperial" ? "metric" : "imperial");
  };

  const bindUnitPreference = () => {
    syncUnitSwitches(readPreference());
    if (typeof document === "undefined") return;
    document.addEventListener("click", (event) => {
      const toggle = event.target.closest("[data-field-guide-unit-toggle]");
      if (!toggle) return;
      event.preventDefault();
      togglePreference();
    });
  };

  window.CloseSnowFieldGuide = Object.freeze({
    copy: Object.freeze({
      conditionName,
      dailyOutlook,
      precipitationOutlook,
      temperatureOutlook,
    }),
    units: Object.freeze({
      LEGACY_STORAGE_KEYS: LEGACY_UNIT_STORAGE_KEYS,
      STORAGE_KEY: UNIT_STORAGE_KEY,
      asFiniteNumber,
      convertValue,
      formatDistance,
      formatRain,
      formatSnow,
      formatTemperature,
      formatValue,
      normalizeMode: normalizeUnitMode,
      readPreference,
      setMode: setPreference,
      setPreference,
      togglePreference,
      unitLabel,
    }),
    weather: Object.freeze({
      conditionForCode,
      conditionName,
      iconHtml,
      metricIconHtml,
    }),
  });

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", bindUnitPreference, { once: true });
    } else {
      bindUnitPreference();
    }
  }

  if (typeof window.addEventListener === "function") {
    window.addEventListener("storage", (event) => {
      if (event.key !== UNIT_STORAGE_KEY) return;
      const mode = readPreference();
      syncUnitSwitches(mode);
      dispatchUnitChange(mode);
    });
  }
}());
