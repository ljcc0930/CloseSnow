const context = window.CLOSESNOW_HOURLY_CONTEXT || {};
const resortId = String(context.resortId || "").trim();
const hourlyDataUrl = String(context.hourlyDataUrl || "").trim();
const dailySummary = context.dailySummary && typeof context.dailySummary === "object" ? context.dailySummary : null;
const hourlyMetricHelpers = window.CloseSnowResortHourlyMetrics || {};
const fieldGuide = window.CloseSnowFieldGuide || {};
const fieldGuideCopy = fieldGuide.copy || {};
const fieldGuideUnits = fieldGuide.units || {};
const fieldGuideWeather = fieldGuide.weather || {};

const hoursSelect = document.getElementById("hours-select");
const refreshBtn = document.getElementById("hours-refresh-btn");
const titleEl = document.getElementById("hourly-title");
const resortContextEl = document.getElementById("resort-context");
const outlookEl = document.getElementById("resort-outlook");
const localTimeEl = document.getElementById("resort-local-time");
const websiteLinkEl = document.getElementById("resort-website-link");
const locationLinkEl = document.getElementById("resort-location-link");
const snapshotEl = document.getElementById("resort-snapshot");
const timelineSection = document.getElementById("resort-timeline-section");
const timelineRoot = document.getElementById("resort-timeline-root");
const airportAccessSectionEl = document.getElementById("resort-airport-access-section");
const airportAccessRootEl = document.getElementById("resort-airport-access-root");
const metaEl = document.getElementById("hourly-meta");
const errorEl = document.getElementById("hourly-error");
const chartErrorEl = document.getElementById("hourly-chart-error");
const hourlyNarrativeEl = document.getElementById("hourly-narrative");
const chartsEl = document.getElementById("hourly-charts");
const hourlyTabButtons = Array.from(document.querySelectorAll("[data-hourly-group]"));
const table = document.getElementById("hourly-table");
const thead = table ? table.querySelector("thead") : null;
const tbody = table ? table.querySelector("tbody") : null;
let metaState = null;
let localTimeTimerId = null;
let timelineAutoCentered = false;
let lastHourlyPayload = null;
let chartResizeRafId = null;
let activeHourlyGroup = "storm";

const metricDefs = Array.isArray(hourlyMetricHelpers.metricDefs) ? hourlyMetricHelpers.metricDefs : [];
const trimHourlyPayload = hourlyMetricHelpers.trimHourlyPayload;
const HOURLY_GROUPS = Object.freeze({
  storm: Object.freeze({
    label: "Storm",
    metrics: Object.freeze(["snowfall", "rain", "precipitation_probability"]),
  }),
  wind: Object.freeze({
    label: "Wind",
    metrics: Object.freeze(["wind_speed_10m", "wind_direction_10m"]),
  }),
  visibility: Object.freeze({
    label: "Visibility and depth",
    metrics: Object.freeze(["visibility", "snow_depth"]),
  }),
});

const routePrefix = (() => {
  const path = window.location.pathname || "";
  const marker = "/resort/";
  const idx = path.lastIndexOf(marker);
  if (idx < 0) return "";
  return path.slice(0, idx);
})();

const GITHUB_COORDINATE_ISSUE_URL = "https://github.com/ljcc0930/CloseSnow/issues/new";
const GITHUB_COORDINATE_ISSUE_TEMPLATE = "01-coordinate-correction.yml";
const GITHUB_PAGES_BASE_URL = "https://ljcc0930.github.io/CloseSnow";
const GOOGLE_MAPS_SEARCH_URL = "https://www.google.com/maps/search/?api=1&query=";

const withPrefix = (path) => {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  if (!routePrefix) return cleanPath;
  return `${routePrefix}${cleanPath}`;
};

const formatValue = (value) => {
  if (value === null || value === undefined || value === "") return "";
  if (typeof value === "number") {
    if (Number.isInteger(value)) return String(value);
    return value.toFixed(1);
  }
  return String(value);
};

const currentUnitMode = () => (fieldGuideUnits.readPreference
  ? fieldGuideUnits.readPreference()
  : "metric");

const formatCoordinate = (value) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return "";
  return num.toFixed(4);
};

const formatCoordinateExact = (value) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return "";
  return num.toFixed(6);
};

const resolveResortLabel = (payload) => String(
  payload?.display_name
  || payload?.query
  || dailySummary?.display_name
  || dailySummary?.query
  || resortId
  || "Unknown resort",
).trim();

const friendlyDate = (rawDate, fallback = "") => {
  const text = String(rawDate || "").trim();
  if (!text) return fallback;
  const datePart = text.split("T", 1)[0];
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(datePart);
  if (!match) return text;
  try {
    return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", weekday: "short", timeZone: "UTC" })
      .format(new Date(`${datePart}T12:00:00Z`));
  } catch (_error) {
    return `${match[2]}-${match[3]}`;
  }
};

const contextText = (value) => {
  if (Array.isArray(value)) return value.flatMap((item) => contextText(item));
  if (value && typeof value === "object") {
    return contextText(value.display_name || value.name || value.label || value.code || "");
  }
  const text = String(value || "").trim();
  return text ? [text] : [];
};

const renderResortIdentity = (payload = null) => {
  const label = resolveResortLabel(payload);
  if (titleEl) titleEl.textContent = label;
  document.title = `${label} forecast | CloseSnow`;
  if (!resortContextEl) return;
  const source = { ...(dailySummary || {}), ...(payload || {}) };
  const place = [source.region || source.subregion, source.admin1, source.country]
    .flatMap((value) => contextText(value))
    .filter((value, index, values) => values.indexOf(value) === index);
  const passes = contextText(source.pass_types).map((value) => `${value} pass`);
  resortContextEl.textContent = [...place, ...passes].join(" · ");
};

const strongestDailySignal = (daily, unitMode) => {
  const days = Array.isArray(daily) ? daily.slice(0, 7) : [];
  let snowDay = null;
  let rainDay = null;
  days.forEach((day) => {
    const snow = toFiniteNumber(day?.snowfall_cm) || 0;
    const rain = toFiniteNumber(day?.rain_mm) || 0;
    if (!snowDay || snow > snowDay.value) snowDay = { day, value: snow };
    if (!rainDay || rain > rainDay.value) rainDay = { day, value: rain };
  });
  if (snowDay && snowDay.value > 0) {
    const amount = fieldGuideUnits.formatSnow
      ? fieldGuideUnits.formatSnow(snowDay.value, unitMode)
      : `${snowDay.value.toFixed(1)} cm`;
    return `The strongest snow signal is ${amount} on ${friendlyDate(snowDay.day?.date, "the leading forecast day")}.`;
  }
  if (rainDay && rainDay.value > 0) {
    const amount = fieldGuideUnits.formatRain
      ? fieldGuideUnits.formatRain(rainDay.value, unitMode)
      : `${rainDay.value.toFixed(1)} mm`;
    return `The wettest signal is ${amount} on ${friendlyDate(rainDay.day?.date, "the leading forecast day")}.`;
  }
  return "No meaningful snow or rain signal stands out in the next seven days.";
};

const renderResortOutlook = () => {
  if (!outlookEl) return;
  const daily = Array.isArray(dailySummary?.daily) ? dailySummary.daily : [];
  if (!daily.length) {
    outlookEl.textContent = "The seven-day outlook is not available yet.";
    return;
  }
  const unitMode = currentUnitMode();
  const base = fieldGuideCopy.dailyOutlook
    ? fieldGuideCopy.dailyOutlook(daily, { mode: unitMode, days: 7 })
    : "Seven-day forecast available below.";
  outlookEl.textContent = `${base} ${strongestDailySignal(daily, unitMode)}`.trim();
};

const buildExternalLink = (href, label, className = "") => {
  const url = String(href || "").trim();
  if (!url) return null;
  let parsedUrl;
  try {
    parsedUrl = new URL(url);
  } catch (_error) {
    return null;
  }
  if (!["http:", "https:"].includes(parsedUrl.protocol)) return null;
  const link = document.createElement("a");
  link.href = parsedUrl.toString();
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  if (className) link.className = className;
  link.textContent = label;
  return link;
};

const appendMetaFragment = (parent, fragment) => {
  if (!parent || !fragment) return;
  if (parent.childNodes.length > 0) {
    parent.appendChild(document.createTextNode(" | "));
  }
  parent.appendChild(fragment);
};

const buildGoogleMapsUrl = (latValue, lonValue) => {
  const lat = formatCoordinateExact(latValue);
  const lon = formatCoordinateExact(lonValue);
  if (!lat || !lon) return "";
  return `${GOOGLE_MAPS_SEARCH_URL}${encodeURIComponent(`${lat},${lon}`)}`;
};

const buildCanonicalResortPageUrl = () => {
  if (!resortId) return `${GITHUB_PAGES_BASE_URL}/`;
  return `${GITHUB_PAGES_BASE_URL}/resort/${encodeURIComponent(resortId)}/`;
};

const resolveIssueResortPageUrl = () => {
  const currentUrl = String(window.location.href || "").trim();
  if (currentUrl.startsWith(`${GITHUB_PAGES_BASE_URL}/`)) {
    return currentUrl;
  }
  return buildCanonicalResortPageUrl();
};

const buildCoordinateIssueUrl = (payload, coordinatesText, mapsUrl) => {
  const url = new URL(GITHUB_COORDINATE_ISSUE_URL);
  const resortLabel = resolveResortLabel(payload);
  url.searchParams.set("template", GITHUB_COORDINATE_ISSUE_TEMPLATE);
  url.searchParams.set("title", `[Coordinate] ${resortLabel}`);
  url.searchParams.set("resort_name", resortLabel);
  url.searchParams.set("resort_page", resolveIssueResortPageUrl());
  url.searchParams.set("current_coordinates", coordinatesText);
  url.searchParams.set("current_map_link", mapsUrl);
  return url.toString();
};

const buildCoordinateEntryFragment = ({
  payload,
  latValue,
  lonValue,
  label,
  ariaLabel,
  includeIssueLink = false,
}) => {
  const latDisplay = formatCoordinate(latValue);
  const lonDisplay = formatCoordinate(lonValue);
  if (!latDisplay || !lonDisplay) return null;

  const coordinatesText = `${latDisplay}, ${lonDisplay}`;
  const mapsUrl = buildGoogleMapsUrl(latValue, lonValue);
  const wrapper = document.createElement("span");
  wrapper.className = "hourly-meta-coordinate-entry";

  const labelEl = document.createElement("span");
  labelEl.className = "hourly-meta-coordinate-label";
  labelEl.textContent = `${label}: `;
  wrapper.appendChild(labelEl);

  if (!mapsUrl) {
    wrapper.appendChild(document.createTextNode(coordinatesText));
    return wrapper;
  }

  const mapsLink = buildExternalLink(mapsUrl, coordinatesText, "hourly-meta-link");
  if (mapsLink) {
    mapsLink.setAttribute("aria-label", `${ariaLabel} in Google Maps`);
    wrapper.appendChild(mapsLink);
  } else {
    wrapper.appendChild(document.createTextNode(coordinatesText));
  }

  if (!includeIssueLink) return wrapper;

  const latExact = formatCoordinateExact(latValue) || latDisplay;
  const lonExact = formatCoordinateExact(lonValue) || lonDisplay;
  const coordinatesIssueText = `${latExact}, ${lonExact}`;
  const issueLink = buildExternalLink(
    buildCoordinateIssueUrl(payload, coordinatesIssueText, mapsUrl),
    "(Wrong coordinates?)",
    "hourly-meta-issue-link",
  );
  if (issueLink) {
    issueLink.setAttribute("aria-label", `Report incorrect coordinates for ${resolveResortLabel(payload)}`);
    wrapper.appendChild(document.createTextNode(" "));
    wrapper.appendChild(issueLink);
  }
  return wrapper;
};

const buildCoordinateMetaFragment = (payload) => {
  const resortCoords = buildCoordinateEntryFragment({
    payload,
    latValue: payload?.input_latitude,
    lonValue: payload?.input_longitude,
    label: "Resort coords",
    ariaLabel: `Open ${resolveResortLabel(payload)} resort coordinates`,
    includeIssueLink: true,
  });
  const forecastCoords = buildCoordinateEntryFragment({
    payload,
    latValue: payload?.resolved_latitude,
    lonValue: payload?.resolved_longitude,
    label: "Forecast grid",
    ariaLabel: `Open ${resolveResortLabel(payload)} forecast grid coordinates`,
  });
  if (!resortCoords && !forecastCoords) return null;
  if (!resortCoords) return forecastCoords;
  if (!forecastCoords) return resortCoords;

  const wrapper = document.createElement("span");
  wrapper.className = "hourly-meta-coordinate";
  wrapper.appendChild(resortCoords);
  wrapper.appendChild(document.createTextNode(" | "));
  wrapper.appendChild(forecastCoords);
  return wrapper;
};

const formatResortLocalTime = (timeZone) => {
  const tz = String(timeZone || "").trim();
  if (!tz) return "";
  try {
    return new Intl.DateTimeFormat(undefined, {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
      timeZone: tz,
      timeZoneName: "short",
    }).format(new Date());
  } catch (_error) {
    return "";
  }
};

const renderMeta = () => {
  if (!metaEl) return;
  if (!metaState) {
    metaEl.textContent = "";
    return;
  }
  metaEl.textContent = "";
  appendMetaFragment(metaEl, document.createTextNode(`${metaState.count} hours`));
  appendMetaFragment(metaEl, document.createTextNode(metaState.timezone || "unknown timezone"));
  appendMetaFragment(metaEl, document.createTextNode(metaState.model || "unknown model"));
  if (metaState.coordFragment) {
    appendMetaFragment(metaEl, metaState.coordFragment);
  }
};

const renderLocalTime = () => {
  if (!localTimeEl) return;
  if (!metaState || !metaState.timezone) {
    localTimeEl.textContent = "";
    return;
  }
  const localTime = formatResortLocalTime(metaState.timezone);
  localTimeEl.textContent = localTime ? `Local time: ${localTime}` : "";
};

const renderWebsiteLink = (payload) => {
  if (!websiteLinkEl) return;
  const url = String(payload?.website || dailySummary?.website || "").trim();
  websiteLinkEl.textContent = "";
  const link = buildExternalLink(url, "link");
  if (!link) return;
  websiteLinkEl.appendChild(document.createTextNode("Official website: "));
  websiteLinkEl.appendChild(link);
};

const renderResortLocationLink = (payload) => {
  if (!locationLinkEl) return;
  const mapsUrl = buildGoogleMapsUrl(payload?.input_latitude, payload?.input_longitude);
  if (!mapsUrl) {
    locationLinkEl.textContent = "";
    return;
  }
  locationLinkEl.textContent = "";
  locationLinkEl.appendChild(document.createTextNode("Resort location: "));
  const mapsLink = buildExternalLink(mapsUrl, "View on Google Maps", "resort-location-map-link");
  if (!mapsLink) return;
  mapsLink.setAttribute("aria-label", `Open ${resolveResortLabel(payload)} location in Google Maps`);
  locationLinkEl.appendChild(mapsLink);
};

const resolveNearbyAirportSource = (payload) => {
  if (payload && Array.isArray(payload.nearby_airports)) {
    return { list: payload.nearby_airports, source: "payload" };
  }
  if (Array.isArray(dailySummary?.nearbyAirports)) {
    return { list: dailySummary.nearbyAirports, source: "summary" };
  }
  return { list: null, source: "missing" };
};

const normalizeNearbyAirport = (item) => {
  if (!item || typeof item !== "object") return null;
  const iataCode = String(item.iata_code || "").trim().toUpperCase();
  const displayName = String(item.display_name || "").trim();
  const locationLabel = String(item.location_label || "").trim();
  const rawDistance = Number(item.distance_miles);
  const distanceMiles = Number.isFinite(rawDistance) ? rawDistance : null;
  if (!displayName) return null;
  return {
    iataCode: iataCode || "---",
    displayName,
    locationLabel,
    distanceMiles,
  };
};

const renderNearbyAirports = (payload) => {
  if (!airportAccessSectionEl || !airportAccessRootEl) return;
  const resolved = resolveNearbyAirportSource(payload);
  airportAccessRootEl.textContent = "";

  if (resolved.list === null) {
    const empty = document.createElement("p");
    empty.className = "resort-airport-access-empty";
    empty.textContent = "Nearby airport data unavailable.";
    airportAccessRootEl.appendChild(empty);
    airportAccessSectionEl.hidden = false;
    return;
  }

  const airports = resolved.list
    .map((item) => normalizeNearbyAirport(item))
    .filter((item) => item !== null);

  if (!airports.length) {
    const empty = document.createElement("p");
    empty.className = "resort-airport-access-empty";
    empty.textContent = "No nearby airports found within roughly 250 miles.";
    airportAccessRootEl.appendChild(empty);
    airportAccessSectionEl.hidden = false;
    return;
  }

  const list = document.createElement("div");
  list.className = "resort-airport-access-list";
  airports.forEach((airport) => {
    const card = document.createElement("article");
    card.className = "resort-airport-access-card";

    const head = document.createElement("p");
    head.className = "resort-airport-access-card-head";

    const code = document.createElement("span");
    code.className = "resort-airport-access-code";
    code.textContent = airport.iataCode;
    head.appendChild(code);

    if (airport.distanceMiles !== null) {
      const distance = document.createElement("span");
      distance.className = "resort-airport-access-distance";
      const distanceKm = airport.distanceMiles * 1.609344;
      distance.textContent = fieldGuideUnits.formatDistance
        ? fieldGuideUnits.formatDistance(distanceKm, currentUnitMode(), { digits: 0 })
        : `${Math.round(airport.distanceMiles)} mi`;
      head.appendChild(distance);
    }

    const name = document.createElement("p");
    name.className = "resort-airport-access-name";
    name.textContent = airport.displayName;

    const location = document.createElement("p");
    location.className = "resort-airport-access-location";
    location.textContent = airport.locationLabel || "Location unavailable";

    card.appendChild(head);
    card.appendChild(name);
    card.appendChild(location);
    list.appendChild(card);
  });
  airportAccessRootEl.appendChild(list);
  airportAccessSectionEl.hidden = false;
};
const syncLocalTimeTimer = () => {
  if (localTimeTimerId !== null) {
    window.clearInterval(localTimeTimerId);
    localTimeTimerId = null;
  }
  if (!metaState || !metaState.timezone) return;
  localTimeTimerId = window.setInterval(renderLocalTime, 1000);
};

const setError = (msg) => {
  if (!errorEl) return;
  const text = String(msg || "").trim();
  if (!text) {
    errorEl.hidden = true;
    errorEl.textContent = "";
    return;
  }
  errorEl.hidden = false;
  errorEl.textContent = text;
};

const setChartError = (msg) => {
  if (!chartErrorEl) return;
  const text = String(msg || "").trim();
  if (!text) {
    chartErrorEl.hidden = true;
    chartErrorEl.textContent = "";
    return;
  }
  chartErrorEl.hidden = false;
  chartErrorEl.textContent = text;
};

const renderResortSnapshot = () => {
  if (!snapshotEl) return;
  const daily = Array.isArray(dailySummary?.daily) ? dailySummary.daily : [];
  const today = daily[0] && typeof daily[0] === "object" ? daily[0] : null;
  if (!today) {
    snapshotEl.hidden = true;
    snapshotEl.innerHTML = "";
    return;
  }
  const high = toFiniteNumber(today.temperature_max_c);
  const low = toFiniteNumber(today.temperature_min_c);
  const snow = daily.slice(0, 7).reduce((sum, day) => sum + (toFiniteNumber(day?.snowfall_cm) || 0), 0);
  const rain = daily.slice(0, 7).reduce((sum, day) => sum + (toFiniteNumber(day?.rain_mm) || 0), 0);
  const weatherCode = today.weather_code;
  const conditionName = fieldGuideWeather.conditionName
    ? fieldGuideWeather.conditionName(weatherCode)
    : "Conditions unavailable";
  const unitMode = currentUnitMode();
  const weatherIcon = fieldGuideWeather.iconHtml
    ? fieldGuideWeather.iconHtml(weatherCode)
    : '<span class="field-guide-weather-icon" role="img" aria-label="Conditions unavailable">?</span>';
  const metricIcon = (kind, label) => (fieldGuideWeather.metricIconHtml
    ? fieldGuideWeather.metricIconHtml(kind, { label })
    : `<span class="field-guide-weather-icon" role="img" aria-label="${label}">?</span>`);
  const temperatureUnit = fieldGuideUnits.unitLabel ? fieldGuideUnits.unitLabel("temperature", unitMode) : "°C";
  const formattedHigh = high === null
    ? "--"
    : (fieldGuideUnits.formatTemperature
      ? fieldGuideUnits.formatTemperature(high, unitMode, { withUnit: false, digits: 0 })
      : String(Math.round(high)));
  const formattedLow = low === null
    ? "--"
    : (fieldGuideUnits.formatTemperature
      ? fieldGuideUnits.formatTemperature(low, unitMode, { withUnit: false, digits: 0 })
      : String(Math.round(low)));
  const temperature = `${formattedHigh} / ${formattedLow} ${temperatureUnit}`;
  const snowValue = fieldGuideUnits.formatSnow ? fieldGuideUnits.formatSnow(snow, unitMode) : `${snow.toFixed(1)} cm`;
  const rainValue = fieldGuideUnits.formatRain ? fieldGuideUnits.formatRain(rain, unitMode) : `${rain.toFixed(1)} mm`;
  const outlook = fieldGuideCopy.dailyOutlook ? fieldGuideCopy.dailyOutlook(daily, { mode: unitMode }) : "";
  snapshotEl.innerHTML = `
    <article class="snapshot-card snapshot-card-weather">
      <span class="snapshot-icon">${weatherIcon}</span>
      <span><small>Today</small><strong>${temperature}</strong><em>${conditionName}</em></span>
    </article>
    <article class="snapshot-card">
      <span class="snapshot-icon snapshot-icon-snow">${metricIcon("snow", "Snowfall")}</span>
      <span><small>Next 7 days</small><strong>${snowValue}</strong><em>Forecast snow</em></span>
    </article>
    <article class="snapshot-card">
      <span class="snapshot-icon snapshot-icon-rain">${metricIcon("rain", "Rainfall")}</span>
      <span><small>Next 7 days</small><strong>${rainValue}</strong><em>Forecast rain</em></span>
    </article>`;
  if (outlook) snapshotEl.setAttribute("aria-label", outlook);
  snapshotEl.hidden = false;
  renderResortOutlook();
};

const toFiniteNumber = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  return num;
};

const splitTimeLabel = (rawTime) => {
  const text = String(rawTime || "");
  if (!text) return { dateLabel: "", timeLabel: "" };
  const [datePart, hourPart = ""] = text.split("T");
  const hourLabel = hourPart.slice(0, 5);
  if (!datePart) return { dateLabel: "", timeLabel: hourLabel || text };
  const md = datePart.length >= 10 ? datePart.slice(5) : datePart;
  return { dateLabel: md, timeLabel: hourLabel };
};

const METRIC_PRESENTATION = Object.freeze({
  snowfall: Object.freeze({
    title: "Snowfall",
    description: "Hourly accumulation across the selected weather window",
    chart: "bar",
    color: "#167a9b",
  }),
  rain: Object.freeze({
    title: "Rainfall",
    description: "Hourly liquid precipitation at the forecast grid",
    chart: "bar",
    color: "#16705d",
  }),
  precipitation_probability: Object.freeze({
    title: "Precipitation chance",
    description: "Likelihood of measurable precipitation each hour",
    chart: "area",
    color: "#486b9b",
  }),
  wind_speed_10m: Object.freeze({
    title: "Wind speed",
    description: "Forecast wind at 10 metres above the surface",
    chart: "line",
    color: "#c75518",
  }),
  wind_direction_10m: Object.freeze({
    title: "Wind direction",
    description: "Where the wind is coming from, sampled across the window",
    chart: "direction",
    color: "#16705d",
  }),
  visibility: Object.freeze({
    title: "Visibility",
    description: "Forecast sight distance; lower values mean poorer visibility",
    chart: "area",
    color: "#486b9b",
  }),
  snow_depth: Object.freeze({
    title: "Snow depth",
    description: "Modelled snowpack depth at the forecast grid",
    chart: "line",
    color: "#167a9b",
  }),
});

const degreesToCardinal = (rawDegrees) => {
  const degrees = toFiniteNumber(rawDegrees);
  if (degrees === null) return "—";
  const labels = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
  const normalized = ((degrees % 360) + 360) % 360;
  return labels[Math.round(normalized / 22.5) % labels.length];
};

const metricUnit = (metricKey, mode = currentUnitMode()) => {
  if (metricKey === "snowfall") return fieldGuideUnits.unitLabel ? fieldGuideUnits.unitLabel("snow", mode) : "cm";
  if (metricKey === "rain") return fieldGuideUnits.unitLabel ? fieldGuideUnits.unitLabel("rain", mode) : "mm";
  if (metricKey === "precipitation_probability") return "%";
  if (metricKey === "snow_depth") return mode === "imperial" ? "ft" : "m";
  if (metricKey === "wind_speed_10m") return mode === "imperial" ? "mph" : "km/h";
  if (metricKey === "wind_direction_10m") return "°";
  if (metricKey === "visibility") return mode === "imperial" ? "mi" : "km";
  return "";
};

const convertHourlyMetric = (metricKey, rawValue, mode = currentUnitMode()) => {
  const value = toFiniteNumber(rawValue);
  if (value === null) return null;
  if (metricKey === "snowfall") {
    return fieldGuideUnits.convertValue ? fieldGuideUnits.convertValue("snow", value, mode) : value;
  }
  if (metricKey === "rain") {
    return fieldGuideUnits.convertValue ? fieldGuideUnits.convertValue("rain", value, mode) : value;
  }
  if (metricKey === "snow_depth") return mode === "imperial" ? value * 3.28084 : value;
  if (metricKey === "wind_speed_10m") return mode === "imperial" ? value / 1.609344 : value;
  if (metricKey === "visibility") return mode === "imperial" ? value / 1609.344 : value / 1000;
  return value;
};

const metricDigits = (metricKey, mode = currentUnitMode()) => {
  if (metricKey === "precipitation_probability" || metricKey === "wind_direction_10m") return 0;
  if (metricKey === "rain" && mode === "imperial") return 2;
  if (metricKey === "visibility") return 1;
  return 1;
};

const formatMetricValue = (metricKey, rawValue, options = {}) => {
  const mode = options.mode || currentUnitMode();
  const converted = convertHourlyMetric(metricKey, rawValue, mode);
  if (converted === null) return "—";
  if (metricKey === "wind_direction_10m") {
    return `${degreesToCardinal(converted)} ${Math.round(converted)}°`;
  }
  const digits = Number.isInteger(options.digits) ? options.digits : metricDigits(metricKey, mode);
  const number = converted.toFixed(digits);
  if (options.withUnit === false) return number;
  if (metricKey === "precipitation_probability") return `${number}%`;
  const unit = metricUnit(metricKey, mode);
  return unit ? `${number} ${unit}` : number;
};

const friendlyHour = (rawTime) => {
  const text = String(rawTime || "").trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(text);
  if (!match) return text || "the selected window";
  try {
    const date = new Date(Date.UTC(
      Number(match[1]),
      Number(match[2]) - 1,
      Number(match[3]),
      Number(match[4]),
      Number(match[5]),
    ));
    return new Intl.DateTimeFormat(undefined, {
      weekday: "short",
      hour: "numeric",
      minute: match[5] === "00" ? undefined : "2-digit",
      timeZone: "UTC",
    }).format(date);
  } catch (_error) {
    return text.replace("T", " ");
  }
};

const finiteSeries = (values) => values.map((value) => toFiniteNumber(value));

const extremeIndex = (values, type = "max") => {
  let selectedIndex = -1;
  let selectedValue = null;
  values.forEach((value, index) => {
    const number = toFiniteNumber(value);
    if (number === null) return;
    if (selectedValue === null || (type === "min" ? number < selectedValue : number > selectedValue)) {
      selectedIndex = index;
      selectedValue = number;
    }
  });
  return { index: selectedIndex, value: selectedValue };
};

const chartYBounds = (metricKey, values) => {
  if (metricKey === "precipitation_probability") return { min: 0, max: 100 };
  const finiteValues = values.filter((value) => value !== null);
  if (!finiteValues.length) return null;
  let min = Math.min(...finiteValues);
  let max = Math.max(...finiteValues);
  if (["snowfall", "rain", "wind_speed_10m"].includes(metricKey)) {
    min = 0;
    max = Math.max(max * 1.1, metricKey === "wind_speed_10m" ? 5 : 1);
    return { min, max };
  }
  const span = max - min;
  const pad = span > 0 ? span * 0.12 : (Math.abs(max) * 0.08 || 1);
  min = Math.max(0, min - pad);
  max += pad;
  return { min, max };
};

const chartLinePath = (values, xForIndex, yForValue) => {
  let path = "";
  let open = false;
  values.forEach((value, idx) => {
    if (value === null) {
      open = false;
      return;
    }
    const x = xForIndex(idx);
    const y = yForValue(value);
    path += `${open ? "L" : "M"}${x.toFixed(2)} ${y.toFixed(2)} `;
    open = true;
  });
  return path.trim();
};

const chartAreaPath = (values, xForIndex, yForValue, baselineY) => {
  const segments = [];
  let current = [];
  values.forEach((value, index) => {
    if (value === null) {
      if (current.length) segments.push(current);
      current = [];
      return;
    }
    current.push({ index, value });
  });
  if (current.length) segments.push(current);
  return segments.map((segment) => {
    const first = segment[0];
    const last = segment[segment.length - 1];
    const line = segment.map((point) => `L${xForIndex(point.index).toFixed(2)} ${yForValue(point.value).toFixed(2)}`).join(" ");
    return `M${xForIndex(first.index).toFixed(2)} ${baselineY.toFixed(2)} ${line} L${xForIndex(last.index).toFixed(2)} ${baselineY.toFixed(2)} Z`;
  }).join(" ");
};

const resolveChartWidth = () => {
  if (!chartsEl) return 720;
  const containerWidth = chartsEl.getBoundingClientRect().width || chartsEl.clientWidth || 720;
  const isSingleColumn = typeof window.matchMedia === "function"
    && window.matchMedia("(max-width: 980px)").matches;
  const columns = isSingleColumn ? 1 : (activeHourlyGroup === "storm" ? 3 : 2);
  const gap = 12;
  const cardHorizontalPadding = 22;
  const rawCardWidth = (containerWidth - (gap * (columns - 1))) / columns;
  return Math.max(320, Math.round(rawCardWidth - cardHorizontalPadding));
};

const metricSummary = (metricKey, rawValues) => {
  const finite = rawValues.map((value) => toFiniteNumber(value)).filter((value) => value !== null);
  if (!finite.length) return "No readings";
  if (["snowfall", "rain"].includes(metricKey)) {
    const total = finite.reduce((sum, value) => sum + value, 0);
    return `Total ${formatMetricValue(metricKey, total)}`;
  }
  if (metricKey === "visibility") {
    return `Low ${formatMetricValue(metricKey, Math.min(...finite))}`;
  }
  if (metricKey === "snow_depth") {
    return `Latest ${formatMetricValue(metricKey, finite[finite.length - 1])}`;
  }
  return `Peak ${formatMetricValue(metricKey, Math.max(...finite))}`;
};

const renderMetricChartCard = (metricKey, times, rawValues, chartWidth) => {
  const metric = METRIC_PRESENTATION[metricKey];
  const card = document.createElement("article");
  card.className = "chart-card";
  card.dataset.metric = metricKey;

  const header = document.createElement("div");
  header.className = "chart-card-header";
  const copy = document.createElement("div");
  const title = document.createElement("h3");
  title.className = "chart-title";
  title.textContent = metric.title;
  copy.appendChild(title);

  const subtitle = document.createElement("p");
  subtitle.className = "chart-subtitle";
  subtitle.textContent = `${metric.description} · ${metricUnit(metricKey)}`;
  copy.appendChild(subtitle);

  const summary = document.createElement("strong");
  summary.className = "chart-summary-value";
  summary.textContent = metricSummary(metricKey, rawValues);
  header.appendChild(copy);
  header.appendChild(summary);
  card.appendChild(header);

  const values = rawValues.map((value) => convertHourlyMetric(metricKey, value));

  const finiteValues = values.filter((v) => v !== null);
  if (!times.length || !finiteValues.length) {
    const empty = document.createElement("div");
    empty.className = "chart-empty";
    empty.textContent = "No data";
    card.appendChild(empty);
    return card;
  }
  if (metric.chart === "bar" && finiteValues.every((value) => value === 0)) {
    const empty = document.createElement("div");
    empty.className = "chart-empty chart-empty-zero";
    empty.textContent = metricKey === "snowfall"
      ? "No hourly snow accumulation is modelled in this window."
      : "No hourly rain accumulation is modelled in this window.";
    card.appendChild(empty);
    return card;
  }

  const yBounds = chartYBounds(metricKey, values);
  if (!yBounds) {
    const empty = document.createElement("div");
    empty.className = "chart-empty";
    empty.textContent = "No data";
    card.appendChild(empty);
    return card;
  }

  const width = Math.max(320, Number(chartWidth) || 720);
  const height = 220;
  const padLeft = 44;
  const padRight = 16;
  const padTop = 12;
  const padBottom = 42;
  const innerW = Math.max(1, width - padLeft - padRight);
  const innerH = Math.max(1, height - padTop - padBottom);
  const ySpan = Math.max(1e-9, yBounds.max - yBounds.min);
  const xDenom = Math.max(1, times.length - 1);

  const xForIndex = (idx) => padLeft + ((idx / xDenom) * innerW);
  const yForValue = (val) => padTop + (((yBounds.max - val) / ySpan) * innerH);

  const svgWrap = document.createElement("div");
  svgWrap.className = "chart-svg-wrap";
  const svgNs = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(svgNs, "svg");
  svg.setAttribute("class", "chart-svg");
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", `${metric.title} by hour. ${summary.textContent}.`);

  const yTicks = 4;
  for (let i = 0; i <= yTicks; i += 1) {
    const ratio = i / yTicks;
    const y = padTop + (ratio * innerH);
    const value = yBounds.max - (ratio * ySpan);

    const grid = document.createElementNS(svgNs, "line");
    grid.setAttribute("class", "chart-grid-line");
    grid.setAttribute("x1", String(padLeft));
    grid.setAttribute("x2", String(width - padRight));
    grid.setAttribute("y1", y.toFixed(2));
    grid.setAttribute("y2", y.toFixed(2));
    svg.appendChild(grid);

    const tick = document.createElementNS(svgNs, "text");
    tick.setAttribute("class", "chart-tick-text");
    tick.setAttribute("x", String(padLeft - 6));
    tick.setAttribute("y", String(y + 3));
    tick.setAttribute("text-anchor", "end");
    tick.textContent = value.toFixed(metricDigits(metricKey));
    svg.appendChild(tick);
  }

  const xTicks = Math.min(6, times.length);
  for (let i = 0; i < xTicks; i += 1) {
    const idx = Math.round((i / Math.max(1, xTicks - 1)) * (times.length - 1));
    const x = xForIndex(idx);
    const { dateLabel, timeLabel } = splitTimeLabel(times[idx]);
    const tick = document.createElementNS(svgNs, "text");
    tick.setAttribute("class", "chart-tick-text");
    tick.setAttribute("x", x.toFixed(2));
    tick.setAttribute("y", String(height - 22));
    tick.setAttribute("text-anchor", "middle");
    const dateTspan = document.createElementNS(svgNs, "tspan");
    dateTspan.setAttribute("x", x.toFixed(2));
    dateTspan.setAttribute("dy", "0");
    dateTspan.textContent = dateLabel;
    tick.appendChild(dateTspan);
    const timeTspan = document.createElementNS(svgNs, "tspan");
    timeTspan.setAttribute("x", x.toFixed(2));
    timeTspan.setAttribute("dy", "11");
    timeTspan.textContent = timeLabel;
    tick.appendChild(timeTspan);
    svg.appendChild(tick);
  }

  const axisX = document.createElementNS(svgNs, "line");
  axisX.setAttribute("class", "chart-axis-line");
  axisX.setAttribute("x1", String(padLeft));
  axisX.setAttribute("x2", String(width - padRight));
  axisX.setAttribute("y1", String(height - padBottom));
  axisX.setAttribute("y2", String(height - padBottom));
  svg.appendChild(axisX);

  const axisY = document.createElementNS(svgNs, "line");
  axisY.setAttribute("class", "chart-axis-line");
  axisY.setAttribute("x1", String(padLeft));
  axisY.setAttribute("x2", String(padLeft));
  axisY.setAttribute("y1", String(padTop));
  axisY.setAttribute("y2", String(height - padBottom));
  svg.appendChild(axisY);

  if (metric.chart === "bar") {
    const baselineY = yForValue(0);
    const barWidth = Math.max(1.5, Math.min(18, (innerW / Math.max(1, times.length)) * 0.68));
    values.forEach((value, index) => {
      if (value === null) return;
      const bar = document.createElementNS(svgNs, "rect");
      const y = yForValue(Math.max(0, value));
      bar.setAttribute("class", "chart-bar");
      bar.setAttribute("x", (xForIndex(index) - (barWidth / 2)).toFixed(2));
      bar.setAttribute("y", y.toFixed(2));
      bar.setAttribute("width", barWidth.toFixed(2));
      bar.setAttribute("height", Math.max(0, baselineY - y).toFixed(2));
      bar.setAttribute("fill", metric.color);
      svg.appendChild(bar);
    });
  } else {
    if (metric.chart === "area") {
      const area = document.createElementNS(svgNs, "path");
      area.setAttribute("class", "chart-area");
      area.setAttribute("fill", metric.color);
      area.setAttribute("d", chartAreaPath(values, xForIndex, yForValue, yForValue(yBounds.min)));
      svg.appendChild(area);
    }
    const line = document.createElementNS(svgNs, "path");
    line.setAttribute("class", "chart-line");
    line.setAttribute("stroke", metric.color);
    line.setAttribute("d", chartLinePath(values, xForIndex, yForValue));
    svg.appendChild(line);
  }

  svgWrap.appendChild(svg);
  card.appendChild(svgWrap);
  return card;
};

const renderWindDirectionCard = (times, rawValues) => {
  const metric = METRIC_PRESENTATION.wind_direction_10m;
  const card = document.createElement("article");
  card.className = "chart-card wind-direction-card";
  card.dataset.metric = "wind_direction_10m";
  const title = document.createElement("h3");
  title.className = "chart-title";
  title.textContent = metric.title;
  const subtitle = document.createElement("p");
  subtitle.className = "chart-subtitle";
  subtitle.textContent = metric.description;
  card.appendChild(title);
  card.appendChild(subtitle);

  const validIndexes = rawValues
    .map((value, index) => (toFiniteNumber(value) === null ? -1 : index))
    .filter((index) => index >= 0);
  if (!validIndexes.length) {
    const empty = document.createElement("div");
    empty.className = "chart-empty";
    empty.textContent = "No wind direction readings in this window.";
    card.appendChild(empty);
    return card;
  }
  const step = Math.max(1, Math.ceil(validIndexes.length / 12));
  const sampled = validIndexes.filter((_, index) => index % step === 0);
  const lastIndex = validIndexes[validIndexes.length - 1];
  if (!sampled.includes(lastIndex)) sampled.push(lastIndex);

  const grid = document.createElement("div");
  grid.className = "wind-direction-grid";
  sampled.forEach((index) => {
    const degrees = toFiniteNumber(rawValues[index]);
    const sample = document.createElement("div");
    sample.className = "wind-direction-sample";
    sample.setAttribute("aria-label", `${friendlyHour(times[index])}: wind from ${degreesToCardinal(degrees)}, ${Math.round(degrees)} degrees`);
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    svg.style.transform = `rotate(${degrees}deg)`;
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", "M12 20V4m0 0-5 5m5-5 5 5");
    svg.appendChild(path);
    const direction = document.createElement("strong");
    direction.textContent = `${degreesToCardinal(degrees)} ${Math.round(degrees)}°`;
    const time = document.createElement("span");
    time.textContent = friendlyHour(times[index]);
    sample.appendChild(svg);
    sample.appendChild(direction);
    sample.appendChild(time);
    grid.appendChild(sample);
  });
  card.appendChild(grid);
  return card;
};

const renderHourlyNarrative = (payload) => {
  if (!hourlyNarrativeEl) return;
  const hourly = payload?.hourly || {};
  const times = Array.isArray(hourly.time) ? hourly.time : [];
  const windowLabel = `${times.length || 0}-hour window`;
  if (!times.length) {
    hourlyNarrativeEl.textContent = "Hourly readings are not available for this forecast window.";
    return;
  }
  if (activeHourlyGroup === "storm") {
    const snow = finiteSeries(Array.isArray(hourly.snowfall) ? hourly.snowfall : []);
    const rain = finiteSeries(Array.isArray(hourly.rain) ? hourly.rain : []);
    const snowTotal = snow.reduce((sum, value) => sum + (value || 0), 0);
    const rainTotal = rain.reduce((sum, value) => sum + (value || 0), 0);
    const probability = extremeIndex(Array.isArray(hourly.precipitation_probability) ? hourly.precipitation_probability : []);
    const accumulation = snowTotal > 0 || rainTotal > 0
      ? `the model shows ${formatMetricValue("snowfall", snowTotal)} of snow and ${formatMetricValue("rain", rainTotal)} of rain.`
      : "no accumulating snow or rain is currently modelled.";
    const chance = probability.value === null
      ? "Precipitation probability is unavailable."
      : `The highest precipitation chance is ${Math.round(probability.value)}% around ${friendlyHour(times[probability.index])}.`;
    hourlyNarrativeEl.textContent = `Across this ${windowLabel}, ${accumulation} ${chance}`;
    return;
  }
  if (activeHourlyGroup === "wind") {
    const wind = Array.isArray(hourly.wind_speed_10m) ? hourly.wind_speed_10m : [];
    const peak = extremeIndex(wind);
    if (peak.value === null) {
      hourlyNarrativeEl.textContent = `Wind readings are unavailable across this ${windowLabel}.`;
      return;
    }
    const directions = Array.isArray(hourly.wind_direction_10m) ? hourly.wind_direction_10m : [];
    const direction = toFiniteNumber(directions[peak.index]);
    const directionCopy = direction === null ? "Direction is unavailable at that hour." : `It is coming from ${degreesToCardinal(direction)} (${Math.round(direction)}°) at that hour.`;
    hourlyNarrativeEl.textContent = `Peak wind reaches ${formatMetricValue("wind_speed_10m", peak.value)} around ${friendlyHour(times[peak.index])}. ${directionCopy}`;
    return;
  }
  const visibility = Array.isArray(hourly.visibility) ? hourly.visibility : [];
  const minimum = extremeIndex(visibility, "min");
  const depth = (Array.isArray(hourly.snow_depth) ? hourly.snow_depth : [])
    .map((value) => toFiniteNumber(value))
    .filter((value) => value !== null);
  const visibilityCopy = minimum.value === null
    ? "Visibility readings are unavailable."
    : `Visibility is lowest at ${formatMetricValue("visibility", minimum.value)} around ${friendlyHour(times[minimum.index])}.`;
  const depthCopy = depth.length
    ? `Modelled snow depth ends near ${formatMetricValue("snow_depth", depth[depth.length - 1])}.`
    : "Snow-depth readings are unavailable.";
  hourlyNarrativeEl.textContent = `${visibilityCopy} ${depthCopy}`;
};

const renderHourlyCharts = (payload) => {
  if (!chartsEl) return;
  lastHourlyPayload = payload;
  chartsEl.innerHTML = "";
  const hourly = payload?.hourly || {};
  const times = Array.isArray(hourly.time) ? hourly.time : [];
  const chartWidth = resolveChartWidth();
  const frag = document.createDocumentFragment();
  const group = HOURLY_GROUPS[activeHourlyGroup] || HOURLY_GROUPS.storm;
  chartsEl.dataset.hourlyGroup = activeHourlyGroup;
  group.metrics.forEach((metricKey) => {
    const rawValues = Array.isArray(hourly[metricKey]) ? hourly[metricKey] : [];
    if (metricKey === "wind_direction_10m") {
      frag.appendChild(renderWindDirectionCard(times, rawValues));
    } else {
      frag.appendChild(renderMetricChartCard(metricKey, times, rawValues, chartWidth));
    }
  });
  chartsEl.appendChild(frag);
  chartsEl.setAttribute("aria-labelledby", `hourly-tab-${activeHourlyGroup}`);
  renderHourlyNarrative(payload);
};

const rerenderChartsForResize = () => {
  if (!lastHourlyPayload) return;
  if (chartResizeRafId !== null) {
    window.cancelAnimationFrame(chartResizeRafId);
  }
  chartResizeRafId = window.requestAnimationFrame(() => {
    chartResizeRafId = null;
    try {
      renderHourlyCharts(lastHourlyPayload);
    } catch (chartErr) {
      setChartError(chartErr instanceof Error ? chartErr.message : String(chartErr));
    }
  });
};

const buildMergedTimelineDays = () => {
  const history = Array.isArray(dailySummary?.past14dDaily) ? dailySummary.past14dDaily : [];
  const forecast = Array.isArray(dailySummary?.daily) ? dailySummary.daily : [];
  const merged = [];

  history.forEach((day, index) => {
    merged.push({
      ...day,
      summary_phase: "history",
      summary_label: friendlyDate(day?.date, `Past day ${index + 1}`),
    });
  });

  forecast.forEach((day, index) => {
    merged.push({
      ...day,
      summary_phase: "forecast",
      summary_label: index === 0 ? "Today" : friendlyDate(day?.date, `Forecast day ${index + 1}`),
      summary_is_today: index === 0,
    });
  });

  return merged;
};

const centerTimelineOnToday = () => {
  if (!timelineRoot || timelineAutoCentered) return;
  const wrap = timelineRoot.querySelector(".field-guide-timeline");
  const todayCell = timelineRoot.querySelector("[data-timeline-today='1']");
  if (!(wrap instanceof HTMLElement) || !(todayCell instanceof HTMLElement)) return;
  const targetLeft = todayCell.offsetLeft + (todayCell.offsetWidth / 2) - (wrap.clientWidth / 2);
  const maxScroll = Math.max(0, wrap.scrollWidth - wrap.clientWidth);
  wrap.scrollLeft = Math.max(0, Math.min(maxScroll, targetLeft));
  timelineAutoCentered = true;
};

const daylightValue = (day, key) => {
  const local = String(day?.[`${key}_local_hhmm`] || "").trim();
  if (local) return local;
  const iso = String(day?.[`${key}_iso`] || "").trim();
  const match = /T(\d{2}:\d{2})/.exec(iso);
  return match ? match[1] : "—";
};

const appendDefinition = (list, term, value) => {
  const wrapper = document.createElement("div");
  const dt = document.createElement("dt");
  dt.textContent = term;
  const dd = document.createElement("dd");
  dd.textContent = value;
  wrapper.appendChild(dt);
  wrapper.appendChild(dd);
  list.appendChild(wrapper);
};

const renderTimelineSummary = () => {
  if (!timelineSection || !timelineRoot) return;
  const merged = buildMergedTimelineDays();
  if (!merged.length) {
    timelineSection.hidden = true;
    timelineRoot.innerHTML = "";
    return;
  }
  timelineRoot.textContent = "";
  const unitMode = currentUnitMode();
  const temperatureUnit = fieldGuideUnits.unitLabel ? fieldGuideUnits.unitLabel("temperature", unitMode) : "°C";
  const wrap = document.createElement("div");
  wrap.className = "field-guide-timeline";
  wrap.tabIndex = 0;
  wrap.setAttribute("aria-label", "Recent conditions and daily forecast. Scroll horizontally for more dates.");
  const track = document.createElement("div");
  track.className = "field-guide-timeline-track";
  merged.forEach((day) => {
    const isToday = Boolean(day.summary_is_today);
    const phase = isToday ? "today" : (day.summary_phase === "history" ? "history" : "forecast");
    const phaseLabel = isToday ? "Today" : (phase === "history" ? "Past" : "Forecast");
    const card = document.createElement("article");
    card.className = "timeline-day-card";
    card.dataset.phase = phase;
    if (isToday) card.dataset.timelineToday = "1";

    const topline = document.createElement("div");
    topline.className = "timeline-card-topline";
    const phaseEl = document.createElement("span");
    phaseEl.className = "timeline-phase";
    phaseEl.textContent = phaseLabel;
    const date = document.createElement("time");
    date.className = "timeline-date";
    date.dateTime = String(day.date || "");
    date.textContent = friendlyDate(day.date, day.summary_label || phaseLabel);
    topline.appendChild(phaseEl);
    topline.appendChild(date);

    const condition = document.createElement("div");
    condition.className = "timeline-condition";
    const icon = document.createElement("span");
    icon.innerHTML = fieldGuideWeather.iconHtml
      ? fieldGuideWeather.iconHtml(day.weather_code)
      : '<span class="field-guide-weather-icon" role="img" aria-label="Conditions unavailable">?</span>';
    const conditionName = document.createElement("strong");
    conditionName.textContent = fieldGuideWeather.conditionName
      ? fieldGuideWeather.conditionName(day.weather_code)
      : "Conditions unavailable";
    condition.appendChild(icon);
    condition.appendChild(conditionName);

    const temperature = document.createElement("div");
    temperature.className = "timeline-temperature";
    const high = document.createElement("strong");
    const low = document.createElement("span");
    const highValue = fieldGuideUnits.formatTemperature
      ? fieldGuideUnits.formatTemperature(day.temperature_max_c, unitMode, { withUnit: false, digits: 0 })
      : formatValue(day.temperature_max_c);
    const lowValue = fieldGuideUnits.formatTemperature
      ? fieldGuideUnits.formatTemperature(day.temperature_min_c, unitMode, { withUnit: false, digits: 0 })
      : formatValue(day.temperature_min_c);
    high.textContent = `High ${highValue} ${temperatureUnit}`;
    low.textContent = `Low ${lowValue} ${temperatureUnit}`;
    temperature.appendChild(high);
    temperature.appendChild(low);

    const metrics = document.createElement("dl");
    metrics.className = "timeline-metrics";
    appendDefinition(metrics, "Snow", fieldGuideUnits.formatSnow
      ? fieldGuideUnits.formatSnow(day.snowfall_cm, unitMode)
      : `${formatValue(day.snowfall_cm)} cm`);
    appendDefinition(metrics, "Rain", fieldGuideUnits.formatRain
      ? fieldGuideUnits.formatRain(day.rain_mm, unitMode)
      : `${formatValue(day.rain_mm)} mm`);

    const daylight = document.createElement("dl");
    daylight.className = "timeline-daylight";
    appendDefinition(daylight, "Sunrise", daylightValue(day, "sunrise"));
    appendDefinition(daylight, "Sunset", daylightValue(day, "sunset"));

    card.appendChild(topline);
    card.appendChild(condition);
    card.appendChild(temperature);
    card.appendChild(metrics);
    card.appendChild(daylight);
    track.appendChild(card);
  });
  wrap.appendChild(track);
  timelineRoot.appendChild(wrap);
  timelineSection.hidden = false;
  window.requestAnimationFrame(centerTimelineOnToday);
};

const renderHourlyTable = (payload) => {
  if (!thead || !tbody) return;
  const hourly = payload?.hourly || {};
  const times = Array.isArray(hourly.time) ? hourly.time : [];
  const metricKeys = metricDefs.length
    ? metricDefs.map((metric) => metric.key)
    : [...new Set(Object.values(HOURLY_GROUPS).flatMap((group) => group.metrics))];
  thead.textContent = "";
  tbody.textContent = "";
  const headRow = document.createElement("tr");
  const timeHead = document.createElement("th");
  timeHead.scope = "col";
  timeHead.textContent = "Local time";
  headRow.appendChild(timeHead);
  metricKeys.forEach((metricKey) => {
    const th = document.createElement("th");
    th.scope = "col";
    const title = METRIC_PRESENTATION[metricKey]?.title || metricKey;
    const unit = metricKey === "wind_direction_10m" ? "cardinal / °" : metricUnit(metricKey);
    th.textContent = unit ? `${title} (${unit})` : title;
    headRow.appendChild(th);
  });
  thead.appendChild(headRow);

  times.forEach((timeValue, index) => {
    const row = document.createElement("tr");
    const timeCell = document.createElement("td");
    const time = document.createElement("time");
    time.dateTime = String(timeValue || "");
    time.textContent = friendlyHour(timeValue);
    time.title = String(timeValue || "");
    timeCell.appendChild(time);
    row.appendChild(timeCell);
    metricKeys.forEach((metricKey) => {
      const cell = document.createElement("td");
      const values = Array.isArray(hourly[metricKey]) ? hourly[metricKey] : [];
      cell.textContent = formatMetricValue(metricKey, values[index], { withUnit: false });
      row.appendChild(cell);
    });
    tbody.appendChild(row);
  });
};

const selectHourlyGroup = (groupKey, options = {}) => {
  if (!Object.prototype.hasOwnProperty.call(HOURLY_GROUPS, groupKey)) return;
  activeHourlyGroup = groupKey;
  hourlyTabButtons.forEach((button) => {
    const selected = button.dataset.hourlyGroup === groupKey;
    button.setAttribute("aria-selected", selected ? "true" : "false");
    button.tabIndex = selected ? 0 : -1;
    if (selected && options.focus) button.focus();
  });
  if (chartsEl) chartsEl.setAttribute("aria-labelledby", `hourly-tab-${groupKey}`);
  if (lastHourlyPayload) renderHourlyCharts(lastHourlyPayload);
};

const loadHourly = async () => {
  if (!resortId) {
    setError("We could not identify this resort. Return to All resorts and choose it again.");
    return;
  }
  const hours = hoursSelect ? String(hoursSelect.value || "72") : "72";
  setError("");
  setChartError("");
  if (metaEl) metaEl.textContent = "Loading the latest hourly field report…";

  try {
    let payload;
    if (hourlyDataUrl) {
      const staticUrl = new URL(hourlyDataUrl, window.location.href);
      const resp = await fetch(staticUrl.toString());
      const rawPayload = await resp.json();
      if (!resp.ok) {
        throw new Error(rawPayload.error || `HTTP ${resp.status}`);
      }
      payload = typeof trimHourlyPayload === "function"
        ? trimHourlyPayload(rawPayload, Number(hours))
        : rawPayload;
    } else {
      const endpoint = new URL(withPrefix("/api/resort-hourly"), window.location.origin);
      endpoint.searchParams.set("resort_id", resortId);
      endpoint.searchParams.set("hours", hours);
      const resp = await fetch(endpoint.toString());
      payload = await resp.json();
      if (!resp.ok) {
        throw new Error(payload.error || `HTTP ${resp.status}`);
      }
    }
    renderResortIdentity(payload);
    metaState = {
      timezone: String(payload.timezone || "").trim(),
      model: String(payload.model || "").trim(),
      count: Number(payload.hours) || 0,
      coordFragment: buildCoordinateMetaFragment(payload),
    };
    renderLocalTime();
    renderWebsiteLink(payload);
    renderResortLocationLink(payload);
    renderNearbyAirports(payload);
    renderMeta();
    syncLocalTimeTimer();
    renderHourlyTable(payload);
    try {
      renderHourlyCharts(payload);
    } catch (chartErr) {
      setChartError(chartErr instanceof Error ? chartErr.message : String(chartErr));
    }
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    setError(`We could not load the hourly forecast. ${detail}`.trim());
    setChartError("");
    metaState = null;
    lastHourlyPayload = null;
    syncLocalTimeTimer();
    renderLocalTime();
    renderWebsiteLink(null);
    renderResortLocationLink(null);
    renderNearbyAirports(null);
    renderMeta();
    if (thead) thead.innerHTML = "";
    if (tbody) tbody.innerHTML = "";
    if (chartsEl) chartsEl.innerHTML = "";
    if (hourlyNarrativeEl) hourlyNarrativeEl.textContent = "Daily information is still available above; try refreshing the hourly report in a moment.";
  }
};

if (refreshBtn) {
  refreshBtn.addEventListener("click", loadHourly);
}
if (hoursSelect) {
  hoursSelect.addEventListener("change", loadHourly);
}
hourlyTabButtons.forEach((button, buttonIndex) => {
  button.addEventListener("click", () => selectHourlyGroup(button.dataset.hourlyGroup || "storm"));
  button.addEventListener("keydown", (event) => {
    let targetIndex = buttonIndex;
    if (event.key === "ArrowRight") targetIndex = (buttonIndex + 1) % hourlyTabButtons.length;
    else if (event.key === "ArrowLeft") targetIndex = (buttonIndex - 1 + hourlyTabButtons.length) % hourlyTabButtons.length;
    else if (event.key === "Home") targetIndex = 0;
    else if (event.key === "End") targetIndex = hourlyTabButtons.length - 1;
    else return;
    event.preventDefault();
    const target = hourlyTabButtons[targetIndex];
    selectHourlyGroup(target?.dataset.hourlyGroup || "storm", { focus: true });
  });
});
window.addEventListener("resize", rerenderChartsForResize);
window.addEventListener("closesnow:unitschange", () => {
  renderResortSnapshot();
  timelineAutoCentered = false;
  renderTimelineSummary();
  renderNearbyAirports(lastHourlyPayload);
  if (lastHourlyPayload) {
    renderHourlyTable(lastHourlyPayload);
    renderHourlyCharts(lastHourlyPayload);
  }
});

renderResortIdentity(null);
renderResortOutlook();
renderResortSnapshot();
renderTimelineSummary();
renderNearbyAirports(null);
selectHourlyGroup(activeHourlyGroup);
loadHourly();
