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
const initialPayloadRaw = window.CLOSESNOW_INITIAL_PAYLOAD;
const initialPayload =
  initialPayloadRaw && typeof initialPayloadRaw === "object" && !Array.isArray(initialPayloadRaw)
    ? initialPayloadRaw
    : null;

const pageContentRoot = document.getElementById("page-content-root");
const reportDateEl = document.getElementById("report-date");
const resortSearchInput = document.getElementById("resort-search-input");
const resortSearchClear = document.getElementById("resort-search-clear");
const filterOpenBtn = document.getElementById("filter-open-btn");
const filterModal = document.getElementById("filter-modal");
const filterResetBtn = document.getElementById("filter-reset-btn");
const filterCloseBtn = document.getElementById("filter-close-btn");
const filterSummary = document.getElementById("filter-summary");
const filterRegionOptions = document.getElementById("filter-region-options");
const filterCountryOptions = document.getElementById("filter-country-options");
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
const DEFAULT_AVAILABLE_FILTERS = { pass_type: {}, region: {}, subregion: {}, country: {} };
const SUBREGION_OPTIONS = [
  { value: "rockies", label: "Rockies" },
  { value: "west-coast", label: "West Coast" },
  { value: "midwest", label: "Midwest" },
  { value: "mid-atlantic", label: "Mid-Atlantic" },
  { value: "northeast", label: "Northeast" },
  { value: "europe", label: "Europe" },
  { value: "asia", label: "Asia" },
  { value: "australia-new-zealand", label: "Australia / New Zealand" },
  { value: "south-america", label: "South America" },
];
const MAX_DISPLAY_DAYS = 14;
const MIN_DESKTOP_SNOW_3DAY_PX = 554;
const LEADING_FAVORITE_COL_PX = 28;
const compactDailySummary = window.CloseSnowCompactDailySummary || {};
const stickySingleTableLayout = window.CloseSnowStickySingleTableLayout || {};
const COMPACT_SUMMARY_UNIT_KIND = "compact_summary";
const SUN_TIME_TOGGLE_KIND = "sun_time";
// Reserve section keys so later workers can move one section at a time to shared single-table layout.
const STICKY_SINGLE_TABLE_SECTION_KEYS = Object.freeze({
  dailySummary: "daily-summary",
  snowfall: "snowfall",
  rainfall: "rainfall",
  temperature: "temperature",
  weather: "weather",
  sun: "sunrise-sunset",
});

const appState = {
  payload: null,
  reports: [],
  availableFilters: DEFAULT_AVAILABLE_FILTERS,
  favoriteResortIds: new Set(),
  filterState: {
    passTypes: new Set(),
    subregions: new Set(),
    countries: new Set(),
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
  layoutMode: "desktop",
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

const measureTextWidth = (text, font) => {
  const cache = measureTextWidth.cache || (measureTextWidth.cache = new Map());
  const cacheKey = `${font}\u0000${text || ""}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey);
  const canvas = measureTextWidth.canvas || (measureTextWidth.canvas = document.createElement("canvas"));
  const context = canvas.getContext("2d");
  context.font = font;
  const width = context.measureText(text || "").width;
  cache.set(cacheKey, width);
  if (cache.size > 4000) cache.clear();
  return width;
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
  const passTypes = Array.isArray(report.pass_types) ? report.pass_types.join(",").toLowerCase() : "";
  const region = String(report.region || "").trim().toLowerCase();
  const country = String(report.country_code || report.country || "").trim().toUpperCase();
  const state = String(report.admin1 || "").trim().toUpperCase();
  const defaultResort = report.default_resort || report.ljcc_favorite ? "1" : "";
  return ` data-pass-types='${_escapeHtml(passTypes)}' data-region='${_escapeHtml(region)}' data-country='${_escapeHtml(country)}' data-state='${_escapeHtml(state)}' data-default-resort='${_escapeHtml(defaultResort)}'`;
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
  const linkHtml = resortId
    ? `<a class='resort-link' href='resort/${encodeURIComponent(resortId)}'>${text}</a>`
    : text;
  return `<td class='favorite-col'>${_favoriteButtonHtml(report)}</td><td class='query-col'><div class='resort-cell'><div class='resort-link-wrap'>${linkHtml}</div></div></td>`;
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

const _renderCompactGridSection = (reports, emptyMessage = "No resorts match the current filters.") => {
  const displayDays = _displayDays();
  const labels = reports.length
    ? Array.from({ length: displayDays }, (_, idx) => compactDailySummary.dayLabelFor(_dailyAt(reports[0], idx), idx))
    : _fallbackDayLabels(displayDays);
  const rows = reports.length ? reports.map((report) => {
    const attrs = _filterAttrs(report);
    const cells = Array.from({ length: displayDays }, (_, idx) => {
      const day = _dailyAt(report, idx);
      const style = compactDailySummary.dayStyle(day);
      const styleAttr = style ? ` style='${style}'` : "";
      return `<td class='compact-day-cell'${styleAttr}>${compactDailySummary.dayCellHtml(day, { unitMode: appState.compactSummaryUnitMode })}</td>`;
    }).join("");
    return `<tr${attrs}>${_resortCellHtml(report)}${cells}</tr>`;
  }).join("") : _emptyStateRow(2 + Math.max(1, displayDays), emptyMessage);
  return `
    <section>
      <div class="section-header">
        <h2>Daily Summary</h2>
        <div class="unit-toggle" role="group" aria-label="Daily Summary unit system" data-compact-summary-toggle="1" data-mode="${appState.compactSummaryUnitMode}">
          <button type="button" class="unit-btn" data-unit-mode="metric">Metric</button>
          <button type="button" class="unit-btn" data-unit-mode="imperial">Imperial</button>
        </div>
      </div>
      <div
        class="compact-grid-mobile-wrap"
        id="compact-grid-mobile-wrap"
        data-sticky-single-table-section="${STICKY_SINGLE_TABLE_SECTION_KEYS.dailySummary}"
        data-sticky-leading-cols="2"
        data-sticky-header-rows="1"
        data-sticky-max-visible-rows="10"
      >
        <table class="compact-grid-mobile-table" id="compact-grid-mobile-table">
          <colgroup><col class='col-favorite'><col class='col-query'>${Array.from({ length: displayDays }, () => "<col class='col-compact-day'>").join("")}</colgroup>
          <thead><tr><th class='favorite-col favorite-head'>${_favoriteAllButtonHtml(reports)}</th><th class='query-col'>Resort</th>${labels.map((label) => `<th>${_dayLabelHtml(label)}</th>`).join("")}</tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </section>`;
};

const _renderPrecipSection = (title, kind, metricUnit, imperialUnit, reports, options, emptyMessage = "No resorts match the current filters.") => {
  const displayDays = _displayDays();
  const dayLabels = reports.length
    ? Array.from({ length: displayDays }, (_, idx) => _dayLabelFor(reports[0], idx))
    : _fallbackDayLabels(displayDays);
  const weeklyHeaders = ["week 1", "week 2"];
  const favoriteAllButton = _favoriteAllButtonHtml(reports);
  if (appState.layoutMode === "compact") {
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
        <div class="${options.prefix}-split-wrap mobile-only">
          <div class="${options.prefix}-left-wrap" id="${options.prefix}-left-wrap-mobile">
            <table class="${options.prefix}-left-table">
              <colgroup><col class='col-favorite'><col class='col-query'></colgroup>
              <thead><tr><th rowspan='2' class='favorite-col favorite-head'>${favoriteAllButton}</th><th rowspan='2' class='query-col'>Resort</th></tr><tr></tr></thead>
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
  }
  const desktopRows = reports.length ? reports.map((report) => {
    const attrs = _filterAttrs(report);
    const weeklyValues = [
      options.week1(report),
      options.week2(report),
    ].map((value) => _metricCellHtml(_formatMetric(value), kind, options.color(value), "week-col-cell"));
    const dailyValues = Array.from({ length: displayDays }, (_, idx) => {
      const value = options.daily(_dailyAt(report, idx));
      return _metricCellHtml(_formatMetric(value), kind, options.color(value), "day-col-cell");
    }).join("");
    return `<tr${attrs}>${_resortCellHtml(report)}${weeklyValues.join("")}${dailyValues}</tr>`;
  }).join("") : _emptyStateRow(4 + Math.max(1, displayDays), emptyMessage);
  const stickySectionKey = options.sectionKey || options.prefix;
  return `
    <section>
      <div class="section-header">
        <h2>${title}</h2>
        <div class="unit-toggle" role="group" aria-label="${title} unit system" data-target-kind="${kind}">
          <button type="button" class="unit-btn" data-unit-mode="metric">${metricUnit}</button>
          <button type="button" class="unit-btn" data-unit-mode="imperial">${imperialUnit}</button>
        </div>
      </div>
      <div
        class="${options.prefix}-sticky-wrap desktop-only"
        id="${options.prefix}-sticky-wrap"
        data-sticky-single-table-section="${_escapeHtml(stickySectionKey)}"
        data-sticky-leading-cols="4"
        data-sticky-header-rows="2"
        data-sticky-max-visible-rows="10"
      >
        <table class="${options.prefix}-sticky-table">
          <colgroup><col class='col-favorite'><col class='col-query'><col class='col-week'><col class='col-week'>${Array.from({ length: displayDays }, () => "<col class='col-day'>").join("")}</colgroup>
          <thead><tr><th rowspan='2' class='favorite-col favorite-head'>${favoriteAllButton}</th><th rowspan='2' class='query-col'>Resort</th><th colspan='2' class='week-group'>Weekly</th><th colspan='${displayDays}'>Daily</th></tr><tr><th class='week-col-cell'>${weeklyHeaders[0]}</th><th class='week-col-cell'>${weeklyHeaders[1]}</th>${dayLabels.map((label) => `<th class='day-col-cell'>${_dayLabelHtml(label)}</th>`).join("")}</tr></thead>
          <tbody>${desktopRows}</tbody>
        </table>
      </div>
    </section>`;
};

const _renderTemperatureSection = (reports, emptyMessage = "No resorts match the current filters.") => {
  const displayDays = _displayDays();
  const labels = reports.length
    ? Array.from({ length: displayDays }, (_, idx) => _dayLabelFor(reports[0], idx))
    : _fallbackDayLabels(displayDays);
  const rows = reports.length ? reports.map((report) => {
    const attrs = _filterAttrs(report);
    const cells = Array.from({ length: displayDays }, (_, idx) => {
      const day = _dailyAt(report, idx);
      return [
        _metricCellHtml(_formatTemp(day.temperature_min_c), "temp", _tempColor(day.temperature_min_c)),
        _metricCellHtml(_formatTemp(day.temperature_max_c), "temp", _tempColor(day.temperature_max_c)),
      ].join("");
    }).join("");
    return `<tr${attrs}>${_resortCellHtml(report)}${cells}</tr>`;
  }).join("") : _emptyStateRow(2 + Math.max(1, displayDays * 2), emptyMessage);
  return `
    <section>
      <div class="section-header">
        <h2>Temperature</h2>
        <div class="unit-toggle" role="group" aria-label="Temperature unit system" data-target-kind="temp">
          <button type="button" class="unit-btn" data-unit-mode="metric">°C</button>
          <button type="button" class="unit-btn" data-unit-mode="imperial">°F</button>
        </div>
      </div>
      <div
        class="temperature-sticky-wrap"
        id="temperature-sticky-wrap"
        data-sticky-single-table-section="${STICKY_SINGLE_TABLE_SECTION_KEYS.temperature}"
        data-sticky-leading-cols="2"
        data-sticky-header-rows="2"
        data-sticky-max-visible-rows="10"
      >
        <table class="temperature-single-table" id="temperature-single-table">
          <colgroup><col class="col-favorite"><col class="col-query">${Array.from({ length: displayDays * 2 }, () => "<col class='col-temp'>").join("")}</colgroup>
          <thead><tr><th rowspan='2' class='favorite-col favorite-head'>${_favoriteAllButtonHtml(reports)}</th><th rowspan='2' class='query-col'>Resort</th>${labels.map((label) => `<th colspan='2'>${_dayLabelHtml(label)}</th>`).join("")}</tr><tr>${Array.from({ length: displayDays }, () => "<th>min</th><th>max</th>").join("")}</tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </section>`;
};

const _renderWeatherSection = (reports, emptyMessage = "No resorts match the current filters.") => {
  const displayDays = _displayDays();
  const labels = reports.length
    ? Array.from({ length: displayDays }, (_, idx) => _dayLabelFor(reports[0], idx))
    : _fallbackDayLabels(displayDays);
  const weatherCells = (report) => Array.from({ length: displayDays }, (_, idx) => {
    const code = _dailyAt(report, idx).weather_code;
    const title = code === null || code === undefined || code === "" ? "WMO code: unknown" : `WMO code: ${code}`;
    return `<td class='weather-emoji-cell' title='${_escapeHtml(title)}'>${_weatherEmoji(code)}</td>`;
  }).join("");
  if (appState.layoutMode === "compact") {
    const leftRows = reports.length ? reports.map((report) => `<tr${_filterAttrs(report)}>${_resortCellHtml(report)}</tr>`).join("") : _emptyStateRow(2, emptyMessage);
    const rightRows = reports.length ? reports.map((report) => {
      const attrs = _filterAttrs(report);
      return `<tr${attrs}>${weatherCells(report)}</tr>`;
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
  }
  const rows = reports.length ? reports.map((report) => `<tr${_filterAttrs(report)}>${_resortCellHtml(report)}${weatherCells(report)}</tr>`).join("") : _emptyStateRow(2 + Math.max(1, displayDays), emptyMessage);
  return `
    <section>
      <h2>Weather</h2>
      <div
        class='weather-table-wrap'
        id='weather-table-wrap'
        data-sticky-single-table-section='${STICKY_SINGLE_TABLE_SECTION_KEYS.weather}'
        data-sticky-leading-cols='2'
        data-sticky-header-rows='1'
        data-sticky-max-visible-rows='10'
      >
        <table class='weather-table' id='weather-table'>
          <colgroup><col class='col-favorite'><col class='col-query'>${Array.from({ length: displayDays }, () => "<col class='col-weather'>").join("")}</colgroup>
          <thead><tr><th class='favorite-col favorite-head'>${_favoriteAllButtonHtml(reports)}</th><th class='query-col'>Resort</th>${labels.map((label) => `<th>${_dayLabelHtml(label)}</th>`).join("")}</tr></thead>
          <tbody>${rows}</tbody>
        </table>
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
  const totalColumns = 2 + (displayDays * 2);
  const rows = reports.length ? reports.map((report) => {
    const attrs = _filterAttrs(report);
    const cells = Array.from({ length: displayDays }, (_, idx) => {
      const day = _dailyAt(report, idx);
      const sunriseRaw = hhmm(day.sunrise_local_hhmm || day.sunrise_iso);
      const sunsetRaw = hhmm(day.sunset_local_hhmm || day.sunset_iso);
      const sunrise = hhmm(sunriseRaw, appState.sunTimeToggleMode);
      const sunset = hhmm(sunsetRaw, appState.sunTimeToggleMode);
      return `<td data-sun-time-raw="${_escapeHtml(sunriseRaw)}">${_escapeHtml(sunrise)}</td><td data-sun-time-raw="${_escapeHtml(sunsetRaw)}">${_escapeHtml(sunset)}</td>`;
    }).join("");
    return `<tr${attrs}>${_resortCellHtml(report)}${cells}</tr>`;
  }).join("") : _emptyStateRow(totalColumns, emptyMessage);
  return `
    <section>
      <div class="section-header">
        <h2>Sunrise / Sunset</h2>
        <div class="unit-toggle" role="group" aria-label="Sunrise and sunset time format" data-sun-time-toggle="1" data-mode="${appState.sunTimeToggleMode}">
          <button type="button" class="unit-btn" data-unit-mode="metric">24h</button>
          <button type="button" class="unit-btn" data-unit-mode="imperial">12h</button>
        </div>
      </div>
      <div
        class="sun-single-wrap"
        id="sun-single-wrap"
        data-sticky-single-table-section="${STICKY_SINGLE_TABLE_SECTION_KEYS.sun}"
        data-sticky-leading-cols="2"
        data-sticky-header-rows="2"
        data-sticky-max-visible-rows="10"
      >
        <table class="sun-single-table" id="sun-single-table">
          <colgroup><col class="col-favorite"><col class="col-query">${Array.from({ length: displayDays * 2 }, () => "<col class='col-sun'>").join("")}</colgroup>
          <thead><tr><th rowspan='2' class='favorite-col favorite-head'>${_favoriteAllButtonHtml(reports)}</th><th rowspan='2' class='query-col'>Resort</th>${labels.map((label) => `<th colspan='2'>${_dayLabelHtml(label)}</th>`).join("")}</tr><tr>${Array.from({ length: displayDays }, () => "<th>sunrise</th><th>sunset</th>").join("")}</tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </section>`;
};

const _renderSections = (reports, emptyMessage = "No resorts match the current filters.") => [
  _renderCompactGridSection(reports, emptyMessage),
  _renderPrecipSection("Snowfall", "snow", "cm", "in", reports, {
    prefix: "snowfall",
    sectionKey: STICKY_SINGLE_TABLE_SECTION_KEYS.snowfall,
    week1: (report) => report.week1_total_snowfall_cm,
    week2: (report) => report.week2_total_snowfall_cm,
    daily: (day) => day.snowfall_cm,
    color: _snowColor,
  }, emptyMessage),
  _renderPrecipSection("Rainfall", "rain", "mm", "in", reports, {
    prefix: "rain",
    sectionKey: STICKY_SINGLE_TABLE_SECTION_KEYS.rainfall,
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
  const out = { pass_type: {}, region: {}, subregion: {}, country: {} };
  reports.forEach((report) => {
    const region = _normalizeSearch(report.region);
    if (region) out.region[region] = (out.region[region] || 0) + 1;
    const subregion = _normalizeSearch(report.subregion);
    if (subregion) out.subregion[subregion] = (out.subregion[subregion] || 0) + 1;
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
      subregion: meta.subregion && typeof meta.subregion === "object" ? meta.subregion : {},
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

const parseSubregionValues = (values) => {
  const out = [];
  values.forEach((raw) => {
    String(raw || "").split(",").map((value) => _normalizeSearch(value)).filter(Boolean).forEach((value) => out.push(value));
  });
  return Array.from(new Set(out));
};

const parseCountryValues = (values) => {
  const out = [];
  values.forEach((raw) => {
    String(raw || "")
      .split(",")
      .map((value) => String(value || "").trim().toUpperCase())
      .filter((value) => /^[A-Z]{2}$/.test(value))
      .forEach((value) => out.push(value));
  });
  return Array.from(new Set(out));
};

const normalizeSortBy = (value) => {
  const text = _normalizeSearch(value);
  if (text === "name") return "name";
  if (text === "favorites") return "favorites";
  if (text === "today_snow") return "today_snow";
  if (text === "week_snow") return "week_snow";
  if (text === "next_week_snow") return "next_week_snow";
  if (text === "two_week_snow") return "two_week_snow";
  return "state";
};

const _dailySnowfall = (report, index = 0) => _asFiniteNumber(_dailyAt(report, index).snowfall_cm);
const _weeklySnowfall = (report) => _asFiniteNumber(report && report.week1_total_snowfall_cm);
const _nextWeekSnowfall = (report) => _asFiniteNumber(report && report.week2_total_snowfall_cm);
const _twoWeekSnowfall = (report) => {
  const week1 = _weeklySnowfall(report);
  const week2 = _nextWeekSnowfall(report);
  if (week1 === null && week2 === null) return null;
  return (week1 || 0) + (week2 || 0);
};

const _sortLabel = (sortBy) => {
  if (sortBy === "name") return "Resort Name (A-Z)";
  if (sortBy === "favorites") return "Favorites First";
  if (sortBy === "today_snow") return "Today's Snowfall";
  if (sortBy === "week_snow") return "This Week's Snowfall";
  if (sortBy === "next_week_snow") return "Next Week's Snowfall";
  if (sortBy === "two_week_snow") return "Two-Week Snowfall";
  return "State (A-Z)";
};

const _subregionLabel = (value) => {
  const hit = SUBREGION_OPTIONS.find((option) => option.value === _normalizeSearch(value));
  return hit ? hit.label : String(value || "");
};

const _countryLabel = (value) => {
  const code = String(value || "").trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) return code;
  try {
    if (typeof Intl !== "undefined" && typeof Intl.DisplayNames === "function") {
      const display = new Intl.DisplayNames(["en"], { type: "region" });
      return display.of(code) || code;
    }
  } catch (error) {
    // Fallback to ISO code when display name lookup is unavailable.
  }
  return code;
};

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
      subregions: parseSubregionValues(Array.isArray(parsed.subregions) ? parsed.subregions : (parsed.subregion ? [parsed.subregion] : [])),
      countries: parseCountryValues(Array.isArray(parsed.countries) ? parsed.countries : (parsed.country ? [parsed.country] : [])),
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
      subregions: Array.from(appState.filterState.subregions).sort(),
      countries: Array.from(appState.filterState.countries).sort(),
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
  const urlSubregions = parseSubregionValues(params.getAll("subregion"));
  const urlCountries = parseCountryValues(params.getAll("country"));
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
  const metaSubregions = parseSubregionValues(
    Array.isArray(filterMetaApplied.subregion)
      ? filterMetaApplied.subregion
      : (filterMetaApplied.subregion ? [filterMetaApplied.subregion] : [])
  );
  const metaCountries = parseCountryValues(
    Array.isArray(filterMetaApplied.country)
      ? filterMetaApplied.country
      : (filterMetaApplied.country ? [filterMetaApplied.country] : [])
  );
  const metaSortBy = normalizeSortBy(filterMetaApplied.sort_by || "");
  const metaSearch = String(filterMetaApplied.search || "");
  const hasMetaSearchAll = Object.prototype.hasOwnProperty.call(filterMetaApplied, "search_all");
  const metaSearchAll = Boolean(filterMetaApplied.search_all);
  const hasMetaIncludeDefault = Object.prototype.hasOwnProperty.call(filterMetaApplied, "include_default");
  const metaIncludeDefault = Boolean(filterMetaApplied.include_default);
  const metaIncludeAll = Boolean(filterMetaApplied.include_all);
  const stored = loadStoredFilterState();

  const passTypes = urlPassTypes.length > 0 ? urlPassTypes : (stored ? stored.passTypes : metaPassTypes);
  const subregions = urlSubregions.length > 0 ? urlSubregions : (stored ? stored.subregions : metaSubregions);
  const countries = urlCountries.length > 0 ? urlCountries : (stored ? stored.countries : metaCountries);
  const sortBy = hasUrlSortBy ? urlSortBy : (stored ? stored.sortBy : metaSortBy);
  const search = urlSearch !== null ? urlSearch : (stored ? stored.search : metaSearch);
  const searchAll = hasUrlSearchAll ? urlSearchAll : (stored ? stored.searchAll : (hasMetaSearchAll ? metaSearchAll : true));
  const includeDefault = hasUrlIncludeDefault
    ? urlIncludeDefault
    : (hasUrlIncludeAll ? !urlIncludeAll : (stored ? stored.includeDefault : (hasMetaIncludeDefault ? metaIncludeDefault : !metaIncludeAll)));
  const favoritesOnly = stored ? stored.favoritesOnly : false;

  appState.filterState.passTypes = new Set(passTypes);
  appState.filterState.subregions = new Set(subregions);
  appState.filterState.countries = new Set(countries);
  appState.filterState.sortBy = sortBy;
  appState.filterState.includeDefault = includeDefault;
  appState.filterState.searchAll = searchAll;
  appState.filterState.search = String(search || "");
  appState.filterState.favoritesOnly = favoritesOnly;

  filterPassTypeInputs.forEach((input) => {
    input.checked = appState.filterState.passTypes.has(_normalizeSearch(input.value));
  });
  if (filterRegionOptions) {
    filterRegionOptions.querySelectorAll("input[name='filter-subregion']").forEach((input) => {
      input.checked = appState.filterState.subregions.has(_normalizeSearch(input.value));
    });
  }
  if (filterCountryOptions) {
    filterCountryOptions.querySelectorAll("input[name='filter-country']").forEach((input) => {
      input.checked = appState.filterState.countries.has(String(input.value || "").trim().toUpperCase());
    });
  }
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
  const selectedSubregions = filterRegionOptions
    ? Array.from(filterRegionOptions.querySelectorAll("input[name='filter-subregion']:checked")).map((input) => _normalizeSearch(input.value))
    : [];
  const selectedCountries = filterCountryOptions
    ? Array.from(filterCountryOptions.querySelectorAll("input[name='filter-country']:checked"))
      .map((input) => String(input.value || "").trim().toUpperCase())
      .filter((value) => /^[A-Z]{2}$/.test(value))
    : [];
  appState.filterState.subregions = new Set(selectedSubregions);
  appState.filterState.countries = new Set(selectedCountries);
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
  Array.from(appState.filterState.subregions).sort().forEach((subregion) => {
    if (subregion) params.append("subregion", subregion);
  });
  Array.from(appState.filterState.countries).sort().forEach((country) => {
    if (country) params.append("country", country);
  });
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
  const stateName = String(report.state_name || "").trim();
  const countryCode = String(report.country_code || report.country || "").trim();
  const countryName = String(report.country_name || "").trim();
  const city = String(report.city || "").trim();
  const address = String(report.address || "").trim();
  const searchTerms = Array.isArray(report.search_terms) ? report.search_terms.join(" ") : "";
  return _normalizeSearch(
    `${_displayName(report)} ${report.query || ""} ${state} ${stateName} ${countryCode} ${countryName} ${city} ${address} ${passTypes} ${searchTerms}`
  );
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
    if (appState.filterState.subregions.size > 0) {
      const reportSubregion = _normalizeSearch(report.subregion || report.region);
      if (!appState.filterState.subregions.has(reportSubregion)) return false;
    }
    if (appState.filterState.countries.size > 0) {
      const reportCountry = String(report.country_code || report.country || "").trim().toUpperCase();
      if (!appState.filterState.countries.has(reportCountry)) return false;
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
    if (sortBy === "next_week_snow") {
      const snowDelta = _compareBySnowDesc(a, b, _nextWeekSnowfall);
      if (snowDelta !== 0) return snowDelta;
    }
    if (sortBy === "two_week_snow") {
      const snowDelta = _compareBySnowDesc(a, b, _twoWeekSnowfall);
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
    if (appState.filterState.subregions.size > 0) {
      parts.push(`region: ${Array.from(appState.filterState.subregions).map((value) => _subregionLabel(value)).join(", ")}`);
    }
    if (appState.filterState.countries.size > 0) {
      parts.push(`country: ${Array.from(appState.filterState.countries).map((value) => _countryLabel(value)).join(", ")}`);
    }
    if (appState.filterState.sortBy !== "state") parts.push(`sort: ${_sortLabel(appState.filterState.sortBy)}`);
    if (appState.filterState.includeDefault && parts.length > 0) parts.push("scope: default");
    if (!appState.filterState.searchAll) parts.push("search: filtered");
  } else {
    parts.push("search: all resorts");
  }
  filterSummary.textContent = parts.length > 0
    ? `${parts.join(" | ")} | visible: ${scope}`
    : (appState.filterState.includeDefault ? `Default resorts (${scope})` : `All Epic + Ikon resorts (${scope})`);
};

const getLayoutModeForWidth = (width = window.innerWidth) => (width < MIN_DESKTOP_SNOW_3DAY_PX ? "compact" : "desktop");

const updateLayoutMode = () => {
  const layoutMode = getLayoutModeForWidth();
  appState.layoutMode = layoutMode;
  document.body.classList.toggle("mobile-simple", layoutMode === "compact");
  return layoutMode;
};

const isCompactLayout = () => appState.layoutMode === "compact";

const _mobileLeadingQueryCap = () => {
  const viewportWidth = Math.max(
    document.documentElement?.clientWidth || 0,
    window.innerWidth || 0,
  );
  return Math.max(0, Math.floor((viewportWidth / 2) - LEADING_FAVORITE_COL_PX));
};

const _resolveQueryColumnBounds = ({
  minWidth,
  maxWidth,
  capToMobileHalfScreen = false,
}) => {
  let resolvedMax = maxWidth;
  if (capToMobileHalfScreen && isCompactLayout()) {
    resolvedMax = Math.min(resolvedMax, _mobileLeadingQueryCap());
  }
  return {
    minWidth: Math.min(minWidth, resolvedMax),
    maxWidth: resolvedMax,
  };
};

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

const _autoSizeQueryOnly = ({
  tableSelector,
  wrapSelector,
  queryVarName,
  minWidth = 150,
  maxWidth = 240,
  padding = 28,
  capToMobileHalfScreen = false,
}) => {
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
  const bounds = _resolveQueryColumnBounds({ minWidth, maxWidth, capToMobileHalfScreen });
  wrap.style.setProperty(
    queryVarName,
    `${Math.max(bounds.minWidth, Math.min(bounds.maxWidth, Math.ceil(queryMax + padding)))}px`,
  );
};

const _autoSizeMobileQueryColumn = ({
  tableSelector,
  wrapSelector,
  minWidth,
  maxWidth,
  padding,
  capToMobileHalfScreen = false,
}) => {
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
  const bounds = _resolveQueryColumnBounds({ minWidth, maxWidth, capToMobileHalfScreen });
  const width = Math.max(
    bounds.minWidth,
    Math.min(
      bounds.maxWidth,
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
    [".snowfall-left-wrap#snowfall-left-wrap-mobile", ".snowfall-right-wrap#snowfall-right-wrap-mobile"],
    [".rain-left-wrap#rain-left-wrap-mobile", ".rain-right-wrap#rain-right-wrap-mobile"],
    [".weather-left-wrap", ".weather-right-wrap"],
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
  _autoSizeQueryOnly({
    tableSelector: ".compact-grid-mobile-table",
    wrapSelector: ".compact-grid-mobile-wrap",
    queryVarName: "--compact-mobile-query-w",
    minWidth: isCompactLayout() ? 120 : 150,
    maxWidth: isCompactLayout() ? 180 : 240,
    padding: isCompactLayout() ? 22 : 28,
    capToMobileHalfScreen: isCompactLayout(),
  });
  _autoSizeQueryOnly({
    tableSelector: ".temperature-sticky-wrap .temperature-single-table",
    wrapSelector: ".temperature-sticky-wrap",
    queryVarName: "--temp-query-w",
    minWidth: 150,
    maxWidth: 220,
    capToMobileHalfScreen: isCompactLayout(),
  });
  if (isCompactLayout()) {
    _autoSizeMobileQueryColumn({
      tableSelector: ".snowfall-left-wrap#snowfall-left-wrap-mobile .snowfall-left-table",
      wrapSelector: ".snowfall-left-wrap#snowfall-left-wrap-mobile",
      minWidth: 150,
      maxWidth: 240,
      padding: 22,
      capToMobileHalfScreen: true,
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
      capToMobileHalfScreen: true,
    });
    _autoSizeMobileRightColumns({
      tableSelector: ".rain-right-wrap#rain-right-wrap-mobile .rain-right-table",
      wrapSelector: ".rain-right-wrap#rain-right-wrap-mobile",
      weekSelector: "col.col-week-right",
      daySelector: "col.col-day",
      minWeekWidth: 92,
      minDayWidth: 62,
    });
    _autoSizeQueryOnly({
      tableSelector: ".weather-left-wrap .weather-left-table",
      wrapSelector: ".weather-left-wrap",
      queryVarName: "--weather-query-w",
      minWidth: 150,
      maxWidth: 220,
      capToMobileHalfScreen: true,
    });
    _autoSizeQueryOnly({
      tableSelector: ".sun-single-wrap .sun-single-table",
      wrapSelector: ".sun-single-wrap",
      queryVarName: "--sun-query-w",
      minWidth: 150,
      maxWidth: 220,
      capToMobileHalfScreen: true,
    });
    return;
  }
  _autoSizeQueryOnly({
    tableSelector: ".snowfall-sticky-wrap.desktop-only .snowfall-sticky-table",
    wrapSelector: ".snowfall-sticky-wrap.desktop-only",
    queryVarName: "--snowfall-query-w",
  });
  _autoSizeQueryOnly({
    tableSelector: ".rain-sticky-wrap.desktop-only .rain-sticky-table",
    wrapSelector: ".rain-sticky-wrap.desktop-only",
    queryVarName: "--rain-query-w",
  });
  _autoSizeQueryOnly({
    tableSelector: ".weather-table-wrap .weather-table",
    wrapSelector: ".weather-table-wrap",
    queryVarName: "--weather-query-w",
  });
  _autoSizeQueryOnly({
    tableSelector: ".sun-single-wrap .sun-single-table",
    wrapSelector: ".sun-single-wrap",
    queryVarName: "--sun-query-w",
  });
  _stretchColumnsToWrap({
    wrapSelector: ".sun-single-wrap",
    tableSelector: ".sun-single-table",
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
  const heights = [];
  for (let index = 0; index < count; index += 1) {
    heights.push(Math.max(leftRows[index].offsetHeight, rightRows[index].offsetHeight));
  }
  for (let index = 0; index < count; index += 1) {
    const targetHeight = heights[index];
    leftRows[index].style.height = `${targetHeight}px`;
    rightRows[index].style.height = `${targetHeight}px`;
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

const syncSplitTableHeights = () => {
  const tablePairs = isCompactLayout()
    ? [
      [".snowfall-left-wrap#snowfall-left-wrap-mobile .snowfall-left-table", ".snowfall-right-wrap#snowfall-right-wrap-mobile .snowfall-right-table", ".snowfall-split-wrap.mobile-only", "--snow-header-row1-h"],
      [".rain-left-wrap#rain-left-wrap-mobile .rain-left-table", ".rain-right-wrap#rain-right-wrap-mobile .rain-right-table", ".rain-split-wrap.mobile-only", "--rain-header-row1-h"],
      [".weather-left-table", ".weather-right-table", ".weather-split-wrap", "--weather-header-row1-h"],
    ]
    : [
      [".weather-left-table", ".weather-right-table", ".weather-split-wrap", "--weather-header-row1-h"],
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
};

let layoutFrame = 0;
let layoutObserver = null;
let dynamicPayloadAbortController = null;

const applyLayout = () => {
  if (layoutFrame) cancelAnimationFrame(layoutFrame);
  layoutFrame = requestAnimationFrame(() => {
    layoutFrame = 0;
    updateLayoutMode();
    autoSizeSplitTables();
    syncSplitTableHeights();
    if (typeof stickySingleTableLayout.applyFromDom === "function") {
      stickySingleTableLayout.applyFromDom({ root: pageContentRoot || document });
    }
    attachSplitScrollSync();
  });
};

const observeLayoutContainers = () => {
  if (!window.ResizeObserver) return;
  if (layoutObserver) layoutObserver.disconnect();
  layoutObserver = new ResizeObserver(() => applyLayout());
  const observed = new Set();
  [
    ".snowfall-sticky-wrap.desktop-only",
    ".snowfall-left-wrap#snowfall-left-wrap-mobile",
    ".snowfall-right-wrap#snowfall-right-wrap-mobile",
    ".rain-sticky-wrap.desktop-only",
    ".rain-left-wrap#rain-left-wrap-mobile",
    ".rain-right-wrap#rain-right-wrap-mobile",
    ".compact-grid-mobile-wrap",
    ".temperature-sticky-wrap",
    ".weather-left-wrap",
    ".weather-right-wrap",
    ".sun-single-wrap",
  ].forEach((selector) => {
    const element = document.querySelector(selector);
    if (!element || observed.has(element)) return;
    layoutObserver.observe(element);
    observed.add(element);
  });
  document.querySelectorAll("[data-sticky-single-table-section]").forEach((element) => {
    if (observed.has(element)) return;
    layoutObserver.observe(element);
    observed.add(element);
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
  const totalReports = _payloadReports().length;
  const keyword = _normalizeSearch(appState.filterState.search);
  const searchAllActive = Boolean(keyword) && appState.filterState.searchAll;
  const emptyMessage = !searchAllActive && appState.filterState.favoritesOnly && appState.favoriteResortIds.size === 0
    ? "No favorite resorts yet. Tap the heart icon to save some."
    : (appState.filterState.favoritesOnly
      ? "No favorite resorts match the current filters."
      : "No resorts match the current filters.");
  updateLayoutMode();
  pageContentRoot.innerHTML = _renderSections(visibleReports, emptyMessage);
  applyLayout();
  observeLayoutContainers();
  pageContentRoot.removeAttribute("data-loading");
  syncFilterSummary(visibleReports.length, totalReports);
  renderReportDate();
  applyUnitModes();
  document.body.classList.remove("units-pending");
};

const _SCROLLABLE_WRAP_SELECTORS = [
  ".compact-grid-mobile-wrap",
  ".snowfall-sticky-wrap.desktop-only",
  ".snowfall-left-wrap#snowfall-left-wrap-mobile",
  ".snowfall-right-wrap#snowfall-right-wrap-mobile",
  ".rain-sticky-wrap.desktop-only",
  ".rain-left-wrap#rain-left-wrap-mobile",
  ".rain-right-wrap#rain-right-wrap-mobile",
  ".temperature-sticky-wrap",
  ".weather-left-wrap",
  ".weather-right-wrap",
  ".sun-single-wrap",
];

const _captureWrapScrollPositions = () => {
  const entries = [];
  const seen = new Set();
  _SCROLLABLE_WRAP_SELECTORS.forEach((selector) => {
    const element = document.querySelector(selector);
    if (!element || seen.has(element)) return;
    entries.push({
      selector,
      sectionKey: "",
      scrollTop: element.scrollTop,
      scrollLeft: element.scrollLeft,
    });
    seen.add(element);
  });
  document.querySelectorAll("[data-sticky-single-table-section]").forEach((element) => {
    if (seen.has(element)) return;
    const sectionKey = String(element.getAttribute("data-sticky-single-table-section") || "").trim();
    entries.push({
      selector: "",
      sectionKey,
      scrollTop: element.scrollTop,
      scrollLeft: element.scrollLeft,
    });
    seen.add(element);
  });
  return entries;
};

const _restoreWrapScrollPositions = (positions) => {
  positions.forEach((entry) => {
    let element = null;
    if (entry.sectionKey) {
      const escapedSectionKey = String(entry.sectionKey).replace(/"/g, "\\\"");
      element = document.querySelector(`[data-sticky-single-table-section="${escapedSectionKey}"]`);
    }
    if (!element && entry.selector) {
      element = document.querySelector(entry.selector);
    }
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

const renderSubregionOptions = () => {
  if (!filterRegionOptions) return;
  const selected = appState.filterState.subregions;
  const counts = appState.availableFilters.subregion || {};
  const rows = SUBREGION_OPTIONS
    .filter((option) => Number(counts[option.value] || 0) > 0 || selected.has(option.value))
    .map((option) => {
      const count = Number(counts[option.value] || 0);
      const checked = selected.has(option.value) ? " checked" : "";
      const countHtml = count > 0 ? ` <span class=\"filter-count\">(${count})</span>` : "";
      return `<label><input type=\"checkbox\" name=\"filter-subregion\" value=\"${option.value}\"${checked} /> ${option.label}${countHtml}</label>`;
    });
  filterRegionOptions.innerHTML = rows.length > 0 ? rows.join("") : "<div class='filter-option-empty'>No region filters available.</div>";
};

const renderCountryOptions = () => {
  if (!filterCountryOptions) return;
  const selected = appState.filterState.countries;
  const counts = appState.availableFilters.country || {};
  const rows = Object.entries(counts)
    .filter(([code, count]) => /^[A-Z]{2}$/.test(code) && Number(count) > 0)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([code, count]) => {
      const checked = selected.has(code) ? " checked" : "";
      return `<label><input type=\"checkbox\" name=\"filter-country\" value=\"${code}\"${checked} /> ${_countryLabel(code)} <span class=\"filter-count\">(${count})</span></label>`;
    });
  filterCountryOptions.innerHTML = rows.length > 0 ? rows.join("") : "<div class='filter-option-empty'>No country filters available.</div>";
};

const updateFilterLabels = () => {
  document.querySelectorAll("[data-pass-count]").forEach((el) => {
    const key = _normalizeSearch(el.getAttribute("data-pass-count") || "");
    const count = Number((appState.availableFilters.pass_type || {})[key] || 0);
    el.textContent = count > 0 ? `(${count})` : "";
  });
  renderSubregionOptions();
  renderCountryOptions();
};

const closeFilterModal = () => {
  if (filterModal) filterModal.hidden = true;
};

const openFilterModal = () => {
  if (filterModal) filterModal.hidden = false;
};

const loadPayload = async (url = _resolvedDataUrl(), options = {}) => {
  const response = await fetch(url, options);
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload && payload.error ? payload.error : `HTTP ${response.status}`);
  }
  return payload;
};

const reloadDynamicPayloadForFilters = async () => {
  const endpoint = new URL(_resolvedDataUrl());
  endpoint.search = buildServerQueryParams().toString();
  if (dynamicPayloadAbortController) dynamicPayloadAbortController.abort();
  const controller = new AbortController();
  dynamicPayloadAbortController = controller;
  try {
    const payload = await loadPayload(endpoint.toString(), { signal: controller.signal });
    if (dynamicPayloadAbortController !== controller) return;
    appState.payload = payload;
    appState.reports = _payloadReports();
    appState.availableFilters = _availableFilters();
    updateFilterLabels();
  } finally {
    if (dynamicPayloadAbortController === controller) dynamicPayloadAbortController = null;
  }
};

const resetFilterControls = () => {
  filterPassTypeInputs.forEach((input) => { input.checked = false; });
  if (filterRegionOptions) {
    filterRegionOptions.querySelectorAll("input[name='filter-subregion']").forEach((input) => { input.checked = false; });
  }
  if (filterCountryOptions) {
    filterCountryOptions.querySelectorAll("input[name='filter-country']").forEach((input) => { input.checked = false; });
  }
  if (filterSortSelect) filterSortSelect.value = "week_snow";
  if (filterIncludeAllInput) filterIncludeAllInput.checked = true;
  if (filterSearchAllInput) filterSearchAllInput.checked = true;
  setFavoritesOnlyControls(false);
  if (resortSearchInput) resortSearchInput.value = "";
};

let scheduledFilterApplyTimeout = 0;

const cancelScheduledFilterApply = () => {
  if (!scheduledFilterApplyTimeout) return;
  window.clearTimeout(scheduledFilterApplyTimeout);
  scheduledFilterApplyTimeout = 0;
};

const scheduleApplyFilters = (delayMs = 120) => {
  cancelScheduledFilterApply();
  scheduledFilterApplyTimeout = window.setTimeout(() => {
    scheduledFilterApplyTimeout = 0;
    void applyFiltersImmediately();
  }, delayMs);
};

const applyFiltersImmediately = async () => {
  cancelScheduledFilterApply();
  applyFilterStateFromControls();
  syncUrlFromFilterState();
  if (_isDynamicApiDataUrl()) {
    try {
      await reloadDynamicPayloadForFilters();
    } catch (error) {
      if (error && error.name === "AbortError") return;
      if (pageContentRoot) {
        pageContentRoot.innerHTML = `<div class="page-load-error">${_escapeHtml(error instanceof Error ? error.message : String(error))}</div>`;
      }
      return;
    }
  }
  renderPage();
};

const bindControls = () => {
  if (resortSearchInput) {
    resortSearchInput.addEventListener("input", () => {
      scheduleApplyFilters();
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
  if (filterRegionOptions) filterRegionOptions.addEventListener("change", applyFiltersImmediately);
  if (filterCountryOptions) filterCountryOptions.addEventListener("change", applyFiltersImmediately);
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
    if (appState.payload && getLayoutModeForWidth() !== appState.layoutMode) {
      renderPagePreservingScroll();
      return;
    }
    applyLayout();
  }, { passive: true });
};

const initialize = async () => {
  Object.keys(appState.unitModes).forEach((kind) => {
    appState.unitModes[kind] = getStoredUnitMode(kind);
  });
  appState.compactSummaryUnitMode = getStoredUnitMode(COMPACT_SUMMARY_UNIT_KIND);
  appState.sunTimeToggleMode = getStoredUnitMode(SUN_TIME_TOGGLE_KIND);
  appState.favoriteResortIds = new Set(loadFavoriteResortIds());
  try {
    appState.payload = initialPayload || await loadPayload();
    appState.reports = _payloadReports();
    appState.availableFilters = _availableFilters();
    updateFilterLabels();
    applyControlsFromQueryOrMeta();
    renderPage();
  } catch (error) {
    if (pageContentRoot) {
      pageContentRoot.innerHTML = `<div class="page-load-error">${_escapeHtml(error instanceof Error ? error.message : String(error))}</div>`;
    }
    document.body.classList.remove("units-pending");
  }
};

bindControls();
void initialize();
