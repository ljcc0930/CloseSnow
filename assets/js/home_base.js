// Shared home-base contract used by the follow-on distance and UI slices.
(() => {
  const CONTRACT_VERSION = 1;
  const STORAGE_KEY = "closesnow_home_base_v1";
  const QUERY_KEYS = Object.freeze({
    source: "home_base_source",
    label: "home_base_label",
    latitude: "home_base_lat",
    longitude: "home_base_lon",
    placeId: "home_base_place",
    city: "home_base_city",
    region: "home_base_region",
    postalCode: "home_base_zip",
    countryCode: "home_base_cc",
  });

  const _text = (value) => String(value || "").trim();
  const _norm = (value) => _text(value).toLowerCase();
  const _upper = (value) => _text(value).toUpperCase();
  const _asFiniteNumber = (value) => {
    if (value === null || value === undefined || value === "") return null;
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
  };
  const _validLatitude = (value) => value !== null && value >= -90 && value <= 90;
  const _validLongitude = (value) => value !== null && value >= -180 && value <= 180;
  const _roundCoord = (value) => Number(value.toFixed(6));
  const _coordinateLabel = (latitude, longitude) => `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;

  const RAW_LOOKUP_ENTRIES = [
    ["salt-lake-city-ut-84101", "Salt Lake City, UT", "Salt Lake City", "UT", "84101", 40.760779, -111.891045],
    ["park-city-ut-84060", "Park City, UT", "Park City", "UT", "84060", 40.646063, -111.497972],
    ["denver-co-80202", "Denver, CO", "Denver", "CO", "80202", 39.752998, -104.999226],
    ["boulder-co-80302", "Boulder, CO", "Boulder", "CO", "80302", 40.017544, -105.279297],
    ["frisco-co-80443", "Frisco, CO", "Frisco", "CO", "80443", 39.57443, -106.09752],
    ["breckenridge-co-80424", "Breckenridge, CO", "Breckenridge", "CO", "80424", 39.481654, -106.038352],
    ["steamboat-springs-co-80487", "Steamboat Springs, CO", "Steamboat Springs", "CO", "80487", 40.485013, -106.831715],
    ["aspen-co-81611", "Aspen, CO", "Aspen", "CO", "81611", 39.191098, -106.817539],
    ["reno-nv-89501", "Reno, NV", "Reno", "NV", "89501", 39.527768, -119.81348],
    ["truckee-ca-96161", "Truckee, CA", "Truckee", "CA", "96161", 39.327962, -120.183253],
    ["south-lake-tahoe-ca-96150", "South Lake Tahoe, CA", "South Lake Tahoe", "CA", "96150", 38.939926, -119.977186],
    ["mammoth-lakes-ca-93546", "Mammoth Lakes, CA", "Mammoth Lakes", "CA", "93546", 37.648546, -118.972079],
    ["sacramento-ca-95814", "Sacramento, CA", "Sacramento", "CA", "95814", 38.581572, -121.4944],
    ["seattle-wa-98101", "Seattle, WA", "Seattle", "WA", "98101", 47.606209, -122.332071],
    ["enumclaw-wa-98022", "Enumclaw, WA", "Enumclaw", "WA", "98022", 47.204266, -121.9915],
    ["spokane-wa-99201", "Spokane, WA", "Spokane", "WA", "99201", 47.65878, -117.426047],
    ["bend-or-97701", "Bend, OR", "Bend", "OR", "97701", 44.058173, -121.31531],
    ["boise-id-83702", "Boise, ID", "Boise", "ID", "83702", 43.615019, -116.202313],
    ["jackson-wy-83001", "Jackson, WY", "Jackson", "WY", "83001", 43.479929, -110.762428],
    ["bozeman-mt-59715", "Bozeman, MT", "Bozeman", "MT", "59715", 45.679653, -111.044048],
    ["burlington-vt-05401", "Burlington, VT", "Burlington", "VT", "05401", 44.475883, -73.212072],
    ["killington-vt-05751", "Killington, VT", "Killington", "VT", "05751", 43.678126, -72.779541],
    ["stowe-vt-05672", "Stowe, VT", "Stowe", "VT", "05672", 44.465433, -72.687402],
    ["north-conway-nh-03860", "North Conway, NH", "North Conway", "NH", "03860", 44.05368, -71.128403],
    ["portland-me-04101", "Portland, ME", "Portland", "ME", "04101", 43.659099, -70.256819],
    ["lake-placid-ny-12946", "Lake Placid, NY", "Lake Placid", "NY", "12946", 44.279491, -73.979871],
    ["albany-ny-12207", "Albany, NY", "Albany", "NY", "12207", 42.65258, -73.756232],
    ["boston-ma-02108", "Boston, MA", "Boston", "MA", "02108", 42.357159, -71.063698],
    ["minneapolis-mn-55401", "Minneapolis, MN", "Minneapolis", "MN", "55401", 44.977753, -93.265011],
    ["duluth-mn-55802", "Duluth, MN", "Duluth", "MN", "55802", 46.786672, -92.100485],
    ["traverse-city-mi-49684", "Traverse City, MI", "Traverse City", "MI", "49684", 44.763057, -85.620632],
    ["detroit-mi-48226", "Detroit, MI", "Detroit", "MI", "48226", 42.331427, -83.045754],
    ["cleveland-oh-44113", "Cleveland, OH", "Cleveland", "OH", "44113", 41.49932, -81.694361],
    ["pittsburgh-pa-15222", "Pittsburgh, PA", "Pittsburgh", "PA", "15222", 40.440625, -79.995886],
    ["philadelphia-pa-19103", "Philadelphia, PA", "Philadelphia", "PA", "19103", 39.952584, -75.165222],
    ["new-york-ny-10001", "New York, NY", "New York", "NY", "10001", 40.750633, -73.997177],
    ["washington-dc-20001", "Washington, DC", "Washington", "DC", "20001", 38.907192, -77.036871],
  ];

  const LOOKUP_ENTRIES = Object.freeze(
    RAW_LOOKUP_ENTRIES.map(([placeId, label, city, region, postalCode, latitude, longitude]) => Object.freeze({
      placeId,
      label,
      display: `${label} (${postalCode})`,
      city,
      region,
      postalCode,
      countryCode: "US",
      latitude,
      longitude,
    }))
  );

  const LOOKUP_INDEX = LOOKUP_ENTRIES.map((entry) => {
    const cityRegion = `${entry.city}, ${entry.region}`;
    return {
      entry,
      exactKeys: new Set([
        _norm(entry.display),
        _norm(entry.label),
        _norm(entry.city),
        _norm(cityRegion),
        _norm(entry.postalCode),
        _norm(entry.placeId),
      ]),
      searchKeys: [
        _norm(entry.display),
        _norm(entry.label),
        _norm(entry.city),
        _norm(cityRegion),
        _norm(entry.postalCode),
        _norm(entry.region),
      ],
    };
  });

  const normalizeHomeBase = (raw) => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    const latitude = _asFiniteNumber(raw.latitude);
    const longitude = _asFiniteNumber(raw.longitude);
    if (!_validLatitude(latitude) || !_validLongitude(longitude)) return null;

    const sourceText = _norm(raw.source);
    const source = sourceText === "geolocation" || sourceText === "lookup" || sourceText === "manual"
      ? sourceText
      : "manual";
    const city = _text(raw.city);
    const region = _upper(raw.region);
    const postalCode = _text(raw.postalCode);
    const countryCode = _upper(raw.countryCode || (source === "lookup" ? "US" : ""));
    const placeId = _text(raw.placeId);
    const label = _text(raw.label) || (
      city && region
        ? `${city}, ${region}`
        : (city || _coordinateLabel(latitude, longitude))
    );
    const query = _text(raw.query) || label;
    const updatedAt = _text(raw.updatedAt) || new Date().toISOString();

    return Object.freeze({
      version: CONTRACT_VERSION,
      source,
      label,
      latitude: _roundCoord(latitude),
      longitude: _roundCoord(longitude),
      query,
      placeId,
      city,
      region,
      postalCode,
      countryCode,
      updatedAt,
    });
  };

  const parseHomeBaseFromSearchParams = (params) => normalizeHomeBase({
    source: params.get(QUERY_KEYS.source) || "",
    label: params.get(QUERY_KEYS.label) || "",
    latitude: params.get(QUERY_KEYS.latitude) || "",
    longitude: params.get(QUERY_KEYS.longitude) || "",
    placeId: params.get(QUERY_KEYS.placeId) || "",
    city: params.get(QUERY_KEYS.city) || "",
    region: params.get(QUERY_KEYS.region) || "",
    postalCode: params.get(QUERY_KEYS.postalCode) || "",
    countryCode: params.get(QUERY_KEYS.countryCode) || "",
  });

  const parseHomeBaseFromQuery = (rawQuery) => {
    const query = _text(rawQuery).replace(/^\?/, "");
    return parseHomeBaseFromSearchParams(new URLSearchParams(query));
  };

  const loadStoredHomeBase = () => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      return normalizeHomeBase(JSON.parse(raw));
    } catch (error) {
      return null;
    }
  };

  const persistHomeBase = (homeBase) => {
    const normalized = normalizeHomeBase(homeBase);
    if (!normalized) return null;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    } catch (error) {
      // Ignore storage failures.
    }
    return normalized;
  };

  const clearStoredHomeBase = () => {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      // Ignore storage failures.
    }
  };

  const removeHomeBaseSearchParams = (params) => {
    Object.values(QUERY_KEYS).forEach((key) => params.delete(key));
    return params;
  };

  const writeHomeBaseToSearchParams = (params, homeBase) => {
    removeHomeBaseSearchParams(params);
    const normalized = normalizeHomeBase(homeBase);
    if (!normalized) return params;
    params.set(QUERY_KEYS.source, normalized.source);
    params.set(QUERY_KEYS.label, normalized.label);
    params.set(QUERY_KEYS.latitude, String(normalized.latitude));
    params.set(QUERY_KEYS.longitude, String(normalized.longitude));
    if (normalized.placeId) params.set(QUERY_KEYS.placeId, normalized.placeId);
    if (normalized.city) params.set(QUERY_KEYS.city, normalized.city);
    if (normalized.region) params.set(QUERY_KEYS.region, normalized.region);
    if (normalized.postalCode) params.set(QUERY_KEYS.postalCode, normalized.postalCode);
    if (normalized.countryCode) params.set(QUERY_KEYS.countryCode, normalized.countryCode);
    return params;
  };

  const _rankLookupMatch = (query, indexEntry) => {
    if (!query) return 0;
    if (indexEntry.exactKeys.has(query)) return 0;
    if (indexEntry.searchKeys.some((key) => key.startsWith(query))) return 1;
    if (indexEntry.searchKeys.some((key) => key.includes(query))) return 2;
    return 99;
  };

  const findLookupMatches = (rawQuery, options = {}) => {
    const query = _norm(rawQuery);
    const limit = Math.max(1, Number(options.limit) || 8);
    return LOOKUP_INDEX
      .map((indexEntry) => ({ rank: _rankLookupMatch(query, indexEntry), entry: indexEntry.entry }))
      .filter((item) => item.rank < 99)
      .sort((a, b) => {
        if (a.rank !== b.rank) return a.rank - b.rank;
        return a.entry.label.localeCompare(b.entry.label);
      })
      .slice(0, limit)
      .map((item) => item.entry);
  };

  const resolveLookupEntry = (rawQuery) => {
    const query = _norm(rawQuery);
    if (!query) return null;
    const exact = LOOKUP_INDEX.find((indexEntry) => indexEntry.exactKeys.has(query));
    if (exact) return exact.entry;
    const [first] = findLookupMatches(query, { limit: 1 });
    return first || null;
  };

  const describeHomeBase = (homeBase) => {
    const normalized = normalizeHomeBase(homeBase);
    if (!normalized) return "Home base not set";
    return `${normalized.label} (${normalized.latitude.toFixed(4)}, ${normalized.longitude.toFixed(4)})`;
  };

  window.CloseSnowHomeBase = Object.freeze({
    CONTRACT_VERSION,
    STORAGE_KEY,
    QUERY_KEYS,
    LOOKUP_ENTRIES,
    clearStoredHomeBase,
    describeHomeBase,
    findLookupMatches,
    loadStoredHomeBase,
    normalizeHomeBase,
    parseHomeBaseFromQuery,
    parseHomeBaseFromSearchParams,
    persistHomeBase,
    removeHomeBaseSearchParams,
    resolveLookupEntry,
    writeHomeBaseToSearchParams,
  });
})();
