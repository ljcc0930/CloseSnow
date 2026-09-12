// Report selection stays independent of the DOM, storage, and page state.
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.CloseSnowWeatherReportModel = api;
}(typeof window !== "undefined" ? window : null, function () {
  "use strict";

  const normalize = (value) => String(value || "").trim().toLowerCase();
  const asNumber = (value) => {
    if (value === null || value === undefined || value === "") return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  };
  const displayName = (report) => String(report?.display_name || report?.query || "").trim();
  const dailyAt = (report, index) => {
    const day = Array.isArray(report?.daily) ? report.daily[index] : null;
    return day && typeof day === "object" ? day : {};
  };
  const weeklySnowfall = (report) => asNumber(report?.week1_total_snowfall_cm);
  const nextWeekSnowfall = (report) => asNumber(report?.week2_total_snowfall_cm);
  const twoWeekSnowfall = (report) => {
    const week1 = weeklySnowfall(report);
    const week2 = nextWeekSnowfall(report);
    return week1 === null && week2 === null ? null : (week1 || 0) + (week2 || 0);
  };
  const payloadReports = (payload) => (Array.isArray(payload?.reports) ? payload.reports : [])
    .filter((report) => report && typeof report === "object" && !Array.isArray(report));

  const deriveAvailableFilters = (reports) => {
    const out = { pass_type: {}, region: {}, subregion: {} };
    const add = (target, value) => {
      const key = normalize(value);
      if (key) target[key] = (target[key] || 0) + 1;
    };
    reports.forEach((report) => {
      add(out.region, report.region);
      add(out.subregion, report.subregion);
      (Array.isArray(report.pass_types) ? report.pass_types : [])
        .forEach((passType) => add(out.pass_type, passType));
    });
    return out;
  };

  const regionSearchText = (value) => {
    const key = normalize(value);
    const words = key.replaceAll("-", " ");
    const label = key === "australia-new-zealand" ? "Australia / New Zealand" : words;
    return `${key} ${words} ${label}`;
  };
  const searchText = (report) => normalize([
    displayName(report), report.query, report.admin1, report.state_name,
    report.country_code || report.country, report.country_name, report.city, report.address,
    regionSearchText(report.region), regionSearchText(report.subregion),
    ...(Array.isArray(report.pass_types) ? report.pass_types : []),
    ...(Array.isArray(report.search_terms) ? report.search_terms : []),
  ].filter(Boolean).join(" "));
  const isFavorite = (report, favoriteResortIds) => favoriteResortIds.has(String(report?.resort_id || "").trim());
  const compareSnow = (a, b, valueFor) => {
    const aValue = valueFor(a);
    const bValue = valueFor(b);
    // Equal missing values must return zero so the stable geographic tie-break works.
    if (aValue === bValue) return 0;
    if (aValue === null) return 1;
    if (bValue === null) return -1;
    return bValue - aValue;
  };
  const snowSorts = {
    today_snow: (report) => asNumber(dailyAt(report, 0).snowfall_cm),
    week_snow: weeklySnowfall,
    next_week_snow: nextWeekSnowfall,
    two_week_snow: twoWeekSnowfall,
  };
  const sortReports = (reports, sortBy, favoriteResortIds = new Set()) => [...reports].sort((a, b) => {
    if (sortBy === "favorites") {
      const delta = Number(isFavorite(b, favoriteResortIds)) - Number(isFavorite(a, favoriteResortIds));
      if (delta) return delta;
    }
    if (Object.prototype.hasOwnProperty.call(snowSorts, sortBy)) {
      const delta = compareSnow(a, b, snowSorts[sortBy]);
      if (delta) return delta;
    }
    if (sortBy === "name") return displayName(a).localeCompare(displayName(b));
    return String(a.admin1 || "").localeCompare(String(b.admin1 || ""))
      || String(a.query || "").localeCompare(String(b.query || ""));
  });

  const selectReports = (reports, filters, favoriteResortIds = new Set()) => {
    const keyword = normalize(filters.search);
    const searchAllActive = Boolean(keyword) && filters.searchAll;
    const passTypes = new Set(Array.from(filters.passTypes || [], normalize));
    const subregions = new Set(Array.from(filters.subregions || [], normalize));
    const visible = reports.filter((report) => {
      if (keyword && !searchText(report).includes(keyword)) return false;
      // Search all explicitly ignores the saved scope, including favorites.
      if (searchAllActive) return true;
      if (filters.favoritesOnly && !isFavorite(report, favoriteResortIds)) return false;
      if (filters.includeDefault && !(report.default_resort || report.ljcc_favorite)) return false;
      if (passTypes.size && !(Array.isArray(report.pass_types) ? report.pass_types : [])
        .some((passType) => passTypes.has(normalize(passType)))) return false;
      if (subregions.size && !subregions.has(normalize(report.subregion || report.region))) return false;
      return true;
    });
    return sortReports(visible, filters.sortBy, favoriteResortIds);
  };

  return { dailyAt, displayName, weeklySnowfall, payloadReports, deriveAvailableFilters, searchText, sortReports, selectReports };
}));
