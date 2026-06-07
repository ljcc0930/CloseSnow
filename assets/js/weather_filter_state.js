(function () {
  const _normalizeSearch = (value) => String(value || "").trim().toLowerCase();

  const _parseCommaValues = (values) => {
    const out = [];
    values.forEach((raw) => {
      String(raw || "")
        .split(",")
        .map((value) => _normalizeSearch(value))
        .filter(Boolean)
        .forEach((value) => out.push(value));
    });
    return Array.from(new Set(out));
  };

  const parsePassTypeValues = (values) => _parseCommaValues(values);
  const parseSubregionValues = (values) => _parseCommaValues(values);

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

  const sortLabel = (sortBy) => {
    if (sortBy === "name") return "Resort Name (A-Z)";
    if (sortBy === "favorites") return "Favorites First";
    if (sortBy === "today_snow") return "Today's Snowfall";
    if (sortBy === "week_snow") return "This Week's Snowfall";
    if (sortBy === "next_week_snow") return "Next Week's Snowfall";
    if (sortBy === "two_week_snow") return "Two-Week Snowfall";
    return "State (A-Z)";
  };

  const loadStoredFilterState = (storage, key) => {
    try {
      const raw = storage.getItem(key);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
      return {
        passTypes: parsePassTypeValues(Array.isArray(parsed.passTypes) ? parsed.passTypes : []),
        subregions: parseSubregionValues(
          Array.isArray(parsed.subregions) ? parsed.subregions : (parsed.subregion ? [parsed.subregion] : []),
        ),
        sortBy: normalizeSortBy(parsed.sortBy || ""),
        includeDefault: parsed.includeDefault !== false,
        searchAll: parsed.searchAll !== false,
        search: String(parsed.search || ""),
        favoritesOnly: Boolean(parsed.favoritesOnly),
      };
    } catch (_error) {
      return null;
    }
  };

  const persistFilterState = (storage, key, state) => {
    try {
      storage.setItem(key, JSON.stringify({
        passTypes: Array.from(state.passTypes || []).sort(),
        subregions: Array.from(state.subregions || []).sort(),
        sortBy: state.sortBy,
        includeDefault: state.includeDefault,
        searchAll: state.searchAll,
        search: state.search,
        favoritesOnly: Boolean(state.favoritesOnly),
      }));
    } catch (_error) {
      // Ignore storage failures.
    }
  };

  window.CloseSnowFilterState = {
    loadStoredFilterState,
    normalizeSortBy,
    parsePassTypeValues,
    parseSubregionValues,
    persistFilterState,
    sortLabel,
  };
}());
