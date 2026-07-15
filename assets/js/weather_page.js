(function () {
  "use strict";

  const pageBootstrap = window.CLOSESNOW_PAGE_BOOTSTRAP && typeof window.CLOSESNOW_PAGE_BOOTSTRAP === "object"
    ? window.CLOSESNOW_PAGE_BOOTSTRAP
    : {};
  const filterMeta = window.CLOSESNOW_FILTER_META && typeof window.CLOSESNOW_FILTER_META === "object"
    ? window.CLOSESNOW_FILTER_META
    : {};
  const filterMetaAvailable = filterMeta.available_filters && typeof filterMeta.available_filters === "object"
    ? filterMeta.available_filters
    : {};
  const filterMetaApplied = filterMeta.applied_filters && typeof filterMeta.applied_filters === "object"
    ? filterMeta.applied_filters
    : {};
  const initialPayload = window.CLOSESNOW_INITIAL_PAYLOAD && typeof window.CLOSESNOW_INITIAL_PAYLOAD === "object"
    ? window.CLOSESNOW_INITIAL_PAYLOAD
    : null;

  const pageContentRoot = document.getElementById("page-content-root");
  const resultsAnnouncer = document.getElementById("results-announcer");
  const reportDateEl = document.getElementById("report-date");
  const reportModelEl = document.getElementById("report-model");
  const visibleResortCountEl = document.getElementById("visible-resort-count");
  const unitStatusEls = Array.from(document.querySelectorAll("[data-field-guide-unit-status]"));
  const resortSearchInput = document.getElementById("resort-search-input");
  const resortSearchClear = document.getElementById("resort-search-clear");
  const filterOpenBtn = document.getElementById("filter-open-btn");
  const filterModal = document.getElementById("filter-modal");
  const filterResetBtn = document.getElementById("filter-reset-btn");
  const filterCloseBtn = document.getElementById("filter-close-btn");
  const filterDoneBtn = document.getElementById("filter-done-btn");
  const filterSummary = document.getElementById("filter-summary");
  const activeFilterCount = document.getElementById("active-filter-count");
  const filterRegionOptions = document.getElementById("filter-region-options");
  const filterSortSelect = document.getElementById("filter-sort-select");
  const filterIncludeAllInput = document.getElementById("filter-include-all");
  const filterSearchAllInput = document.getElementById("filter-search-all");
  const favoritesOnlyToggle = document.getElementById("favorites-only-toggle");
  const filterFavoritesOnlyInput = document.getElementById("filter-favorites-only");
  const filterPassTypeInputs = Array.from(document.querySelectorAll("input[name='filter-pass-type']"));

  const FILTER_STORAGE_KEY = "closesnow_filter_state_v1";
  const FAVORITES_STORAGE_KEY = "closesnow_favorite_resorts_v1";
  const INITIAL_RESULT_LIMIT = 12;
  const RESULT_PAGE_SIZE = 12;
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

  const formatters = window.CloseSnowWeatherPageFormatters || {};
  const normalizeSearch = formatters.normalizeSearch || ((value) => String(value || "").trim().toLowerCase());
  const isTruthyParam = formatters.isTruthyParam || ((value) => ["1", "true", "yes", "on"].includes(normalizeSearch(value)));
  const filterHelpers = window.CloseSnowFilterState || {};
  const parsePassTypeValues = filterHelpers.parsePassTypeValues || ((values) => values);
  const parseSubregionValues = filterHelpers.parseSubregionValues || ((values) => values);
  const normalizeSortBy = filterHelpers.normalizeSortBy || ((value) => value || "state");
  const sortLabel = filterHelpers.sortLabel || ((value) => value);
  const fieldGuide = window.CloseSnowFieldGuide || {};
  const fieldGuideUnits = fieldGuide.units || {};
  const homepage = window.CloseSnowFieldGuideHomepage || {};

  const appState = {
    payload: null,
    availableFilters: DEFAULT_AVAILABLE_FILTERS,
    favoriteResortIds: new Set(),
    unitMode: "metric",
    filterState: {
      passTypes: new Set(),
      subregions: new Set(),
      sortBy: "week_snow",
      includeDefault: true,
      searchAll: true,
      search: "",
      favoritesOnly: false,
    },
  };
  let visibleResultLimit = INITIAL_RESULT_LIMIT;

  const displayName = (report) => String(report?.display_name || report?.query || "").trim();
  const asFiniteNumber = (value) => {
    if (value === null || value === undefined || typeof value === "boolean") return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const payloadReports = () => {
    const reports = Array.isArray(appState.payload?.reports) ? appState.payload.reports : [];
    return reports.filter((report) => report && typeof report === "object");
  };

  const dailyAt = (report, index) => {
    const daily = Array.isArray(report?.daily) ? report.daily : [];
    return daily[index] && typeof daily[index] === "object" ? daily[index] : {};
  };

  const weeklySnowfall = (report) => asFiniteNumber(report?.week1_total_snowfall_cm);
  const weeklyRainfall = (report) => {
    const direct = asFiniteNumber(report?.week1_total_rain_mm);
    if (direct !== null) return direct;
    const values = (Array.isArray(report?.daily) ? report.daily : []).slice(0, 7)
      .map((day) => asFiniteNumber(day?.rain_mm))
      .filter((value) => value !== null);
    return values.length ? values.reduce((total, value) => total + value, 0) : null;
  };
  const nextWeekSnowfall = (report) => asFiniteNumber(report?.week2_total_snowfall_cm);
  const twoWeekSnowfall = (report) => {
    const weekOne = weeklySnowfall(report);
    const weekTwo = nextWeekSnowfall(report);
    return weekOne === null && weekTwo === null ? null : (weekOne || 0) + (weekTwo || 0);
  };

  const compareDescending = (a, b, valueFn) => {
    const aValue = valueFn(a);
    const bValue = valueFn(b);
    const safeA = aValue === null ? Number.NEGATIVE_INFINITY : aValue;
    const safeB = bValue === null ? Number.NEGATIVE_INFINITY : bValue;
    return safeB - safeA;
  };

  const resolveBootstrapUrl = (rawUrl) => {
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

  const resolvedDataUrl = () => resolveBootstrapUrl(pageBootstrap.dataUrl);

  const isDynamicApiDataUrl = () => {
    try {
      return new URL(resolvedDataUrl()).pathname.endsWith("/api/data");
    } catch (_error) {
      return false;
    }
  };

  const loadFavoriteResortIds = () => {
    try {
      const parsed = JSON.parse(localStorage.getItem(FAVORITES_STORAGE_KEY) || "[]");
      if (!Array.isArray(parsed)) return [];
      return Array.from(new Set(parsed.map((value) => String(value || "").trim()).filter(Boolean)));
    } catch (_error) {
      return [];
    }
  };

  const persistFavoriteResortIds = () => {
    try {
      localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify([...appState.favoriteResortIds].sort()));
    } catch (_error) {
      // Storage can be unavailable in private or embedded browsing contexts.
    }
  };

  const toggleFavorite = (resortId) => {
    const normalized = String(resortId || "").trim();
    if (!normalized) return;
    if (appState.favoriteResortIds.has(normalized)) appState.favoriteResortIds.delete(normalized);
    else appState.favoriteResortIds.add(normalized);
    persistFavoriteResortIds();
  };

  const deriveAvailableFilters = (reports) => {
    const output = { pass_type: {}, region: {}, subregion: {} };
    reports.forEach((report) => {
      const region = normalizeSearch(report.region);
      const subregion = normalizeSearch(report.subregion);
      if (region) output.region[region] = (output.region[region] || 0) + 1;
      if (subregion) output.subregion[subregion] = (output.subregion[subregion] || 0) + 1;
      (Array.isArray(report.pass_types) ? report.pass_types : []).forEach((passType) => {
        const key = normalizeSearch(passType);
        if (key) output.pass_type[key] = (output.pass_type[key] || 0) + 1;
      });
    });
    return output;
  };

  const availableFilters = () => {
    if (Object.keys(filterMetaAvailable).length) {
      return {
        pass_type: typeof filterMetaAvailable.pass_type === "object" ? filterMetaAvailable.pass_type : {},
        region: typeof filterMetaAvailable.region === "object" ? filterMetaAvailable.region : {},
        subregion: typeof filterMetaAvailable.subregion === "object" ? filterMetaAvailable.subregion : {},
      };
    }
    return deriveAvailableFilters(payloadReports());
  };

  const loadStoredFilterState = () => (typeof filterHelpers.loadStoredFilterState === "function"
    ? filterHelpers.loadStoredFilterState(localStorage, FILTER_STORAGE_KEY)
    : null);

  const persistFilterState = () => {
    if (typeof filterHelpers.persistFilterState !== "function") return;
    filterHelpers.persistFilterState(localStorage, FILTER_STORAGE_KEY, appState.filterState);
  };

  const setFavoritesOnlyControls = (checked) => {
    if (favoritesOnlyToggle) favoritesOnlyToggle.checked = Boolean(checked);
    if (filterFavoritesOnlyInput) filterFavoritesOnlyInput.checked = Boolean(checked);
  };

  const applyControlsFromQueryOrMeta = () => {
    const params = new URLSearchParams(window.location.search);
    const stored = loadStoredFilterState();
    const urlPassTypes = parsePassTypeValues(params.getAll("pass_type"));
    const urlSubregions = parseSubregionValues(params.getAll("subregion"));
    const metaPassTypes = parsePassTypeValues(Array.isArray(filterMetaApplied.pass_type) ? filterMetaApplied.pass_type : []);
    const metaSubregions = parseSubregionValues(
      Array.isArray(filterMetaApplied.subregion)
        ? filterMetaApplied.subregion
        : (filterMetaApplied.subregion ? [filterMetaApplied.subregion] : []),
    );
    const passTypes = urlPassTypes.length ? urlPassTypes : (stored?.passTypes || metaPassTypes);
    const subregions = urlSubregions.length ? urlSubregions : (stored?.subregions || metaSubregions);
    const sortBy = params.has("sort_by")
      ? normalizeSortBy(params.get("sort_by"))
      : (stored?.sortBy || normalizeSortBy(filterMetaApplied.sort_by || "week_snow"));
    const search = params.has("search")
      ? params.get("search")
      : (stored?.search ?? String(filterMetaApplied.search || ""));
    const searchAll = params.has("search_all")
      ? isTruthyParam(params.get("search_all"))
      : (stored?.searchAll ?? (Object.prototype.hasOwnProperty.call(filterMetaApplied, "search_all") ? Boolean(filterMetaApplied.search_all) : true));
    const includeDefault = params.has("include_default")
      ? isTruthyParam(params.get("include_default"))
      : (params.has("include_all")
        ? !isTruthyParam(params.get("include_all"))
        : (stored?.includeDefault ?? (Object.prototype.hasOwnProperty.call(filterMetaApplied, "include_default")
          ? Boolean(filterMetaApplied.include_default)
          : !Boolean(filterMetaApplied.include_all))));
    const favoritesOnly = Boolean(stored?.favoritesOnly);

    appState.filterState = {
      passTypes: new Set(passTypes),
      subregions: new Set(subregions),
      sortBy,
      includeDefault,
      searchAll,
      search: String(search || ""),
      favoritesOnly,
    };
    filterPassTypeInputs.forEach((input) => { input.checked = appState.filterState.passTypes.has(normalizeSearch(input.value)); });
    filterRegionOptions?.querySelectorAll("input[name='filter-subregion']").forEach((input) => {
      input.checked = appState.filterState.subregions.has(normalizeSearch(input.value));
    });
    if (filterSortSelect) filterSortSelect.value = sortBy;
    if (filterIncludeAllInput) filterIncludeAllInput.checked = includeDefault;
    if (filterSearchAllInput) filterSearchAllInput.checked = searchAll;
    if (resortSearchInput) resortSearchInput.value = appState.filterState.search;
    setFavoritesOnlyControls(favoritesOnly);
  };

  const applyFilterStateFromControls = () => {
    appState.filterState.passTypes = new Set(filterPassTypeInputs
      .filter((input) => input.checked)
      .map((input) => normalizeSearch(input.value)));
    appState.filterState.subregions = new Set(Array.from(
      filterRegionOptions?.querySelectorAll("input[name='filter-subregion']:checked") || [],
    ).map((input) => normalizeSearch(input.value)));
    appState.filterState.sortBy = normalizeSortBy(filterSortSelect?.value || "week_snow");
    appState.filterState.includeDefault = Boolean(filterIncludeAllInput?.checked);
    appState.filterState.searchAll = Boolean(filterSearchAllInput?.checked);
    appState.filterState.search = String(resortSearchInput?.value || "");
    appState.filterState.favoritesOnly = Boolean(favoritesOnlyToggle?.checked || filterFavoritesOnlyInput?.checked);
    setFavoritesOnlyControls(appState.filterState.favoritesOnly);
    persistFilterState();
  };

  const buildServerQueryParams = () => {
    const params = new URLSearchParams();
    [...appState.filterState.passTypes].sort().forEach((value) => params.append("pass_type", value));
    [...appState.filterState.subregions].sort().forEach((value) => params.append("subregion", value));
    if (appState.filterState.search) params.set("search", appState.filterState.search);
    params.set("search_all", appState.filterState.searchAll ? "1" : "0");
    params.set(appState.filterState.includeDefault ? "include_default" : "include_all", "1");
    return params;
  };

  const reportSearchText = (report) => {
    const passTypes = Array.isArray(report.pass_types) ? report.pass_types.join(" ") : "";
    const searchTerms = Array.isArray(report.search_terms) ? report.search_terms.join(" ") : "";
    return normalizeSearch([
      displayName(report), report.query, report.city, report.admin1, report.state_name,
      report.country, report.country_code, report.country_name, report.address, passTypes, searchTerms,
    ].filter(Boolean).join(" "));
  };

  const filteredReports = () => {
    const keyword = normalizeSearch(appState.filterState.search);
    const searchAllActive = Boolean(keyword) && appState.filterState.searchAll;
    const reports = payloadReports().filter((report) => {
      if (keyword && !reportSearchText(report).includes(keyword)) return false;
      if (searchAllActive) return true;
      const resortId = String(report.resort_id || "").trim();
      if (appState.filterState.favoritesOnly && !appState.favoriteResortIds.has(resortId)) return false;
      if (appState.filterState.includeDefault && !Boolean(report.default_resort || report.ljcc_favorite)) return false;
      if (appState.filterState.passTypes.size) {
        const reportPasses = new Set((Array.isArray(report.pass_types) ? report.pass_types : []).map(normalizeSearch));
        if (![...appState.filterState.passTypes].some((passType) => reportPasses.has(passType))) return false;
      }
      if (appState.filterState.subregions.size) {
        const reportRegion = normalizeSearch(report.subregion || report.region);
        if (!appState.filterState.subregions.has(reportRegion)) return false;
      }
      return true;
    });

    const sortBy = appState.filterState.sortBy;
    const hasPositiveWeeklySnow = reports.some((report) => (weeklySnowfall(report) || 0) > 0);
    reports.sort((a, b) => {
      if (sortBy === "favorites") {
        const favoriteDelta = Number(appState.favoriteResortIds.has(String(b.resort_id || "")))
          - Number(appState.favoriteResortIds.has(String(a.resort_id || "")));
        if (favoriteDelta) return favoriteDelta;
      }
      if (sortBy === "today_snow") {
        const delta = compareDescending(a, b, (report) => asFiniteNumber(dailyAt(report, 0).snowfall_cm));
        if (delta) return delta;
      }
      if (sortBy === "week_snow") {
        if (hasPositiveWeeklySnow) {
          const snowDelta = compareDescending(a, b, weeklySnowfall);
          if (snowDelta) return snowDelta;
        }
        const rainDelta = compareDescending(a, b, weeklyRainfall);
        if (rainDelta) return rainDelta;
      }
      if (sortBy === "next_week_snow") {
        const delta = compareDescending(a, b, nextWeekSnowfall);
        if (delta) return delta;
      }
      if (sortBy === "two_week_snow") {
        const delta = compareDescending(a, b, twoWeekSnowfall);
        if (delta) return delta;
      }
      if (sortBy === "name") return displayName(a).localeCompare(displayName(b));
      const stateDelta = String(a.admin1 || "").localeCompare(String(b.admin1 || ""));
      return stateDelta || displayName(a).localeCompare(displayName(b));
    });
    return reports;
  };

  const activeFilterTotal = () => (
    appState.filterState.passTypes.size
    + appState.filterState.subregions.size
    + Number(appState.filterState.favoritesOnly)
    + Number(!appState.filterState.includeDefault)
    + Number(Boolean(normalizeSearch(appState.filterState.search)))
  );

  const subregionLabel = (value) => SUBREGION_OPTIONS.find((option) => option.value === normalizeSearch(value))?.label || value;

  const syncFilterSummary = (visibleCount, totalCount) => {
    const details = [];
    if (appState.filterState.favoritesOnly) details.push("favorites");
    if (appState.filterState.passTypes.size) details.push([...appState.filterState.passTypes].map((value) => value.toUpperCase()).join(" / "));
    if (appState.filterState.subregions.size) details.push([...appState.filterState.subregions].map(subregionLabel).join(" / "));
    if (!appState.filterState.includeDefault) details.push("all supported resorts");
    if (normalizeSearch(appState.filterState.search)) details.push(`search: “${appState.filterState.search.trim()}”`);
    const suffix = details.length ? ` · ${details.join(" · ")}` : "";
    if (filterSummary) filterSummary.textContent = `${visibleCount} of ${totalCount} resorts · ${sortLabel(appState.filterState.sortBy)}${suffix}`;
    if (visibleResortCountEl) visibleResortCountEl.textContent = `${visibleCount} of ${totalCount} resorts`;
    if (activeFilterCount) {
      const count = activeFilterTotal();
      activeFilterCount.hidden = count === 0;
      activeFilterCount.textContent = String(count);
      activeFilterCount.setAttribute("aria-label", `${count} active filter${count === 1 ? "" : "s"}`);
    }
  };

  const renderReportMetadata = () => {
    const raw = appState.payload?.generated_at_utc || reportDateEl?.getAttribute("data-generated-utc");
    const generated = raw ? new Date(raw) : null;
    if (reportDateEl && generated && !Number.isNaN(generated.getTime())) {
      reportDateEl.textContent = generated.toLocaleString(undefined, {
        month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short",
      });
    }
    if (reportModelEl) {
      const model = String(appState.payload?.model || "ecmwf_ifs025");
      reportModelEl.textContent = model === "ecmwf_ifs025" ? "ECMWF IFS 0.25°" : model.replaceAll("_", " ").toUpperCase();
    }
    unitStatusEls.forEach((element) => { element.textContent = appState.unitMode === "imperial" ? "Imperial" : "Metric"; });
  };

  const emptyStateMessage = () => {
    if (appState.filterState.favoritesOnly && appState.favoriteResortIds.size === 0) {
      return "You have not saved any favorites yet. Turn off Favorites only, then use the heart button on a resort.";
    }
    if (normalizeSearch(appState.filterState.search)) return "No resort matched that search with the current scope. Try a broader name, state, country, or pass.";
    return "No resort matched the current filters. Reset the filters to return to the full morning report.";
  };

  const renderPage = (options = {}) => {
    if (!pageContentRoot || !appState.payload || typeof homepage.render !== "function") return;
    const visibleReports = filteredReports();
    pageContentRoot.innerHTML = homepage.render(visibleReports, {
      mode: appState.unitMode,
      favorites: appState.favoriteResortIds,
      emptyMessage: emptyStateMessage(),
      limit: visibleResultLimit,
    });
    pageContentRoot.removeAttribute("data-loading");
    pageContentRoot.setAttribute("aria-busy", "false");
    syncFilterSummary(visibleReports.length, payloadReports().length);
    renderReportMetadata();
    document.body.classList.remove("units-pending");
    if (options.focusFavoriteId) {
      const selectorId = window.CSS?.escape ? window.CSS.escape(options.focusFavoriteId) : options.focusFavoriteId.replaceAll("\"", "\\\"");
      const favoriteTarget = pageContentRoot.querySelector(`.favorite-btn[data-resort-id="${selectorId}"]`);
      if (favoriteTarget) favoriteTarget.focus();
      else if (appState.filterState.favoritesOnly) favoritesOnlyToggle?.focus();
    }
    if (Number.isInteger(options.focusResultIndex)) {
      pageContentRoot.querySelector(`.resort-forecast-card[data-result-index="${options.focusResultIndex}"] h3`)?.focus();
    }
    if (options.announceResults && resultsAnnouncer) {
      const shownCount = Math.min(visibleResultLimit, visibleReports.length);
      resultsAnnouncer.textContent = `Showing ${shownCount} of ${visibleReports.length} resorts.`;
    }
  };

  const renderPagePreservingPosition = (options = {}) => {
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;
    renderPage(options);
    const movedFocus = Boolean(options.focusFavoriteId) || Number.isInteger(options.focusResultIndex);
    if (!movedFocus) window.requestAnimationFrame(() => window.scrollTo(scrollX, scrollY));
  };

  const renderSubregionOptions = () => {
    if (!filterRegionOptions) return;
    const selected = appState.filterState.subregions;
    const counts = appState.availableFilters.subregion || {};
    const html = SUBREGION_OPTIONS
      .filter((option) => Number(counts[option.value] || 0) > 0 || selected.has(option.value))
      .map((option) => {
        const count = Number(counts[option.value] || 0);
        return `<label><input type="checkbox" name="filter-subregion" value="${option.value}"${selected.has(option.value) ? " checked" : ""} /> <span>${option.label}</span><small>${count}</small></label>`;
      }).join("");
    filterRegionOptions.innerHTML = html || `<p class="filter-option-empty">Region filters are not available for this report.</p>`;
  };

  const updateFilterLabels = () => {
    document.querySelectorAll("[data-pass-count]").forEach((element) => {
      const count = Number(appState.availableFilters.pass_type?.[normalizeSearch(element.getAttribute("data-pass-count"))] || 0);
      element.textContent = count ? `(${count})` : "";
    });
    renderSubregionOptions();
  };

  let focusBeforeFilter = null;
  const filterFocusable = () => Array.from(filterModal?.querySelectorAll(
    "button:not([disabled]), input:not([disabled]), select:not([disabled]), [href], [tabindex]:not([tabindex='-1'])",
  ) || []).filter((element) => !element.hidden && element.getClientRects().length > 0);

  const openFilterModal = () => {
    if (!filterModal) return;
    focusBeforeFilter = document.activeElement;
    filterModal.hidden = false;
    document.body.classList.add("filter-sheet-open");
    window.requestAnimationFrame(() => filterCloseBtn?.focus());
  };

  const closeFilterModal = (restoreFocus = true) => {
    if (!filterModal) return;
    filterModal.hidden = true;
    document.body.classList.remove("filter-sheet-open");
    if (restoreFocus && focusBeforeFilter instanceof HTMLElement) focusBeforeFilter.focus();
  };

  const loadPayload = async (url = resolvedDataUrl(), options = {}) => {
    const response = await fetch(url, options);
    let payload;
    try {
      payload = await response.json();
    } catch (_error) {
      throw new Error("The forecast service returned an unreadable response. Please try again.");
    }
    if (!response.ok) throw new Error(payload?.error || `Forecast request failed (${response.status}).`);
    return payload;
  };

  let dynamicPayloadAbortController = null;
  const reloadDynamicPayloadForFilters = async () => {
    const endpoint = new URL(resolvedDataUrl());
    endpoint.search = buildServerQueryParams().toString();
    dynamicPayloadAbortController?.abort();
    const controller = new AbortController();
    dynamicPayloadAbortController = controller;
    try {
      appState.payload = await loadPayload(endpoint.toString(), { signal: controller.signal });
      appState.availableFilters = availableFilters();
      updateFilterLabels();
    } finally {
      if (dynamicPayloadAbortController === controller) dynamicPayloadAbortController = null;
    }
  };

  const renderPageLoadError = (error) => {
    if (!pageContentRoot) return;
    const wrapper = document.createElement("section");
    wrapper.className = "page-load-error";
    const heading = document.createElement("h2");
    heading.textContent = "The morning report could not load";
    const detail = document.createElement("p");
    detail.textContent = error instanceof Error ? error.message : String(error);
    wrapper.append(heading, detail);
    pageContentRoot.replaceChildren(wrapper);
    pageContentRoot.setAttribute("aria-busy", "false");
    document.body.classList.remove("units-pending");
  };

  const resetFilterControls = () => {
    filterPassTypeInputs.forEach((input) => { input.checked = false; });
    filterRegionOptions?.querySelectorAll("input[name='filter-subregion']").forEach((input) => { input.checked = false; });
    if (filterSortSelect) filterSortSelect.value = "week_snow";
    if (filterIncludeAllInput) filterIncludeAllInput.checked = true;
    if (filterSearchAllInput) filterSearchAllInput.checked = true;
    if (resortSearchInput) resortSearchInput.value = "";
    setFavoritesOnlyControls(false);
  };

  let scheduledFilterApplyTimeout = 0;
  const cancelScheduledFilterApply = () => {
    if (!scheduledFilterApplyTimeout) return;
    window.clearTimeout(scheduledFilterApplyTimeout);
    scheduledFilterApplyTimeout = 0;
  };

  const applyFiltersImmediately = async () => {
    cancelScheduledFilterApply();
    applyFilterStateFromControls();
    visibleResultLimit = INITIAL_RESULT_LIMIT;
    if (isDynamicApiDataUrl()) {
      try {
        await reloadDynamicPayloadForFilters();
      } catch (error) {
        if (error?.name === "AbortError") return;
        renderPageLoadError(error);
        return;
      }
    }
    renderPage();
  };

  const scheduleApplyFilters = () => {
    cancelScheduledFilterApply();
    scheduledFilterApplyTimeout = window.setTimeout(() => {
      scheduledFilterApplyTimeout = 0;
      void applyFiltersImmediately();
    }, 140);
  };

  const bindControls = () => {
    window.addEventListener("closesnow:unitschange", (event) => {
      appState.unitMode = event?.detail?.mode === "imperial" ? "imperial" : "metric";
      renderPagePreservingPosition();
    });
    resortSearchInput?.addEventListener("input", scheduleApplyFilters);
    resortSearchClear?.addEventListener("click", () => {
      if (resortSearchInput) resortSearchInput.value = "";
      void applyFiltersImmediately();
      resortSearchInput?.focus();
    });
    filterOpenBtn?.addEventListener("click", openFilterModal);
    filterCloseBtn?.addEventListener("click", () => closeFilterModal());
    filterDoneBtn?.addEventListener("click", () => closeFilterModal());
    filterResetBtn?.addEventListener("click", () => {
      resetFilterControls();
      void applyFiltersImmediately();
    });
    filterPassTypeInputs.forEach((input) => input.addEventListener("change", () => void applyFiltersImmediately()));
    filterRegionOptions?.addEventListener("change", () => void applyFiltersImmediately());
    filterSortSelect?.addEventListener("change", () => void applyFiltersImmediately());
    filterIncludeAllInput?.addEventListener("change", () => void applyFiltersImmediately());
    filterSearchAllInput?.addEventListener("change", () => void applyFiltersImmediately());
    favoritesOnlyToggle?.addEventListener("change", () => {
      setFavoritesOnlyControls(favoritesOnlyToggle.checked);
      void applyFiltersImmediately();
    });
    filterFavoritesOnlyInput?.addEventListener("change", () => {
      setFavoritesOnlyControls(filterFavoritesOnlyInput.checked);
      void applyFiltersImmediately();
    });
    filterModal?.addEventListener("click", (event) => {
      if (event.target === filterModal) closeFilterModal();
    });
    document.addEventListener("keydown", (event) => {
      if (!filterModal || filterModal.hidden) return;
      if (event.key === "Escape") {
        event.preventDefault();
        closeFilterModal();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = filterFocusable();
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    });
    document.addEventListener("click", (event) => {
      const showMoreButton = event.target.closest("[data-show-more-results]");
      if (showMoreButton) {
        event.preventDefault();
        const firstNewResultIndex = visibleResultLimit;
        visibleResultLimit += RESULT_PAGE_SIZE;
        renderPage({ focusResultIndex: firstNewResultIndex, announceResults: true });
        return;
      }
      const button = event.target.closest(".favorite-btn[data-resort-id]");
      if (!button) return;
      event.preventDefault();
      const resortId = String(button.getAttribute("data-resort-id") || "");
      toggleFavorite(resortId);
      if (appState.filterState.favoritesOnly || appState.filterState.sortBy === "favorites") {
        visibleResultLimit = INITIAL_RESULT_LIMIT;
      }
      renderPagePreservingPosition({ focusFavoriteId: resortId });
    });
  };

  const initialize = async () => {
    appState.unitMode = typeof fieldGuideUnits.readPreference === "function"
      ? fieldGuideUnits.readPreference()
      : "metric";
    appState.favoriteResortIds = new Set(loadFavoriteResortIds());
    try {
      appState.payload = initialPayload || await loadPayload();
      appState.availableFilters = availableFilters();
      updateFilterLabels();
      applyControlsFromQueryOrMeta();
      renderPage();
    } catch (error) {
      renderPageLoadError(error);
    }
  };

  bindControls();
  void initialize();
}());
