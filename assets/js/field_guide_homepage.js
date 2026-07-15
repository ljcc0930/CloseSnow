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

  const sumDays = (report, key, count = 7) => {
    const values = safeDaily(report).slice(0, count)
      .map((day) => asFiniteNumber(day[key]))
      .filter((value) => value !== null);
    if (!values.length) return null;
    return values.reduce((total, value) => total + value, 0);
  };

  const reportTotal = (report, key, dailyKey, start, end) => {
    const direct = asFiniteNumber(report?.[key]);
    if (direct !== null) return direct;
    const values = safeDaily(report).slice(start, end)
      .map((day) => asFiniteNumber(day[dailyKey]))
      .filter((value) => value !== null);
    return values.length ? values.reduce((total, value) => total + value, 0) : null;
  };

  const weekOneSnow = (report) => reportTotal(report, "week1_total_snowfall_cm", "snowfall_cm", 0, 7);
  const weekTwoSnow = (report) => reportTotal(report, "week2_total_snowfall_cm", "snowfall_cm", 7, 14);
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

  const rankCandidates = (reports, limit = 3) => {
    const safeReports = (Array.isArray(reports) ? reports : []).filter((report) => report && typeof report === "object");
    const snowLed = safeReports.some((report) => (weekOneSnow(report) || 0) > 0);
    return [...safeReports]
      .sort((a, b) => {
        const primaryA = snowLed ? (weekOneSnow(a) || 0) : (weekOneRain(a) || 0);
        const primaryB = snowLed ? (weekOneSnow(b) || 0) : (weekOneRain(b) || 0);
        if (primaryB !== primaryA) return primaryB - primaryA;
        const secondaryDelta = (weekOneSnow(b) || 0) - (weekOneSnow(a) || 0);
        if (secondaryDelta !== 0) return secondaryDelta;
        return displayName(a).localeCompare(displayName(b));
      })
      .slice(0, Math.max(0, Number(limit) || 0))
      .map((report) => ({ report, signal: snowLed ? "snow" : "rain" }));
  };

  const temperatureSentence = (day, mode) => {
    const high = asFiniteNumber(day?.temperature_max_c);
    const low = asFiniteNumber(day?.temperature_min_c);
    if (high === null && low === null) return "Temperature guidance is not available.";
    if (high === null) return `Today's low is near ${formatMeasure("temperature", low, mode)}.`;
    if (low === null) return `Today's high is near ${formatMeasure("temperature", high, mode)}.`;
    return `Today ranges from ${formatMeasure("temperature", low, mode)} to ${formatMeasure("temperature", high, mode)}.`;
  };

  const rankingExplanation = (report, signal, mode) => {
    const snow = weekOneSnow(report);
    const rain = weekOneRain(report);
    const key = signal === "snow" ? "snowfall_cm" : "rain_mm";
    const strongest = strongestDay(report, key);
    const signalText = signal === "snow"
      ? (snow === null ? "Seven-day snow guidance is not available." : `${formatMeasure("snow", snow, mode)} of snow is forecast over seven days.`)
      : (rain === null ? "Seven-day rain guidance is not available." : `${formatMeasure("rain", rain, mode)} of rain is forecast over seven days.`);
    let bestDayText = "No accumulating snow or rain is currently forecast.";
    if (strongest && strongest.value > 0) {
      const label = dateParts(strongest.day.date, strongest.index).compact;
      const measure = formatMeasure(signal === "snow" ? "snow" : "rain", strongest.value, mode);
      bestDayText = `${label} has the strongest ${signal} signal at ${measure}.`;
    }
    return `${signalText} ${bestDayText} ${temperatureSentence(dailyAt(report, 0), mode)}`;
  };

  const resortHref = (report) => {
    const id = String(report?.resort_id || "").trim();
    return id ? `resort/${encodeURIComponent(id)}` : "";
  };

  const resortLink = (report, className = "") => {
    const name = escapeHtml(displayName(report));
    const href = resortHref(report);
    return href ? `<a class="${escapeHtml(className)}" href="${escapeHtml(href)}">${name}</a>` : `<span class="${escapeHtml(className)}">${name}</span>`;
  };

  const renderInsightCard = (entry, index, mode) => {
    const { report, signal } = entry;
    const today = dailyAt(report, 0);
    return `
      <article class="insight-card">
        <div class="insight-card__topline">
          <span class="insight-rank">${index + 1}</span>
          ${conditionIcon(today.weather_code, "insight-weather-icon")}
        </div>
        <p class="insight-kicker">${signal === "snow" ? "Snow signal" : "Storm signal"}</p>
        <h3>${resortLink(report, "insight-resort-link")}</h3>
        <p class="insight-location">${escapeHtml(locationLabel(report))}</p>
        <p class="insight-explanation">${escapeHtml(rankingExplanation(report, signal, mode))}</p>
      </article>`;
  };

  const renderInsightBoard = (reports, mode) => {
    const entries = rankCandidates(reports, 3);
    if (!entries.length) {
      return `
        <section class="insight-board insight-board--empty" aria-labelledby="insight-title">
          <div><p class="section-kicker">Morning picks</p><h2 id="insight-title">Nothing to rank yet</h2></div>
          <p>Change the search or filters to bring mountain guidance back into view.</p>
        </section>`;
    }
    const signal = entries[0].signal;
    return `
      <section class="insight-board" aria-labelledby="insight-title">
        <div class="section-heading">
          <div>
            <p class="section-kicker">Morning picks</p>
            <h2 id="insight-title">${signal === "snow" ? "Where the snow signal is strongest" : "Where weather is most active"}</h2>
          </div>
          <p>${signal === "snow" ? "Ranked by seven-day snowfall" : "No accumulating snow in view; ranked by seven-day rain"}</p>
        </div>
        <div class="insight-grid">${entries.map((entry, index) => renderInsightCard(entry, index, mode)).join("")}</div>
      </section>`;
  };

  const favoriteButton = (report, active) => {
    const resortId = String(report?.resort_id || "").trim();
    if (!resortId) return "";
    const label = active ? "Remove resort from favorites" : "Add resort to favorites";
    return `
      <button type="button" class="favorite-btn" data-resort-id="${escapeHtml(resortId)}" data-favorite-active="${active ? "1" : "0"}" aria-pressed="${active ? "true" : "false"}" aria-label="${label}">
        <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M12 20.4S3.4 15.7 3.4 9.1A4.7 4.7 0 0 1 12 6.5a4.7 4.7 0 0 1 8.6 2.6c0 6.6-8.6 11.3-8.6 11.3Z"></path></svg>
      </button>`;
  };

  const passesHtml = (report) => {
    const passes = Array.isArray(report?.pass_types) ? report.pass_types : [];
    return passes.slice(0, 3)
      .map((pass) => `<span class="resort-tag">${escapeHtml(String(pass).toUpperCase())}</span>`)
      .join("");
  };

  const metricBlock = (label, value, kind, mode, options = {}) => {
    const numeric = asFiniteNumber(value);
    const noSnow = kind === "snow" && numeric === 0 && options.zeroCopy;
    const rendered = noSnow ? options.zeroCopy : formatMeasure(kind, value, mode);
    return `<div class="resort-metric"><dt>${escapeHtml(label)}</dt><dd data-field-guide-number>${escapeHtml(rendered)}</dd></div>`;
  };

  const renderNearTermDay = (day, index, mode) => {
    const label = dateParts(day?.date, index).compact;
    const condition = conditionName(day?.weather_code);
    return `
      <li class="near-day">
        <span class="near-day__date">${escapeHtml(label)}</span>
        <span class="near-day__condition">${conditionIcon(day?.weather_code)}<span>${escapeHtml(condition)}</span></span>
        <span class="near-day__temp" data-field-guide-number>${escapeHtml(formatMeasure("temperature", day?.temperature_max_c, mode))}</span>
        <span class="near-day__snow" data-field-guide-number>${escapeHtml(formatMeasure("snow", day?.snowfall_cm, mode))} snow</span>
      </li>`;
  };

  const localTime = (day, kind) => {
    const localKey = `${kind}_local_hhmm`;
    const isoKey = `${kind}_iso`;
    const local = String(day?.[localKey] || "").trim();
    if (/^\d{2}:\d{2}$/.test(local)) return local;
    const iso = String(day?.[isoKey] || "").trim();
    const match = /T(\d{2}:\d{2})/.exec(iso);
    return match ? match[1] : "Not available";
  };

  const renderDailyDetail = (day, index, mode) => {
    const date = dateParts(day?.date, index).full;
    const condition = conditionName(day?.weather_code);
    return `
      <article class="daily-detail-card">
        <header>
          <div><p>${escapeHtml(date)}</p><h4>${escapeHtml(condition)}</h4></div>
          ${conditionIcon(day?.weather_code, "daily-detail-icon")}
        </header>
        <dl class="daily-detail-metrics">
          <div><dt>High / low</dt><dd data-field-guide-number>${escapeHtml(formatMeasure("temperature", day?.temperature_max_c, mode))} / ${escapeHtml(formatMeasure("temperature", day?.temperature_min_c, mode))}</dd></div>
          <div><dt>Snow</dt><dd data-field-guide-number>${escapeHtml(formatMeasure("snow", day?.snowfall_cm, mode))}</dd></div>
          <div><dt>Rain</dt><dd data-field-guide-number>${escapeHtml(formatMeasure("rain", day?.rain_mm, mode))}</dd></div>
          <div><dt>Daylight</dt><dd data-field-guide-number>${escapeHtml(localTime(day, "sunrise"))}–${escapeHtml(localTime(day, "sunset"))}</dd></div>
        </dl>
      </article>`;
  };

  const outlookText = (report, mode) => {
    const days = safeDaily(report).slice(0, 3);
    if (!days.length) return "Forecast details are not available for this resort yet.";
    const today = days[0];
    const condition = conditionName(today.weather_code);
    const snow = sumDays({ daily: days }, "snowfall_cm", 3);
    const rain = sumDays({ daily: days }, "rain_mm", 3);
    const precipitation = [];
    if (snow !== null && snow > 0) precipitation.push(`${formatMeasure("snow", snow, mode)} snow`);
    if (rain !== null && rain > 0) precipitation.push(`${formatMeasure("rain", rain, mode)} rain`);
    const precipText = precipitation.length
      ? `${precipitation.join(" and ")} over the next three days.`
      : "Little to no snow or rain is expected over the next three days.";
    return `${condition} today. ${precipText} ${temperatureSentence(today, mode)}`;
  };

  const renderResortCard = (report, options = {}) => {
    const mode = normalizeMode(options.mode);
    const active = Boolean(options.favorite);
    const today = dailyAt(report, 0);
    const days = safeDaily(report);
    const resortId = String(report?.resort_id || "").trim();
    const detailsId = `forecast-${resortId || options.index || "resort"}`.replace(/[^a-zA-Z0-9_-]/g, "-");
    const weekOne = weekOneSnow(report);
    const weekTwo = weekTwoSnow(report);
    const rain = weekOneRain(report);
    const dailyHtml = days.length
      ? days.map((day, index) => renderDailyDetail(day, index, mode)).join("")
      : `<p class="forecast-missing-state">Daily guidance is not available yet. Check back after the next model update.</p>`;
    return `
      <article class="resort-forecast-card" data-resort-card="${escapeHtml(resortId)}">
        <header class="resort-card-heading">
          <div class="resort-card-title">
            <p>${escapeHtml(locationLabel(report))}</p>
            <h3>${resortLink(report, "resort-card-link")}</h3>
            <div class="resort-tags">${passesHtml(report)}</div>
          </div>
          ${favoriteButton(report, active)}
        </header>
        <p class="resort-outlook">${escapeHtml(outlookText(report, mode))}</p>
        <div class="today-brief">
          ${conditionIcon(today.weather_code, "today-brief-icon")}
          <div><span>Today</span><strong>${escapeHtml(conditionName(today.weather_code))}</strong></div>
          <span class="today-temperature" data-field-guide-number>${escapeHtml(formatMeasure("temperature", today.temperature_max_c, mode))} / ${escapeHtml(formatMeasure("temperature", today.temperature_min_c, mode))}</span>
        </div>
        <dl class="resort-metric-grid">
          ${metricBlock("Week 1 snow", weekOne, "snow", mode, { zeroCopy: "No snow forecast" })}
          ${metricBlock("Week 2 snow", weekTwo, "snow", mode, { zeroCopy: "No snow forecast" })}
          ${metricBlock("7-day rain", rain, "rain", mode)}
        </dl>
        <ol class="near-term-list" aria-label="Three-day preview">
          ${days.slice(0, 3).map((day, index) => renderNearTermDay(day, index, mode)).join("") || `<li class="forecast-missing-state">Near-term guidance is not available.</li>`}
        </ol>
        <details class="resort-day-disclosure" data-field-guide-disclosure data-resort-disclosure="${escapeHtml(resortId)}">
          <summary aria-controls="${escapeHtml(detailsId)}">
            <span>Full ${days.length || 14}-day forecast</span>
            <span class="disclosure-hint">Weather, temperatures, snow, rain &amp; daylight</span>
          </summary>
          <div class="daily-detail-grid" id="${escapeHtml(detailsId)}">${dailyHtml}</div>
          ${resortHref(report) ? `<a class="resort-detail-link fg-button" href="${escapeHtml(resortHref(report))}">Open resort forecast</a>` : ""}
        </details>
      </article>`;
  };

  const renderResults = (reports, options = {}) => {
    const mode = normalizeMode(options.mode);
    const favorites = options.favorites instanceof Set ? options.favorites : new Set(options.favorites || []);
    const cards = reports.map((report, index) => renderResortCard(report, {
      mode,
      index,
      favorite: favorites.has(String(report?.resort_id || "").trim()),
    })).join("");
    const empty = `
      <div class="results-empty-state">
        <span class="results-empty-icon" aria-hidden="true">×</span>
        <h2>No resorts match this view</h2>
        <p>${escapeHtml(options.emptyMessage || "Try clearing the search or changing a filter.")}</p>
      </div>`;
    return `
      <section class="forecast-results" aria-labelledby="results-title">
        <div class="section-heading results-heading">
          <div><p class="section-kicker">Forecast directory</p><h2 id="results-title">Mountain-by-mountain outlook</h2></div>
          <p>${reports.length} resort${reports.length === 1 ? "" : "s"} in this view · Select a resort to reveal every forecast day.</p>
        </div>
        <div class="resort-card-grid">${cards || empty}</div>
      </section>`;
  };

  const render = (reports, options = {}) => {
    const safeReports = (Array.isArray(reports) ? reports : []).filter((report) => report && typeof report === "object");
    return `${renderInsightBoard(safeReports, options.mode)}${renderResults(safeReports, options)}`;
  };

  window.CloseSnowFieldGuideHomepage = Object.freeze({
    escapeHtml,
    rankCandidates,
    rankingExplanation,
    render,
    renderDailyDetail,
    renderResortCard,
    weekOneRain,
    weekOneSnow,
    weekTwoSnow,
  });
}());
