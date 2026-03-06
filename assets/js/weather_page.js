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
const filterApplyBtn = document.getElementById("filter-apply-btn");
const filterResetBtn = document.getElementById("filter-reset-btn");
const filterCloseBtn = document.getElementById("filter-close-btn");
const filterSummary = document.getElementById("filter-summary");
const filterRegionSelect = document.getElementById("filter-region-select");
const filterCountrySelect = document.getElementById("filter-country-select");
const filterSortSelect = document.getElementById("filter-sort-select");
const filterIncludeAllInput = document.getElementById("filter-include-all");
const filterSearchAllInput = document.getElementById("filter-search-all");
const filterPassTypeInputs = Array.from(document.querySelectorAll("input[name='filter-pass-type']"));

const UNIT_STORAGE_KEY_PREFIX = "closesnow_unit_mode_";
const VALID_UNIT_KINDS = new Set(["snow", "rain", "temp"]);
const DEFAULT_AVAILABLE_FILTERS = { pass_type: {}, region: {}, country: {} };
const MAX_DISPLAY_DAYS = 14;
const MIN_DESKTOP_SNOW_3DAY_PX = 554;

const appState = {
  payload: null,
  reports: [],
  availableFilters: DEFAULT_AVAILABLE_FILTERS,
  filterState: {
    passTypes: new Set(),
    region: "",
    country: "",
    sortBy: "state",
    includeDefault: true,
    searchAll: true,
    search: "",
  },
  unitModes: {
    snow: "metric",
    rain: "metric",
    temp: "metric",
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
  if (v <= 10) {
    if (v <= 0) return "background:#FFFFFF;";
    const x = v / 10;
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
  const defaultEnabled = report.ljcc_favorite ? "1" : "";
  return ` data-pass-types='${_escapeHtml(passTypes)}' data-region='${_escapeHtml(region)}' data-country='${_escapeHtml(country)}' data-state='${_escapeHtml(state)}' data-default-enabled='${_escapeHtml(defaultEnabled)}'`;
};

const _resortLinkHtml = (report) => {
  const text = _escapeHtml(report.query || "");
  const resortId = String(report.resort_id || "").trim();
  if (!resortId) return `<td class='query-col'>${text}</td>`;
  return `<td class='query-col'><a class='resort-link' href='resort/${encodeURIComponent(resortId)}'>${text}</a></td>`;
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
  const label = _formatDayLabel(_dailyAt(report, index).date);
  if (label) return label;
  return index === 0 ? "today" : `day ${index + 1}`;
};

const _renderPrecipSection = (title, kind, metricUnit, imperialUnit, reports, options) => {
  if (!reports.length) return `<section><h2>${title}</h2><p>No data</p></section>`;
  const displayDays = _displayDays();
  const dayLabels = Array.from({ length: displayDays }, (_, idx) => _dayLabelFor(reports[0], idx));
  const weeklyHeaders = ["week 1", "week 2"];
  const desktopLeftRows = reports.map((report) => {
    const attrs = _filterAttrs(report);
    const weeklyValues = [
      options.week1(report),
      options.week2(report),
    ].map((value) => _metricCellHtml(_formatMetric(value), kind, options.color(value)));
    return `<tr${attrs}>${_resortLinkHtml(report)}${weeklyValues.join("")}</tr>`;
  }).join("");
  const desktopRightRows = reports.map((report) => {
    const attrs = _filterAttrs(report);
    const dailyValues = Array.from({ length: displayDays }, (_, idx) => {
      const value = options.daily(_dailyAt(report, idx));
      return _metricCellHtml(_formatMetric(value), kind, options.color(value));
    }).join("");
    return `<tr${attrs}>${dailyValues}</tr>`;
  }).join("");
  const mobileLeftRows = reports.map((report) => `<tr${_filterAttrs(report)}>${_resortLinkHtml(report)}</tr>`).join("");
  const mobileRightRows = reports.map((report) => {
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
  }).join("");
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
            <colgroup><col class='col-query'><col class='col-week'><col class='col-week'></colgroup>
            <thead><tr><th rowspan='2' class='query-col'>Resort</th><th colspan='2'>weekly</th></tr><tr><th>${weeklyHeaders[0]}</th><th>${weeklyHeaders[1]}</th></tr></thead>
            <tbody>${desktopLeftRows}</tbody>
          </table>
        </div>
        <div class="${options.prefix}-right-wrap" id="${options.prefix}-right-wrap">
          <table class="${options.prefix}-right-table">
            <colgroup>${Array.from({ length: displayDays }, () => "<col class='col-day'>").join("")}</colgroup>
            <thead><tr><th colspan='${displayDays}'>daily</th></tr><tr>${dayLabels.map((label) => `<th>${_dayLabelHtml(label)}</th>`).join("")}</tr></thead>
            <tbody>${desktopRightRows}</tbody>
          </table>
        </div>
      </div>
      <div class="${options.prefix}-split-wrap mobile-only">
        <div class="${options.prefix}-left-wrap" id="${options.prefix}-left-wrap-mobile">
          <table class="${options.prefix}-left-table">
            <colgroup><col class='col-query'></colgroup>
            <thead><tr><th rowspan='2' class='query-col'>Resort</th></tr><tr></tr></thead>
            <tbody>${mobileLeftRows}</tbody>
          </table>
        </div>
        <div class="${options.prefix}-right-wrap" id="${options.prefix}-right-wrap-mobile">
          <table class="${options.prefix}-right-table">
            <colgroup><col class='col-week-right'><col class='col-week-right'>${Array.from({ length: displayDays }, () => "<col class='col-day'>").join("")}</colgroup>
            <thead><tr><th class='week-group' colspan='2'>weekly</th><th colspan='${displayDays}'>daily</th></tr><tr><th class='week-col-cell'>week 1</th><th class='week-col-cell'>week 2</th>${dayLabels.map((label) => `<th>${_dayLabelHtml(label)}</th>`).join("")}</tr></thead>
            <tbody>${mobileRightRows}</tbody>
          </table>
        </div>
      </div>
    </section>`;
};

const _renderTemperatureSection = (reports) => {
  if (!reports.length) return "<section><h2>Temperature</h2><p>No data</p></section>";
  const displayDays = _displayDays();
  const labels = Array.from({ length: displayDays }, (_, idx) => _dayLabelFor(reports[0], idx));
  const leftRows = reports.map((report) => `<tr${_filterAttrs(report)}>${_resortLinkHtml(report)}</tr>`).join("");
  const rightRows = reports.map((report) => {
    const attrs = _filterAttrs(report);
    const cells = Array.from({ length: displayDays }, (_, idx) => {
      const day = _dailyAt(report, idx);
      return [
        _metricCellHtml(_formatTemp(day.temperature_min_c), "temp", _tempColor(day.temperature_min_c)),
        _metricCellHtml(_formatTemp(day.temperature_max_c), "temp", _tempColor(day.temperature_max_c)),
      ].join("");
    }).join("");
    return `<tr${attrs}>${cells}</tr>`;
  }).join("");
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
            <colgroup><col class="col-query"></colgroup>
            <thead><tr><th rowspan='2' class='query-col'>Resort</th></tr><tr></tr></thead>
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

const _renderWeatherSection = (reports) => {
  if (!reports.length) return "<section><h2>Weather</h2><p>No data</p></section>";
  const displayDays = _displayDays();
  const labels = Array.from({ length: displayDays }, (_, idx) => _dayLabelFor(reports[0], idx));
  const leftRows = reports.map((report) => `<tr${_filterAttrs(report)}>${_resortLinkHtml(report)}</tr>`).join("");
  const rightRows = reports.map((report) => {
    const attrs = _filterAttrs(report);
    const cells = Array.from({ length: displayDays }, (_, idx) => {
      const code = _dailyAt(report, idx).weather_code;
      const title = code === null || code === undefined || code === "" ? "WMO code: unknown" : `WMO code: ${code}`;
      return `<td class='weather-emoji-cell' title='${_escapeHtml(title)}'>${_weatherEmoji(code)}</td>`;
    }).join("");
    return `<tr${attrs}>${cells}</tr>`;
  }).join("");
  return `
    <section>
      <h2>Weather</h2>
      <div class='weather-split-wrap'>
        <div class='weather-left-wrap' id='weather-left-wrap'>
          <table class='weather-left-table' id='weather-left-table'>
            <colgroup><col class='col-query'></colgroup>
            <thead><tr><th rowspan='2' class='query-col'>Resort</th></tr><tr></tr></thead>
            <tbody>${leftRows}</tbody>
          </table>
        </div>
        <div class='weather-right-wrap' id='weather-right-wrap'>
          <table class='weather-right-table' id='weather-right-table'>
            <colgroup>${Array.from({ length: displayDays }, () => "<col class='col-weather'>").join("")}</colgroup>
            <thead><tr><th colspan='${displayDays}'>daily</th></tr><tr>${labels.map((label) => `<th>${_dayLabelHtml(label)}</th>`).join("")}</tr></thead>
            <tbody>${rightRows}</tbody>
          </table>
        </div>
      </div>
    </section>`;
};

const _renderSunSection = (reports) => {
  if (!reports.length) return "<section><h2>Sunrise / Sunset</h2><p>No data</p></section>";
  const displayDays = _displayDays();
  const labels = Array.from({ length: displayDays }, (_, idx) => _dayLabelFor(reports[0], idx));
  const hhmm = (raw) => {
    const text = String(raw || "").trim();
    if (!text) return "";
    if (text.includes("T")) return text.split("T", 2)[1].slice(0, 5);
    return text.slice(0, 5);
  };
  const leftRows = reports.map((report) => `<tr${_filterAttrs(report)}>${_resortLinkHtml(report)}</tr>`).join("");
  const rightRows = reports.map((report) => {
    const attrs = _filterAttrs(report);
    const cells = Array.from({ length: displayDays }, (_, idx) => {
      const day = _dailyAt(report, idx);
      const sunrise = hhmm(day.sunrise_local_hhmm || day.sunrise_iso);
      const sunset = hhmm(day.sunset_local_hhmm || day.sunset_iso);
      return `<td>${_escapeHtml(sunrise)}</td><td>${_escapeHtml(sunset)}</td>`;
    }).join("");
    return `<tr${attrs}>${cells}</tr>`;
  }).join("");
  return `
    <section>
      <h2>Sunrise / Sunset</h2>
      <div class="sun-split-wrap">
        <div class="sun-left-wrap" id="sun-left-wrap">
          <table class="sun-left-table" id="sun-left-table">
            <colgroup><col class="col-query"></colgroup>
            <thead><tr><th rowspan='2' class='query-col'>Resort</th></tr><tr></tr></thead>
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

const _renderSections = (reports) => [
  _renderPrecipSection("Snowfall", "snow", "cm", "in", reports, {
    prefix: "snowfall",
    week1: (report) => report.week1_total_snowfall_cm,
    week2: (report) => report.week2_total_snowfall_cm,
    daily: (day) => day.snowfall_cm,
    color: _snowColor,
  }),
  _renderPrecipSection("Rainfall", "rain", "mm", "in", reports, {
    prefix: "rain",
    week1: (report) => report.week1_total_rain_mm,
    week2: (report) => report.week2_total_rain_mm,
    daily: (day) => day.rain_mm,
    color: _rainColor,
  }),
  _renderTemperatureSection(reports),
  _renderWeatherSection(reports),
  _renderSunSection(reports),
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
  return text === "name" ? "name" : "state";
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

  const passTypes = urlPassTypes.length > 0 ? urlPassTypes : metaPassTypes;
  const region = urlRegion || metaRegion;
  const country = urlCountry || metaCountry;
  const sortBy = hasUrlSortBy ? urlSortBy : metaSortBy;
  const search = urlSearch !== null ? urlSearch : metaSearch;
  const searchAll = hasUrlSearchAll ? urlSearchAll : (hasMetaSearchAll ? metaSearchAll : true);
  const includeDefault = hasUrlIncludeDefault
    ? urlIncludeDefault
    : (hasUrlIncludeAll ? !urlIncludeAll : (hasMetaIncludeDefault ? metaIncludeDefault : !metaIncludeAll));

  appState.filterState.passTypes = new Set(passTypes);
  appState.filterState.region = region;
  appState.filterState.country = country;
  appState.filterState.sortBy = sortBy;
  appState.filterState.includeDefault = includeDefault;
  appState.filterState.searchAll = searchAll;
  appState.filterState.search = String(search || "");

  filterPassTypeInputs.forEach((input) => {
    input.checked = appState.filterState.passTypes.has(_normalizeSearch(input.value));
  });
  if (filterRegionSelect) filterRegionSelect.value = region;
  if (filterCountrySelect) filterCountrySelect.value = country;
  if (filterSortSelect) filterSortSelect.value = sortBy;
  if (filterIncludeAllInput) filterIncludeAllInput.checked = includeDefault;
  if (filterSearchAllInput) filterSearchAllInput.checked = searchAll;
  if (resortSearchInput) resortSearchInput.value = appState.filterState.search;
};

const applyFilterStateFromControls = () => {
  appState.filterState.passTypes = new Set(
    filterPassTypeInputs.map((input) => _normalizeSearch(input.value)).filter((value, index) => filterPassTypeInputs[index].checked)
  );
  appState.filterState.region = _normalizeSearch(filterRegionSelect ? filterRegionSelect.value : "");
  appState.filterState.country = (filterCountrySelect ? filterCountrySelect.value : "").trim().toUpperCase();
  appState.filterState.sortBy = normalizeSortBy(filterSortSelect ? filterSortSelect.value : "state");
  appState.filterState.includeDefault = filterIncludeAllInput ? Boolean(filterIncludeAllInput.checked) : true;
  appState.filterState.searchAll = filterSearchAllInput ? Boolean(filterSearchAllInput.checked) : true;
  appState.filterState.search = resortSearchInput ? String(resortSearchInput.value || "") : "";
};

const buildFilterQueryParams = () => {
  const params = new URLSearchParams();
  Array.from(appState.filterState.passTypes).sort().forEach((passType) => params.append("pass_type", passType));
  if (appState.filterState.region) params.set("region", appState.filterState.region);
  if (appState.filterState.country) params.set("country", appState.filterState.country);
  if (appState.filterState.sortBy !== "state") params.set("sort_by", appState.filterState.sortBy);
  params.set("include_default", appState.filterState.includeDefault ? "1" : "0");
  params.set("search_all", appState.filterState.searchAll ? "1" : "0");
  const keyword = appState.filterState.search.trim();
  if (keyword) params.set("search", keyword);
  return params;
};

const syncUrlFromFilterState = () => {
  const nextParams = buildFilterQueryParams();
  const currentUrl = new URL(window.location.href);
  const currentQuery = currentUrl.search.replace(/^\?/, "");
  const nextQuery = nextParams.toString();
  if (currentQuery === nextQuery) return false;
  currentUrl.search = nextQuery;
  window.history.replaceState({}, "", currentUrl.toString());
  return true;
};

const _rowSearchText = (report) => {
  const passTypes = Array.isArray(report.pass_types) ? report.pass_types.join(" ") : "";
  const state = String(report.admin1 || "").trim();
  return _normalizeSearch(`${report.query || ""} ${state} ${passTypes}`);
};

const _isDefaultResort = (report) => Boolean(report.ljcc_favorite);

const _filteredReports = () => {
  const keyword = _normalizeSearch(appState.filterState.search);
  const reports = _payloadReports();
  const filtered = reports.filter((report) => {
    if (keyword && !_rowSearchText(report).includes(keyword)) return false;
    if (keyword && appState.filterState.searchAll) return true;
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
    if (sortBy === "name") return String(a.query || "").localeCompare(String(b.query || ""));
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

const getStoredUnitMode = (kind) => {
  try {
    const saved = localStorage.getItem(`${UNIT_STORAGE_KEY_PREFIX}${kind}`);
    return saved === "imperial" || saved === "metric" ? saved : "metric";
  } catch (error) {
    return "metric";
  }
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
  syncToggleButtons();
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
};

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
  pageContentRoot.innerHTML = _renderSections(visibleReports);
  pageContentRoot.removeAttribute("data-loading");
  syncFilterSummary(visibleReports.length, _payloadReports().length);
  renderReportDate();
  applyUnitModes();
  updateLayoutMode();
  document.body.classList.remove("units-pending");
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

const loadPayload = async () => {
  const dataUrl = String(pageBootstrap.dataUrl || "").trim();
  if (!dataUrl) throw new Error("Missing dataUrl bootstrap.");
  const response = await fetch(new URL(dataUrl, window.location.href).toString());
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload && payload.error ? payload.error : `HTTP ${response.status}`);
  }
  return payload;
};

const resetFilterControls = () => {
  filterPassTypeInputs.forEach((input) => { input.checked = false; });
  if (filterRegionSelect) filterRegionSelect.value = "";
  if (filterCountrySelect) filterCountrySelect.value = "";
  if (filterSortSelect) filterSortSelect.value = "state";
  if (filterIncludeAllInput) filterIncludeAllInput.checked = true;
  if (filterSearchAllInput) filterSearchAllInput.checked = true;
  if (resortSearchInput) resortSearchInput.value = "";
};

const bindControls = () => {
  if (resortSearchInput) {
    resortSearchInput.addEventListener("input", () => {
      applyFilterStateFromControls();
      syncUrlFromFilterState();
      renderPage();
    });
  }
  if (resortSearchClear) {
    resortSearchClear.addEventListener("click", () => {
      if (resortSearchInput) resortSearchInput.value = "";
      applyFilterStateFromControls();
      syncUrlFromFilterState();
      renderPage();
    });
  }
  if (filterOpenBtn) filterOpenBtn.addEventListener("click", openFilterModal);
  if (filterCloseBtn) filterCloseBtn.addEventListener("click", closeFilterModal);
  if (filterApplyBtn) {
    filterApplyBtn.addEventListener("click", () => {
      applyFilterStateFromControls();
      syncUrlFromFilterState();
      closeFilterModal();
      renderPage();
    });
  }
  if (filterResetBtn) {
    filterResetBtn.addEventListener("click", () => {
      resetFilterControls();
      applyFilterStateFromControls();
      syncUrlFromFilterState();
      closeFilterModal();
      renderPage();
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
    const button = event.target.closest(".unit-btn[data-unit-mode]");
    if (!button) return;
    const group = button.closest(".unit-toggle[data-target-kind]");
    if (!group) return;
    const kind = group.getAttribute("data-target-kind");
    const mode = button.getAttribute("data-unit-mode");
    setUnitMode(kind, mode);
  });
  window.addEventListener("resize", updateLayoutMode, { passive: true });
};

const initialize = async () => {
  Object.keys(appState.unitModes).forEach((kind) => {
    appState.unitModes[kind] = getStoredUnitMode(kind);
  });
  try {
    appState.payload = await loadPayload();
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
