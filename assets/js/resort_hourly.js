const context = window.CLOSESNOW_HOURLY_CONTEXT || {};
const resortId = String(context.resortId || "").trim();
const hourlyDataUrl = String(context.hourlyDataUrl || "").trim();

const hoursSelect = document.getElementById("hours-select");
const refreshBtn = document.getElementById("hours-refresh-btn");
const titleEl = document.getElementById("hourly-title");
const metaEl = document.getElementById("hourly-meta");
const errorEl = document.getElementById("hourly-error");
const chartErrorEl = document.getElementById("hourly-chart-error");
const chartsEl = document.getElementById("hourly-charts");
const table = document.getElementById("hourly-table");
const thead = table ? table.querySelector("thead") : null;
const tbody = table ? table.querySelector("tbody") : null;

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

const formatTimeLabel = (rawTime) => {
  const text = String(rawTime || "");
  if (!text) return "";
  const [datePart, hourPart = ""] = text.split("T");
  const hourLabel = hourPart.slice(0, 5);
  if (!datePart) return hourLabel || text;
  const md = datePart.length >= 10 ? datePart.slice(5) : datePart;
  return `${md} ${hourLabel}`.trim();
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

const renderMetricChartCard = (metric, times, values) => {
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

  const width = 720;
  const height = 220;
  const padLeft = 44;
  const padRight = 16;
  const padTop = 12;
  const padBottom = 30;
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
    const tick = document.createElementNS(svgNs, "text");
    tick.setAttribute("class", "chart-tick-text");
    tick.setAttribute("x", x.toFixed(2));
    tick.setAttribute("y", String(height - 10));
    tick.setAttribute("text-anchor", "middle");
    tick.textContent = formatTimeLabel(times[idx]);
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
  chartsEl.innerHTML = "";
  const hourly = payload?.hourly || {};
  const times = Array.isArray(hourly.time) ? hourly.time : [];
  const frag = document.createDocumentFragment();
  metricDefs.forEach((metric) => {
    const rawValues = Array.isArray(hourly[metric.key]) ? hourly[metric.key] : [];
    const values = times.map((_, idx) => toFiniteNumber(rawValues[idx]));
    frag.appendChild(renderMetricChartCard(metric, times, values));
  });
  chartsEl.appendChild(frag);
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
    if (titleEl) titleEl.textContent = `Hourly Forecast: ${payload.query || resortId}`;
    if (metaEl) {
      const tz = payload.timezone || "unknown timezone";
      const model = payload.model || "unknown model";
      const count = payload.hours || 0;
      metaEl.textContent = `${count} hours | ${tz} | ${model}`;
    }
    renderHourlyTable(payload);
    try {
      renderHourlyCharts(payload);
    } catch (chartErr) {
      setChartError(chartErr instanceof Error ? chartErr.message : String(chartErr));
    }
  } catch (err) {
    setError(err instanceof Error ? err.message : String(err));
    setChartError("");
    if (metaEl) metaEl.textContent = "";
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

loadHourly();
