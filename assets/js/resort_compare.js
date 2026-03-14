const compareContextRaw = window.CLOSESNOW_COMPARE_CONTEXT;
const compareContext =
  compareContextRaw && typeof compareContextRaw === "object" && !Array.isArray(compareContextRaw) ? compareContextRaw : {};
const compareSelectionApi = window.CloseSnowCompareSelection || {};
const compareSelectionConfig =
  compareContext.compareSelection && typeof compareContext.compareSelection === "object" && !Array.isArray(compareContext.compareSelection)
    ? compareContext.compareSelection
    : {};

const compareSummary = document.getElementById("compare-summary");
const compareSelectedChips = document.getElementById("compare-selected-chips");
const compareCopyBtn = document.getElementById("compare-copy-btn");
const compareShareBtn = document.getElementById("compare-share-btn");
const compareHomeLink = document.getElementById("compare-home-link");
const compareMessage = document.getElementById("compare-message");
const compareEmptyState = document.getElementById("compare-empty-state");
const compareCards = document.getElementById("compare-cards");
const compareMetrics = document.getElementById("compare-metrics");

const COMPARE_QUERY_KEY = String(compareSelectionConfig.queryKey || compareSelectionApi.DEFAULT_QUERY_KEY || "compare").trim() || "compare";
const COMPARE_MAX_RESORTS = Number(compareSelectionConfig.maxResorts || compareSelectionApi.DEFAULT_MAX_SELECTION || 4) || 4;
const COMPARE_DAYS = 7;
const COMPARE_HOURLY_HOURS = 36;
const COMPARE_HOURLY_SUMMARY_HOURS = 24;
const COMPARE_HOURLY_ROW_STEP = 3;
const COMPARE_HOURLY_ROW_LIMIT = 8;

const appState = {
  payload: null,
  selectedIds: [],
  reportById: new Map(),
  notice: "",
  hourlyByResortId: new Map(),
};

const _escapeHtml = (value) => String(value || "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll("\"", "&quot;")
  .replaceAll("'", "&#39;");

const _asFiniteNumber = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

const _formatMetric = (value, suffix = "") => {
  const num = _asFiniteNumber(value);
  return num === null ? "?" : `${num.toFixed(1)}${suffix}`;
};

const _formatTemp = (value) => {
  const num = _asFiniteNumber(value);
  if (num === null) return "?";
  return Number.isInteger(num) ? String(num) : num.toFixed(1);
};

const _formatIntegerMetric = (value, suffix = "") => {
  const num = _asFiniteNumber(value);
  return num === null ? "?" : `${Math.round(num)}${suffix}`;
};

const _displayName = (report) => String(report?.display_name || report?.query || report?.resort_id || "").trim();

const _locationLabel = (report) => (
  [String(report?.admin1 || "").trim(), String(report?.country_code || report?.country || "").trim().toUpperCase()]
    .filter(Boolean)
    .join(" . ")
);

const compareRoutePrefix = (() => {
  const path = window.location.pathname || "";
  const marker = "/compare";
  const idx = path.lastIndexOf(marker);
  if (idx < 0) return "";
  return path.slice(0, idx);
})();

const withPrefix = (path) => {
  const cleanPath = String(path || "").startsWith("/") ? String(path || "") : `/${String(path || "")}`;
  if (!compareRoutePrefix) return cleanPath;
  return `${compareRoutePrefix}${cleanPath}`;
};

const _resolveDataUrl = (rawUrl) => {
  const text = String(rawUrl || "").trim();
  if (!text) throw new Error("Missing compare dataUrl bootstrap.");
  if (/^[a-z][a-z0-9+.-]*:/i.test(text) || text.startsWith("//")) {
    return new URL(text, window.location.href).toString();
  }
  const pathname = window.location.pathname || "/";
  const normalizedPath = pathname.endsWith("/")
    ? pathname
    : `${pathname}/`;
  return new URL(text, `${window.location.origin}${normalizedPath}`).toString();
};

const _isDynamicApiDataUrl = () => {
  try {
    return new URL(_resolveDataUrl(compareContext.dataUrl)).pathname.endsWith("/api/data");
  } catch (error) {
    return false;
  }
};

const _hourlyPayloadUrlFor = (resortId) => {
  const normalizedId = String(resortId || "").trim();
  if (!normalizedId) throw new Error("Missing resort id for hourly compare.");
  if (_isDynamicApiDataUrl()) {
    const endpoint = new URL(withPrefix("/api/resort-hourly"), window.location.origin);
    endpoint.searchParams.set("resort_id", normalizedId);
    endpoint.searchParams.set("hours", String(COMPARE_HOURLY_HOURS));
    return endpoint.toString();
  }
  return new URL(withPrefix(`/resort/${encodeURIComponent(normalizedId)}/hourly.json`), window.location.origin).toString();
};

const _hourlyPageUrlFor = (resortId) => new URL(
  withPrefix(`/resort/${encodeURIComponent(String(resortId || "").trim())}/`),
  window.location.origin,
).toString();

const _weatherEmoji = (rawCode) => {
  const code = Number(rawCode);
  if (!Number.isFinite(code)) return "?";
  if (code === 0) return "Clear";
  if (code === 1) return "Mostly clear";
  if (code === 2) return "Partly cloudy";
  if (code === 3) return "Cloudy";
  if (code === 45 || code === 48) return "Fog";
  if ([51, 53, 55, 56, 57].includes(code)) return "Drizzle";
  if ([61, 63, 65, 80, 81, 82].includes(code)) return "Rain";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "Snow";
  if ([95, 96, 99].includes(code)) return "Storm";
  return `WMO ${code}`;
};

const _weatherGlyph = (rawCode) => {
  const code = Number(rawCode);
  if (!Number.isFinite(code)) return "?";
  if (code === 0) return "☀";
  if (code === 1) return "🌤";
  if (code === 2) return "⛅";
  if (code === 3) return "☁";
  if (code === 45 || code === 48) return "🌫";
  if ([51, 53, 55, 56, 57].includes(code)) return "🌦";
  if ([61, 63, 65, 80, 81, 82].includes(code)) return "🌧";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "❄";
  if ([95, 96, 99].includes(code)) return "⛈";
  return "?";
};

const _dailyAt = (report, index) => {
  const daily = Array.isArray(report?.daily) ? report.daily : [];
  return daily[index] && typeof daily[index] === "object" ? daily[index] : {};
};

const _dayLabelFor = (report, index) => {
  if (index === 0) return "Today";
  const dateText = String(_dailyAt(report, index).date || "").trim();
  if (!dateText) return `Day ${index + 1}`;
  const dt = new Date(`${dateText}T00:00:00`);
  if (Number.isNaN(dt.getTime())) return `Day ${index + 1}`;
  return dt.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

const _displayDays = () => {
  const raw = Number(appState.payload?.forecast_days || 0);
  return Math.max(1, Math.min(COMPARE_DAYS, Number.isFinite(raw) && raw > 0 ? raw : COMPARE_DAYS));
};

const _selectedReports = () => appState.selectedIds.map((resortId) => appState.reportById.get(resortId)).filter(Boolean);

const _buildCompareUrl = (selectedIds = appState.selectedIds) => {
  const url = new URL(window.location.href);
  const params = typeof compareSelectionApi.withSelectionInParams === "function"
    ? compareSelectionApi.withSelectionInParams(new URLSearchParams(url.search), selectedIds, {
      queryKey: COMPARE_QUERY_KEY,
      validResortIds: Array.from(appState.reportById.keys()),
      maxSelection: COMPARE_MAX_RESORTS,
    })
    : new URLSearchParams(url.search);
  if (!(typeof compareSelectionApi.withSelectionInParams === "function")) {
    params.delete(COMPARE_QUERY_KEY);
    selectedIds.forEach((resortId) => params.append(COMPARE_QUERY_KEY, resortId));
  }
  url.search = params.toString();
  return url.toString();
};

const _buildHomeUrl = (selectedIds = appState.selectedIds) => {
  const baseHref = compareHomeLink?.getAttribute("href") || "../";
  const url = new URL(baseHref, window.location.href);
  const params = typeof compareSelectionApi.withSelectionInParams === "function"
    ? compareSelectionApi.withSelectionInParams(new URLSearchParams(url.search), selectedIds, {
      queryKey: COMPARE_QUERY_KEY,
      validResortIds: Array.from(appState.reportById.keys()),
      maxSelection: COMPARE_MAX_RESORTS,
    })
    : new URLSearchParams(url.search);
  if (!(typeof compareSelectionApi.withSelectionInParams === "function")) {
    params.delete(COMPARE_QUERY_KEY);
    selectedIds.forEach((resortId) => params.append(COMPARE_QUERY_KEY, resortId));
  }
  url.search = params.toString();
  return url.toString();
};

const _setNotice = (message) => {
  appState.notice = String(message || "").trim();
  if (!appState.notice) {
    compareMessage.hidden = true;
    compareMessage.textContent = "";
    return;
  }
  compareMessage.hidden = false;
  compareMessage.textContent = appState.notice;
};

const _parseSelection = () => {
  const validResortIds = Array.from(appState.reportById.keys());
  if (typeof compareSelectionApi.parseSelectionFromSearch === "function") {
    return compareSelectionApi.parseSelectionFromSearch(window.location.search, {
      queryKey: COMPARE_QUERY_KEY,
      validResortIds,
      maxSelection: COMPARE_MAX_RESORTS,
    });
  }
  const params = new URLSearchParams(window.location.search);
  return params.getAll(COMPARE_QUERY_KEY).filter((resortId) => validResortIds.includes(resortId)).slice(0, COMPARE_MAX_RESORTS);
};

const _toggleSelection = (resortId) => {
  if (typeof compareSelectionApi.toggleSelection === "function") {
    return compareSelectionApi.toggleSelection(appState.selectedIds, resortId, {
      queryKey: COMPARE_QUERY_KEY,
      validResortIds: Array.from(appState.reportById.keys()),
      maxSelection: COMPARE_MAX_RESORTS,
    });
  }
  if (appState.selectedIds.includes(resortId)) {
    return { selection: appState.selectedIds.filter((value) => value !== resortId), reason: "removed" };
  }
  if (appState.selectedIds.length >= COMPARE_MAX_RESORTS) {
    return { selection: appState.selectedIds.slice(), reason: "max" };
  }
  return { selection: [...appState.selectedIds, resortId], reason: "added" };
};

const _winnerIdsFor = (reports, getter, comparator = "max") => {
  const displayDays = _displayDays();
  return Array.from({ length: displayDays }, (_, index) => {
    const values = reports.map((report) => ({ resortId: report.resort_id, value: getter(report, index) }));
    const numericValues = values.filter((entry) => entry.value !== null);
    if (!numericValues.length) return new Set();
    const target = comparator === "min"
      ? Math.min(...numericValues.map((entry) => entry.value))
      : Math.max(...numericValues.map((entry) => entry.value));
    return new Set(numericValues.filter((entry) => entry.value === target).map((entry) => entry.resort_id || entry.resortId));
  });
};

const _renderChips = () => {
  compareSelectedChips.innerHTML = appState.selectedIds.map((resortId, index) => {
    const report = appState.reportById.get(resortId);
    const label = _displayName(report);
    return `<span class="compare-chip">${_escapeHtml(label)} <strong>#${index + 1}</strong><button type="button" class="compare-chip-remove" data-remove-id="${_escapeHtml(resortId)}" aria-label="Remove ${_escapeHtml(label)} from compare">Remove</button></span>`;
  }).join("");
};

const _renderSummaryCards = (reports) => {
  const week1Winner = new Set(reports.filter((report) => report.week1_total_snowfall_cm === Math.max(...reports.map((entry) => Number(entry.week1_total_snowfall_cm || 0)))).map((report) => report.resort_id));
  const week2Winner = new Set(reports.filter((report) => report.week2_total_snowfall_cm === Math.max(...reports.map((entry) => Number(entry.week2_total_snowfall_cm || 0)))).map((report) => report.resort_id));
  compareCards.hidden = false;
  compareCards.innerHTML = reports.map((report) => {
    const daily = Array.from({ length: _displayDays() }, (_, index) => _dailyAt(report, index));
    const snowiestDay = daily.reduce((best, day) => ((_asFiniteNumber(day.snowfall_cm) || -1) > (_asFiniteNumber(best?.snowfall_cm) || -1) ? day : best), null);
    const rainiestDay = daily.reduce((best, day) => ((_asFiniteNumber(day.rain_mm) || -1) > (_asFiniteNumber(best?.rain_mm) || -1) ? day : best), null);
    const coldestDay = daily.reduce((best, day) => ((_asFiniteNumber(day.temperature_min_c) ?? Number.POSITIVE_INFINITY) < (_asFiniteNumber(best?.temperature_min_c) ?? Number.POSITIVE_INFINITY) ? day : best), null);
    return `
      <article class="compare-card">
        <h2>${_escapeHtml(_displayName(report))}</h2>
        <div class="compare-card-meta">${_escapeHtml(_locationLabel(report) || report.resort_id || "")}</div>
        <div class="compare-card-grid">
          <div class="compare-card-stat">
            <strong>Week 1 Snow</strong>
            <div class="compare-card-value ${week1Winner.has(report.resort_id) ? "winner" : ""}">${_escapeHtml(_formatMetric(report.week1_total_snowfall_cm, " cm"))}</div>
          </div>
          <div class="compare-card-stat">
            <strong>Week 2 Snow</strong>
            <div class="compare-card-value ${week2Winner.has(report.resort_id) ? "winner" : ""}">${_escapeHtml(_formatMetric(report.week2_total_snowfall_cm, " cm"))}</div>
          </div>
          <div class="compare-card-stat">
            <strong>Snowiest Day</strong>
            <div class="compare-card-value">${_escapeHtml(_formatMetric(snowiestDay?.snowfall_cm, " cm"))}</div>
          </div>
          <div class="compare-card-stat">
            <strong>Rainiest Day</strong>
            <div class="compare-card-value">${_escapeHtml(_formatMetric(rainiestDay?.rain_mm, " mm"))}</div>
          </div>
          <div class="compare-card-stat">
            <strong>Coldest Low</strong>
            <div class="compare-card-value">${_escapeHtml(`${_formatTemp(coldestDay?.temperature_min_c)} C`)}</div>
          </div>
          <div class="compare-card-stat">
            <strong>Weather Swing</strong>
            <div class="compare-card-value">${_escapeHtml(_weatherGlyph(snowiestDay?.weather_code || rainiestDay?.weather_code || daily[0]?.weather_code))}</div>
          </div>
        </div>
      </article>`;
  }).join("");
};

const _renderValueTable = ({ title, subtitle, reports, getter, formatter, comparator = "max" }) => {
  const labels = Array.from({ length: _displayDays() }, (_, index) => _dayLabelFor(reports[0], index));
  const winners = _winnerIdsFor(reports, getter, comparator);
  const rows = reports.map((report) => {
    const cells = labels.map((_, index) => {
      const value = getter(report, index);
      const klass = winners[index].has(report.resort_id) ? "compare-cell winner" : "compare-cell";
      return `<td class="${klass}">${_escapeHtml(formatter(value))}</td>`;
    }).join("");
    return `<tr><td class="compare-row-label">${_escapeHtml(_displayName(report))}</td>${cells}</tr>`;
  }).join("");
  return `
    <section class="compare-section">
      <div class="compare-section-head">
        <h2>${_escapeHtml(title)}</h2>
        <p>${_escapeHtml(subtitle)}</p>
      </div>
      <div class="compare-table-wrap">
        <table class="compare-table">
          <thead><tr><th>Resort</th>${labels.map((label) => `<th>${_escapeHtml(label)}</th>`).join("")}</tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </section>`;
};

const _renderTemperatureTable = (reports) => {
  const labels = Array.from({ length: _displayDays() }, (_, index) => _dayLabelFor(reports[0], index));
  const coldest = _winnerIdsFor(reports, (report, index) => _asFiniteNumber(_dailyAt(report, index).temperature_min_c), "min");
  const warmest = _winnerIdsFor(reports, (report, index) => _asFiniteNumber(_dailyAt(report, index).temperature_max_c), "max");
  const rows = reports.map((report) => {
    const cells = labels.map((_, index) => {
      const day = _dailyAt(report, index);
      const lowClass = coldest[index].has(report.resort_id) ? "compare-temp-low coldest" : "compare-temp-low";
      const highClass = warmest[index].has(report.resort_id) ? "compare-temp-high warmest" : "compare-temp-high";
      return `<td class="compare-cell"><span class="compare-temp-pair"><span class="${lowClass}">${_escapeHtml(_formatTemp(day.temperature_min_c))}</span><span>/</span><span class="${highClass}">${_escapeHtml(_formatTemp(day.temperature_max_c))}</span></span></td>`;
    }).join("");
    return `<tr><td class="compare-row-label">${_escapeHtml(_displayName(report))}</td>${cells}</tr>`;
  }).join("");
  return `
    <section class="compare-section">
      <div class="compare-section-head">
        <h2>Temperature</h2>
        <p>Daily lows and highs. Blue marks the coldest low, amber marks the warmest high.</p>
      </div>
      <div class="compare-table-wrap">
        <table class="compare-table">
          <thead><tr><th>Resort</th>${labels.map((label) => `<th>${_escapeHtml(label)}</th>`).join("")}</tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </section>`;
};

const _renderWeatherTable = (reports) => {
  const labels = Array.from({ length: _displayDays() }, (_, index) => _dayLabelFor(reports[0], index));
  const rows = reports.map((report) => {
    const cells = labels.map((_, index) => {
      const code = _dailyAt(report, index).weather_code;
      return `<td class="compare-cell compare-weather-cell">${_escapeHtml(_weatherGlyph(code))}<span class="compare-weather-label">${_escapeHtml(_weatherEmoji(code))}</span></td>`;
    }).join("");
    return `<tr><td class="compare-row-label">${_escapeHtml(_displayName(report))}</td>${cells}</tr>`;
  }).join("");
  return `
    <section class="compare-section">
      <div class="compare-section-head">
        <h2>Weather Windows</h2>
        <p>Daily weather pattern cues for the currently selected resorts.</p>
      </div>
      <div class="compare-table-wrap">
        <table class="compare-table">
          <thead><tr><th>Resort</th>${labels.map((label) => `<th>${_escapeHtml(label)}</th>`).join("")}</tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </section>`;
};

const _hourlySeries = (payload, key) => {
  const hourly = payload?.hourly && typeof payload.hourly === "object" ? payload.hourly : {};
  const times = Array.isArray(hourly.time) ? hourly.time : [];
  const rawValues = Array.isArray(hourly[key]) ? hourly[key] : [];
  return times.map((_, index) => _asFiniteNumber(rawValues[index]));
};

const _sumFirstHours = (values, hours) => values
  .slice(0, Math.max(0, hours))
  .reduce((sum, value) => sum + (value || 0), 0);

const _maxFirstHours = (values, hours) => {
  const subset = values.slice(0, Math.max(0, hours)).filter((value) => value !== null);
  return subset.length ? Math.max(...subset) : null;
};

const _firstTimeLabel = (times, values, predicate) => {
  for (let index = 0; index < times.length; index += 1) {
    const value = values[index];
    if (predicate(value)) return _compactTimeLabel(times[index]);
  }
  return "None";
};

const _compactTimeLabel = (rawTime) => {
  const text = String(rawTime || "").trim();
  if (!text) return "Unknown";
  const [datePart, timePart = ""] = text.split("T");
  const md = datePart.length >= 10 ? datePart.slice(5) : datePart;
  const hhmm = timePart.slice(0, 5);
  return [md, hhmm].filter(Boolean).join(" ");
};

const _hourlyRows = (payload) => {
  const hourly = payload?.hourly && typeof payload.hourly === "object" ? payload.hourly : {};
  const times = Array.isArray(hourly.time) ? hourly.time : [];
  const snowfall = _hourlySeries(payload, "snowfall");
  const rain = _hourlySeries(payload, "rain");
  const wind = _hourlySeries(payload, "wind_speed_10m");
  const probability = _hourlySeries(payload, "precipitation_probability");
  const out = [];
  for (let index = 0; index < times.length && out.length < COMPARE_HOURLY_ROW_LIMIT; index += COMPARE_HOURLY_ROW_STEP) {
    out.push({
      time: times[index],
      snowfall: snowfall[index],
      rain: rain[index],
      wind: wind[index],
      probability: probability[index],
    });
  }
  return out;
};

const _hourlyStateFor = (resortId) => appState.hourlyByResortId.get(String(resortId || "").trim()) || { status: "idle" };

const _renderHourlyCard = (report, hourlyState) => {
  const resortId = String(report?.resort_id || "").trim();
  const resortLabel = _displayName(report);
  const location = _locationLabel(report) || resortId;
  if (hourlyState.status === "loading" || hourlyState.status === "idle") {
    return `
      <article class="compare-hourly-card is-loading">
        <div class="compare-hourly-card-head">
          <div>
            <h3>${_escapeHtml(resortLabel)}</h3>
            <p>${_escapeHtml(location)}</p>
          </div>
          <a class="compare-hourly-link" href="${_escapeHtml(_hourlyPageUrlFor(resortId))}">Hourly page</a>
        </div>
        <div class="compare-hourly-status">Loading hourly compare detail...</div>
      </article>`;
  }
  if (hourlyState.status === "error") {
    return `
      <article class="compare-hourly-card is-error">
        <div class="compare-hourly-card-head">
          <div>
            <h3>${_escapeHtml(resortLabel)}</h3>
            <p>${_escapeHtml(location)}</p>
          </div>
          <a class="compare-hourly-link" href="${_escapeHtml(_hourlyPageUrlFor(resortId))}">Hourly page</a>
        </div>
        <div class="compare-hourly-status">Hourly detail unavailable for this resort right now. Daily compare remains available.</div>
        <p class="compare-hourly-error-detail">${_escapeHtml(hourlyState.message || "Missing hourly artifact.")}</p>
      </article>`;
  }

  const payload = hourlyState.payload;
  const hourly = payload?.hourly && typeof payload.hourly === "object" ? payload.hourly : {};
  const times = Array.isArray(hourly.time) ? hourly.time : [];
  if (!times.length) {
    return `
      <article class="compare-hourly-card is-error">
        <div class="compare-hourly-card-head">
          <div>
            <h3>${_escapeHtml(resortLabel)}</h3>
            <p>${_escapeHtml(location)}</p>
          </div>
          <a class="compare-hourly-link" href="${_escapeHtml(_hourlyPageUrlFor(resortId))}">Hourly page</a>
        </div>
        <div class="compare-hourly-status">No hourly rows were available for this resort.</div>
      </article>`;
  }

  const snowfall = _hourlySeries(payload, "snowfall");
  const rain = _hourlySeries(payload, "rain");
  const wind = _hourlySeries(payload, "wind_speed_10m");
  const probability = _hourlySeries(payload, "precipitation_probability");
  const rows = _hourlyRows(payload);
  const metaParts = [
    `${Math.min(times.length, COMPARE_HOURLY_HOURS)}h window`,
    String(payload?.timezone || "").trim(),
    String(payload?.model || "").trim(),
  ].filter(Boolean);
  return `
    <article class="compare-hourly-card">
      <div class="compare-hourly-card-head">
        <div>
          <h3>${_escapeHtml(resortLabel)}</h3>
          <p>${_escapeHtml(location)}</p>
        </div>
        <a class="compare-hourly-link" href="${_escapeHtml(_hourlyPageUrlFor(resortId))}">Hourly page</a>
      </div>
      <div class="compare-hourly-meta">${_escapeHtml(metaParts.join(" | "))}</div>
      <div class="compare-hourly-stats">
        <div class="compare-hourly-stat">
          <strong>24h snow</strong>
          <span>${_escapeHtml(_formatMetric(_sumFirstHours(snowfall, COMPARE_HOURLY_SUMMARY_HOURS), " cm"))}</span>
        </div>
        <div class="compare-hourly-stat">
          <strong>Snow starts</strong>
          <span>${_escapeHtml(_firstTimeLabel(times, snowfall, (value) => (value || 0) > 0.05))}</span>
        </div>
        <div class="compare-hourly-stat">
          <strong>Rain starts</strong>
          <span>${_escapeHtml(_firstTimeLabel(times, rain, (value) => (value || 0) > 0.05))}</span>
        </div>
        <div class="compare-hourly-stat">
          <strong>Peak wind</strong>
          <span>${_escapeHtml(_formatMetric(_maxFirstHours(wind, COMPARE_HOURLY_SUMMARY_HOURS), " km/h"))}</span>
        </div>
        <div class="compare-hourly-stat">
          <strong>Peak precip</strong>
          <span>${_escapeHtml(_formatIntegerMetric(_maxFirstHours(probability, COMPARE_HOURLY_SUMMARY_HOURS), "%"))}</span>
        </div>
      </div>
      <div class="compare-hourly-table-wrap">
        <table class="compare-hourly-table">
          <thead>
            <tr><th>Time</th><th>Snow</th><th>Rain</th><th>Wind</th><th>Precip</th></tr>
          </thead>
          <tbody>
            ${rows.map((row) => `
              <tr>
                <td>${_escapeHtml(_compactTimeLabel(row.time))}</td>
                <td>${_escapeHtml(_formatMetric(row.snowfall, " cm"))}</td>
                <td>${_escapeHtml(_formatMetric(row.rain, " mm"))}</td>
                <td>${_escapeHtml(_formatMetric(row.wind, " km/h"))}</td>
                <td>${_escapeHtml(_formatIntegerMetric(row.probability, "%"))}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    </article>`;
};

const _renderHourlySection = (reports) => {
  const hourlyStates = reports.map((report) => ({ report, state: _hourlyStateFor(report.resort_id) }));
  const loadingCount = hourlyStates.filter((entry) => entry.state.status === "loading" || entry.state.status === "idle").length;
  const errorCount = hourlyStates.filter((entry) => entry.state.status === "error").length;
  let noticeHtml = "";
  if (loadingCount) {
    noticeHtml += `<div class="compare-hourly-warning">Loading hourly detail for ${loadingCount} resort${loadingCount === 1 ? "" : "s"}.</div>`;
  }
  if (errorCount) {
    noticeHtml += `<div class="compare-hourly-warning is-error">${errorCount} selected resort${errorCount === 1 ? " is" : "s are"} missing hourly detail. Remaining resorts still render.</div>`;
  }
  return `
    <section class="compare-section compare-hourly-section">
      <div class="compare-section-head">
        <h2>Hourly Compare</h2>
        <p>Trip-decision metrics only: snowfall timing, rain crossover, wind, and precip risk from the existing hourly resort artifacts.</p>
      </div>
      <div class="compare-hourly-shell">
        ${noticeHtml}
        <div class="compare-hourly-grid">
          ${hourlyStates.map(({ report, state }) => _renderHourlyCard(report, state)).join("")}
        </div>
      </div>
    </section>`;
};

const _renderEmptyState = (title, body) => {
  compareCards.hidden = true;
  compareCards.innerHTML = "";
  compareMetrics.hidden = true;
  compareMetrics.innerHTML = "";
  compareEmptyState.hidden = false;
  compareEmptyState.innerHTML = `<h2>${_escapeHtml(title)}</h2><p>${_escapeHtml(body)}</p>`;
};

const renderPage = () => {
  _renderChips();
  if (compareHomeLink) compareHomeLink.href = _buildHomeUrl();
  const reports = _selectedReports();
  compareSummary.textContent = `${appState.selectedIds.length}/${COMPARE_MAX_RESORTS} resorts selected for side-by-side daily and hourly comparison.`;
  if (reports.length === 0) {
    _renderEmptyState("Choose resorts to compare", "Add 2 to 4 resorts from the homepage compare controls, then reopen this compare page.");
    return;
  }
  if (reports.length < 2) {
    _renderEmptyState("Add at least one more resort", `Only ${reports.length} resort is selected right now. Return to the homepage and add one or more compare picks.`);
    return;
  }
  compareEmptyState.hidden = true;
  compareEmptyState.innerHTML = "";
  _renderSummaryCards(reports);
  compareMetrics.hidden = false;
  compareMetrics.innerHTML = [
    _renderHourlySection(reports),
    _renderValueTable({
      title: "Snowfall",
      subtitle: "Strongest snowfall day for each window is highlighted in teal.",
      reports,
      getter: (report, index) => _asFiniteNumber(_dailyAt(report, index).snowfall_cm),
      formatter: (value) => _formatMetric(value, " cm"),
    }),
    _renderValueTable({
      title: "Rainfall",
      subtitle: "Wettest resort for each day is highlighted in teal.",
      reports,
      getter: (report, index) => _asFiniteNumber(_dailyAt(report, index).rain_mm),
      formatter: (value) => _formatMetric(value, " mm"),
    }),
    _renderTemperatureTable(reports),
    _renderWeatherTable(reports),
  ].join("");
};

const _fetchJson = async (url) => {
  const response = await fetch(url);
  const text = await response.text();
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch (error) {
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    throw new Error("Invalid JSON response.");
  }
  if (!response.ok) {
    throw new Error(payload && payload.error ? payload.error : `HTTP ${response.status}`);
  }
  return payload;
};

const loadPayload = async () => _fetchJson(_resolveDataUrl(compareContext.dataUrl));

const loadHourlyPayload = async (resortId) => {
  const payload = await _fetchJson(_hourlyPayloadUrlFor(resortId));
  if (!payload || typeof payload !== "object" || !payload.hourly || !Array.isArray(payload.hourly.time)) {
    throw new Error("Hourly detail is unavailable for this resort.");
  }
  return payload;
};

const ensureHourlyDataForSelection = async () => {
  const selectedIds = _selectedReports().map((report) => String(report?.resort_id || "").trim()).filter(Boolean);
  const missingIds = selectedIds.filter((resortId) => !_hourlyStateFor(resortId).status || _hourlyStateFor(resortId).status === "idle");
  if (!missingIds.length) return;
  missingIds.forEach((resortId) => {
    appState.hourlyByResortId.set(resortId, { status: "loading" });
  });
  renderPage();
  await Promise.all(missingIds.map(async (resortId) => {
    try {
      const payload = await loadHourlyPayload(resortId);
      appState.hourlyByResortId.set(resortId, { status: "ready", payload });
    } catch (error) {
      appState.hourlyByResortId.set(resortId, {
        status: "error",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }));
  renderPage();
};

const syncUrl = () => {
  window.history.replaceState({}, "", _buildCompareUrl());
};

const syncSelectionAndRender = () => {
  syncUrl();
  renderPage();
  void ensureHourlyDataForSelection();
};

const initialize = async () => {
  try {
    appState.payload = await loadPayload();
    const reports = Array.isArray(appState.payload?.reports) ? appState.payload.reports : [];
    appState.reportById = new Map(
      reports
        .filter((report) => report && typeof report === "object")
        .map((report) => [String(report.resort_id || "").trim(), report])
        .filter(([resortId]) => Boolean(resortId)),
    );
    appState.selectedIds = _parseSelection();
    renderPage();
    void ensureHourlyDataForSelection();
  } catch (error) {
    _setNotice(error instanceof Error ? error.message : String(error));
    _renderEmptyState("Unable to load compare data", "The compare surface could not load the daily payload.");
  }
};

compareCopyBtn?.addEventListener("click", async () => {
  const url = _buildCompareUrl();
  if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
    try {
      await navigator.clipboard.writeText(url);
      _setNotice("Compare link copied.");
      return;
    } catch (error) {
      // Fall through to the non-clipboard message below.
    }
  }
  _setNotice("Share this page URL from the address bar.");
});

compareShareBtn?.addEventListener("click", async () => {
  const url = _buildCompareUrl();
  if (navigator.share && typeof navigator.share === "function") {
    try {
      await navigator.share({
        title: "CloseSnow resort compare",
        text: "Open this compare view in CloseSnow.",
        url,
      });
      _setNotice("Compare link shared.");
      return;
    } catch (error) {
      if (error && typeof error === "object" && error.name === "AbortError") {
        return;
      }
    }
  }
  if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
    try {
      await navigator.clipboard.writeText(url);
      _setNotice("Share sheet unavailable. Compare link copied instead.");
      return;
    } catch (error) {
      // Fall through to the final message below.
    }
  }
  _setNotice("Share this page URL from the address bar.");
});

document.addEventListener("click", (event) => {
  const target = event.target instanceof Element ? event.target : null;
  const removeButton = target ? target.closest(".compare-chip-remove[data-remove-id]") : null;
  if (!removeButton) return;
  const result = _toggleSelection(removeButton.getAttribute("data-remove-id"));
  appState.selectedIds = Array.isArray(result.selection) ? result.selection : appState.selectedIds.slice();
  if (result.reason === "max") {
    _setNotice(`Compare up to ${COMPARE_MAX_RESORTS} resorts at a time.`);
  } else {
    _setNotice("");
  }
  syncSelectionAndRender();
});

void initialize();
