const context = window.CLOSESNOW_HOURLY_CONTEXT || {};
const resortId = String(context.resortId || "").trim();
const hourlyDataUrl = String(context.hourlyDataUrl || "").trim();
const dailySummary = context.dailySummary && typeof context.dailySummary === "object" ? context.dailySummary : null;
const compactDailySummary = window.CloseSnowCompactDailySummary || {};
const hourlyMetricHelpers = window.CloseSnowResortHourlyMetrics || {};

const hoursSelect = document.getElementById("hours-select");
const refreshBtn = document.getElementById("hours-refresh-btn");
const titleEl = document.getElementById("hourly-title");
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
const chartsEl = document.getElementById("hourly-charts");
const table = document.getElementById("hourly-table");
const thead = table ? table.querySelector("thead") : null;
const tbody = table ? table.querySelector("tbody") : null;
let metaState = null;
let localTimeTimerId = null;
let timelineAutoCentered = false;
let lastHourlyPayload = null;
let chartResizeRafId = null;

const metricDefs = Array.isArray(hourlyMetricHelpers.metricDefs) ? hourlyMetricHelpers.metricDefs : [];
const trimHourlyPayload = hourlyMetricHelpers.trimHourlyPayload;

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

// Shared by the resort overview and the raw hourly table, not chart-specific.
const toFiniteNumber = (value) => {
  if (typeof value !== "number" && typeof value !== "string") return null;
  if (typeof value === "string" && !value.trim()) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const formatValue = (value) => {
  const number = toFiniteNumber(value);
  if (number === null) return "—";
  return window.CloseSnowHourlyExplorer?.formatNumber(number) || String(number);
};

const formatCoordinateExact = (value) => {
  if (value === null || value === undefined || String(value).trim() === "") return "";
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

const buildCoordinateIssueLink = (payload, mapsUrl) => {
  const latitude = formatCoordinateExact(payload?.input_latitude);
  const longitude = formatCoordinateExact(payload?.input_longitude);
  if (!latitude || !longitude || !mapsUrl) return null;
  const link = buildExternalLink(
    buildCoordinateIssueUrl(payload, `${latitude}, ${longitude}`, mapsUrl),
    "Report map error",
    "resort-location-issue-link",
  );
  if (link) link.setAttribute("aria-label", `Report incorrect coordinates for ${resolveResortLabel(payload)}`);
  return link;
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
  metaEl.textContent = metaState.timezone ? `Times shown in resort local time (${metaState.timezone}).` : "";
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
  const link = buildExternalLink(url, "Official website ↗");
  if (!link) return;
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
  const latitude = formatCoordinateExact(payload.input_latitude);
  const longitude = formatCoordinateExact(payload.input_longitude);
  locationLinkEl.appendChild(document.createTextNode(`Coordinates: ${latitude}, ${longitude} · `));
  const mapsLink = buildExternalLink(mapsUrl, "Map", "resort-location-map-link");
  if (!mapsLink) return;
  mapsLink.setAttribute("aria-label", `Open ${resolveResortLabel(payload)} location in Google Maps`);
  locationLinkEl.appendChild(mapsLink);
  const issueLink = buildCoordinateIssueLink(payload, mapsUrl);
  if (issueLink) {
    locationLinkEl.appendChild(document.createTextNode(" · "));
    locationLinkEl.appendChild(issueLink);
  }
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
      distance.textContent = `${Math.round(airport.distanceMiles)} mi`;
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
  const weatherEmoji = window.CloseSnowWeatherCode?.emojiForWeatherCode
    ? window.CloseSnowWeatherCode.emojiForWeatherCode(weatherCode)
    : "❓";
  const temperature = high === null || low === null ? "--" : `${Math.round(high)}° / ${Math.round(low)}°`;
  snapshotEl.innerHTML = `
    <article class="snapshot-card snapshot-card-weather">
      <span class="snapshot-icon" aria-hidden="true">${weatherEmoji}</span>
      <span><small>Today</small><strong>${temperature}</strong><em>High / low °C</em></span>
    </article>
    <article class="snapshot-card">
      <span class="snapshot-icon snapshot-icon-snow" aria-hidden="true">❄</span>
      <span><small>7-day snow</small><strong>${snow.toFixed(1)} cm</strong></span>
    </article>
    <article class="snapshot-card">
      <span class="snapshot-icon snapshot-icon-rain" aria-hidden="true">◌</span>
      <span><small>7-day rain</small><strong>${rain.toFixed(1)} mm</strong></span>
    </article>`;
  snapshotEl.hidden = false;
};

let hourlyExplorer = null;
const renderHourlyCharts = (payload) => {
  if (!chartsEl) return;
  lastHourlyPayload = payload;
  if (!hourlyExplorer) hourlyExplorer = window.CloseSnowHourlyExplorer.create(chartsEl, metricDefs);
  hourlyExplorer.update(payload);
};

const rerenderChartsForResize = () => {
  if (!lastHourlyPayload || !hourlyExplorer) return;
  if (chartResizeRafId !== null) window.cancelAnimationFrame(chartResizeRafId);
  chartResizeRafId = window.requestAnimationFrame(() => {
    chartResizeRafId = null;
    hourlyExplorer.resize();
  });
};

const buildMergedTimelineDays = () => {
  const labelFor = typeof compactDailySummary.dayLabelFor === "function"
    ? compactDailySummary.dayLabelFor
    : (day, index, options = {}) => {
      const labelMode = options.labelMode === "calendar" ? "calendar" : "forecast";
      if (labelMode === "forecast" && index === 0) return "Today";
      return String(day?.date || "");
    };
  const history = Array.isArray(dailySummary?.past14dDaily) ? dailySummary.past14dDaily : [];
  const forecast = Array.isArray(dailySummary?.daily) ? dailySummary.daily : [];
  const merged = [];

  history.forEach((day, index) => {
    merged.push({
      ...day,
      summary_phase: "history",
      summary_label: labelFor(day, index, { labelMode: "calendar" }),
    });
  });

  forecast.forEach((day, index) => {
    merged.push({
      ...day,
      summary_phase: "forecast",
      summary_label: labelFor(day, index, { labelMode: "forecast" }),
      summary_is_today: index === 0,
    });
  });

  return merged;
};

const centerTimelineOnToday = () => {
  if (!timelineRoot || timelineAutoCentered) return;
  const wrap = timelineRoot.querySelector(".resort-daily-summary-wrap");
  const todayCell = timelineRoot.querySelector("[data-compact-today-anchor='1']");
  if (!(wrap instanceof HTMLElement) || !(todayCell instanceof HTMLElement)) return;
  const targetLeft = todayCell.offsetLeft + (todayCell.offsetWidth / 2) - (wrap.clientWidth / 2);
  const maxScroll = Math.max(0, wrap.scrollWidth - wrap.clientWidth);
  wrap.scrollLeft = Math.max(0, Math.min(maxScroll, targetLeft));
  timelineAutoCentered = true;
};

const renderTimelineSummary = () => {
  if (!timelineSection || !timelineRoot || !compactDailySummary.renderSingleResortHtml) return;
  const merged = buildMergedTimelineDays();
  if (!merged.length) {
    timelineSection.hidden = true;
    timelineRoot.innerHTML = "";
    return;
  }
  timelineRoot.innerHTML = compactDailySummary.renderSingleResortHtml(merged, {
    emptyText: "No forecast or recent history",
  });
  timelineSection.hidden = false;
  window.requestAnimationFrame(centerTimelineOnToday);
};

const renderHourlyTable = (payload) => {
  if (!thead || !tbody) return;
  const hourly = payload?.hourly || {};
  const times = Array.isArray(hourly.time) ? hourly.time : [];

  thead.innerHTML = `<tr>${["time", ...metricDefs.map((m) => m.label)].map((h) => `<th>${h}</th>`).join("")}</tr>`;

  const rows = times.map((time, idx) => {
    const cells = [`<td>${time}</td>`];
    metricDefs.forEach((metric) => {
      const values = Array.isArray(hourly[metric.key]) ? hourly[metric.key] : [];
      cells.push(`<td>${formatValue(values[idx])}</td>`);
    });
    return `<tr>${cells.join("")}</tr>`;
  });
  tbody.innerHTML = rows.join("");
};

const loadHourly = async () => {
  if (!resortId) {
    setError("Missing resort id.");
    return;
  }
  const hours = hoursSelect ? String(hoursSelect.value || "72") : "72";
  setError("");
  setChartError("");
  if (metaEl) metaEl.textContent = "Loading...";

  try {
    let payload;
    if (hourlyDataUrl) {
      const staticUrl = new URL(hourlyDataUrl, window.location.href);
      const resp = await fetch(staticUrl.toString());
      const rawPayload = await resp.json();
      if (!resp.ok) {
        throw new Error(rawPayload.error || `HTTP ${resp.status}`);
      }
      payload = trimHourlyPayload(rawPayload, Number(hours));
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
    if (titleEl) {
      const resortLabel = resolveResortLabel(payload);
      titleEl.textContent = resortLabel;
      document.title = `${resortLabel} · CloseSnow`;
    }
    metaState = {
      timezone: String(payload.timezone || "").trim(),
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
    setError(err instanceof Error ? err.message : String(err));
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
    if (hourlyExplorer) hourlyExplorer.update({ hourly: {} });
  }
};

if (refreshBtn) {
  refreshBtn.addEventListener("click", loadHourly);
}
if (hoursSelect) {
  hoursSelect.addEventListener("change", loadHourly);
}
window.addEventListener("resize", rerenderChartsForResize);

renderResortSnapshot();
renderTimelineSummary();
renderNearbyAirports(null);
loadHourly();
