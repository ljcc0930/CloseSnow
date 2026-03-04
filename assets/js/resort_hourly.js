const context = window.CLOSESNOW_HOURLY_CONTEXT || {};
const resortId = String(context.resortId || "").trim();
const hourlyDataUrl = String(context.hourlyDataUrl || "").trim();

const hoursSelect = document.getElementById("hours-select");
const refreshBtn = document.getElementById("hours-refresh-btn");
const titleEl = document.getElementById("hourly-title");
const metaEl = document.getElementById("hourly-meta");
const errorEl = document.getElementById("hourly-error");
const table = document.getElementById("hourly-table");
const thead = table ? table.querySelector("thead") : null;
const tbody = table ? table.querySelector("tbody") : null;

const metricDefs = [
  { key: "snowfall", label: "snowfall (cm)" },
  { key: "rain", label: "rain (mm)" },
  { key: "precipitation_probability", label: "precip prob (%)" },
  { key: "snow_depth", label: "snow depth (m)" },
  { key: "wind_speed_10m", label: "wind speed (km/h)" },
  { key: "wind_direction_10m", label: "wind dir (deg)" },
  { key: "visibility", label: "visibility (m)" },
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
  } catch (err) {
    setError(err instanceof Error ? err.message : String(err));
    if (metaEl) metaEl.textContent = "";
    if (thead) thead.innerHTML = "";
    if (tbody) tbody.innerHTML = "";
  }
};

if (refreshBtn) {
  refreshBtn.addEventListener("click", loadHourly);
}
if (hoursSelect) {
  hoursSelect.addEventListener("change", loadHourly);
}

loadHourly();
