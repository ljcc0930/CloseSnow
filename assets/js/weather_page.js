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
const DEFAULT_AVAILABLE_FILTERS = { pass_type: {}, region: {}, subregion: {} };
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
const compactDailySummary = window.CloseSnowCompactDailySummary || {};
const filterStateHelpers = window.CloseSnowFilterState || {};
const COMPACT_SUMMARY_UNIT_KIND = "compact_summary";
const SUN_TIME_TOGGLE_KIND = "sun_time";
const appState = {
  payload: null,
  reports: [],
  availableFilters: DEFAULT_AVAILABLE_FILTERS,
  favoriteResortIds: new Set(),
  filterState: {
    passTypes: new Set(),
    subregions: new Set(),
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
  forecastTab: "summary",
};

const weatherPageFormatters = window.CloseSnowWeatherPageFormatters || {};
const {
  isTruthyParam: _isTruthyParam,
  normalizeSearch: _normalizeSearch,
} = weatherPageFormatters;

const _errorMessage = (error) => (error instanceof Error ? error.message : String(error));

const renderPageLoadError = (error) => {
  if (!pageContentRoot) return;
  const el = document.createElement("div");
  el.className = "page-load-error";
  el.textContent = _errorMessage(error);
  pageContentRoot.replaceChildren(el);
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

const reportModel = window.CloseSnowWeatherReportModel;
const weatherSections = window.CloseSnowWeatherSections;
const sectionRenderer = weatherSections.createRenderer({
  state: appState,
  formatters: weatherPageFormatters,
  compactDailySummary,
  weatherCode: window.CloseSnowWeatherCode,
  reportModel,
});
const {
  getLayoutModeForWidth, updateLayoutMode, applyLayout, observeLayoutContainers,
} = window.CloseSnowWeatherTableLayout.createController({
  state: appState,
  window,
  document,
  contentRoot: pageContentRoot,
  stickySingleTableLayout: window.CloseSnowStickySingleTableLayout,
});
const _isFavoriteResortId = (resortId) => appState.favoriteResortIds.has(String(resortId || "").trim());

const _payloadReports = () => reportModel.payloadReports(appState.payload);
const _deriveAvailableFiltersFromReports = reportModel.deriveAvailableFilters;

const _availableFilters = () => {
  const meta = filterMetaAvailable;
  if (meta && typeof meta === "object" && Object.keys(meta).length > 0) {
    return {
      pass_type: meta.pass_type && typeof meta.pass_type === "object" ? meta.pass_type : {},
      region: meta.region && typeof meta.region === "object" ? meta.region : {},
      subregion: meta.subregion && typeof meta.subregion === "object" ? meta.subregion : {},
    };
  }
  return _deriveAvailableFiltersFromReports(_payloadReports());
};

const parsePassTypeValues = filterStateHelpers.parsePassTypeValues;
const parseSubregionValues = filterStateHelpers.parseSubregionValues;
const normalizeSortBy = filterStateHelpers.normalizeSortBy;

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

const loadStoredFilterState = () => filterStateHelpers.loadStoredFilterState(localStorage, FILTER_STORAGE_KEY);

const persistFilterState = () => {
  filterStateHelpers.persistFilterState(localStorage, FILTER_STORAGE_KEY, appState.filterState);
};

const applyControlsFromQueryOrMeta = () => {
  const params = new URLSearchParams(window.location.search);
  const urlPassTypes = parsePassTypeValues(params.getAll("pass_type"));
  const urlSubregions = parseSubregionValues(params.getAll("subregion"));
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
  const sortBy = hasUrlSortBy ? urlSortBy : (stored ? stored.sortBy : metaSortBy);
  const search = urlSearch !== null ? urlSearch : (stored ? stored.search : metaSearch);
  const searchAll = hasUrlSearchAll ? urlSearchAll : (stored ? stored.searchAll : (hasMetaSearchAll ? metaSearchAll : true));
  const includeDefault = hasUrlIncludeDefault
    ? urlIncludeDefault
    : (hasUrlIncludeAll ? !urlIncludeAll : (stored ? stored.includeDefault : (hasMetaIncludeDefault ? metaIncludeDefault : !metaIncludeAll)));
  const favoritesOnly = stored ? stored.favoritesOnly : false;

  appState.filterState.passTypes = new Set(passTypes);
  appState.filterState.subregions = new Set(subregions);
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
  appState.filterState.subregions = new Set(selectedSubregions);
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
  if (appState.filterState.search) params.set("search", appState.filterState.search);
  params.set("search_all", appState.filterState.searchAll ? "1" : "0");
  if (appState.filterState.includeDefault) {
    params.set("include_default", "1");
  } else {
    params.set("include_all", "1");
  }
  return params;
};

const _filteredReports = () => reportModel.selectReports(
  _payloadReports(), appState.filterState, appState.favoriteResortIds,
);

const syncFilterSummary = (visibleReports) => {
  if (!filterSummary) return;
  filterSummary.textContent = `${visibleReports} resort${visibleReports === 1 ? "" : "s"}`;
};

let dynamicPayloadAbortController = null;

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
      button.setAttribute("aria-pressed", String(button.getAttribute("data-unit-mode") === mode));
    });
  });
};

const syncSunTimeToggle = () => {
  document.querySelectorAll(".unit-toggle[data-sun-time-toggle='1']").forEach((toggle) => {
    const mode = appState.sunTimeToggleMode || "metric";
    toggle.setAttribute("data-mode", mode);
    toggle.querySelectorAll(".unit-btn[data-unit-mode]").forEach((button) => {
      button.classList.toggle("is-active", button.getAttribute("data-unit-mode") === mode);
      button.setAttribute("aria-pressed", String(button.getAttribute("data-unit-mode") === mode));
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
  document.querySelectorAll("[data-compact-unit-label]").forEach((el) => {
    const kind = String(el.getAttribute("data-compact-unit-label") || "").trim();
    if (kind === "snow") el.textContent = mode === "imperial" ? "in" : "cm";
    if (kind === "temp") el.textContent = mode === "imperial" ? "°F" : "°C";
    if (kind === "rain") el.textContent = mode === "imperial" ? "in" : "mm";
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
      button.setAttribute("aria-pressed", String(button.getAttribute("data-unit-mode") === mode));
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

const renderReportDate = () => {
  if (!reportDateEl) return;
  const raw = appState.payload && appState.payload.generated_at_utc
    ? appState.payload.generated_at_utc
    : reportDateEl.getAttribute("data-generated-utc");
  const utcDate = raw ? new Date(raw) : null;
  if (!utcDate || Number.isNaN(utcDate.getTime())) return;
  reportDateEl.title = `Forecast generated ${utcDate.toISOString()}`;
  reportDateEl.textContent = `Generated ${utcDate.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZoneName: "short",
  })}`;
};

let pageRenderRevision = 0;
const renderPage = () => {
  if (!pageContentRoot || !appState.payload) return;
  pageRenderRevision += 1;
  const visibleReports = _filteredReports();
  const keyword = _normalizeSearch(appState.filterState.search);
  const searchAllActive = Boolean(keyword) && appState.filterState.searchAll;
  const emptyMessage = !searchAllActive && appState.filterState.favoritesOnly && appState.favoriteResortIds.size === 0
    ? "No favorite resorts yet. Tap the heart icon to save some."
    : (appState.filterState.favoritesOnly
      ? "No favorite resorts match the current filters."
      : "No resorts match the current filters.");
  const tabStripScrollLeft = pageContentRoot.querySelector(".forecast-tabs")?.scrollLeft || 0;
  updateLayoutMode();
  pageContentRoot.innerHTML = sectionRenderer.render(visibleReports, emptyMessage);
  const tabStrip = pageContentRoot.querySelector(".forecast-tabs");
  if (tabStrip) tabStrip.scrollLeft = tabStripScrollLeft;
  applyLayout();
  observeLayoutContainers();
  pageContentRoot.removeAttribute("data-loading");
  syncFilterSummary(visibleReports.length);
  renderReportDate();
  applyUnitModes();
  document.body.classList.remove("units-pending");
};

const _SCROLLABLE_WRAP_SELECTORS = [
  ".compact-grid-mobile-wrap",
  ".snowfall-sticky-wrap.desktop-only",
  ".snowfall-sticky-wrap.mobile-only",
  ".rain-sticky-wrap.desktop-only",
  ".rain-sticky-wrap.mobile-only",
  ".temperature-sticky-wrap",
  ".weather-table-wrap",
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
      sectionKey: String(element.getAttribute("data-sticky-single-table-section") || "").trim(),
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

const forecastTabScrollPositions = new Map();

const focusForecastControl = (element) => {
  if (!element) return;
  element.focus({ preventScroll: true });
  if (!element.hasAttribute("data-forecast-tab")) return;
  const tabStrip = element.closest(".forecast-tabs");
  if (!tabStrip) return;
  const tabBounds = element.getBoundingClientRect();
  const stripBounds = tabStrip.getBoundingClientRect();
  if (tabBounds.left < stripBounds.left) tabStrip.scrollLeft -= stripBounds.left - tabBounds.left;
  if (tabBounds.right > stripBounds.right) tabStrip.scrollLeft += tabBounds.right - stripBounds.right;
};

const renderPagePreservingScroll = ({ positions, focusTab } = {}) => {
  const scrollX = window.scrollX;
  const scrollY = window.scrollY;
  const wrapScrollPositions = positions || _captureWrapScrollPositions();
  const activeElement = document.activeElement;
  const focusedWithinContent = Boolean(activeElement && pageContentRoot?.contains(activeElement));
  const favoriteId = activeElement?.getAttribute("data-resort-id");
  const favoriteAll = activeElement?.hasAttribute("data-favorite-all");
  const activeId = activeElement?.id;
  renderPage();
  const revision = pageRenderRevision;
  let focusTarget = focusTab ? document.getElementById(`forecast-tab-${focusTab}`) : null;
  if (!focusTarget && focusedWithinContent) {
    if (activeId) focusTarget = document.getElementById(activeId);
    if (!focusTarget && favoriteId) {
      focusTarget = Array.from(pageContentRoot.querySelectorAll(".favorite-btn[data-resort-id]"))
        .find((button) => button.getAttribute("data-resort-id") === favoriteId);
    }
    if (!focusTarget && favoriteAll) focusTarget = pageContentRoot.querySelector(".favorite-all-btn");
    if (!focusTarget) focusTarget = document.getElementById(`forecast-tab-${appState.forecastTab}`);
  }
  focusForecastControl(focusTarget);
  window.requestAnimationFrame(() => {
    if (revision !== pageRenderRevision) return;
    _restoreWrapScrollPositions(wrapScrollPositions);
    window.scrollTo(scrollX, scrollY);
    window.requestAnimationFrame(() => {
      if (revision !== pageRenderRevision) return;
      _restoreWrapScrollPositions(wrapScrollPositions);
      window.scrollTo(scrollX, scrollY);
    });
  });
};

const activateForecastTab = (key) => {
  const nextTab = weatherSections.resolveTab(key);
  if (nextTab === appState.forecastTab) {
    focusForecastControl(document.getElementById(`forecast-tab-${nextTab}`));
    return;
  }
  forecastTabScrollPositions.set(appState.forecastTab, _captureWrapScrollPositions());
  appState.forecastTab = nextTab;
  renderPagePreservingScroll({
    positions: forecastTabScrollPositions.get(nextTab) || [],
    focusTab: nextTab,
  });
  // Only an explicit tab change enters; initial loads, filters, units, and
  // favorites stay immediate. Replaced panels cannot queue stale animations.
  document.getElementById(`forecast-panel-${nextTab}`)?.classList.add("is-entering");
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

const updateFilterLabels = () => {
  document.querySelectorAll("[data-pass-count]").forEach((el) => {
    const key = _normalizeSearch(el.getAttribute("data-pass-count") || "");
    const count = Number((appState.availableFilters.pass_type || {})[key] || 0);
    el.textContent = count > 0 ? `(${count})` : "";
  });
  renderSubregionOptions();
};

let modalReturnFocus = null;
let modalBodyOverflow = "";
const modalBackgroundState = new Map();

const closeFilterModal = () => {
  if (!filterModal || filterModal.hidden) return;
  filterModal.hidden = true;
  filterOpenBtn?.setAttribute("aria-expanded", "false");
  document.body.style.overflow = modalBodyOverflow;
  modalBackgroundState.forEach((wasInert, element) => { element.inert = wasInert; });
  modalBackgroundState.clear();
  modalReturnFocus?.focus({ preventScroll: true });
};

const openFilterModal = () => {
  if (!filterModal || !filterModal.hidden) return;
  modalReturnFocus = document.activeElement;
  modalBodyOverflow = document.body.style.overflow;
  filterModal.hidden = false;
  filterOpenBtn?.setAttribute("aria-expanded", "true");
  document.body.style.overflow = "hidden";
  // The dialog is nested in main; make siblings at each level inert.
  let branch = filterModal;
  while (branch.parentElement && branch !== document.body) {
    Array.from(branch.parentElement.children).forEach((element) => {
      if (element === branch || !(element instanceof HTMLElement)) return;
      modalBackgroundState.set(element, element.inert);
      element.inert = true;
    });
    branch = branch.parentElement;
  }
  filterModal.querySelector("input, button, select")?.focus();
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
      renderPageLoadError(error);
      return;
    }
  }
  renderPagePreservingScroll();
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
    filterModal.addEventListener("keydown", (event) => {
      if (event.key !== "Tab") return;
      const controls = Array.from(filterModal.querySelectorAll("input, button, select, a[href], [tabindex='0']"))
        .filter((element) => !element.disabled && element.getClientRects().length > 0);
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    });
  }
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && filterModal && !filterModal.hidden) closeFilterModal();
    const tab = event.target.closest("[data-forecast-tab]");
    if (!tab) return;
    const nextTab = weatherSections.tabForKey(tab.getAttribute("data-forecast-tab"), event.key);
    if (!nextTab) return;
    event.preventDefault();
    activateForecastTab(nextTab);
  });
  document.addEventListener("click", (event) => {
    const tab = event.target.closest("[data-forecast-tab]");
    if (tab) {
      activateForecastTab(tab.getAttribute("data-forecast-tab"));
      return;
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
      setCompactSummaryUnitMode(button.getAttribute("data-unit-mode"));
      return;
    }
    const sunTimeToggle = button.closest(".unit-toggle[data-sun-time-toggle='1']");
    if (sunTimeToggle) {
      setSunTimeToggleMode(button.getAttribute("data-unit-mode"));
      return;
    }
    const group = button.closest(".unit-toggle[data-target-kind]");
    if (!group) return;
    const kind = group.getAttribute("data-target-kind");
    setUnitMode(kind, button.getAttribute("data-unit-mode"));
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
    renderPageLoadError(error);
    document.body.classList.remove("units-pending");
  }
};

bindControls();
void initialize();
