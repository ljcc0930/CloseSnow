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

const formatValue = (value) => {
  if (value === null || value === undefined || value === "") return "";
  if (typeof value === "number") {
    if (Number.isInteger(value)) return String(value);
    return value.toFixed(1);
  }
  return String(value);
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

const chartYBounds = (metricKey, values) => {
  if (metricKey === "precipitation_probability") return { min: 0, max: 100, step: 25 };
  if (metricKey === "wind_direction_10m") return { min: 0, max: 360, step: 90 };
  const finiteValues = values.filter((value) => value !== null);
  if (!finiteValues.length) return null;
  // These measurements are nonnegative. Keep zero visible so small changes do
  // not look like large swings, and never give dry hours a negative rain axis.
  const min = Math.min(0, ...finiteValues);
  const max = Math.max(0, ...finiteValues);
  const roughStep = (max - min || 1) / 3;
  const magnitude = 10 ** Math.floor(Math.log10(roughStep));
  const step = [1, 2, 2.5, 5, 10].find((factor) => factor * magnitude >= roughStep) * magnitude;
  return {
    min: Math.floor(min / step) * step,
    max: Math.max(step, Math.ceil(max / step) * step),
    step,
  };
};

const chartLinePath = (values, xForIndex, yForValue, maxDelta = Infinity) => {
  let path = "";
  let previous = null;
  values.forEach((value, idx) => {
    if (value === null) {
      previous = null;
      return;
    }
    const connected = previous !== null && Math.abs(value - previous) <= maxDelta;
    path += `${connected ? "L" : "M"}${xForIndex(idx).toFixed(2)} ${yForValue(value).toFixed(2)} `;
    previous = value;
  });
  return path.trim();
};

const chartNumberFormatter = new Intl.NumberFormat("en-US", { maximumFractionDigits: 20 });
const chartValueLabel = (value) => chartNumberFormatter.format(value);

const chartTickLabel = (value) => {
  if (Math.abs(value) >= 1000) return `${Number((value / 1000).toFixed(2))}k`;
  return String(Number(value.toFixed(4)));
};

const chartTimeLabel = (rawTime) => {
  const { dateLabel, timeLabel } = splitTimeLabel(rawTime);
  const datePart = String(rawTime || "").split("T")[0];
  const date = new Date(`${datePart}T00:00:00Z`);
  return {
    dateLabel: Number.isNaN(date.getTime()) ? dateLabel : date.toLocaleDateString("en-US", {
      month: "short", day: "numeric", timeZone: "UTC",
    }),
    timeLabel,
  };
};

const chartTimeTickIndices = (times, innerWidth) => {
  if (!times.length) return [];
  // Parse the provider's local clock as a floating calendar value. Applying the
  // viewer's timezone here would move midnight labels away from resort midnight.
  const clockValues = times.map((time) => {
    const local = String(time).match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/);
    return local ? Date.parse(`${local[1]}T${local[2]}:00Z`) : NaN;
  });
  const first = clockValues[0];
  const last = clockValues[clockValues.length - 1];
  if (!Number.isFinite(first) || !Number.isFinite(last)) return [0];
  const hour = 60 * 60 * 1000;
  const maxTicks = Math.max(2, Math.min(5, Math.floor(innerWidth / 100) + 1));
  const minHours = (last - first) / hour / maxTicks;
  const intervalHours = [6, 12, 24, 48, 72, 96, 168].find((step) => step >= minHours) || 168;
  const firstDay = Math.floor(first / (24 * hour)) * 24 * hour;
  const indices = [];
  clockValues.forEach((clock, idx) => {
    if ((clock - firstDay) % (intervalHours * hour) !== 0) return;
    const previous = indices[indices.length - 1];
    const gap = ((idx - previous) / Math.max(1, times.length - 1)) * innerWidth;
    if (previous === undefined || gap >= 70) indices.push(idx);
  });
  return indices.length ? indices : [0];
};

const resolveChartWidth = () => {
  if (!chartsEl) return 720;
  const containerWidth = chartsEl.getBoundingClientRect().width || chartsEl.clientWidth || 720;
  const isSingleColumn = typeof window.matchMedia === "function"
    && window.matchMedia("(max-width: 980px)").matches;
  const gap = 16;
  const cardHorizontalPadding = 34;
  const rawCardWidth = isSingleColumn ? containerWidth : ((containerWidth - gap) / 2);
  return Math.max(220, Math.round(rawCardWidth - cardHorizontalPadding));
};

const renderMetricChartCard = (metric, times, values, chartWidth) => {
  const card = document.createElement("article");
  card.className = "chart-card";
  card.style.setProperty("--chart-accent", metric.color);

  const title = document.createElement("h2");
  title.className = "chart-title";
  title.textContent = metric.title;
  card.appendChild(title);

  const finiteValues = values.filter((value) => value !== null);
  if (!times.length || !finiteValues.length) {
    const empty = document.createElement("div");
    empty.className = "chart-empty";
    empty.textContent = "No data";
    card.appendChild(empty);
    return card;
  }

  const low = Math.min(...finiteValues);
  const high = Math.max(...finiteValues);
  const rangeLabel = low === high ? chartValueLabel(low) : `${chartValueLabel(low)}–${chartValueLabel(high)}`;
  const displayUnit = metric.key === "wind_direction_10m" ? "°" : metric.unit;
  const readout = document.createElement("div");
  readout.className = "chart-readout";
  const reading = document.createElement("span");
  reading.className = "chart-reading";
  reading.textContent = rangeLabel;
  const unit = document.createElement("span");
  unit.className = "chart-unit";
  unit.textContent = displayUnit;
  const readingTime = document.createElement("span");
  readingTime.className = "chart-reading-time";
  readingTime.textContent = "Forecast range";
  readout.appendChild(reading);
  readout.appendChild(unit);
  readout.appendChild(readingTime);
  card.appendChild(readout);

  const yBounds = chartYBounds(metric.key, values);
  const width = Math.max(220, Number(chartWidth) || 720);
  const height = 184;
  const padLeft = 34;
  const padRight = 10;
  const padTop = 10;
  const padBottom = 40;
  const innerW = width - padLeft - padRight;
  const innerH = height - padTop - padBottom;
  const ySpan = yBounds.max - yBounds.min;
  const xDenom = Math.max(1, times.length - 1);
  const xForIndex = (idx) => padLeft + ((idx / xDenom) * innerW);
  const yForValue = (value) => padTop + (((yBounds.max - value) / ySpan) * innerH);
  // A north crossing is a discontinuity on a 0–360 degree axis, not a sweep
  // through south. Preserve both observations without drawing that false ramp.
  const maxDelta = metric.key === "wind_direction_10m" ? 180 : Infinity;

  const svgWrap = document.createElement("div");
  svgWrap.className = "chart-svg-wrap";
  svgWrap.tabIndex = 0;
  svgWrap.setAttribute("role", "slider");
  svgWrap.setAttribute("aria-label", `${metric.title}, hourly forecast`);
  svgWrap.setAttribute("aria-orientation", "horizontal");
  svgWrap.setAttribute("aria-valuemin", "0");
  svgWrap.setAttribute("aria-valuemax", String(times.length - 1));
  const svgNs = "http://www.w3.org/2000/svg";
  const makeSvg = (tag, attributes, text = "") => {
    const element = document.createElementNS(svgNs, tag);
    Object.entries(attributes).forEach(([name, value]) => element.setAttribute(name, String(value)));
    if (text) element.textContent = text;
    return element;
  };
  const svg = makeSvg("svg", { class: "chart-svg", viewBox: `0 0 ${width} ${height}`, "aria-hidden": "true" });

  const yTicks = Math.round(ySpan / yBounds.step);
  for (let i = 0; i <= yTicks; i += 1) {
    const value = yBounds.min + (i * yBounds.step);
    const y = yForValue(value);
    svg.appendChild(makeSvg("line", {
      class: i === 0 ? "chart-baseline" : "chart-grid-line",
      x1: padLeft, x2: width - padRight, y1: y.toFixed(2), y2: y.toFixed(2),
    }));
    svg.appendChild(makeSvg("text", {
      class: "chart-tick-text", x: padLeft - 9, y: y + 3.5, "text-anchor": "end",
    }, metric.key === "wind_direction_10m" ? ["N", "E", "S", "W", "N"][Math.round(value / 90)] : chartTickLabel(value)));
  }

  const xTicks = chartTimeTickIndices(times, innerW);
  xTicks.forEach((idx) => {
    const x = xForIndex(idx).toFixed(2);
    const { dateLabel, timeLabel } = chartTimeLabel(times[idx]);
    const tick = makeSvg("text", {
      class: "chart-tick-text chart-time-tick", x, y: height - 20,
      "text-anchor": Number(x) < padLeft + 25 ? "start" : (Number(x) > width - padRight - 25 ? "end" : "middle"),
    });
    tick.appendChild(makeSvg("tspan", { x, dy: 0 }, timeLabel));
    tick.appendChild(makeSvg("tspan", { class: "chart-date-tick", x, dy: 14 }, dateLabel));
    svg.appendChild(tick);
  });

  svg.appendChild(makeSvg("path", {
    class: "chart-line", d: chartLinePath(values, xForIndex, yForValue, maxDelta),
  }));

  // A single observed hour between gaps needs a mark; connected hours need only
  // the line. Never turn a missing hour into zero or bridge across the gap.
  values.forEach((value, idx) => {
    if (value === null) return;
    const connectedBefore = idx > 0 && values[idx - 1] !== null
      && Math.abs(value - values[idx - 1]) <= maxDelta;
    const connectedAfter = idx < values.length - 1 && values[idx + 1] !== null
      && Math.abs(value - values[idx + 1]) <= maxDelta;
    if (!connectedBefore && !connectedAfter) {
      svg.appendChild(makeSvg("circle", {
        class: "chart-isolated-point", cx: xForIndex(idx).toFixed(2), cy: yForValue(value).toFixed(2), r: 3,
      }));
    }
  });

  const selection = makeSvg("g", { class: "chart-selection", visibility: "hidden" });
  const cursor = makeSvg("line", { class: "chart-cursor", y1: padTop, y2: height - padBottom });
  const point = makeSvg("circle", { class: "chart-selected-point", r: 4 });
  selection.appendChild(cursor);
  selection.appendChild(point);
  svg.appendChild(selection);

  let selectedIndex = values.findIndex((value) => value !== null);
  const describeHour = (idx) => {
    const { dateLabel, timeLabel } = chartTimeLabel(times[idx]);
    const valueLabel = values[idx] === null ? "No data" : `${chartValueLabel(values[idx])} ${displayUnit}`;
    return `${dateLabel}, ${timeLabel}: ${valueLabel}`;
  };
  const selectHour = (idx) => {
    selectedIndex = Math.max(0, Math.min(times.length - 1, idx));
    const value = values[selectedIndex];
    const { dateLabel, timeLabel } = chartTimeLabel(times[selectedIndex]);
    reading.textContent = value === null ? "No data" : chartValueLabel(value);
    unit.hidden = value === null;
    readingTime.textContent = `${dateLabel} · ${timeLabel}`;
    svgWrap.setAttribute("aria-valuenow", String(selectedIndex));
    svgWrap.setAttribute("aria-valuetext", describeHour(selectedIndex));
    const x = xForIndex(selectedIndex).toFixed(2);
    cursor.setAttribute("x1", x);
    cursor.setAttribute("x2", x);
    point.setAttribute("cx", x);
    point.setAttribute("visibility", value === null ? "hidden" : "visible");
    if (value !== null) point.setAttribute("cy", yForValue(value).toFixed(2));
    selection.setAttribute("visibility", "visible");
  };
  const clearSelection = () => {
    selection.setAttribute("visibility", "hidden");
    point.setAttribute("visibility", "hidden");
    reading.textContent = rangeLabel;
    unit.hidden = false;
    readingTime.textContent = "Forecast range";
  };
  const selectPointerHour = (event) => {
    const rect = svg.getBoundingClientRect();
    if (!rect.width || !Number.isFinite(event.clientX)) return;
    const x = ((event.clientX - rect.left) / rect.width) * width;
    selectHour(Math.round(((x - padLeft) / innerW) * xDenom));
  };
  svgWrap.setAttribute("aria-valuenow", String(selectedIndex));
  svgWrap.setAttribute("aria-valuetext", describeHour(selectedIndex));
  svgWrap.addEventListener("pointermove", selectPointerHour);
  svgWrap.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    svgWrap.focus({ preventScroll: true });
    selectPointerHour(event);
  });
  svgWrap.addEventListener("pointerleave", () => {
    if (document.activeElement !== svgWrap) clearSelection();
  });
  svgWrap.addEventListener("focus", () => selectHour(selectedIndex));
  svgWrap.addEventListener("blur", clearSelection);
  svgWrap.addEventListener("keydown", (event) => {
    const nextIndex = {
      ArrowLeft: selectedIndex - 1, ArrowDown: selectedIndex - 1,
      ArrowRight: selectedIndex + 1, ArrowUp: selectedIndex + 1,
      Home: 0, End: times.length - 1,
    }[event.key];
    if (nextIndex === undefined) return;
    event.preventDefault();
    selectHour(nextIndex);
  });
  svgWrap.appendChild(svg);
  card.appendChild(svgWrap);
  return card;
};

const renderHourlyCharts = (payload) => {
  if (!chartsEl) return;
  lastHourlyPayload = payload;
  chartsEl.innerHTML = "";
  const hourly = payload?.hourly || {};
  const times = Array.isArray(hourly.time) ? hourly.time : [];
  const chartWidth = resolveChartWidth();
  const frag = document.createDocumentFragment();
  metricDefs.forEach((metric) => {
    const rawValues = Array.isArray(hourly[metric.key]) ? hourly[metric.key] : [];
    const values = times.map((_, idx) => toFiniteNumber(rawValues[idx]));
    frag.appendChild(renderMetricChartCard(metric, times, values, chartWidth));
  });
  chartsEl.appendChild(frag);
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
    if (chartsEl) chartsEl.innerHTML = "";
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
