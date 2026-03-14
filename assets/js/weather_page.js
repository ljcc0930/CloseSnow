const pageBootstrapRaw = window.CLOSESNOW_PAGE_BOOTSTRAP;
const pageBootstrap =
  pageBootstrapRaw && typeof pageBootstrapRaw === "object" && !Array.isArray(pageBootstrapRaw) ? pageBootstrapRaw : {};
const filterMetaRaw = window.CLOSESNOW_FILTER_META;
const filterMeta =
  filterMetaRaw && typeof filterMetaRaw === "object" && !Array.isArray(filterMetaRaw) ? filterMetaRaw : {};
const filterMetaAvailable =
  filterMeta.available_filters && typeof filterMeta.available_filters === "object"
    ? filterMeta.available_filters
    : {};
const filterMetaApplied =
  filterMeta.applied_filters && typeof filterMeta.applied_filters === "object"
    ? filterMeta.applied_filters
    : {};

const pageContentRoot = document.getElementById("page-content-root");
const reportDateEl = document.getElementById("report-date");
const resortSearchInput = document.getElementById("resort-search-input");
const resortSearchClear = document.getElementById("resort-search-clear");
const filterOpenBtn = document.getElementById("filter-open-btn");
const filterModal = document.getElementById("filter-modal");
const filterResetBtn = document.getElementById("filter-reset-btn");
const filterCloseBtn = document.getElementById("filter-close-btn");
const filterSummary = document.getElementById("filter-summary");
const filterRegionSelect = document.getElementById("filter-region-select");
const filterCountrySelect = document.getElementById("filter-country-select");
const filterSortSelect = document.getElementById("filter-sort-select");
const filterIncludeAllInput = document.getElementById("filter-include-all");
const filterSearchAllInput = document.getElementById("filter-search-all");
const favoritesOnlyToggle = document.getElementById("favorites-only-toggle");
const filterFavoritesOnlyInput = document.getElementById("filter-favorites-only");
const filterPassTypeInputs = Array.from(document.querySelectorAll("input[name='filter-pass-type']"));

const UNIT_STORAGE_KEY_PREFIX = "closesnow_unit_mode_";
const FILTER_STORAGE_KEY = "closesnow_filter_state_v1";
const FAVORITES_STORAGE_KEY = "closesnow_favorite_resorts_v1";
const VALID_UNIT_KINDS = new Set(["snow", "rain", "temp"]);
const DEFAULT_AVAILABLE_FILTERS = { pass_type: {}, region: {}, country: {} };
const MAX_DISPLAY_DAYS = 14;
const MIN_DESKTOP_SNOW_3DAY_PX = 554;
const compactDailySummary = window.CloseSnowCompactDailySummary || {};
const COMPACT_SUMMARY_UNIT_KIND = "compact_summary";
const SUN_TIME_TOGGLE_KIND = "sun_time";
const MAP_METRIC_STORAGE_KEY = "closesnow_us_snowfall_map_metric_v1";
const DEFAULT_MAP_METRIC_KEY = "today";
const VALID_MAP_METRIC_KEYS = new Set(["today", "next_72h", "week1"]);
const MAP_SELECTION_EVENT = "closesnow:map-resort-select";

const appState = {
  payload: null,
  reports: [],
  availableFilters: DEFAULT_AVAILABLE_FILTERS,
  favoriteResortIds: new Set(),
  filterState: {
    passTypes: new Set(),
    region: "",
    country: "",
    sortBy: "week_snow",
    includeDefault: true,
    searchAll: true,
    search: "",
    favoritesOnly: false,
  },
  unitModes: {
    snow: "metric",
    rain: "metric",
    temp: "metric",
  },
  compactSummaryUnitMode: "metric",
  sunTimeToggleMode: "metric",
  map: {
    activeMetricKey: DEFAULT_MAP_METRIC_KEY,
    selectedResortId: "",
    controller: null,
    controllerAvailable: false,
  },
};

const _normalizeSearch = (value) => String(value || "").trim().toLowerCase();
const _escapeHtml = (value) => String(value || "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll("\"", "&quot;")
  .replaceAll("'", "&#39;");

const _isTruthyParam = (value) => {
  const text = _normalizeSearch(value);
  return text === "1" || text === "true" || text === "yes" || text === "on";
};

const _normalizeMapMetricKey = (value) => {
  const text = _normalizeSearch(value).replaceAll("-", "_");
  if (VALID_MAP_METRIC_KEYS.has(text)) return text;
  if (text === "today_snow") return "today";
  if (text === "week_snow") return "week1";
  return DEFAULT_MAP_METRIC_KEY;
};

const _selectedMapResortId = () => String(appState.map.selectedResortId || "").trim();

const _isMapSelectedResortId = (resortId) => {
  const id = String(resortId || "").trim();
  return Boolean(id) && id === _selectedMapResortId();
};

const getStoredMapMetricKey = () => {
  try {
    return _normalizeMapMetricKey(localStorage.getItem(MAP_METRIC_STORAGE_KEY));
  } catch (error) {
    return DEFAULT_MAP_METRIC_KEY;
  }
};

const measureTextWidth = (text, font) => {
  const canvas = measureTextWidth.canvas || (measureTextWidth.canvas = document.createElement("canvas"));
  const context = canvas.getContext("2d");
  context.font = font;
  return context.measureText(text || "").width;
};

const _resolveBootstrapUrl = (rawUrl) => {
  const text = String(rawUrl || "").trim();
  if (!text) throw new Error("Missing dataUrl bootstrap.");
  if (/^[a-z][a-z0-9+.-]*:/i.test(text) || text.startsWith("//")) {
    return new URL(text, window.location.href).toString();
  }
  const pathname = window.location.pathname || "/";
  const normalizedPath = pathname.endsWith("/")
    ? pathname
    : (pathname.includes(".") ? pathname.replace(/[^/]+$/, "") : `${pathname}/`);
  return new URL(text, `${window.location.origin}${normalizedPath}`).toString();
};

const _resolvedDataUrl = () => _resolveBootstrapUrl(pageBootstrap.dataUrl);

const _isDynamicApiDataUrl = () => {
  try {
    const resolved = new URL(_resolvedDataUrl());
    return resolved.pathname.endsWith("/api/data");
  } catch (error) {
    return false;
  }
};

const _asFiniteNumber = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

const _formatMetric = (value) => {
  const num = _asFiniteNumber(value);
  return num === null ? "" : num.toFixed(1);
};

const _formatTemp = (value) => {
  const num = _asFiniteNumber(value);
  if (num === null) return "";
  if (Number.isInteger(num)) return String(num);
  return num.toFixed(1);
};

const _formatDayLabel = (dateText) => {
  const text = String(dateText || "").trim();
  if (!text) return "";
  const parts = text.split("-");
  if (parts.length !== 3) return "";
  const [year, month, day] = parts;
  const dt = new Date(`${year}-${month}-${day}T00:00:00`);
  if (Number.isNaN(dt.getTime())) return "";
  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return `${month}-${day} ${weekdays[dt.getDay()]}`;
};

const _dayLabelHtml = (label) => {
  const text = String(label || "").trim();
  if (!text) return "";
  const parts = text.split(/\s+/, 2);
  if (parts.length === 2 && parts[0].includes("-")) {
    return `<span class='day-label-date'>${_escapeHtml(parts[0])}</span><span class='day-label-weekday'>${_escapeHtml(parts[1])}</span>`;
  }
  return _escapeHtml(text);
};

const _weatherEmoji = (rawCode) => {
  const code = Number(rawCode);
  if (!Number.isFinite(code)) return "❓";
  if (code === 0) return "☀️";
  if (code === 1) return "🌤️";
  if (code === 2) return "⛅";
  if (code === 3) return "☁️";
  if (code === 45 || code === 48) return "🌫️";
  if ([51, 53, 55, 56, 57].includes(code)) return "🌦️";
  if ([61, 63, 65, 80, 81, 82].includes(code)) return "🌧️";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "❄️";
  if ([95, 96, 99].includes(code)) return "⛈️";
  return "❓";
};

const _snowColor = (value) => {
  const v = _asFiniteNumber(value);
  if (v === null) return "";
  if (v > 15) return "background:#FFE7CC;";
  const x = Math.min(Math.max(v, 0), 15) / 15;
  const r = Math.round(255 + ((207 - 255) * x));
  const g = Math.round(255 + ((232 - 255) * x));
  return `background:rgb(${r},${g},255);`;
};

const _rainColor = (value) => {
  const v = _asFiniteNumber(value);
  if (v === null) return "";
  if (v <= 0) return "background:#FFFFFF;";
  if (v >= 7.6) return "background:#CFEFD8;";
  const x = v / 7.6;
  const r = Math.round(255 + ((207 - 255) * x));
  const g = Math.round(255 + ((239 - 255) * x));
  const b = Math.round(255 + ((216 - 255) * x));
  return `background:rgb(${r},${g},${b});`;
};

const _tempColor = (value) => {
  const v = _asFiniteNumber(value);
  if (v === null) return "";
  if (v < -10) return "background:#CFE8FF;";
  if (v < 0) {
    const x = (v + 10) / 10;
    const r = Math.round(207 + ((255 - 207) * x));
    const g = Math.round(232 + ((255 - 232) * x));
    return `background:rgb(${r},${g},255);`;
  }
  if (v <= 20) {
    if (v <= 4) return "background:#FFFFFF;";
    const x = (v - 4) / 16;
    const g = Math.round(255 + ((214 - 255) * x));
    const b = Math.round(255 + ((214 - 255) * x));
    return `background:rgb(255,${g},${b});`;
  }
  return "background:#FFD6D6;";
};

const _metricCellHtml = (rawValue, kind, style = "", klass = "") => {
  const value = String(rawValue || "").trim();
  const klassAttr = klass ? ` class='${klass}'` : "";
  const styleAttr = style ? ` style='${style}'` : "";
  const numeric = _asFiniteNumber(value);
  if (numeric === null) {
    return `<td${klassAttr}${styleAttr}>${_escapeHtml(value)}</td>`;
  }
  return `<td${klassAttr}${styleAttr} data-kind='${kind}' data-metric-value='${numeric.toFixed(6)}'>${_escapeHtml(value)}</td>`;
};

const _filterAttrs = (report) => {
  const resortId = String(report.resort_id || "").trim();
  const passTypes = Array.isArray(report.pass_types) ? report.pass_types.join(",").toLowerCase() : "";
  const region = String(report.region || "").trim().toLowerCase();
  const country = String(report.country_code || report.country || "").trim().toUpperCase();
  const state = String(report.admin1 || "").trim().toUpperCase();
  const defaultResort = report.default_resort || report.ljcc_favorite ? "1" : "";
  const mapSelected = _isMapSelectedResortId(resortId) ? "1" : "0";
  return ` data-resort-id='${_escapeHtml(resortId)}' data-pass-types='${_escapeHtml(passTypes)}' data-region='${_escapeHtml(region)}' data-country='${_escapeHtml(country)}' data-state='${_escapeHtml(state)}' data-default-resort='${_escapeHtml(defaultResort)}' data-map-selected='${mapSelected}'`;
};

const _isFavoriteResortId = (resortId) => appState.favoriteResortIds.has(String(resortId || "").trim());

const _favoriteButtonHtml = (report) => {
  const resortId = String(report.resort_id || "").trim();
  if (!resortId) return "";
  const active = _isFavoriteResortId(resortId);
  const label = active ? "Remove resort from favorites" : "Add resort to favorites";
  return `<button type='button' class='favorite-btn' data-resort-id='${_escapeHtml(resortId)}' data-favorite-active='${active ? "1" : "0"}' aria-pressed='${active ? "true" : "false"}' aria-label='${label}'><svg class='favorite-btn-icon favorite-btn-outline' aria-hidden='true' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'><path d='M12 21s-6.9-4.35-9.2-8.45C.9 9.18 2.03 5.5 5.58 4.6c2.12-.54 4.4.24 5.82 1.98 1.42-1.74 3.7-2.52 5.82-1.98 3.55.9 4.68 4.58 2.78 7.95C18.9 16.65 12 21 12 21Z'/></svg><svg class='favorite-btn-icon favorite-btn-filled' aria-hidden='true' viewBox='0 0 24 24' fill='currentColor'><path d='M12 21s-6.9-4.35-9.2-8.45C.9 9.18 2.03 5.5 5.58 4.6c2.12-.54 4.4.24 5.82 1.98 1.42-1.74 3.7-2.52 5.82-1.98 3.55.9 4.68 4.58 2.78 7.95C18.9 16.65 12 21 12 21Z'/></svg></button>`;
};

const _favoriteAllButtonHtml = (reports) => {
  const visibleIds = Array.from(new Set((reports || []).map((report) => String(report?.resort_id || "").trim()).filter(Boolean)));
  if (!visibleIds.length) return "";
  const allFavorited = visibleIds.every((resortId) => _isFavoriteResortId(resortId));
  const label = allFavorited ? "Remove all visible resorts from favorites" : "Favorite all visible resorts";
  return `<button type='button' class='favorite-btn favorite-all-btn' data-favorite-all='1' data-favorite-active='${allFavorited ? "1" : "0"}' aria-pressed='${allFavorited ? "true" : "false"}' aria-label='${label}'><svg class='favorite-btn-icon favorite-btn-outline' aria-hidden='true' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'><path d='M12 21s-6.9-4.35-9.2-8.45C.9 9.18 2.03 5.5 5.58 4.6c2.12-.54 4.4.24 5.82 1.98 1.42-1.74 3.7-2.52 5.82-1.98 3.55.9 4.68 4.58 2.78 7.95C18.9 16.65 12 21 12 21Z'/></svg><svg class='favorite-btn-icon favorite-btn-filled' aria-hidden='true' viewBox='0 0 24 24' fill='currentColor'><path d='M12 21s-6.9-4.35-9.2-8.45C.9 9.18 2.03 5.5 5.58 4.6c2.12-.54 4.4.24 5.82 1.98 1.42-1.74 3.7-2.52 5.82-1.98 3.55.9 4.68 4.58 2.78 7.95C18.9 16.65 12 21 12 21Z'/></svg></button>`;
};

const _displayName = (report) => String(report?.display_name || report?.query || "").trim();

const _resortCellHtml = (report) => {
  const text = _escapeHtml(_displayName(report));
  const resortId = String(report.resort_id || "").trim();
  const selected = _isMapSelectedResortId(resortId);
  const selectedAttr = selected ? " data-map-selected='1'" : " data-map-selected='0'";
  const cellClass = selected ? "resort-cell is-map-selected" : "resort-cell";
  const linkClass = selected ? "resort-link is-map-selected" : "resort-link";
  const linkHtml = resortId
    ? `<a class='${linkClass}' data-resort-id='${_escapeHtml(resortId)}'${selectedAttr} href='resort/${encodeURIComponent(resortId)}'>${text}</a>`
    : text;
  const cellDataAttr = resortId ? ` data-resort-id='${_escapeHtml(resortId)}'` : "";
  return `<td class='favorite-col'>${_favoriteButtonHtml(report)}</td><td class='query-col'><div class='${cellClass}'${cellDataAttr}${selectedAttr}><div class='resort-link-wrap'>${linkHtml}</div></div></td>`;
};

const _displayDays = () => {
  const raw = appState.payload && Number(appState.payload.forecast_days);
  if (Number.isFinite(raw) && raw > 0) return Math.max(0, Math.min(MAX_DISPLAY_DAYS, raw - 1));
  return MAX_DISPLAY_DAYS;
};

const _dailyAt = (report, index) => {
  const daily = Array.isArray(report.daily) ? report.daily : [];
  return daily[index] && typeof daily[index] === "object" ? daily[index] : {};
};

const _dayLabelFor = (report, index) => {
  if (index === 0) return "Today";
  const label = _formatDayLabel(_dailyAt(report, index).date);
  if (label) return label;
  return `day ${index + 1}`;
};

const _fallbackDayLabels = (count) => Array.from({ length: count }, (_, idx) => (idx === 0 ? "Today" : `day ${idx + 1}`));

const _emptyStateRow = (colspan, message) => `<tr><td class="empty-state-cell" colspan="${colspan}">${_escapeHtml(message)}</td></tr>`;

const _renderUsSnowfallMapSection = () => {
  const activeMetricKey = _normalizeMapMetricKey(appState.map.activeMetricKey);
  const todayActive = activeMetricKey === "today";
  const next72hActive = activeMetricKey === "next_72h";
  const weekActive = activeMetricKey === "week1";
  return `
  <section id="us-snowfall-map-section" class="us-snowfall-map-section" aria-labelledby="us-snowfall-map-title" data-map-shell="1">
    <div class="section-header us-snowfall-map-header">
      <div class="us-snowfall-map-heading-wrap">
        <h2 id="us-snowfall-map-title">US Snowfall Map</h2>
        <p class="us-snowfall-map-subtitle">Scan nationwide snowfall concentration, then open the same resort records and hourly pages from one map surface.</p>
      </div>
      <div id="us-snowfall-map-metric-toggle" class="unit-toggle us-snowfall-map-metric-toggle" role="group" aria-label="Snowfall map metric" data-map-metric-toggle="1" data-mode="${activeMetricKey}">
        <button type="button" class="unit-btn${todayActive ? " is-active" : ""}" data-map-metric-key="today" aria-pressed="${todayActive ? "true" : "false"}">24h</button>
        <button type="button" class="unit-btn${next72hActive ? " is-active" : ""}" data-map-metric-key="next_72h" aria-pressed="${next72hActive ? "true" : "false"}">72h</button>
        <button type="button" class="unit-btn${weekActive ? " is-active" : ""}" data-map-metric-key="week1" aria-pressed="${weekActive ? "true" : "false"}">7d</button>
      </div>
    </div>
    <div class="us-snowfall-map-shell">
      <div id="us-snowfall-map-root" class="us-snowfall-map-root" role="region" aria-label="US snowfall map">
        <div class="us-snowfall-map-placeholder">
          <span class="us-snowfall-map-placeholder-kicker">Nationwide resort snowfall</span>
          <strong>Track 24h, 72h, and 7-day snow from one map.</strong>
          <span>Interactive markers, panning, and hourly drill-ins load with the page script while the forecast tables stay available below.</span>
        </div>
      </div>
      <div class="us-snowfall-map-meta">
        <div class="us-snowfall-map-panel us-snowfall-map-panel-status">
          <span class="us-snowfall-map-panel-label">Map status</span>
          <div id="us-snowfall-map-status" class="us-snowfall-map-status" role="status">
            <strong>Preparing nationwide resort snowfall coverage.</strong>
            <span>Switch metrics, pan the map, and open a marker to continue into the matching hourly page.</span>
          </div>
        </div>
        <div id="us-snowfall-map-legend" class="us-snowfall-map-legend" aria-label="Snowfall legend">
          <div class="us-snowfall-map-panel-heading">
            <span class="us-snowfall-map-panel-label">Intensity guide</span>
            <p class="us-snowfall-map-panel-copy">Marker fill reflects the active snowfall range while the rest of the forecast stays available below.</p>
          </div>
          <div class="us-snowfall-map-legend-scale">
            <span class="us-snowfall-map-legend-chip" data-map-legend-stop="low">0-5 cm</span>
            <span class="us-snowfall-map-legend-chip" data-map-legend-stop="mid">5-15 cm</span>
            <span class="us-snowfall-map-legend-chip" data-map-legend-stop="high">15+ cm</span>
          </div>
        </div>
      </div>
    </div>
  </section>`;
};

const _renderCompactGridSection = (reports, emptyMessage = "No resorts match the current filters.") => {
  const displayDays = _displayDays();
  const labels = reports.length
    ? Array.from({ length: displayDays }, (_, idx) => compactDailySummary.dayLabelFor(_dailyAt(reports[0], idx), idx))
    : _fallbackDayLabels(displayDays);
  const leftRows = reports.length
    ? reports.map((report) => `<tr${_filterAttrs(report)}>${_resortCellHtml(report)}</tr>`).join("")
    : _emptyStateRow(2, emptyMessage);
  const rightRows = reports.length ? reports.map((report) => {
    const attrs = _filterAttrs(report);
    const cells = Array.from({ length: displayDays }, (_, idx) => {
      const day = _dailyAt(report, idx);
      const style = compactDailySummary.dayStyle(day);
      const styleAttr = style ? ` style='${style}'` : "";
      return `<td class='compact-day-cell'${styleAttr}>${compactDailySummary.dayCellHtml(day, { unitMode: appState.compactSummaryUnitMode })}</td>`;
    }).join("");
    return `<tr${attrs}>${cells}</tr>`;
  }).join("") : _emptyStateRow(Math.max(1, displayDays), emptyMessage);
  return `
    <section>
      <div class="section-header">
        <h2>Daily Summary</h2>
        <div class="unit-toggle" role="group" aria-label="Daily Summary unit system" data-compact-summary-toggle="1" data-mode="${appState.compactSummaryUnitMode}">
          <button type="button" class="unit-btn" data-unit-mode="metric">Metric</button>
          <button type="button" class="unit-btn" data-unit-mode="imperial">Imperial</button>
        </div>
      </div>
      <div class="compact-grid-wrap">
        <div class="compact-grid-left-wrap" id="compact-grid-left-wrap">
          <table class="compact-grid-left-table" id="compact-grid-left-table">
            <colgroup><col class='col-favorite'><col class='col-query'></colgroup>
            <thead><tr><th rowspan='2' class='favorite-col favorite-head'>${_favoriteAllButtonHtml(reports)}</th><th rowspan='2' class='query-col'>Resort</th></tr><tr></tr></thead>
            <tbody>${leftRows}</tbody>
          </table>
        </div>
        <div class="compact-grid-right-wrap" id="compact-grid-right-wrap">
          <table class="compact-grid-right-table" id="compact-grid-right-table">
            <colgroup>${Array.from({ length: displayDays }, () => "<col class='col-compact-day'>").join("")}</colgroup>
            <thead><tr>${labels.map((label) => `<th>${_dayLabelHtml(label)}</th>`).join("")}</tr></thead>
            <tbody>${rightRows}</tbody>
          </table>
        </div>
      </div>
    </section>`;
};

const _renderPrecipSection = (title, kind, metricUnit, imperialUnit, reports, options, emptyMessage = "No resorts match the current filters.") => {
  const displayDays = _displayDays();
  const dayLabels = reports.length
    ? Array.from({ length: displayDays }, (_, idx) => _dayLabelFor(reports[0], idx))
    : _fallbackDayLabels(displayDays);
  const weeklyHeaders = ["week 1", "week 2"];
  const desktopLeftRows = reports.length ? reports.map((report) => {
    const attrs = _filterAttrs(report);
    const weeklyValues = [
      options.week1(report),
      options.week2(report),
    ].map((value) => _metricCellHtml(_formatMetric(value), kind, options.color(value)));
    return `<tr${attrs}>${_resortCellHtml(report)}${weeklyValues.join("")}</tr>`;
  }).join("") : _emptyStateRow(4, emptyMessage);
  const desktopRightRows = reports.length ? reports.map((report) => {
    const attrs = _filterAttrs(report);
    const dailyValues = Array.from({ length: displayDays }, (_, idx) => {
      const value = options.daily(_dailyAt(report, idx));
      return _metricCellHtml(_formatMetric(value), kind, options.color(value));
    }).join("");
    return `<tr${attrs}>${dailyValues}</tr>`;
  }).join("") : _emptyStateRow(Math.max(1, displayDays), emptyMessage);
  const mobileLeftRows = reports.length ? reports.map((report) => `<tr${_filterAttrs(report)}>${_resortCellHtml(report)}</tr>`).join("") : _emptyStateRow(2, emptyMessage);
  const mobileRightRows = reports.length ? reports.map((report) => {
    const attrs = _filterAttrs(report);
    const weeklyValues = [
      options.week1(report),
      options.week2(report),
    ].map((value) => _metricCellHtml(_formatMetric(value), kind, options.color(value), "week-col-cell"));
    const dailyValues = Array.from({ length: displayDays }, (_, idx) => {
      const value = options.daily(_dailyAt(report, idx));
      return _metricCellHtml(_formatMetric(value), kind, options.color(value));
    });
    return `<tr${attrs}>${weeklyValues.join("")}${dailyValues.join("")}</tr>`;
  }).join("") : _emptyStateRow(2 + Math.max(1, displayDays), emptyMessage);
  return `
    <section>
      <div class="section-header">
        <h2>${title}</h2>
        <div class="unit-toggle" role="group" aria-label="${title} unit system" data-target-kind="${kind}">
          <button type="button" class="unit-btn" data-unit-mode="metric">${metricUnit}</button>
          <button type="button" class="unit-btn" data-unit-mode="imperial">${imperialUnit}</button>
        </div>
      </div>
      <div class="${options.prefix}-split-wrap desktop-only">
        <div class="${options.prefix}-left-wrap" id="${options.prefix}-left-wrap">
          <table class="${options.prefix}-left-table">
            <colgroup><col class='col-favorite'><col class='col-query'><col class='col-week'><col class='col-week'></colgroup>
            <thead><tr><th rowspan='2' class='favorite-col favorite-head'>${_favoriteAllButtonHtml(reports)}</th><th rowspan='2' class='query-col'>Resort</th><th colspan='2'>Weekly</th></tr><tr><th>${weeklyHeaders[0]}</th><th>${weeklyHeaders[1]}</th></tr></thead>
            <tbody>${desktopLeftRows}</tbody>
          </table>
        </div>
        <div class="${options.prefix}-right-wrap" id="${options.prefix}-right-wrap">
          <table class="${options.prefix}-right-table">
            <colgroup>${Array.from({ length: displayDays }, () => "<col class='col-day'>").join("")}</colgroup>
            <thead><tr><th colspan='${displayDays}'>Daily</th></tr><tr>${dayLabels.map((label) => `<th>${_dayLabelHtml(label)}</th>`).join("")}</tr></thead>
            <tbody>${desktopRightRows}</tbody>
          </table>
        </div>
      </div>
      <div class="${options.prefix}-split-wrap mobile-only">
        <div class="${options.prefix}-left-wrap" id="${options.prefix}-left-wrap-mobile">
          <table class="${options.prefix}-left-table">
            <colgroup><col class='col-favorite'><col class='col-query'></colgroup>
            <thead><tr><th rowspan='2' class='favorite-col favorite-head'>${_favoriteAllButtonHtml(reports)}</th><th rowspan='2' class='query-col'>Resort</th></tr><tr></tr></thead>
            <tbody>${mobileLeftRows}</tbody>
          </table>
        </div>
        <div class="${options.prefix}-right-wrap" id="${options.prefix}-right-wrap-mobile">
          <table class="${options.prefix}-right-table">
            <colgroup><col class='col-week-right'><col class='col-week-right'>${Array.from({ length: displayDays }, () => "<col class='col-day'>").join("")}</colgroup>
            <thead><tr><th class='week-group' colspan='2'>Weekly</th><th colspan='${displayDays}'>Daily</th></tr><tr><th class='week-col-cell'>Week 1</th><th class='week-col-cell'>Week 2</th>${dayLabels.map((label) => `<th>${_dayLabelHtml(label)}</th>`).join("")}</tr></thead>
            <tbody>${mobileRightRows}</tbody>
          </table>
        </div>
      </div>
    </section>`;
};

const _renderTemperatureSection = (reports, emptyMessage = "No resorts match the current filters.") => {
  const displayDays = _displayDays();
  const labels = reports.length
    ? Array.from({ length: displayDays }, (_, idx) => _dayLabelFor(reports[0], idx))
    : _fallbackDayLabels(displayDays);
  const leftRows = reports.length ? reports.map((report) => `<tr${_filterAttrs(report)}>${_resortCellHtml(report)}</tr>`).join("") : _emptyStateRow(2, emptyMessage);
  const rightRows = reports.length ? reports.map((report) => {
    const attrs = _filterAttrs(report);
    const cells = Array.from({ length: displayDays }, (_, idx) => {
      const day = _dailyAt(report, idx);
      return [
        _metricCellHtml(_formatTemp(day.temperature_min_c), "temp", _tempColor(day.temperature_min_c)),
        _metricCellHtml(_formatTemp(day.temperature_max_c), "temp", _tempColor(day.temperature_max_c)),
      ].join("");
    }).join("");
    return `<tr${attrs}>${cells}</tr>`;
  }).join("") : _emptyStateRow(Math.max(1, displayDays * 2), emptyMessage);
  return `
    <section>
      <div class="section-header">
        <h2>Temperature</h2>
        <div class="unit-toggle" role="group" aria-label="Temperature unit system" data-target-kind="temp">
          <button type="button" class="unit-btn" data-unit-mode="metric">°C</button>
          <button type="button" class="unit-btn" data-unit-mode="imperial">°F</button>
        </div>
      </div>
      <div class="temperature-split-wrap">
        <div class="temperature-left-wrap" id="temperature-left-wrap">
          <table class="temperature-left-table" id="temperature-left-table">
            <colgroup><col class="col-favorite"><col class="col-query"></colgroup>
            <thead><tr><th rowspan='2' class='favorite-col favorite-head'>${_favoriteAllButtonHtml(reports)}</th><th rowspan='2' class='query-col'>Resort</th></tr><tr></tr></thead>
            <tbody>${leftRows}</tbody>
          </table>
        </div>
        <div class="temperature-right-wrap" id="temperature-right-wrap">
          <table class="temperature-right-table" id="temperature-right-table">
            <colgroup>${Array.from({ length: displayDays * 2 }, () => "<col class='col-temp'>").join("")}</colgroup>
            <thead><tr>${labels.map((label) => `<th colspan='2'>${_dayLabelHtml(label)}</th>`).join("")}</tr><tr>${Array.from({ length: displayDays }, () => "<th>min</th><th>max</th>").join("")}</tr></thead>
            <tbody>${rightRows}</tbody>
          </table>
        </div>
      </div>
    </section>`;
};

const _renderWeatherSection = (reports, emptyMessage = "No resorts match the current filters.") => {
  const displayDays = _displayDays();
  const labels = reports.length
    ? Array.from({ length: displayDays }, (_, idx) => _dayLabelFor(reports[0], idx))
    : _fallbackDayLabels(displayDays);
  const leftRows = reports.length ? reports.map((report) => `<tr${_filterAttrs(report)}>${_resortCellHtml(report)}</tr>`).join("") : _emptyStateRow(2, emptyMessage);
  const rightRows = reports.length ? reports.map((report) => {
    const attrs = _filterAttrs(report);
    const cells = Array.from({ length: displayDays }, (_, idx) => {
      const code = _dailyAt(report, idx).weather_code;
      const title = code === null || code === undefined || code === "" ? "WMO code: unknown" : `WMO code: ${code}`;
      return `<td class='weather-emoji-cell' title='${_escapeHtml(title)}'>${_weatherEmoji(code)}</td>`;
    }).join("");
    return `<tr${attrs}>${cells}</tr>`;
  }).join("") : _emptyStateRow(Math.max(1, displayDays), emptyMessage);
  return `
    <section>
      <h2>Weather</h2>
      <div class='weather-split-wrap'>
        <div class='weather-left-wrap' id='weather-left-wrap'>
          <table class='weather-left-table' id='weather-left-table'>
            <colgroup><col class='col-favorite'><col class='col-query'></colgroup>
            <thead><tr><th rowspan='2' class='favorite-col favorite-head'>${_favoriteAllButtonHtml(reports)}</th><th rowspan='2' class='query-col'>Resort</th></tr><tr></tr></thead>
            <tbody>${leftRows}</tbody>
          </table>
        </div>
        <div class='weather-right-wrap' id='weather-right-wrap'>
          <table class='weather-right-table' id='weather-right-table'>
            <colgroup>${Array.from({ length: displayDays }, () => "<col class='col-weather'>").join("")}</colgroup>
            <thead><tr>${labels.map((label) => `<th>${_dayLabelHtml(label)}</th>`).join("")}</tr></thead>
            <tbody>${rightRows}</tbody>
          </table>
        </div>
      </div>
    </section>`;
};

const _renderSunSection = (reports, emptyMessage = "No resorts match the current filters.") => {
  const displayDays = _displayDays();
  const labels = reports.length
    ? Array.from({ length: displayDays }, (_, idx) => _dayLabelFor(reports[0], idx))
    : _fallbackDayLabels(displayDays);
  const hhmm = (raw, mode = "metric") => {
    const text = String(raw || "").trim();
    if (!text) return "";
    const value = text.includes("T") ? text.split("T", 2)[1].slice(0, 5) : text.slice(0, 5);
    if (mode !== "imperial") return value;
    const match = /^(\d{2}):(\d{2})$/.exec(value);
    if (!match) return value;
    const hour24 = Number(match[1]);
    if (!Number.isFinite(hour24)) return value;
    const minute = match[2];
    const suffix = hour24 >= 12 ? "PM" : "AM";
    const hour12 = hour24 % 12 || 12;
    return `${hour12}:${minute} ${suffix}`;
  };
  const leftRows = reports.length ? reports.map((report) => `<tr${_filterAttrs(report)}>${_resortCellHtml(report)}</tr>`).join("") : _emptyStateRow(2, emptyMessage);
  const rightRows = reports.length ? reports.map((report) => {
    const attrs = _filterAttrs(report);
    const cells = Array.from({ length: displayDays }, (_, idx) => {
      const day = _dailyAt(report, idx);
      const sunriseRaw = hhmm(day.sunrise_local_hhmm || day.sunrise_iso);
      const sunsetRaw = hhmm(day.sunset_local_hhmm || day.sunset_iso);
      const sunrise = hhmm(sunriseRaw, appState.sunTimeToggleMode);
      const sunset = hhmm(sunsetRaw, appState.sunTimeToggleMode);
      return `<td data-sun-time-raw="${_escapeHtml(sunriseRaw)}">${_escapeHtml(sunrise)}</td><td data-sun-time-raw="${_escapeHtml(sunsetRaw)}">${_escapeHtml(sunset)}</td>`;
    }).join("");
    return `<tr${attrs}>${cells}</tr>`;
  }).join("") : _emptyStateRow(Math.max(1, displayDays * 2), emptyMessage);
  return `
    <section>
      <div class="section-header">
        <h2>Sunrise / Sunset</h2>
        <div class="unit-toggle" role="group" aria-label="Sunrise and sunset time format" data-sun-time-toggle="1" data-mode="${appState.sunTimeToggleMode}">
          <button type="button" class="unit-btn" data-unit-mode="metric">24h</button>
          <button type="button" class="unit-btn" data-unit-mode="imperial">12h</button>
        </div>
      </div>
      <div class="sun-split-wrap">
        <div class="sun-left-wrap" id="sun-left-wrap">
          <table class="sun-left-table" id="sun-left-table">
            <colgroup><col class="col-favorite"><col class="col-query"></colgroup>
            <thead><tr><th rowspan='2' class='favorite-col favorite-head'>${_favoriteAllButtonHtml(reports)}</th><th rowspan='2' class='query-col'>Resort</th></tr><tr></tr></thead>
            <tbody>${leftRows}</tbody>
          </table>
        </div>
        <div class="sun-right-wrap" id="sun-right-wrap">
          <table class="sun-right-table" id="sun-right-table">
            <colgroup>${Array.from({ length: displayDays * 2 }, () => "<col class='col-sun'>").join("")}</colgroup>
            <thead><tr>${labels.map((label) => `<th colspan='2'>${_dayLabelHtml(label)}</th>`).join("")}</tr><tr>${Array.from({ length: displayDays }, () => "<th>sunrise</th><th>sunset</th>").join("")}</tr></thead>
            <tbody>${rightRows}</tbody>
          </table>
        </div>
      </div>
    </section>`;
};

const _renderSections = (reports, emptyMessage = "No resorts match the current filters.") => [
  _renderUsSnowfallMapSection(),
  _renderCompactGridSection(reports, emptyMessage),
  _renderPrecipSection("Snowfall", "snow", "cm", "in", reports, {
    prefix: "snowfall",
    week1: (report) => report.week1_total_snowfall_cm,
    week2: (report) => report.week2_total_snowfall_cm,
    daily: (day) => day.snowfall_cm,
    color: _snowColor,
  }, emptyMessage),
  _renderPrecipSection("Rainfall", "rain", "mm", "in", reports, {
    prefix: "rain",
    week1: (report) => report.week1_total_rain_mm,
    week2: (report) => report.week2_total_rain_mm,
    daily: (day) => day.rain_mm,
    color: _rainColor,
  }, emptyMessage),
  _renderTemperatureSection(reports, emptyMessage),
  _renderWeatherSection(reports, emptyMessage),
  _renderSunSection(reports, emptyMessage),
].join("");

const _payloadReports = () => {
  const reports = appState.payload && Array.isArray(appState.payload.reports) ? appState.payload.reports : [];
  return reports.filter((report) => report && typeof report === "object");
};

const _deriveAvailableFiltersFromReports = (reports) => {
  const out = { pass_type: {}, region: {}, country: {} };
  reports.forEach((report) => {
    const region = _normalizeSearch(report.region);
    if (region) out.region[region] = (out.region[region] || 0) + 1;
    const country = String(report.country_code || report.country || "").trim().toUpperCase();
    if (country) out.country[country] = (out.country[country] || 0) + 1;
    const passTypes = Array.isArray(report.pass_types) ? report.pass_types : [];
    passTypes.forEach((passType) => {
      const key = _normalizeSearch(passType);
      if (key) out.pass_type[key] = (out.pass_type[key] || 0) + 1;
    });
  });
  return out;
};

const _availableFilters = () => {
  const meta = filterMetaAvailable;
  if (meta && typeof meta === "object" && Object.keys(meta).length > 0) {
    return {
      pass_type: meta.pass_type && typeof meta.pass_type === "object" ? meta.pass_type : {},
      region: meta.region && typeof meta.region === "object" ? meta.region : {},
      country: meta.country && typeof meta.country === "object" ? meta.country : {},
    };
  }
  return _deriveAvailableFiltersFromReports(_payloadReports());
};

const parsePassTypeValues = (values) => {
  const out = [];
  values.forEach((raw) => {
    String(raw || "").split(",").map((value) => _normalizeSearch(value)).filter(Boolean).forEach((value) => out.push(value));
  });
  return Array.from(new Set(out));
};

const normalizeSortBy = (value) => {
  const text = _normalizeSearch(value);
  if (text === "name") return "name";
  if (text === "favorites") return "favorites";
  if (text === "today_snow") return "today_snow";
  if (text === "week_snow") return "week_snow";
  return "state";
};

const _dailySnowfall = (report, index = 0) => _asFiniteNumber(_dailyAt(report, index).snowfall_cm);
const _weeklySnowfall = (report) => _asFiniteNumber(report && report.week1_total_snowfall_cm);

const _compareBySnowDesc = (a, b, valueFn) => {
  const aValue = valueFn(a);
  const bValue = valueFn(b);
  const aSortable = aValue === null ? Number.NEGATIVE_INFINITY : aValue;
  const bSortable = bValue === null ? Number.NEGATIVE_INFINITY : bValue;
  return bSortable - aSortable;
};

const loadFavoriteResortIds = () => {
  try {
    const raw = localStorage.getItem(FAVORITES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return Array.from(new Set(parsed.map((value) => String(value || "").trim()).filter(Boolean)));
  } catch (error) {
    return [];
  }
};

const persistFavoriteResortIds = () => {
  try {
    localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(Array.from(appState.favoriteResortIds).sort()));
  } catch (error) {
    // Ignore storage failures.
  }
};

const toggleFavoriteResortId = (resortId) => {
  const id = String(resortId || "").trim();
  if (!id) return;
  if (appState.favoriteResortIds.has(id)) {
    appState.favoriteResortIds.delete(id);
  } else {
    appState.favoriteResortIds.add(id);
  }
  persistFavoriteResortIds();
};

const toggleFavoriteVisibleReports = (reports) => {
  const visibleIds = Array.from(new Set((reports || []).map((report) => String(report?.resort_id || "").trim()).filter(Boolean)));
  if (!visibleIds.length) return;
  const allFavorited = visibleIds.every((resortId) => appState.favoriteResortIds.has(resortId));
  visibleIds.forEach((resortId) => {
    if (allFavorited) {
      appState.favoriteResortIds.delete(resortId);
    } else {
      appState.favoriteResortIds.add(resortId);
    }
  });
  persistFavoriteResortIds();
};

const _favoriteButtonLabel = (active) => (active ? "Remove resort from favorites" : "Add resort to favorites");

const _favoriteAllButtonLabel = (active) => (
  active ? "Remove all visible resorts from favorites" : "Favorite all visible resorts"
);

const _syncFavoriteButtonState = (button, active) => {
  if (!button) return;
  button.setAttribute("data-favorite-active", active ? "1" : "0");
  button.setAttribute("aria-pressed", active ? "true" : "false");
  button.setAttribute("aria-label", _favoriteButtonLabel(active));
};

const _syncFavoriteAllButtonState = (button, active) => {
  if (!button) return;
  button.setAttribute("data-favorite-active", active ? "1" : "0");
  button.setAttribute("aria-pressed", active ? "true" : "false");
  button.setAttribute("aria-label", _favoriteAllButtonLabel(active));
};

const syncFavoriteButtons = () => {
  document.querySelectorAll(".favorite-btn[data-resort-id]").forEach((button) => {
    const resortId = String(button.getAttribute("data-resort-id") || "").trim();
    _syncFavoriteButtonState(button, _isFavoriteResortId(resortId));
  });
};

const syncFavoriteAllButtons = (reports) => {
  const visibleIds = Array.from(new Set((reports || []).map((report) => String(report?.resort_id || "").trim()).filter(Boolean)));
  const allFavorited = visibleIds.length > 0 && visibleIds.every((resortId) => _isFavoriteResortId(resortId));
  document.querySelectorAll(".favorite-all-btn[data-favorite-all='1']").forEach((button) => {
    _syncFavoriteAllButtonState(button, allFavorited);
  });
};

const syncFavoriteUiInPlace = (reports) => {
  syncFavoriteButtons();
  syncFavoriteAllButtons(reports);
};

const favoriteInteractionNeedsFullRender = () => (
  appState.filterState.favoritesOnly || appState.filterState.sortBy === "favorites"
);

const setFavoritesOnlyControls = (checked) => {
  const value = Boolean(checked);
  if (favoritesOnlyToggle) favoritesOnlyToggle.checked = value;
  if (filterFavoritesOnlyInput) filterFavoritesOnlyInput.checked = value;
};

const loadStoredFilterState = () => {
  try {
    const raw = localStorage.getItem(FILTER_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return {
      passTypes: parsePassTypeValues(Array.isArray(parsed.passTypes) ? parsed.passTypes : []),
      region: _normalizeSearch(parsed.region || ""),
      country: String(parsed.country || "").trim().toUpperCase(),
      sortBy: normalizeSortBy(parsed.sortBy || ""),
      includeDefault: parsed.includeDefault !== false,
      searchAll: parsed.searchAll !== false,
      search: String(parsed.search || ""),
      favoritesOnly: Boolean(parsed.favoritesOnly),
    };
  } catch (error) {
    return null;
  }
};

const persistFilterState = () => {
  try {
    localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify({
      passTypes: Array.from(appState.filterState.passTypes).sort(),
      region: appState.filterState.region,
      country: appState.filterState.country,
      sortBy: appState.filterState.sortBy,
      includeDefault: appState.filterState.includeDefault,
      searchAll: appState.filterState.searchAll,
      search: appState.filterState.search,
      favoritesOnly: appState.filterState.favoritesOnly,
    }));
  } catch (error) {
    // Ignore storage failures.
  }
};

const applyControlsFromQueryOrMeta = () => {
  const params = new URLSearchParams(window.location.search);
  const urlPassTypes = parsePassTypeValues(params.getAll("pass_type"));
  const urlRegion = _normalizeSearch(params.get("region") || "");
  const urlCountry = (params.get("country") || "").trim().toUpperCase();
  const hasUrlSortBy = params.has("sort_by");
  const urlSortBy = normalizeSortBy(params.get("sort_by") || "");
  const urlSearch = params.get("search");
  const hasUrlIncludeDefault = params.has("include_default");
  const urlIncludeDefault = _isTruthyParam(params.get("include_default") || "");
  const hasUrlSearchAll = params.has("search_all");
  const urlSearchAll = _isTruthyParam(params.get("search_all") || "");
  const hasUrlIncludeAll = params.has("include_all");
  const urlIncludeAll = _isTruthyParam(params.get("include_all") || "");

  const metaPassTypes = parsePassTypeValues(Array.isArray(filterMetaApplied.pass_type) ? filterMetaApplied.pass_type : []);
  const metaRegion = _normalizeSearch(filterMetaApplied.region || "");
  const metaCountry = String(filterMetaApplied.country || "").trim().toUpperCase();
  const metaSortBy = normalizeSortBy(filterMetaApplied.sort_by || "");
  const metaSearch = String(filterMetaApplied.search || "");
  const hasMetaSearchAll = Object.prototype.hasOwnProperty.call(filterMetaApplied, "search_all");
  const metaSearchAll = Boolean(filterMetaApplied.search_all);
  const hasMetaIncludeDefault = Object.prototype.hasOwnProperty.call(filterMetaApplied, "include_default");
  const metaIncludeDefault = Boolean(filterMetaApplied.include_default);
  const metaIncludeAll = Boolean(filterMetaApplied.include_all);
  const stored = loadStoredFilterState();

  const passTypes = urlPassTypes.length > 0 ? urlPassTypes : (stored ? stored.passTypes : metaPassTypes);
  const region = urlRegion || (stored ? stored.region : metaRegion);
  const country = urlCountry || (stored ? stored.country : metaCountry);
  const sortBy = hasUrlSortBy ? urlSortBy : (stored ? stored.sortBy : metaSortBy);
  const search = urlSearch !== null ? urlSearch : (stored ? stored.search : metaSearch);
  const searchAll = hasUrlSearchAll ? urlSearchAll : (stored ? stored.searchAll : (hasMetaSearchAll ? metaSearchAll : true));
  const includeDefault = hasUrlIncludeDefault
    ? urlIncludeDefault
    : (hasUrlIncludeAll ? !urlIncludeAll : (stored ? stored.includeDefault : (hasMetaIncludeDefault ? metaIncludeDefault : !metaIncludeAll)));
  const favoritesOnly = stored ? stored.favoritesOnly : false;

  appState.filterState.passTypes = new Set(passTypes);
  appState.filterState.region = region;
  appState.filterState.country = country;
  appState.filterState.sortBy = sortBy;
  appState.filterState.includeDefault = includeDefault;
  appState.filterState.searchAll = searchAll;
  appState.filterState.search = String(search || "");
  appState.filterState.favoritesOnly = favoritesOnly;

  filterPassTypeInputs.forEach((input) => {
    input.checked = appState.filterState.passTypes.has(_normalizeSearch(input.value));
  });
  if (filterRegionSelect) filterRegionSelect.value = region;
  if (filterCountrySelect) filterCountrySelect.value = country;
  if (filterSortSelect) filterSortSelect.value = sortBy;
  if (filterIncludeAllInput) filterIncludeAllInput.checked = includeDefault;
  if (filterSearchAllInput) filterSearchAllInput.checked = searchAll;
  setFavoritesOnlyControls(favoritesOnly);
  if (resortSearchInput) resortSearchInput.value = appState.filterState.search;
};

const applyFilterStateFromControls = () => {
  appState.filterState.passTypes = new Set(
    filterPassTypeInputs.map((input) => _normalizeSearch(input.value)).filter((value, index) => filterPassTypeInputs[index].checked)
  );
  appState.filterState.region = _normalizeSearch(filterRegionSelect ? filterRegionSelect.value : "");
  appState.filterState.country = (filterCountrySelect ? filterCountrySelect.value : "").trim().toUpperCase();
  appState.filterState.sortBy = normalizeSortBy(filterSortSelect ? filterSortSelect.value : "week_snow");
  appState.filterState.includeDefault = filterIncludeAllInput ? Boolean(filterIncludeAllInput.checked) : true;
  appState.filterState.searchAll = filterSearchAllInput ? Boolean(filterSearchAllInput.checked) : true;
  appState.filterState.search = resortSearchInput ? String(resortSearchInput.value || "") : "";
  appState.filterState.favoritesOnly = favoritesOnlyToggle
    ? Boolean(favoritesOnlyToggle.checked)
    : Boolean(filterFavoritesOnlyInput && filterFavoritesOnlyInput.checked);
  setFavoritesOnlyControls(appState.filterState.favoritesOnly);
  persistFilterState();
};

const syncUrlFromFilterState = () => {
  return false;
};

const buildServerQueryParams = () => {
  const params = new URLSearchParams();
  Array.from(appState.filterState.passTypes).sort().forEach((passType) => {
    if (passType) params.append("pass_type", passType);
  });
  if (appState.filterState.region) params.set("region", appState.filterState.region);
  if (appState.filterState.country) params.set("country", appState.filterState.country);
  if (appState.filterState.search) params.set("search", appState.filterState.search);
  params.set("search_all", appState.filterState.searchAll ? "1" : "0");
  if (appState.filterState.includeDefault) {
    params.set("include_default", "1");
  } else {
    params.set("include_all", "1");
  }
  return params;
};

const _rowSearchText = (report) => {
  const passTypes = Array.isArray(report.pass_types) ? report.pass_types.join(" ") : "";
  const state = String(report.admin1 || "").trim();
  return _normalizeSearch(`${_displayName(report)} ${report.query || ""} ${state} ${passTypes}`);
};

const _isDefaultResort = (report) => Boolean(report.default_resort || report.ljcc_favorite);
const _isFavoriteReport = (report) => _isFavoriteResortId(report && report.resort_id);

const _filteredReports = () => {
  const keyword = _normalizeSearch(appState.filterState.search);
  const reports = _payloadReports();
  const searchAllActive = Boolean(keyword) && appState.filterState.searchAll;
  const filtered = reports.filter((report) => {
    if (keyword && !_rowSearchText(report).includes(keyword)) return false;
    if (searchAllActive) return true;
    if (appState.filterState.favoritesOnly && !_isFavoriteReport(report)) return false;
    if (appState.filterState.includeDefault && !_isDefaultResort(report)) return false;
    if (appState.filterState.passTypes.size > 0) {
      const reportPassTypes = new Set((Array.isArray(report.pass_types) ? report.pass_types : []).map(_normalizeSearch));
      let matchesPass = false;
      for (const passType of appState.filterState.passTypes) {
        if (reportPassTypes.has(passType)) {
          matchesPass = true;
          break;
        }
      }
      if (!matchesPass) return false;
    }
    if (appState.filterState.region && _normalizeSearch(report.region) !== appState.filterState.region) return false;
    if (appState.filterState.country) {
      const reportCountry = String(report.country_code || report.country || "").trim().toUpperCase();
      if (reportCountry !== appState.filterState.country) return false;
    }
    return true;
  });
  const sortBy = appState.filterState.sortBy;
  filtered.sort((a, b) => {
    if (sortBy === "favorites") {
      const favoriteDelta = Number(_isFavoriteReport(b)) - Number(_isFavoriteReport(a));
      if (favoriteDelta !== 0) return favoriteDelta;
    }
    if (sortBy === "today_snow") {
      const snowDelta = _compareBySnowDesc(a, b, (report) => _dailySnowfall(report, 0));
      if (snowDelta !== 0) return snowDelta;
    }
    if (sortBy === "week_snow") {
      const snowDelta = _compareBySnowDesc(a, b, _weeklySnowfall);
      if (snowDelta !== 0) return snowDelta;
    }
    if (sortBy === "name") return _displayName(a).localeCompare(_displayName(b));
    const stateCmp = String(a.admin1 || "").localeCompare(String(b.admin1 || ""));
    if (stateCmp !== 0) return stateCmp;
    return String(a.query || "").localeCompare(String(b.query || ""));
  });
  return filtered;
};

const syncFilterSummary = (visibleReports, totalReports) => {
  if (!filterSummary) return;
  const scope = totalReports > 0 ? (visibleReports === totalReports ? `${visibleReports}` : `${visibleReports}/${totalReports}`) : "0";
  const keyword = _normalizeSearch(appState.filterState.search);
  const searchAllActive = Boolean(keyword) && appState.filterState.searchAll;
  const parts = [];
  if (!searchAllActive) {
    if (appState.filterState.favoritesOnly) parts.push("favorites only");
    if (appState.filterState.passTypes.size > 0) parts.push(`pass: ${Array.from(appState.filterState.passTypes).join(", ")}`);
    if (appState.filterState.region) parts.push(`region: ${appState.filterState.region}`);
    if (appState.filterState.country) parts.push(`country: ${appState.filterState.country}`);
    if (appState.filterState.sortBy !== "state") parts.push(`sort: ${appState.filterState.sortBy}`);
    if (appState.filterState.includeDefault && parts.length > 0) parts.push("scope: default");
    if (!appState.filterState.searchAll) parts.push("search: filtered");
  } else {
    parts.push("search: all resorts");
  }
  filterSummary.textContent = parts.length > 0
    ? `${parts.join(" | ")} | visible: ${scope}`
    : (appState.filterState.includeDefault ? `Default resorts (${scope})` : `All Epic + Ikon resorts (${scope})`);
};

const updateLayoutMode = () => {
  document.body.classList.toggle("mobile-simple", window.innerWidth < MIN_DESKTOP_SNOW_3DAY_PX);
};

const isCompactLayout = () => document.body.classList.contains("mobile-simple");

const _autoSizeDesktopLeftColumns = ({
  tableSelector,
  wrapSelector,
  queryVarName,
  weekVarName,
}) => {
  const table = document.querySelector(tableSelector);
  const wrap = document.querySelector(wrapSelector);
  if (!table || !wrap) return;
  const rows = Array.from(table.querySelectorAll("tbody tr"));
  const headerCells = Array.from(table.querySelectorAll("thead tr:last-child th"));
  if (headerCells.length < 2) return;
  const sampleCell = table.querySelector("tbody td") || headerCells[0];
  if (!sampleCell) return;
  const font = window.getComputedStyle(sampleCell).font;

  const queryIndex = headerCells.length >= 2 ? 1 : 0;
  const queryValues = rows.map((row) => row.children[queryIndex]?.textContent?.trim() || "");
  const queryHeader = table.querySelector("thead .query-col")?.textContent?.trim() || "query";
  const queryMax = Math.max(
    measureTextWidth(queryHeader, font),
    ...queryValues.map((value) => measureTextWidth(value, font)),
  );

  const weekHeaders = headerCells.map((cell) => cell.textContent?.trim() || "");
  const weekValues = rows.flatMap((row) =>
    Array.from(row.children)
      .slice(queryIndex + 1)
      .map((cell) => cell.textContent?.trim() || ""),
  );
  const weekMax = Math.max(
    ...weekHeaders.map((value) => measureTextWidth(value, font)),
    ...weekValues.map((value) => measureTextWidth(value, font)),
  );

  wrap.style.setProperty(queryVarName, `${Math.max(150, Math.min(240, Math.ceil(queryMax + 28)))}px`);
  wrap.style.setProperty(weekVarName, `${Math.max(90, Math.min(130, Math.ceil(weekMax + 24)))}px`);
};

const _autoSizeQueryOnly = ({ tableSelector, wrapSelector, queryVarName }) => {
  const table = document.querySelector(tableSelector);
  const wrap = document.querySelector(wrapSelector);
  if (!table || !wrap) return;
  const rows = Array.from(table.querySelectorAll("tbody tr"));
  const header = table.querySelector("thead .query-col") || table.querySelector("thead th");
  const sampleCell = table.querySelector("tbody td") || header;
  if (!sampleCell || !header) return;
  const font = window.getComputedStyle(sampleCell).font;
  const queryIndex = header && header.cellIndex >= 0 ? header.cellIndex : 0;
  const values = rows.map((row) => row.children[queryIndex]?.textContent?.trim() || "");
  const headerText = header.textContent?.trim() || "query";
  const queryMax = Math.max(
    measureTextWidth(headerText, font),
    ...values.map((value) => measureTextWidth(value, font)),
  );
  wrap.style.setProperty(queryVarName, `${Math.max(150, Math.min(240, Math.ceil(queryMax + 28)))}px`);
};

const _autoSizeMobileQueryColumn = ({ tableSelector, wrapSelector, minWidth, maxWidth, padding }) => {
  const table = document.querySelector(tableSelector);
  const wrap = document.querySelector(wrapSelector);
  if (!table || !wrap) return;
  const rows = Array.from(table.querySelectorAll("tbody tr"));
  const header = table.querySelector("thead .query-col");
  const sampleCell = table.querySelector("tbody td") || header;
  if (!sampleCell || !header) return;
  const font = window.getComputedStyle(sampleCell).font;
  const queryIndex = header && header.cellIndex >= 0 ? header.cellIndex : 0;
  const values = rows.map((row) => row.children[queryIndex]?.textContent?.trim() || "");
  const headerText = header.textContent?.trim() || "Resort";
  const width = Math.max(
    minWidth,
    Math.min(
      maxWidth,
      Math.ceil(Math.max(measureTextWidth(headerText, font), ...values.map((value) => measureTextWidth(value, font))) + padding),
    ),
  );
  wrap.style.setProperty("--query-col-w", `${width}px`);
  wrap.style.setProperty("--rain-query-w", `${width}px`);
};

const _autoSizeMobileRightColumns = ({
  tableSelector,
  wrapSelector,
  weekSelector,
  daySelector,
  minWeekWidth,
  minDayWidth,
}) => {
  const table = document.querySelector(tableSelector);
  const wrap = document.querySelector(wrapSelector);
  if (!table || !wrap) return;
  const weekCols = Array.from(table.querySelectorAll(weekSelector));
  const dayCols = Array.from(table.querySelectorAll(daySelector));
  const totalCols = weekCols.length + dayCols.length;
  if (!totalCols) return;

  const minTotal = (minWeekWidth * weekCols.length) + (minDayWidth * dayCols.length);
  const wrapWidth = wrap.clientWidth;
  if (wrapWidth >= minTotal) {
    const base = Math.floor(wrapWidth / totalCols);
    const remainder = wrapWidth - (base * totalCols);
    [...weekCols, ...dayCols].forEach((col, index) => {
      const width = base + (index < remainder ? 1 : 0);
      col.style.width = `${width}px`;
    });
    table.style.width = `${wrapWidth}px`;
    return;
  }

  weekCols.forEach((col) => {
    col.style.width = `${minWeekWidth}px`;
  });
  dayCols.forEach((col) => {
    col.style.width = `${minDayWidth}px`;
  });
  table.style.width = `${minTotal}px`;
};

const _setFixedMobileHeights = (leftSelector, rightSelector, wrapSelector, stickyVar) => {
  const leftTable = document.querySelector(leftSelector);
  const rightTable = document.querySelector(rightSelector);
  const splitWrap = document.querySelector(wrapSelector);
  if (!leftTable || !rightTable) return;

  const leftHeadRows = Array.from(leftTable.tHead?.rows || []);
  const rightHeadRows = Array.from(rightTable.tHead?.rows || []);
  const leftBodyRows = Array.from(leftTable.tBodies[0]?.rows || []);
  const rightBodyRows = Array.from(rightTable.tBodies[0]?.rows || []);

  const headRowHeights = [30, 30];
  leftHeadRows.forEach((row, index) => { row.style.height = `${headRowHeights[index] || 30}px`; });
  rightHeadRows.forEach((row, index) => { row.style.height = `${headRowHeights[index] || 30}px`; });
  leftBodyRows.forEach((row) => { row.style.height = "30px"; });
  rightBodyRows.forEach((row) => { row.style.height = "30px"; });

  if (splitWrap) {
    splitWrap.style.setProperty(stickyVar, `${headRowHeights[0]}px`);
  }
};

const attachVerticalSync = (left, right) => {
  if (!left || !right || left.dataset.scrollSyncAttached === "1") return;
  let syncing = false;
  const sync = (source, target) => {
    if (syncing) return;
    syncing = true;
    target.scrollTop = source.scrollTop;
    requestAnimationFrame(() => {
      syncing = false;
    });
  };
  left.addEventListener("scroll", () => sync(left, right), { passive: true });
  right.addEventListener("scroll", () => sync(right, left), { passive: true });
  left.dataset.scrollSyncAttached = "1";
  right.dataset.scrollSyncAttached = "1";
};

const attachSplitScrollSync = () => {
  [
    [".compact-grid-left-wrap", ".compact-grid-right-wrap"],
    [".snowfall-left-wrap#snowfall-left-wrap", ".snowfall-right-wrap#snowfall-right-wrap"],
    [".snowfall-left-wrap#snowfall-left-wrap-mobile", ".snowfall-right-wrap#snowfall-right-wrap-mobile"],
    [".rain-left-wrap#rain-left-wrap", ".rain-right-wrap#rain-right-wrap"],
    [".rain-left-wrap#rain-left-wrap-mobile", ".rain-right-wrap#rain-right-wrap-mobile"],
    [".temperature-left-wrap", ".temperature-right-wrap"],
    [".weather-left-wrap", ".weather-right-wrap"],
    [".sun-left-wrap", ".sun-right-wrap"],
  ].forEach(([leftSelector, rightSelector]) => {
    attachVerticalSync(document.querySelector(leftSelector), document.querySelector(rightSelector));
  });
};

const _stretchColumnsToWrap = ({ wrapSelector, tableSelector, colSelector, minWidth }) => {
  const wrap = document.querySelector(wrapSelector);
  const table = document.querySelector(tableSelector);
  if (!wrap || !table) return;
  const cols = Array.from(table.querySelectorAll(colSelector));
  const count = cols.length;
  if (!count) return;

  const wrapWidth = wrap.clientWidth;
  const minTotal = minWidth * count;
  if (wrapWidth >= minTotal) {
    const base = Math.floor(wrapWidth / count);
    const remainder = wrapWidth - (base * count);
    cols.forEach((col, index) => {
      const width = base + (index < remainder ? 1 : 0);
      col.style.width = `${width}px`;
    });
    table.style.width = `${wrapWidth}px`;
    return;
  }

  cols.forEach((col) => {
    col.style.width = `${minWidth}px`;
  });
  table.style.width = `${minTotal}px`;
};

const autoSizeSplitTables = () => {
  if (isCompactLayout()) {
    _autoSizeMobileQueryColumn({
      tableSelector: ".snowfall-left-wrap#snowfall-left-wrap-mobile .snowfall-left-table",
      wrapSelector: ".snowfall-left-wrap#snowfall-left-wrap-mobile",
      minWidth: 150,
      maxWidth: 240,
      padding: 22,
    });
    _autoSizeMobileRightColumns({
      tableSelector: ".snowfall-right-wrap#snowfall-right-wrap-mobile .snowfall-right-table",
      wrapSelector: ".snowfall-right-wrap#snowfall-right-wrap-mobile",
      weekSelector: "col.col-week-right",
      daySelector: "col.col-day",
      minWeekWidth: 92,
      minDayWidth: 62,
    });
    _autoSizeMobileQueryColumn({
      tableSelector: ".rain-left-wrap#rain-left-wrap-mobile .rain-left-table",
      wrapSelector: ".rain-left-wrap#rain-left-wrap-mobile",
      minWidth: 150,
      maxWidth: 240,
      padding: 22,
    });
    _autoSizeMobileRightColumns({
      tableSelector: ".rain-right-wrap#rain-right-wrap-mobile .rain-right-table",
      wrapSelector: ".rain-right-wrap#rain-right-wrap-mobile",
      weekSelector: "col.col-week-right",
      daySelector: "col.col-day",
      minWeekWidth: 92,
      minDayWidth: 62,
    });
    return;
  }
  _autoSizeDesktopLeftColumns({
    tableSelector: ".snowfall-left-wrap#snowfall-left-wrap .snowfall-left-table",
    wrapSelector: ".snowfall-left-wrap#snowfall-left-wrap",
    queryVarName: "--query-col-w",
    weekVarName: "--week-col-w",
  });
  _stretchColumnsToWrap({
    wrapSelector: ".snowfall-right-wrap#snowfall-right-wrap",
    tableSelector: ".snowfall-right-wrap#snowfall-right-wrap .snowfall-right-table",
    colSelector: "col.col-day",
    minWidth: 66,
  });
  _autoSizeDesktopLeftColumns({
    tableSelector: ".rain-left-wrap#rain-left-wrap .rain-left-table",
    wrapSelector: ".rain-left-wrap#rain-left-wrap",
    queryVarName: "--rain-query-w",
    weekVarName: "--rain-week-w",
  });
  _stretchColumnsToWrap({
    wrapSelector: ".rain-right-wrap#rain-right-wrap",
    tableSelector: ".rain-right-wrap#rain-right-wrap .rain-right-table",
    colSelector: "col.col-day",
    minWidth: 66,
  });
  _autoSizeQueryOnly({
    tableSelector: ".compact-grid-left-table",
    wrapSelector: ".compact-grid-left-wrap",
    queryVarName: "--compact-query-w",
  });
  _autoSizeQueryOnly({
    tableSelector: ".temperature-left-wrap .temperature-left-table",
    wrapSelector: ".temperature-left-wrap",
    queryVarName: "--temp-query-w",
  });
  _autoSizeQueryOnly({
    tableSelector: ".weather-left-wrap .weather-left-table",
    wrapSelector: ".weather-left-wrap",
    queryVarName: "--weather-query-w",
  });
  _stretchColumnsToWrap({
    wrapSelector: ".temperature-right-wrap",
    tableSelector: ".temperature-right-table",
    colSelector: "col.col-temp",
    minWidth: 50,
  });
  _autoSizeQueryOnly({
    tableSelector: ".sun-left-wrap .sun-left-table",
    wrapSelector: ".sun-left-wrap",
    queryVarName: "--sun-query-w",
  });
  _stretchColumnsToWrap({
    wrapSelector: ".weather-right-wrap",
    tableSelector: ".weather-right-table",
    colSelector: "col.col-weather",
    minWidth: 68,
  });
  _stretchColumnsToWrap({
    wrapSelector: ".sun-right-wrap",
    tableSelector: ".sun-right-table",
    colSelector: "col.col-sun",
    minWidth: 58,
  });
};

const _clearRowHeights = (rows) => {
  rows.forEach((row) => {
    row.style.height = "";
  });
};

const _syncRowPairHeights = (leftRows, rightRows) => {
  const count = Math.min(leftRows.length, rightRows.length);
  for (let index = 0; index < count; index += 1) {
    const leftRow = leftRows[index];
    const rightRow = rightRows[index];
    const targetHeight = Math.max(leftRow.offsetHeight, rightRow.offsetHeight);
    leftRow.style.height = `${targetHeight}px`;
    rightRow.style.height = `${targetHeight}px`;
  }
};

const _syncStickySecondRowTop = (leftTable, rightTable, splitWrap, variableName) => {
  if (!leftTable || !rightTable || !splitWrap) return;
  const leftFirstRow = leftTable.tHead?.rows?.[0];
  const rightFirstRow = rightTable.tHead?.rows?.[0];
  if (!leftFirstRow || !rightFirstRow) return;
  const top = Math.max(leftFirstRow.offsetHeight, rightFirstRow.offsetHeight);
  if (top > 0) {
    splitWrap.style.setProperty(variableName, `${top}px`);
  }
};

const _setVisibleRowViewport = ({ leftSelector, rightSelector, rowsVisible = 5 }) => {
  const leftWrap = document.querySelector(leftSelector);
  const rightWrap = document.querySelector(rightSelector);
  const leftTable = leftWrap?.querySelector("table");
  const rightTable = rightWrap?.querySelector("table");
  if (!leftWrap || !rightWrap || !leftTable || !rightTable) return;

  const leftHeadRows = Array.from(leftTable.tHead?.rows || []);
  const rightHeadRows = Array.from(rightTable.tHead?.rows || []);
  const leftBodyRows = Array.from(leftTable.tBodies[0]?.rows || []);
  const rightBodyRows = Array.from(rightTable.tBodies[0]?.rows || []);
  const visibleCount = Math.min(
    rowsVisible,
    leftBodyRows.length || rowsVisible,
    rightBodyRows.length || rowsVisible,
  );
  if (visibleCount <= 0) return;

  const leftHeadHeight = leftHeadRows.reduce((sum, row) => sum + row.offsetHeight, 0);
  const rightHeadHeight = rightHeadRows.reduce((sum, row) => sum + row.offsetHeight, 0);
  const leftBodyHeight = leftBodyRows.slice(0, visibleCount).reduce((sum, row) => sum + row.offsetHeight, 0);
  const rightBodyHeight = rightBodyRows.slice(0, visibleCount).reduce((sum, row) => sum + row.offsetHeight, 0);
  const maxHeight = Math.max(leftHeadHeight + leftBodyHeight, rightHeadHeight + rightBodyHeight);
  if (maxHeight > 0) {
    leftWrap.style.maxHeight = `${maxHeight}px`;
    rightWrap.style.maxHeight = `${maxHeight}px`;
  }
};

const syncSplitTableHeights = () => {
  const tablePairs = isCompactLayout()
    ? [
      [".snowfall-left-wrap#snowfall-left-wrap-mobile .snowfall-left-table", ".snowfall-right-wrap#snowfall-right-wrap-mobile .snowfall-right-table", ".snowfall-split-wrap.mobile-only", "--snow-header-row1-h"],
      [".rain-left-wrap#rain-left-wrap-mobile .rain-left-table", ".rain-right-wrap#rain-right-wrap-mobile .rain-right-table", ".rain-split-wrap.mobile-only", "--rain-header-row1-h"],
      [".compact-grid-left-table", ".compact-grid-right-table", ".compact-grid-wrap", "--compact-header-row1-h"],
      [".temperature-left-table", ".temperature-right-table", ".temperature-split-wrap", "--temp-header-row1-h"],
      [".weather-left-table", ".weather-right-table", ".weather-split-wrap", "--weather-header-row1-h"],
      [".sun-left-table", ".sun-right-table", ".sun-split-wrap", "--sun-header-row1-h"],
    ]
    : [
      [".snowfall-left-wrap#snowfall-left-wrap .snowfall-left-table", ".snowfall-right-wrap#snowfall-right-wrap .snowfall-right-table", ".snowfall-split-wrap.desktop-only", "--snow-header-row1-h"],
      [".rain-left-wrap#rain-left-wrap .rain-left-table", ".rain-right-wrap#rain-right-wrap .rain-right-table", ".rain-split-wrap.desktop-only", "--rain-header-row1-h"],
      [".compact-grid-left-table", ".compact-grid-right-table", ".compact-grid-wrap", "--compact-header-row1-h"],
      [".temperature-left-table", ".temperature-right-table", ".temperature-split-wrap", "--temp-header-row1-h"],
      [".weather-left-table", ".weather-right-table", ".weather-split-wrap", "--weather-header-row1-h"],
      [".sun-left-table", ".sun-right-table", ".sun-split-wrap", "--sun-header-row1-h"],
    ];
  tablePairs.forEach(([leftSelector, rightSelector, wrapSelector, stickyVar]) => {
    const leftTable = document.querySelector(leftSelector);
    const rightTable = document.querySelector(rightSelector);
    const splitWrap = document.querySelector(wrapSelector);
    if (!leftTable || !rightTable) return;

    const leftHeadRows = Array.from(leftTable.tHead ? leftTable.tHead.rows : []);
    const rightHeadRows = Array.from(rightTable.tHead ? rightTable.tHead.rows : []);
    const leftBodyRows = Array.from(leftTable.tBodies[0] ? leftTable.tBodies[0].rows : []);
    const rightBodyRows = Array.from(rightTable.tBodies[0] ? rightTable.tBodies[0].rows : []);

    _clearRowHeights(leftHeadRows);
    _clearRowHeights(rightHeadRows);
    _clearRowHeights(leftBodyRows);
    _clearRowHeights(rightBodyRows);

    _syncRowPairHeights(leftHeadRows, rightHeadRows);
    _syncRowPairHeights(leftBodyRows, rightBodyRows);
    _syncStickySecondRowTop(leftTable, rightTable, splitWrap, stickyVar);
  });
  _setVisibleRowViewport({
    leftSelector: ".compact-grid-left-wrap",
    rightSelector: ".compact-grid-right-wrap",
    rowsVisible: 5,
  });
};

let layoutFrame = 0;
let layoutObserver = null;

const _selectorEscape = (value) => {
  if (window.CSS && typeof window.CSS.escape === "function") {
    return window.CSS.escape(String(value || ""));
  }
  return String(value || "").replace(/["\\]/g, "\\$&");
};

const _visibleReportResortIds = (reports) => new Set(
  (Array.isArray(reports) ? reports : [])
    .map((report) => String(report?.resort_id || "").trim())
    .filter(Boolean)
);

const syncUsSnowfallMapMetricToggle = () => {
  const metricKey = _normalizeMapMetricKey(appState.map.activeMetricKey);
  const toggle = document.getElementById("us-snowfall-map-metric-toggle");
  if (!toggle) return;
  toggle.setAttribute("data-mode", metricKey);
  toggle.querySelectorAll("[data-map-metric-key]").forEach((button) => {
    const active = _normalizeMapMetricKey(button.getAttribute("data-map-metric-key")) === metricKey;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", active ? "true" : "false");
  });
};

const syncSelectedResortUi = () => {
  const selectedResortId = _selectedMapResortId();
  document.querySelectorAll("tr[data-resort-id]").forEach((row) => {
    const active = selectedResortId && String(row.getAttribute("data-resort-id") || "").trim() === selectedResortId;
    row.setAttribute("data-map-selected", active ? "1" : "0");
  });
  document.querySelectorAll(".resort-cell[data-resort-id], .resort-link[data-resort-id]").forEach((node) => {
    const active = selectedResortId && String(node.getAttribute("data-resort-id") || "").trim() === selectedResortId;
    node.setAttribute("data-map-selected", active ? "1" : "0");
    node.classList.toggle("is-map-selected", active);
  });
};

const _scrollSelectedResortIntoView = (resortId) => {
  const normalized = String(resortId || "").trim();
  if (!normalized) return;
  const selectorValue = _selectorEscape(normalized);
  const row = document.querySelector(`.compact-grid-left-table tbody tr[data-resort-id="${selectorValue}"]`)
    || document.querySelector(`tr[data-resort-id="${selectorValue}"]`);
  if (row && typeof row.scrollIntoView === "function") {
    row.scrollIntoView({ block: "nearest", inline: "nearest" });
  }
};

const setUsSnowfallMapUnavailable = (message = "Snowfall map unavailable. Existing tables remain active.") => {
  appState.map.controllerAvailable = false;
  const section = document.getElementById("us-snowfall-map-section");
  if (section) section.setAttribute("data-map-ready", "0");
  const statusElement = document.getElementById("us-snowfall-map-status");
  if (statusElement) statusElement.textContent = message;
};

const safeUsSnowfallMapCall = (method, ...args) => {
  const controller = appState.map.controller;
  if (!controller || typeof controller[method] !== "function") return false;
  try {
    controller[method](...args);
    return true;
  } catch (error) {
    setUsSnowfallMapUnavailable();
    appState.map.controller = null;
    return false;
  }
};

const setUsSnowfallMapMetric = (metricKey) => {
  appState.map.activeMetricKey = _normalizeMapMetricKey(metricKey);
  try {
    localStorage.setItem(MAP_METRIC_STORAGE_KEY, appState.map.activeMetricKey);
  } catch (error) {
    // Ignore storage failures.
  }
  syncUsSnowfallMapMetricToggle();
  safeUsSnowfallMapCall("setMetric", appState.map.activeMetricKey);
};

const setUsSnowfallMapSelectedResort = (resortId, options = {}) => {
  const visibleReports = Array.isArray(options.visibleReports) ? options.visibleReports : _filteredReports();
  const visibleIds = _visibleReportResortIds(visibleReports);
  const normalized = String(resortId || "").trim();
  const nextResortId = normalized && visibleIds.has(normalized) ? normalized : "";
  const changed = nextResortId !== _selectedMapResortId();
  appState.map.selectedResortId = nextResortId;
  syncSelectedResortUi();
  safeUsSnowfallMapCall("setSelectedResort", nextResortId);
  if ((changed || options.forceScroll) && nextResortId && options.scrollIntoView) {
    _scrollSelectedResortIntoView(nextResortId);
  }
};

const destroyUsSnowfallMapController = () => {
  const controller = appState.map.controller;
  if (controller && typeof controller.destroy === "function") {
    try {
      controller.destroy();
    } catch (error) {
      // Ignore scaffold cleanup failures.
    }
  }
  appState.map.controller = null;
  appState.map.controllerAvailable = false;
};

const mountUsSnowfallMapController = (visibleReports) => {
  destroyUsSnowfallMapController();
  const api = window.CloseSnowUsSnowfallMap;
  if (!api || typeof api.create !== "function") {
    setUsSnowfallMapUnavailable();
    return;
  }
  try {
    appState.map.controller = api.create({
      section: document.getElementById("us-snowfall-map-section"),
      metricToggle: document.getElementById("us-snowfall-map-metric-toggle"),
      statusElement: document.getElementById("us-snowfall-map-status"),
      legendElement: document.getElementById("us-snowfall-map-legend"),
      mapRoot: document.getElementById("us-snowfall-map-root"),
      metricKey: appState.map.activeMetricKey,
      selectedResortId: _selectedMapResortId(),
      reports: visibleReports,
      onSelectResort: (resortId) => {
        setUsSnowfallMapSelectedResort(resortId, {
          visibleReports,
          scrollIntoView: true,
          forceScroll: true,
        });
      },
    }) || null;
  } catch (error) {
    appState.map.controller = null;
  }
  appState.map.controllerAvailable = Boolean(appState.map.controller);
  if (!appState.map.controllerAvailable) {
    setUsSnowfallMapUnavailable();
    return;
  }
  syncUsSnowfallMapMetricToggle();
  safeUsSnowfallMapCall("setVisibleReports", visibleReports);
  safeUsSnowfallMapCall("setMetric", appState.map.activeMetricKey);
  safeUsSnowfallMapCall("setSelectedResort", _selectedMapResortId());
};

const applyLayout = () => {
  if (layoutFrame) cancelAnimationFrame(layoutFrame);
  layoutFrame = requestAnimationFrame(() => {
    layoutFrame = 0;
    updateLayoutMode();
    autoSizeSplitTables();
    syncSplitTableHeights();
    attachSplitScrollSync();
    safeUsSnowfallMapCall("resize");
  });
};

const observeLayoutContainers = () => {
  if (!window.ResizeObserver) return;
  if (layoutObserver) layoutObserver.disconnect();
  layoutObserver = new ResizeObserver(() => applyLayout());
  [
    ".snowfall-left-wrap#snowfall-left-wrap",
    ".snowfall-right-wrap#snowfall-right-wrap",
    ".snowfall-left-wrap#snowfall-left-wrap-mobile",
    ".snowfall-right-wrap#snowfall-right-wrap-mobile",
    ".rain-left-wrap#rain-left-wrap",
    ".rain-right-wrap#rain-right-wrap",
    ".rain-left-wrap#rain-left-wrap-mobile",
    ".rain-right-wrap#rain-right-wrap-mobile",
    ".compact-grid-left-wrap",
    ".compact-grid-right-wrap",
    ".temperature-left-wrap",
    ".temperature-right-wrap",
    ".weather-left-wrap",
    ".weather-right-wrap",
    ".sun-left-wrap",
    ".sun-right-wrap",
  ].forEach((selector) => {
    const element = document.querySelector(selector);
    if (element) layoutObserver.observe(element);
  });
};

const getStoredUnitMode = (kind) => {
  try {
    const saved = localStorage.getItem(`${UNIT_STORAGE_KEY_PREFIX}${kind}`);
    return saved === "imperial" || saved === "metric" ? saved : "metric";
  } catch (error) {
    return "metric";
  }
};

const syncCompactSummaryToggle = () => {
  document.querySelectorAll(".unit-toggle[data-compact-summary-toggle='1']").forEach((toggle) => {
    const mode = appState.compactSummaryUnitMode || "metric";
    toggle.setAttribute("data-mode", mode);
    toggle.querySelectorAll(".unit-btn[data-unit-mode]").forEach((button) => {
      button.classList.toggle("is-active", button.getAttribute("data-unit-mode") === mode);
    });
  });
};

const syncSunTimeToggle = () => {
  document.querySelectorAll(".unit-toggle[data-sun-time-toggle='1']").forEach((toggle) => {
    const mode = appState.sunTimeToggleMode || "metric";
    toggle.setAttribute("data-mode", mode);
    toggle.querySelectorAll(".unit-btn[data-unit-mode]").forEach((button) => {
      button.classList.toggle("is-active", button.getAttribute("data-unit-mode") === mode);
    });
  });
};

const renderCompactSummaryValues = () => {
  const mode = appState.compactSummaryUnitMode || "metric";
  document.querySelectorAll("[data-compact-unit-kind][data-compact-metric-value]").forEach((el) => {
    const kind = String(el.getAttribute("data-compact-unit-kind") || "").trim();
    const metricValue = Number(el.getAttribute("data-compact-metric-value"));
    if (!Number.isFinite(metricValue)) return;
    if (kind === "temp") {
      el.textContent = mode === "imperial"
        ? String(Math.round((metricValue * 9 / 5) + 32))
        : String(Math.round(metricValue));
      return;
    }
    if (kind === "snow") {
      el.textContent = mode === "imperial"
        ? (metricValue / 2.54).toFixed(1)
        : metricValue.toFixed(1);
      return;
    }
    if (kind === "rain") {
      el.textContent = mode === "imperial"
        ? (metricValue / 25.4).toFixed(2)
        : metricValue.toFixed(1);
    }
  });
};

const renderSunTimeValues = () => {
  const mode = appState.sunTimeToggleMode || "metric";
  document.querySelectorAll("[data-sun-time-raw]").forEach((el) => {
    const raw = String(el.getAttribute("data-sun-time-raw") || "").trim();
    if (!raw) {
      el.textContent = "";
      return;
    }
    if (mode !== "imperial") {
      el.textContent = raw;
      return;
    }
    const match = /^(\d{2}):(\d{2})$/.exec(raw);
    if (!match) {
      el.textContent = raw;
      return;
    }
    const hour24 = Number(match[1]);
    if (!Number.isFinite(hour24)) {
      el.textContent = raw;
      return;
    }
    const minute = match[2];
    const suffix = hour24 >= 12 ? "PM" : "AM";
    const hour12 = hour24 % 12 || 12;
    el.textContent = `${hour12}:${minute} ${suffix}`;
  });
};

const formatMeasure = (metricValue, kind, mode) => {
  if (mode === "imperial") {
    if (kind === "snow") return (metricValue / 2.54).toFixed(1);
    if (kind === "rain") return (metricValue / 25.4).toFixed(2);
    if (kind === "temp") return ((metricValue * 9 / 5) + 32).toFixed(1);
  }
  if (kind === "rain") return metricValue.toFixed(1);
  return metricValue.toFixed(1);
};

const renderUnitValues = (kind, mode) => {
  document.querySelectorAll(`td[data-kind="${kind}"][data-metric-value]`).forEach((cell) => {
    const metricValue = Number(cell.getAttribute("data-metric-value"));
    if (!Number.isFinite(metricValue)) return;
    cell.textContent = formatMeasure(metricValue, kind, mode);
  });
};

const syncToggleButtons = () => {
  document.querySelectorAll(".unit-toggle[data-target-kind]").forEach((toggle) => {
    const kind = toggle.getAttribute("data-target-kind");
    const mode = appState.unitModes[kind] || "metric";
    toggle.setAttribute("data-mode", mode);
    toggle.querySelectorAll(".unit-btn[data-unit-mode]").forEach((button) => {
      button.classList.toggle("is-active", button.getAttribute("data-unit-mode") === mode);
    });
  });
};

const applyUnitModes = () => {
  Object.entries(appState.unitModes).forEach(([kind, mode]) => {
    renderUnitValues(kind, mode);
  });
  renderCompactSummaryValues();
  renderSunTimeValues();
  syncToggleButtons();
  syncCompactSummaryToggle();
  syncSunTimeToggle();
};

const setUnitMode = (kind, mode) => {
  if (!VALID_UNIT_KINDS.has(kind)) return;
  appState.unitModes[kind] = mode === "imperial" ? "imperial" : "metric";
  try {
    localStorage.setItem(`${UNIT_STORAGE_KEY_PREFIX}${kind}`, appState.unitModes[kind]);
  } catch (error) {
    // Ignore storage failures.
  }
  applyUnitModes();
  applyLayout();
};

const setCompactSummaryUnitMode = (mode) => {
  appState.compactSummaryUnitMode = mode === "imperial" ? "imperial" : "metric";
  try {
    localStorage.setItem(`${UNIT_STORAGE_KEY_PREFIX}${COMPACT_SUMMARY_UNIT_KIND}`, appState.compactSummaryUnitMode);
  } catch (error) {
    // Ignore storage failures.
  }
  renderCompactSummaryValues();
  syncCompactSummaryToggle();
};

const setSunTimeToggleMode = (mode) => {
  appState.sunTimeToggleMode = mode === "imperial" ? "imperial" : "metric";
  try {
    localStorage.setItem(`${UNIT_STORAGE_KEY_PREFIX}${SUN_TIME_TOGGLE_KIND}`, appState.sunTimeToggleMode);
  } catch (error) {
    // Ignore storage failures.
  }
  renderSunTimeValues();
  syncSunTimeToggle();
};

const oppositeUnitMode = (mode) => (mode === "imperial" ? "metric" : "imperial");

const renderReportDate = () => {
  if (!reportDateEl) return;
  const raw = appState.payload && appState.payload.generated_at_utc
    ? appState.payload.generated_at_utc
    : reportDateEl.getAttribute("data-generated-utc");
  const utcDate = raw ? new Date(raw) : null;
  if (!utcDate || Number.isNaN(utcDate.getTime())) return;
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "local";
  reportDateEl.textContent = `Generated At: ${utcDate.toLocaleString(undefined, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZoneName: "short",
  })} (${tz})`;
};

const renderPage = () => {
  if (!pageContentRoot || !appState.payload) return;
  const visibleReports = _filteredReports();
  const visibleResortIds = _visibleReportResortIds(visibleReports);
  if (!visibleResortIds.has(_selectedMapResortId())) {
    appState.map.selectedResortId = "";
  }
  const totalReports = _payloadReports().length;
  const keyword = _normalizeSearch(appState.filterState.search);
  const searchAllActive = Boolean(keyword) && appState.filterState.searchAll;
  const emptyMessage = !searchAllActive && appState.filterState.favoritesOnly && appState.favoriteResortIds.size === 0
    ? "No favorite resorts yet. Tap the heart icon to save some."
    : (appState.filterState.favoritesOnly
      ? "No favorite resorts match the current filters."
      : "No resorts match the current filters.");
  destroyUsSnowfallMapController();
  pageContentRoot.innerHTML = _renderSections(visibleReports, emptyMessage);
  syncUsSnowfallMapMetricToggle();
  syncSelectedResortUi();
  mountUsSnowfallMapController(visibleReports);
  applyLayout();
  observeLayoutContainers();
  pageContentRoot.removeAttribute("data-loading");
  syncFilterSummary(visibleReports.length, totalReports);
  renderReportDate();
  applyUnitModes();
  document.body.classList.remove("units-pending");
};

const _SCROLLABLE_WRAP_SELECTORS = [
  ".compact-grid-left-wrap",
  ".compact-grid-right-wrap",
  ".snowfall-left-wrap#snowfall-left-wrap",
  ".snowfall-right-wrap#snowfall-right-wrap",
  ".snowfall-left-wrap#snowfall-left-wrap-mobile",
  ".snowfall-right-wrap#snowfall-right-wrap-mobile",
  ".rain-left-wrap#rain-left-wrap",
  ".rain-right-wrap#rain-right-wrap",
  ".rain-left-wrap#rain-left-wrap-mobile",
  ".rain-right-wrap#rain-right-wrap-mobile",
  ".temperature-left-wrap",
  ".temperature-right-wrap",
  ".weather-left-wrap",
  ".weather-right-wrap",
  ".sun-left-wrap",
  ".sun-right-wrap",
];

const _captureWrapScrollPositions = () => _SCROLLABLE_WRAP_SELECTORS.map((selector) => {
  const element = document.querySelector(selector);
  if (!element) return null;
  return {
    selector,
    scrollTop: element.scrollTop,
    scrollLeft: element.scrollLeft,
  };
}).filter(Boolean);

const _restoreWrapScrollPositions = (positions) => {
  positions.forEach((entry) => {
    const element = document.querySelector(entry.selector);
    if (!element) return;
    element.scrollTop = entry.scrollTop;
    element.scrollLeft = entry.scrollLeft;
  });
};

const renderPagePreservingScroll = () => {
  const scrollX = window.scrollX;
  const scrollY = window.scrollY;
  const wrapScrollPositions = _captureWrapScrollPositions();
  if (document.activeElement instanceof HTMLElement) {
    document.activeElement.blur();
  }
  renderPage();
  window.requestAnimationFrame(() => {
    _restoreWrapScrollPositions(wrapScrollPositions);
    window.scrollTo(scrollX, scrollY);
    window.requestAnimationFrame(() => {
      _restoreWrapScrollPositions(wrapScrollPositions);
      window.scrollTo(scrollX, scrollY);
    });
  });
};

const populateCountryOptions = () => {
  if (!filterCountrySelect) return;
  const selected = appState.filterState.country;
  const counts = appState.availableFilters.country || {};
  filterCountrySelect.innerHTML = "";
  const allOption = document.createElement("option");
  allOption.value = "";
  allOption.textContent = "All";
  filterCountrySelect.appendChild(allOption);
  Object.entries(counts)
    .filter(([code, count]) => /^[A-Z]{2}$/.test(code) && Number(count) > 0)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .forEach(([code, count]) => {
      const option = document.createElement("option");
      option.value = code;
      option.textContent = `${code} (${count})`;
      filterCountrySelect.appendChild(option);
    });
  if (selected) filterCountrySelect.value = selected;
};

const updateFilterLabels = () => {
  document.querySelectorAll("[data-pass-count]").forEach((el) => {
    const key = _normalizeSearch(el.getAttribute("data-pass-count") || "");
    const count = Number((appState.availableFilters.pass_type || {})[key] || 0);
    el.textContent = count > 0 ? `(${count})` : "";
  });
  if (filterRegionSelect) {
    Array.from(filterRegionSelect.options).forEach((option) => {
      const value = _normalizeSearch(option.value || "");
      const baseLabel = option.getAttribute("data-base-label") || option.textContent.replace(/\s+\(\d+\)$/, "");
      option.setAttribute("data-base-label", baseLabel);
      if (!value) {
        option.textContent = baseLabel;
        return;
      }
      const count = Number((appState.availableFilters.region || {})[value] || 0);
      option.textContent = count > 0 ? `${baseLabel} (${count})` : baseLabel;
    });
  }
  populateCountryOptions();
};

const closeFilterModal = () => {
  if (filterModal) filterModal.hidden = true;
};

const openFilterModal = () => {
  if (filterModal) filterModal.hidden = false;
};

const loadPayload = async (url = _resolvedDataUrl()) => {
  const response = await fetch(url);
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload && payload.error ? payload.error : `HTTP ${response.status}`);
  }
  return payload;
};

const reloadDynamicPayloadForFilters = async () => {
  const endpoint = new URL(_resolvedDataUrl());
  endpoint.search = buildServerQueryParams().toString();
  const payload = await loadPayload(endpoint.toString());
  appState.payload = payload;
  appState.reports = _payloadReports();
  appState.availableFilters = _availableFilters();
  updateFilterLabels();
};

const resetFilterControls = () => {
  filterPassTypeInputs.forEach((input) => { input.checked = false; });
  if (filterRegionSelect) filterRegionSelect.value = "";
  if (filterCountrySelect) filterCountrySelect.value = "";
  if (filterSortSelect) filterSortSelect.value = "week_snow";
  if (filterIncludeAllInput) filterIncludeAllInput.checked = true;
  if (filterSearchAllInput) filterSearchAllInput.checked = true;
  setFavoritesOnlyControls(false);
  if (resortSearchInput) resortSearchInput.value = "";
};

const applyFiltersImmediately = async () => {
  applyFilterStateFromControls();
  syncUrlFromFilterState();
  if (_isDynamicApiDataUrl()) {
    try {
      await reloadDynamicPayloadForFilters();
    } catch (error) {
      destroyUsSnowfallMapController();
      if (pageContentRoot) {
        pageContentRoot.innerHTML = `<div class="page-load-error">${_escapeHtml(error instanceof Error ? error.message : String(error))}</div>`;
      }
      return;
    }
  }
  renderPage();
};

const bindControls = () => {
  window.addEventListener(MAP_SELECTION_EVENT, (event) => {
    const detail = event && typeof event === "object" ? event.detail : null;
    const resortId = detail && typeof detail === "object" ? detail.resortId : "";
    setUsSnowfallMapSelectedResort(resortId, {
      scrollIntoView: true,
      forceScroll: true,
    });
  });
  document.addEventListener("mouseover", (event) => {
    const resortNode = event.target.closest("tr[data-resort-id], .resort-cell[data-resort-id], .resort-link[data-resort-id]");
    if (!resortNode) return;
    setUsSnowfallMapSelectedResort(resortNode.getAttribute("data-resort-id"));
  });
  document.addEventListener("focusin", (event) => {
    const resortNode = event.target.closest(".resort-link[data-resort-id]");
    if (!resortNode) return;
    setUsSnowfallMapSelectedResort(resortNode.getAttribute("data-resort-id"));
  });
  if (resortSearchInput) {
    resortSearchInput.addEventListener("input", () => {
      applyFiltersImmediately();
    });
  }
  if (resortSearchClear) {
    resortSearchClear.addEventListener("click", () => {
      if (resortSearchInput) resortSearchInput.value = "";
      applyFiltersImmediately();
    });
  }
  if (filterOpenBtn) filterOpenBtn.addEventListener("click", openFilterModal);
  if (filterCloseBtn) filterCloseBtn.addEventListener("click", closeFilterModal);
  if (filterResetBtn) {
    filterResetBtn.addEventListener("click", () => {
      resetFilterControls();
      applyFiltersImmediately();
    });
  }
  filterPassTypeInputs.forEach((input) => {
    input.addEventListener("change", applyFiltersImmediately);
  });
  if (filterRegionSelect) filterRegionSelect.addEventListener("change", applyFiltersImmediately);
  if (filterCountrySelect) filterCountrySelect.addEventListener("change", applyFiltersImmediately);
  if (filterSortSelect) filterSortSelect.addEventListener("change", applyFiltersImmediately);
  if (filterIncludeAllInput) filterIncludeAllInput.addEventListener("change", applyFiltersImmediately);
  if (filterSearchAllInput) filterSearchAllInput.addEventListener("change", applyFiltersImmediately);
  if (favoritesOnlyToggle) {
    favoritesOnlyToggle.addEventListener("change", () => {
      setFavoritesOnlyControls(favoritesOnlyToggle.checked);
      applyFiltersImmediately();
    });
  }
  if (filterFavoritesOnlyInput) {
    filterFavoritesOnlyInput.addEventListener("change", () => {
      setFavoritesOnlyControls(filterFavoritesOnlyInput.checked);
      applyFiltersImmediately();
    });
  }
  if (filterModal) {
    filterModal.addEventListener("click", (event) => {
      if (event.target === filterModal) closeFilterModal();
    });
  }
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && filterModal && !filterModal.hidden) closeFilterModal();
  });
  document.addEventListener("click", (event) => {
    const mapMetricButton = event.target.closest("[data-map-metric-key]");
    if (mapMetricButton) {
      event.preventDefault();
      setUsSnowfallMapMetric(mapMetricButton.getAttribute("data-map-metric-key"));
      return;
    }
    const resortLink = event.target.closest(".resort-link[data-resort-id]");
    if (resortLink) {
      setUsSnowfallMapSelectedResort(resortLink.getAttribute("data-resort-id"));
    }
    const favoriteAllButton = event.target.closest(".favorite-all-btn[data-favorite-all='1']");
    if (favoriteAllButton) {
      event.preventDefault();
      const visibleReports = _filteredReports();
      toggleFavoriteVisibleReports(visibleReports);
      if (favoriteInteractionNeedsFullRender()) {
        renderPagePreservingScroll();
      } else {
        syncFavoriteUiInPlace(visibleReports);
      }
      return;
    }
    const favoriteButton = event.target.closest(".favorite-btn[data-resort-id]");
    if (favoriteButton) {
      event.preventDefault();
      const visibleReports = _filteredReports();
      toggleFavoriteResortId(favoriteButton.getAttribute("data-resort-id"));
      if (favoriteInteractionNeedsFullRender()) {
        renderPagePreservingScroll();
      } else {
        syncFavoriteUiInPlace(visibleReports);
      }
      return;
    }
    const button = event.target.closest(".unit-btn[data-unit-mode]");
    if (!button) return;
    const compactToggle = button.closest(".unit-toggle[data-compact-summary-toggle='1']");
    if (compactToggle) {
      setCompactSummaryUnitMode(oppositeUnitMode(appState.compactSummaryUnitMode));
      return;
    }
    const sunTimeToggle = button.closest(".unit-toggle[data-sun-time-toggle='1']");
    if (sunTimeToggle) {
      setSunTimeToggleMode(oppositeUnitMode(appState.sunTimeToggleMode));
      return;
    }
    const group = button.closest(".unit-toggle[data-target-kind]");
    if (!group) return;
    const kind = group.getAttribute("data-target-kind");
    const currentMode = appState.unitModes[kind] || "metric";
    setUnitMode(kind, oppositeUnitMode(currentMode));
  });
  window.addEventListener("resize", () => {
    applyLayout();
  }, { passive: true });
};

const initialize = async () => {
  Object.keys(appState.unitModes).forEach((kind) => {
    appState.unitModes[kind] = getStoredUnitMode(kind);
  });
  appState.compactSummaryUnitMode = getStoredUnitMode(COMPACT_SUMMARY_UNIT_KIND);
  appState.sunTimeToggleMode = getStoredUnitMode(SUN_TIME_TOGGLE_KIND);
  appState.map.activeMetricKey = getStoredMapMetricKey();
  appState.favoriteResortIds = new Set(loadFavoriteResortIds());
  try {
    appState.payload = await loadPayload();
    appState.reports = _payloadReports();
    appState.availableFilters = _availableFilters();
    updateFilterLabels();
    applyControlsFromQueryOrMeta();
    renderPage();
  } catch (error) {
    destroyUsSnowfallMapController();
    if (pageContentRoot) {
      pageContentRoot.innerHTML = `<div class="page-load-error">${_escapeHtml(error instanceof Error ? error.message : String(error))}</div>`;
    }
    document.body.classList.remove("units-pending");
  }
};

bindControls();
void initialize();
