(function () {
  "use strict";

  const foundation = window.CloseSnowFieldGuide || {};
  const weather = foundation.weather || {};
  const units = foundation.units || {};

  const asFiniteNumber = (value) => {
    if (value === null || value === undefined || typeof value === "boolean") return null;
    if (typeof value === "string" && !value.trim()) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const escapeHtml = (value) => String(value === null || value === undefined ? "" : value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");

  const normalizeMode = (value) => (value === "imperial" ? "imperial" : "metric");

  const formatFallback = (kind, value, mode) => {
    const numeric = asFiniteNumber(value);
    if (numeric === null) return "Not available";
    if (kind === "temperature") return `${Math.round(numeric)} °C`;
    if (kind === "rain") return `${numeric.toFixed(1)} mm`;
    return `${numeric.toFixed(1)} cm`;
  };

  const formatMeasure = (kind, value, mode) => {
    const normalizedMode = normalizeMode(mode);
    const formatters = {
      temperature: units.formatTemperature,
      snow: units.formatSnow,
      rain: units.formatRain,
    };
    const formatter = formatters[kind];
    if (typeof formatter === "function") {
      const rendered = formatter(value, normalizedMode, { fallback: "Not available" });
      return String(rendered);
    }
    return formatFallback(kind, value, normalizedMode);
  };

  const safeDaily = (report) => (Array.isArray(report?.daily) ? report.daily : [])
    .filter((day) => day && typeof day === "object");

  const dailyAt = (report, index) => safeDaily(report)[index] || {};

  const displayName = (report) => String(report?.display_name || report?.query || "Unnamed resort").trim();

  const locationLabel = (report) => {
    const parts = [report?.city, report?.admin1 || report?.state_name, report?.country_code]
      .map((value) => String(value || "").trim())
      .filter(Boolean);
    return Array.from(new Set(parts)).join(", ") || String(report?.region || "Mountain location").trim();
  };

  const dateParts = (rawValue, index) => {
    const raw = String(rawValue || "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      return { compact: index === 0 ? "Today" : `Day ${index + 1}`, full: index === 0 ? "Today" : `Forecast day ${index + 1}` };
    }
    const date = new Date(`${raw}T00:00:00Z`);
    if (Number.isNaN(date.getTime())) return { compact: raw, full: raw };
    const weekday = new Intl.DateTimeFormat(undefined, { weekday: "short", timeZone: "UTC" }).format(date);
    const monthDay = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", timeZone: "UTC" }).format(date);
    return {
      compact: index === 0 ? `Today · ${monthDay}` : `${weekday} · ${monthDay}`,
      full: index === 0 ? `Today, ${weekday}, ${monthDay}` : `${weekday}, ${monthDay}`,
    };
  };

  const conditionName = (code) => (typeof weather.conditionName === "function"
    ? weather.conditionName(code)
    : "Conditions unavailable");

  const conditionIcon = (code, className = "") => (typeof weather.iconHtml === "function"
    ? weather.iconHtml(code, { className })
    : `<span class="condition-icon-fallback" aria-hidden="true">—</span>`);

  const reportTotal = (report, key, dailyKey, start, end) => {
    const direct = asFiniteNumber(report?.[key]);
    if (direct !== null) return direct;
    const values = safeDaily(report).slice(start, end)
      .map((day) => asFiniteNumber(day[dailyKey]))
      .filter((value) => value !== null);
    return values.length ? values.reduce((total, value) => total + value, 0) : null;
  };

  const weekOneSnow = (report) => reportTotal(report, "week1_total_snowfall_cm", "snowfall_cm", 0, 7);
  const weekOneRain = (report) => reportTotal(report, "week1_total_rain_mm", "rain_mm", 0, 7);

  const strongestDay = (report, key, count = 7) => {
    let winner = null;
    safeDaily(report).slice(0, count).forEach((day, index) => {
      const value = asFiniteNumber(day[key]);
      if (value === null) return;
      if (!winner || value > winner.value) winner = { day, index, value };
    });
    return winner;
  };

  const resortHref = (report) => {
    const id = String(report?.resort_id || "").trim();
    return id ? `resort/${encodeURIComponent(id)}` : "";
  };

  const favoriteButton = (report, active) => {
    const resortId = String(report?.resort_id || "").trim();
    if (!resortId) return "";
    const resortName = displayName(report);
    const label = active ? `Remove ${resortName} from favorites` : `Add ${resortName} to favorites`;
    return `
      <button type="button" class="favorite-btn" data-resort-id="${escapeHtml(resortId)}" data-favorite-active="${active ? "1" : "0"}" aria-pressed="${active ? "true" : "false"}" aria-label="${escapeHtml(label)}">
        <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M12 20.4S3.4 15.7 3.4 9.1A4.7 4.7 0 0 1 12 6.5a4.7 4.7 0 0 1 8.6 2.6c0 6.6-8.6 11.3-8.6 11.3Z"></path></svg>
      </button>`;
  };

  const passesHtml = (report) => {
    const passes = Array.isArray(report?.pass_types) ? report.pass_types : [];
    return passes.slice(0, 3)
      .map((pass) => `<span class="resort-tag">${escapeHtml(String(pass).toUpperCase())}</span>`)
      .join("");
  };

  const highLowText = (day, mode) => {
    const high = asFiniteNumber(day?.temperature_max_c);
    const low = asFiniteNumber(day?.temperature_min_c);
    if (high === null && low === null) return "High / low unavailable";
    return `${formatMeasure("temperature", high, mode)} / ${formatMeasure("temperature", low, mode)}`;
  };

  const compactSignal = (report, mode) => {
    const snow = weekOneSnow(report);
    const rain = weekOneRain(report);
    const signal = (snow || 0) > 0
      ? "snow"
      : ((rain || 0) > 0
        ? "rain"
        : (snow === null || rain === null ? "unavailable" : "quiet"));
    const kind = signal === "rain" ? "rain" : "snow";
    const value = signal === "rain" ? rain : snow;
    const peak = strongestDay(report, kind === "rain" ? "rain_mm" : "snowfall_cm");
    const hasPeak = peak && peak.value > 0;
    const peakLabel = hasPeak ? `Peak ${dateParts(peak.day.date, peak.index).compact.split(" · ")[0]}` : "Peak day";
    const peakValue = hasPeak ? formatMeasure(kind, peak.value, mode) : (signal === "quiet" ? "No accumulation" : "Not available");
    const secondary = signal === "rain"
      ? { label: "7-day snow", value: formatMeasure("snow", snow, mode) }
      : { label: "7-day rain", value: formatMeasure("rain", rain, mode) };
    return {
      kind,
      signal,
      signalLabel: signal === "snow" ? "Snow" : (signal === "rain" ? "Rain" : (signal === "quiet" ? "Quiet" : "Pending")),
      primaryLabel: signal === "rain"
        ? "7-day rain"
        : (signal === "unavailable" ? "Pending · 7-day forecast" : (signal === "quiet" ? "Quiet · 7-day snow" : "7-day snow")),
      primaryValue: signal === "unavailable" ? "Not available" : formatMeasure(kind, value, mode),
      peakLabel,
      peakValue,
      secondary,
    };
  };

  const renderResortCard = (report, options = {}) => {
    const mode = normalizeMode(options.mode);
    const active = Boolean(options.favorite);
    const today = dailyAt(report, 0);
    const resortId = String(report?.resort_id || "").trim();
    const summary = compactSignal(report, mode);
    const href = resortHref(report);
    const name = displayName(report);
    const detailLink = href
      ? `<a class="resort-detail-link" href="${escapeHtml(href)}" aria-label="Open the complete forecast for ${escapeHtml(name)}"><span>Forecast</span><svg aria-hidden="true" viewBox="0 0 20 20"><path d="m7 4 6 6-6 6"></path></svg></a>`
      : `<span class="resort-detail-link resort-detail-link--disabled">Unavailable</span>`;
    return `
      <article class="resort-forecast-card" data-resort-card="${escapeHtml(resortId)}" data-result-index="${Number(options.index) || 0}" data-signal="${summary.signal}">
        <div class="resort-favorite-cell">
          ${favoriteButton(report, active)}
        </div>
        <div class="resort-identity">
          <h3 tabindex="-1">${escapeHtml(name)}</h3>
          <div class="resort-identity-meta">
            <span class="resort-location">${escapeHtml(locationLabel(report))}</span>
            <span class="resort-tags">${passesHtml(report)}</span>
          </div>
        </div>
        <div class="resort-today">
          ${conditionIcon(today.weather_code, "resort-today-icon")}
          <div>
            <span>Today</span>
            <strong>${escapeHtml(conditionName(today.weather_code))}</strong>
            <small data-field-guide-number>${escapeHtml(highLowText(today, mode))}</small>
          </div>
        </div>
        <dl class="resort-primary-signal" data-metric-kind="${summary.kind}"${["snow", "rain"].includes(summary.signal) ? ' data-priority="primary"' : ""}>
          <dt><span class="signal-dot" aria-hidden="true"></span>${escapeHtml(summary.primaryLabel)}</dt>
          <dd data-field-guide-number>${escapeHtml(summary.primaryValue)}</dd>
        </dl>
        <div class="resort-supporting-signal">
          <div><span>${escapeHtml(summary.peakLabel)}</span><strong data-field-guide-number>${escapeHtml(summary.peakValue)}</strong></div>
          <div><span>${escapeHtml(summary.secondary.label)}</span><strong data-field-guide-number>${escapeHtml(summary.secondary.value)}</strong></div>
        </div>
        ${detailLink}
      </article>`;
  };

  const renderResults = (reports, options = {}) => {
    const mode = normalizeMode(options.mode);
    const favorites = options.favorites instanceof Set ? options.favorites : new Set(options.favorites || []);
    const requestedLimit = Number(options.limit);
    const limit = Number.isFinite(requestedLimit) && requestedLimit > 0 ? Math.floor(requestedLimit) : 12;
    const visibleReports = reports.slice(0, limit);
    const cards = visibleReports.map((report, index) => renderResortCard(report, {
      mode,
      index,
      favorite: favorites.has(String(report?.resort_id || "").trim()),
    })).join("");
    const shownCount = visibleReports.length;
    const remainingCount = Math.max(0, reports.length - shownCount);
    const nextCount = Math.min(12, remainingCount);
    const empty = `
      <div class="results-empty-state">
        <span class="results-empty-icon" aria-hidden="true">×</span>
        <h2>No resorts match this view</h2>
        <p>${escapeHtml(options.emptyMessage || "Try clearing the search or changing a filter.")}</p>
      </div>`;
    return `
      <section class="forecast-results" aria-labelledby="results-title">
        <div class="section-heading results-heading">
          <div><p class="section-kicker">Forecast directory</p><h2 id="results-title">Compare resorts</h2></div>
          <p id="results-count" role="status">Showing ${shownCount} of ${reports.length} resort${reports.length === 1 ? "" : "s"}</p>
        </div>
        <div class="result-column-headings" aria-hidden="true"><span></span><span>Resort</span><span>Today</span><span>7-day signal</span><span>Peak / secondary</span><span></span></div>
        <div class="resort-card-grid">${cards || empty}</div>
        ${remainingCount ? `<div class="results-pagination"><button id="show-more-resorts" class="fg-button" type="button" data-show-more-results aria-describedby="results-count" aria-label="Show ${nextCount} more resorts; ${shownCount} of ${reports.length} currently shown">Show ${nextCount} more</button></div>` : ""}
      </section>`;
  };

  const render = (reports, options = {}) => {
    const safeReports = (Array.isArray(reports) ? reports : []).filter((report) => report && typeof report === "object");
    return renderResults(safeReports, options);
  };

  window.CloseSnowFieldGuideHomepage = Object.freeze({
    escapeHtml,
    render,
    renderResortCard,
    weekOneRain,
    weekOneSnow,
  });
}());
