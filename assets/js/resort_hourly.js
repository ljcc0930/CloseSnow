const context = window.CLOSESNOW_HOURLY_CONTEXT || {};
const resortId = String(context.resortId || "").trim();
const hourlyDataUrl = String(context.hourlyDataUrl || "").trim();
const dailySummary = context.dailySummary && typeof context.dailySummary === "object" ? context.dailySummary : null;
const compactDailySummary = window.CloseSnowCompactDailySummary || {};

const hoursSelect = document.getElementById("hours-select");
const refreshBtn = document.getElementById("hours-refresh-btn");
const titleEl = document.getElementById("hourly-title");
const localTimeEl = document.getElementById("resort-local-time");
const websiteLinkEl = document.getElementById("resort-website-link");
const timelineSection = document.getElementById("resort-timeline-section");
const timelineRoot = document.getElementById("resort-timeline-root");
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

const metricDefs = [
  { key: "snowfall", label: "snowfall (cm)", title: "Snowfall", unit: "cm", color: "#2563eb" },
  { key: "rain", label: "rain (mm)", title: "Rain", unit: "mm", color: "#0891b2" },
  {
    key: "precipitation_probability",
    label: "precip prob (%)",
    title: "Precipitation Probability",
    unit: "%",
    color: "#7c3aed",
  },
  { key: "snow_depth", label: "snow depth (m)", title: "Snow Depth", unit: "m", color: "#0f766e" },
  { key: "wind_speed_10m", label: "wind speed (km/h)", title: "Wind Speed 10m", unit: "km/h", color: "#b45309" },
  {
    key: "wind_direction_10m",
    label: "wind dir (deg)",
    title: "Wind Direction 10m",
    unit: "deg",
    color: "#be185d",
  },
  { key: "visibility", label: "visibility (m)", title: "Visibility", unit: "m", color: "#334155" },
];

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

const buildExternalLink = (href, label, className = "") => {
  const url = String(href || "").trim();
  if (!url) return null;
  const link = document.createElement("a");
  link.href = url;
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
  if (!url) {
    websiteLinkEl.innerHTML = "";
    return;
  }
  websiteLinkEl.innerHTML = `Official website: <a href="${url}" target="_blank" rel="noopener noreferrer">link</a>`;
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
  if (metricKey === "precipitation_probability") return { min: 0, max: 100 };
  if (metricKey === "wind_direction_10m") return { min: 0, max: 360 };
  const finiteValues = values.filter((v) => v !== null);
  if (!finiteValues.length) return null;
  let min = Math.min(...finiteValues);
  let max = Math.max(...finiteValues);
  if (min === max) {
    const pad = min === 0 ? 1 : Math.abs(min) * 0.1;
    min -= pad;
    max += pad;
  }
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

const resolveChartWidth = () => {
  if (!chartsEl) return 720;
  const containerWidth = chartsEl.getBoundingClientRect().width || chartsEl.clientWidth || 720;
  const isSingleColumn = typeof window.matchMedia === "function"
    && window.matchMedia("(max-width: 980px)").matches;
  const gap = 12;
  const cardHorizontalPadding = 22;
  const rawCardWidth = isSingleColumn ? containerWidth : ((containerWidth - gap) / 2);
  return Math.max(320, Math.round(rawCardWidth - cardHorizontalPadding));
};

const renderMetricChartCard = (metric, times, values, chartWidth) => {
  const card = document.createElement("article");
  card.className = "chart-card";

  const title = document.createElement("h2");
  title.className = "chart-title";
  title.textContent = metric.title;
  card.appendChild(title);

  const subtitle = document.createElement("p");
  subtitle.className = "chart-subtitle";
  subtitle.textContent = `Unit: ${metric.unit}`;
  card.appendChild(subtitle);

  const finiteValues = values.filter((v) => v !== null);
  if (!times.length || !finiteValues.length) {
    const empty = document.createElement("div");
    empty.className = "chart-empty";
    empty.textContent = "No data";
    card.appendChild(empty);
    return card;
  }

  const yBounds = chartYBounds(metric.key, values);
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
  svg.setAttribute("aria-label", `${metric.title} hourly trend line chart`);

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
    tick.textContent = formatValue(value);
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

  const line = document.createElementNS(svgNs, "path");
  line.setAttribute("class", "chart-line");
  line.setAttribute("stroke", metric.color);
  line.setAttribute("d", chartLinePath(values, xForIndex, yForValue));
  svg.appendChild(line);

  values.forEach((value, idx) => {
    if (value === null) return;
    const point = document.createElementNS(svgNs, "circle");
    point.setAttribute("class", "chart-point");
    point.setAttribute("cx", xForIndex(idx).toFixed(2));
    point.setAttribute("cy", yForValue(value).toFixed(2));
    point.setAttribute("r", "2.6");
    point.setAttribute("fill", metric.color);
    const pointTitle = document.createElementNS(svgNs, "title");
    pointTitle.textContent = `${times[idx]} | ${formatValue(value)} ${metric.unit}`;
    point.appendChild(pointTitle);
    svg.appendChild(point);
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

const trimHourlyPayload = (payload, hours) => {
  const hourly = payload?.hourly || {};
  const times = Array.isArray(hourly.time) ? hourly.time : [];
  const maxHours = Math.max(1, Number(hours) || 72);
  const n = Math.min(maxHours, times.length);
  const trimmedHourly = { time: times.slice(0, n) };
  metricDefs.forEach((metric) => {
    const values = Array.isArray(hourly[metric.key]) ? hourly[metric.key] : [];
    trimmedHourly[metric.key] = values.slice(0, n);
  });
  return {
    ...payload,
    hours: n,
    hourly: trimmedHourly,
  };
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
      const resortLabel = String(payload?.display_name || payload?.query || dailySummary?.display_name || dailySummary?.query || "").trim();
      titleEl.textContent = resortLabel ? `Resort Forecast: ${resortLabel}` : "Resort Forecast";
    }
    metaState = {
      timezone: String(payload.timezone || "").trim(),
      model: String(payload.model || "").trim(),
      count: Number(payload.hours) || 0,
      coordFragment: buildCoordinateMetaFragment(payload),
    };
    renderLocalTime();
    renderWebsiteLink(payload);
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

renderTimelineSummary();
loadHourly();
