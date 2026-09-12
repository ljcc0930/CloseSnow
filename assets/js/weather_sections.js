// Pure HTML rendering: state and helpers are supplied by the page controller.
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.CloseSnowWeatherSections = api;
}(typeof window !== "undefined" ? window : null, function () {
  "use strict";
  const FORECAST_TABS = Object.freeze([
    { key: "summary", label: "Summary" },
    { key: "snowfall", label: "Snowfall" },
    { key: "rainfall", label: "Rainfall" },
    { key: "temperature", label: "Temperature" },
    { key: "weather", label: "Weather" },
    { key: "daylight", label: "Daylight" },
  ]);
  const resolveTab = (key) => FORECAST_TABS.some((tab) => tab.key === key) ? key : "summary";
  const tabForKey = (activeTab, key) => {
    const index = FORECAST_TABS.findIndex((tab) => tab.key === resolveTab(activeTab));
    if (key === "Home") return FORECAST_TABS[0].key;
    if (key === "End") return FORECAST_TABS[FORECAST_TABS.length - 1].key;
    if (key === "ArrowRight") return FORECAST_TABS[(index + 1) % FORECAST_TABS.length].key;
    if (key === "ArrowLeft") return FORECAST_TABS[(index + FORECAST_TABS.length - 1) % FORECAST_TABS.length].key;
    return null;
  };
  const createRenderer = ({ state, formatters, compactDailySummary, weatherCode = {}, reportModel }) => {
    const MAX_DISPLAY_DAYS = 14;
    const STICKY_SINGLE_TABLE_SECTION_KEYS = Object.freeze({
      dailySummary: "daily-summary",
      snowfall: "snowfall",
      rainfall: "rainfall",
      temperature: "temperature",
      weather: "weather",
      sun: "sunrise-sunset",
    });

    const {
      asFiniteNumber: _asFiniteNumber,
      dayLabelHtml: _dayLabelHtml,
      escapeHtml: _escapeHtml,
      formatDayLabel: _formatDayLabel,
      formatMetric: _formatMetric,
      formatTemp: _formatTemp,
      metricCellHtml: _metricCellHtml,
      rainColor: _rainColor,
      snowColor: _snowColor,
      tempColor: _tempColor,
    } = formatters;

    const _weatherEmoji = (rawCode) => {
      const helper = weatherCode.emojiForWeatherCode;
      return helper ? helper(rawCode) : "❓";
    };

    const _filterAttrs = (report) => {
      const passTypes = Array.isArray(report.pass_types) ? report.pass_types.join(",").toLowerCase() : "";
      const region = String(report.region || "").trim().toLowerCase();
      const country = String(report.country_code || report.country || "").trim().toUpperCase();
      const state = String(report.admin1 || "").trim().toUpperCase();
      const defaultResort = report.default_resort || report.ljcc_favorite ? "1" : "";
      return ` data-pass-types='${_escapeHtml(passTypes)}' data-region='${_escapeHtml(region)}' data-country='${_escapeHtml(country)}' data-state='${_escapeHtml(state)}' data-default-resort='${_escapeHtml(defaultResort)}'`;
    };

    const _isFavoriteResortId = (resortId) => state.favoriteResortIds.has(String(resortId || "").trim());

    const _favoriteButtonHtml = (report) => {
      const resortId = String(report.resort_id || "").trim();
      if (!resortId) return "";
      const active = _isFavoriteResortId(resortId);
      const label = active ? "Remove resort from favorites" : "Add resort to favorites";
      return `<button type='button' class='favorite-btn' data-resort-id='${_escapeHtml(resortId)}' data-favorite-active='${active ? "1" : "0"}' aria-pressed='${active ? "true" : "false"}' aria-label='${label}'><svg class='favorite-btn-icon favorite-btn-outline' aria-hidden='true' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'><path d='M12 21s-6.9-4.35-9.2-8.45C.9 9.18 2.03 5.5 5.58 4.6c2.12-.54 4.4.24 5.82 1.98 1.42-1.74 3.7-2.52 5.82-1.98 3.55.9 4.68 4.58 2.78 7.95C18.9 16.65 12 21 12 21Z'/></svg><svg class='favorite-btn-icon favorite-btn-filled' aria-hidden='true' viewBox='0 0 24 24' fill='currentColor'><path d='M12 21s-6.9-4.35-9.2-8.45C.9 9.18 2.03 5.5 5.58 4.6c2.12-.54 4.4.24 5.82 1.98 1.42-1.74 3.7-2.52 5.82-1.98 3.55.9 4.68 4.58 2.78 7.95C18.9 16.65 12 21 12 21Z'/></svg></button>`;
    };

    const _favoriteAllButtonHtml = (reports) => {
      const visibleIds = Array.from(new Set((reports || []).map((report) => String(report?.resort_id || "").trim()).filter(Boolean)));
      if (!visibleIds.length) return "";
      const allFavorited = visibleIds.every((resortId) => _isFavoriteResortId(resortId));
      const label = allFavorited ? "Remove all visible resorts from favorites" : "Favorite all visible resorts";
      return `<button type='button' class='favorite-btn favorite-all-btn' data-favorite-all='1' data-favorite-active='${allFavorited ? "1" : "0"}' aria-pressed='${allFavorited ? "true" : "false"}' aria-label='${label}'><svg class='favorite-btn-icon favorite-btn-outline' aria-hidden='true' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'><path d='M12 21s-6.9-4.35-9.2-8.45C.9 9.18 2.03 5.5 5.58 4.6c2.12-.54 4.4.24 5.82 1.98 1.42-1.74 3.7-2.52 5.82-1.98 3.55.9 4.68 4.58 2.78 7.95C18.9 16.65 12 21 12 21Z'/></svg><svg class='favorite-btn-icon favorite-btn-filled' aria-hidden='true' viewBox='0 0 24 24' fill='currentColor'><path d='M12 21s-6.9-4.35-9.2-8.45C.9 9.18 2.03 5.5 5.58 4.6c2.12-.54 4.4.24 5.82 1.98 1.42-1.74 3.7-2.52 5.82-1.98 3.55.9 4.68 4.58 2.78 7.95C18.9 16.65 12 21 12 21Z'/></svg></button>`;
    };

    const _displayName = reportModel.displayName;

    const _resortLinkHtml = (report) => {
      const text = _escapeHtml(_displayName(report));
      const resortId = String(report.resort_id || "").trim();
      return resortId
        ? `<a class='resort-link' href='resort/${encodeURIComponent(resortId)}'>${text}</a>`
        : text;
    };

    const _resortCellHtml = (report) => {
      const linkHtml = _resortLinkHtml(report);
      return `<td class='favorite-col'>${_favoriteButtonHtml(report)}</td><td class='query-col'><div class='resort-cell'><div class='resort-link-wrap'>${linkHtml}</div></div></td>`;
    };

    const _mobilePrecipResortHeadHtml = (favoriteAllButton) => `
      <th rowspan='2' class='query-col mobile-precip-resort-head'>
        <div class='mobile-precip-resort-content'>${favoriteAllButton}<span class='mobile-precip-resort-label'>Resort</span></div>
      </th>`;

    const _mobilePrecipResortCellHtml = (report) => `
      <td class='query-col mobile-precip-resort-cell'>
        <div class='mobile-precip-resort-content'>${_favoriteButtonHtml(report)}<div class='resort-cell'><div class='resort-link-wrap'>${_resortLinkHtml(report)}</div></div></div>
      </td>`;

    const _displayDays = () => {
      const raw = state.payload && Number(state.payload.forecast_days);
      if (Number.isFinite(raw) && raw > 0) return Math.max(0, Math.min(MAX_DISPLAY_DAYS, raw - 1));
      return MAX_DISPLAY_DAYS;
    };

    const _dailyAt = reportModel.dailyAt;
    const _weeklySnowfall = reportModel.weeklySnowfall;

    const _dayLabelFor = (report, index) => {
      if (index === 0) return "Today";
      const label = _formatDayLabel(_dailyAt(report, index).date);
      if (label) return label;
      return `day ${index + 1}`;
    };

    const _fallbackDayLabels = (count) => Array.from({ length: count }, (_, idx) => (idx === 0 ? "Today" : `day ${idx + 1}`));

    const _emptyStateRow = (colspan, message) => `<tr><td class="empty-state-cell" colspan="${colspan}">${_escapeHtml(message)}</td></tr>`;

    const _overviewLocation = (report) => {
      const parts = [report?.city, report?.admin1 || report?.country_code]
        .map((value) => String(value || "").trim())
        .filter(Boolean);
      return parts.join(", ") || String(report?.region || "Mountain forecast").trim();
    };

    const _overviewValue = (kind, value, fallback = "--") => {
      const numeric = _asFiniteNumber(value);
      if (numeric === null) return `<span class="overview-value">${fallback}</span>`;
      const display = kind === "temp" ? String(Math.round(numeric)) : numeric.toFixed(1);
      return `<span class="overview-value" data-compact-unit-kind="${kind}" data-compact-metric-value="${numeric.toFixed(6)}">${display}</span>`;
    };

    const _renderForecastOverview = (reports) => {
      const snowSorted = [...reports].sort((a, b) => (_weeklySnowfall(b) || 0) - (_weeklySnowfall(a) || 0));
      const hasSnow = snowSorted.some((report) => (_weeklySnowfall(report) || 0) > 0);
      const candidates = (hasSnow
        ? snowSorted
        : [...reports].sort((a, b) => (Number(b?.week1_total_rain_mm) || 0) - (Number(a?.week1_total_rain_mm) || 0)))
        .slice(0, 3);
      const outlookKind = hasSnow ? "snow" : "rain";
      const outlookLabel = hasSnow ? "7-day snow" : "7-day rain";
      const outlookUnit = hasSnow ? "cm" : "mm";
      const cards = candidates.map((report, index) => {
        const today = _dailyAt(report, 0);
        const code = today.weather_code;
        const weatherTitle = weatherCode.descriptionForWeatherCode?.(code) || "Weather unavailable";
        return `
          <article class="snow-pick-card">
            <div class="snow-pick-card-topline">
              <span class="snow-pick-rank">#${index + 1}</span>
              <span class="snow-pick-weather" title="${_escapeHtml(weatherTitle)}">${_weatherEmoji(code)}</span>
            </div>
            <h3>${_resortLinkHtml(report)}</h3>
            <p>${_escapeHtml(_overviewLocation(report))}</p>
            <div class="snow-pick-metrics">
              <span><small>${outlookLabel}</small><strong>${_overviewValue(outlookKind, hasSnow ? _weeklySnowfall(report) : report?.week1_total_rain_mm)}<em data-compact-unit-label="${outlookKind}">${outlookUnit}</em></strong></span>
              <span><small>Today high</small><strong>${_overviewValue("temp", today.temperature_max_c)}<em data-compact-unit-label="temp">°C</em></strong></span>
            </div>
          </article>`;
      }).join("");
      const empty = `
        <div class="overview-empty">
          <strong>No resorts found</strong>
          <span>Try another search or adjust your filters.</span>
        </div>`;
      return `
        <section class="forecast-overview" aria-labelledby="forecast-overview-title">
          <div class="overview-heading">
            <h2 id="forecast-overview-title">${hasSnow ? "Most snow this week" : "Precipitation this week"}</h2>
          </div>
          <div class="snow-pick-grid">${cards || empty}</div>
        </section>`;
    };

    const _renderCompactGridSection = (reports, emptyMessage = "No resorts match the current filters.") => {
      const displayDays = _displayDays();
      const labels = reports.length
        ? Array.from({ length: displayDays }, (_, idx) => compactDailySummary.dayLabelFor(_dailyAt(reports[0], idx), idx))
        : _fallbackDayLabels(displayDays);
      const rows = reports.length ? reports.map((report) => {
        const attrs = _filterAttrs(report);
        const cells = Array.from({ length: displayDays }, (_, idx) => {
          const day = _dailyAt(report, idx);
          const style = compactDailySummary.dayStyle(day);
          const styleAttr = style ? ` style='${style}'` : "";
          return `<td class='compact-day-cell'${styleAttr}>${compactDailySummary.dayCellHtml(day, { unitMode: state.compactSummaryUnitMode })}</td>`;
        }).join("");
        return `<tr${attrs}>${_resortCellHtml(report)}${cells}</tr>`;
      }).join("") : _emptyStateRow(2 + Math.max(1, displayDays), emptyMessage);
      return `
        <section class="forecast-section forecast-section-daily">
          <div class="section-header">
            <h2>Daily Summary</h2>
            <div class="unit-toggle" role="group" aria-label="Daily Summary unit system" data-compact-summary-toggle="1" data-mode="${state.compactSummaryUnitMode}">
              <button type="button" class="unit-btn" data-unit-mode="metric">Metric</button>
              <button type="button" class="unit-btn" data-unit-mode="imperial">Imperial</button>
            </div>
          </div>
          <div
            class="compact-grid-mobile-wrap"
            id="compact-grid-mobile-wrap"
            data-sticky-single-table-section="${STICKY_SINGLE_TABLE_SECTION_KEYS.dailySummary}"
            data-sticky-leading-cols="2"
            data-sticky-header-rows="1"
            data-sticky-max-visible-rows="5"
          >
            <table class="compact-grid-mobile-table" id="compact-grid-mobile-table">
              <colgroup><col class='col-favorite'><col class='col-query'>${Array.from({ length: displayDays }, () => "<col class='col-compact-day'>").join("")}</colgroup>
              <thead><tr><th class='favorite-col favorite-head'>${_favoriteAllButtonHtml(reports)}</th><th class='query-col'>Resort</th>${labels.map((label) => `<th>${_dayLabelHtml(label)}</th>`).join("")}</tr></thead>
              <tbody>${rows}</tbody>
            </table>
          </div>
        </section>`;
    };

    const _renderPrecipSection = (title, kind, metricUnit, imperialUnit, reports, options, emptyMessage = "No resorts match the current filters.") => {
      const displayDays = _displayDays();
      const dayLabels = reports.length
        ? Array.from({ length: displayDays }, (_, idx) => _dayLabelFor(reports[0], idx))
        : _fallbackDayLabels(displayDays);
      const weeklyHeaders = ["week 1", "week 2"];
      const favoriteAllButton = _favoriteAllButtonHtml(reports);
      const stickySectionKey = options.sectionKey || options.prefix;
      if (state.layoutMode === "compact") {
        const mobileRows = reports.length ? reports.map((report) => {
          const attrs = _filterAttrs(report);
          const weeklyValues = [
            options.week1(report),
            options.week2(report),
          ].map((value) => _metricCellHtml(_formatMetric(value), kind, options.color(value), "week-col-cell"));
          const dailyValues = Array.from({ length: displayDays }, (_, idx) => {
            const value = options.daily(_dailyAt(report, idx));
            return _metricCellHtml(_formatMetric(value), kind, options.color(value), "day-col-cell");
          });
          return `<tr${attrs}>${_mobilePrecipResortCellHtml(report)}${weeklyValues.join("")}${dailyValues.join("")}</tr>`;
        }).join("") : _emptyStateRow(3 + Math.max(1, displayDays), emptyMessage);
        return `
          <section class="forecast-section forecast-section-precip">
            <div class="section-header">
              <h2>${title}</h2>
              <div class="unit-toggle" role="group" aria-label="${title} unit system" data-target-kind="${kind}">
                <button type="button" class="unit-btn" data-unit-mode="metric">${metricUnit}</button>
                <button type="button" class="unit-btn" data-unit-mode="imperial">${imperialUnit}</button>
              </div>
            </div>
            <div
              class="${options.prefix}-sticky-wrap mobile-only"
              id="${options.prefix}-sticky-wrap-mobile"
              data-sticky-single-table-section="${_escapeHtml(stickySectionKey)}"
              data-sticky-leading-cols="1"
              data-sticky-header-rows="2"
              data-sticky-max-visible-rows="10"
            >
              <table class="${options.prefix}-sticky-table ${options.prefix}-mobile-sticky-table">
                <colgroup><col class='col-query'><col class='col-week'><col class='col-week'>${Array.from({ length: displayDays }, () => "<col class='col-day'>").join("")}</colgroup>
                <thead><tr>${_mobilePrecipResortHeadHtml(favoriteAllButton)}<th colspan='2' class='week-group'>Weekly</th><th colspan='${displayDays}'>Daily</th></tr><tr><th class='week-col-cell'>${weeklyHeaders[0]}</th><th class='week-col-cell'>${weeklyHeaders[1]}</th>${dayLabels.map((label) => `<th class='day-col-cell'>${_dayLabelHtml(label)}</th>`).join("")}</tr></thead>
                <tbody>${mobileRows}</tbody>
              </table>
            </div>
          </section>`;
      }
      const desktopRows = reports.length ? reports.map((report) => {
        const attrs = _filterAttrs(report);
        const weeklyValues = [
          options.week1(report),
          options.week2(report),
        ].map((value) => _metricCellHtml(_formatMetric(value), kind, options.color(value), "week-col-cell"));
        const dailyValues = Array.from({ length: displayDays }, (_, idx) => {
          const value = options.daily(_dailyAt(report, idx));
          return _metricCellHtml(_formatMetric(value), kind, options.color(value), "day-col-cell");
        }).join("");
        return `<tr${attrs}>${_resortCellHtml(report)}${weeklyValues.join("")}${dailyValues}</tr>`;
      }).join("") : _emptyStateRow(4 + Math.max(1, displayDays), emptyMessage);
      return `
        <section class="forecast-section forecast-section-precip">
          <div class="section-header">
            <h2>${title}</h2>
            <div class="unit-toggle" role="group" aria-label="${title} unit system" data-target-kind="${kind}">
              <button type="button" class="unit-btn" data-unit-mode="metric">${metricUnit}</button>
              <button type="button" class="unit-btn" data-unit-mode="imperial">${imperialUnit}</button>
            </div>
          </div>
          <div
            class="${options.prefix}-sticky-wrap desktop-only"
            id="${options.prefix}-sticky-wrap"
            data-sticky-single-table-section="${_escapeHtml(stickySectionKey)}"
            data-sticky-leading-cols="4"
            data-sticky-header-rows="2"
            data-sticky-max-visible-rows="10"
          >
            <table class="${options.prefix}-sticky-table">
              <colgroup><col class='col-favorite'><col class='col-query'><col class='col-week'><col class='col-week'>${Array.from({ length: displayDays }, () => "<col class='col-day'>").join("")}</colgroup>
              <thead><tr><th rowspan='2' class='favorite-col favorite-head'>${favoriteAllButton}</th><th rowspan='2' class='query-col'>Resort</th><th colspan='2' class='week-group'>Weekly</th><th colspan='${displayDays}'>Daily</th></tr><tr><th class='week-col-cell'>${weeklyHeaders[0]}</th><th class='week-col-cell'>${weeklyHeaders[1]}</th>${dayLabels.map((label) => `<th class='day-col-cell'>${_dayLabelHtml(label)}</th>`).join("")}</tr></thead>
              <tbody>${desktopRows}</tbody>
            </table>
          </div>
        </section>`;
    };

    const _renderTemperatureSection = (reports, emptyMessage = "No resorts match the current filters.") => {
      const displayDays = _displayDays();
      const labels = reports.length
        ? Array.from({ length: displayDays }, (_, idx) => _dayLabelFor(reports[0], idx))
        : _fallbackDayLabels(displayDays);
      const rows = reports.length ? reports.map((report) => {
        const attrs = _filterAttrs(report);
        const cells = Array.from({ length: displayDays }, (_, idx) => {
          const day = _dailyAt(report, idx);
          return [
            _metricCellHtml(_formatTemp(day.temperature_min_c), "temp", _tempColor(day.temperature_min_c)),
            _metricCellHtml(_formatTemp(day.temperature_max_c), "temp", _tempColor(day.temperature_max_c)),
          ].join("");
        }).join("");
        return `<tr${attrs}>${_resortCellHtml(report)}${cells}</tr>`;
      }).join("") : _emptyStateRow(2 + Math.max(1, displayDays * 2), emptyMessage);
      return `
        <section class="forecast-section forecast-section-temperature">
          <div class="section-header">
            <h2>Temperature</h2>
            <div class="unit-toggle" role="group" aria-label="Temperature unit system" data-target-kind="temp">
              <button type="button" class="unit-btn" data-unit-mode="metric">°C</button>
              <button type="button" class="unit-btn" data-unit-mode="imperial">°F</button>
            </div>
          </div>
          <div
            class="temperature-sticky-wrap"
            id="temperature-sticky-wrap"
            data-sticky-single-table-section="${STICKY_SINGLE_TABLE_SECTION_KEYS.temperature}"
            data-sticky-leading-cols="2"
            data-sticky-header-rows="2"
            data-sticky-max-visible-rows="10"
          >
            <table class="temperature-single-table" id="temperature-single-table">
              <colgroup><col class="col-favorite"><col class="col-query">${Array.from({ length: displayDays * 2 }, () => "<col class='col-temp'>").join("")}</colgroup>
              <thead><tr><th rowspan='2' class='favorite-col favorite-head'>${_favoriteAllButtonHtml(reports)}</th><th rowspan='2' class='query-col'>Resort</th>${labels.map((label) => `<th colspan='2'>${_dayLabelHtml(label)}</th>`).join("")}</tr><tr>${Array.from({ length: displayDays }, () => "<th>min</th><th>max</th>").join("")}</tr></thead>
              <tbody>${rows}</tbody>
            </table>
          </div>
        </section>`;
    };

    const _renderWeatherSection = (reports, emptyMessage = "No resorts match the current filters.") => {
      const displayDays = _displayDays();
      const labels = reports.length
        ? Array.from({ length: displayDays }, (_, idx) => _dayLabelFor(reports[0], idx))
        : _fallbackDayLabels(displayDays);
      const weatherCells = (report) => Array.from({ length: displayDays }, (_, idx) => {
        const code = _dailyAt(report, idx).weather_code;
        const title = weatherCode.descriptionForWeatherCode?.(code) || "Weather unavailable";
        return `<td class='weather-emoji-cell' title='${_escapeHtml(title)}'>${_weatherEmoji(code)}</td>`;
      }).join("");
      const rows = reports.length ? reports.map((report) => `<tr${_filterAttrs(report)}>${_resortCellHtml(report)}${weatherCells(report)}</tr>`).join("") : _emptyStateRow(2 + Math.max(1, displayDays), emptyMessage);
      return `
        <section class="forecast-section forecast-section-weather">
          <div class="section-header">
            <h2>Weather</h2>
          </div>
          <div
            class='weather-table-wrap'
            id='weather-table-wrap'
            data-sticky-single-table-section='${STICKY_SINGLE_TABLE_SECTION_KEYS.weather}'
            data-sticky-leading-cols='2'
            data-sticky-header-rows='1'
            data-sticky-max-visible-rows='10'
          >
            <table class='weather-table' id='weather-table'>
              <colgroup><col class='col-favorite'><col class='col-query'>${Array.from({ length: displayDays }, () => "<col class='col-weather'>").join("")}</colgroup>
              <thead><tr><th class='favorite-col favorite-head'>${_favoriteAllButtonHtml(reports)}</th><th class='query-col'>Resort</th>${labels.map((label) => `<th>${_dayLabelHtml(label)}</th>`).join("")}</tr></thead>
              <tbody>${rows}</tbody>
            </table>
          </div>
        </section>`;
    };

    const _renderSunSection = (reports, emptyMessage = "No resorts match the current filters.") => {
      const displayDays = _displayDays();
      const labels = reports.length
        ? Array.from({ length: displayDays }, (_, idx) => _dayLabelFor(reports[0], idx))
        : _fallbackDayLabels(displayDays);
      const hhmm = (raw, mode = "metric") => {
        const text = String(raw || "").trim();
        if (!text) return "";
        const value = text.includes("T") ? text.split("T", 2)[1].slice(0, 5) : text.slice(0, 5);
        if (mode !== "imperial") return value;
        const match = /^(\d{2}):(\d{2})$/.exec(value);
        if (!match) return value;
        const hour24 = Number(match[1]);
        if (!Number.isFinite(hour24)) return value;
        const minute = match[2];
        const suffix = hour24 >= 12 ? "PM" : "AM";
        const hour12 = hour24 % 12 || 12;
        return `${hour12}:${minute} ${suffix}`;
      };
      const totalColumns = 2 + (displayDays * 2);
      const rows = reports.length ? reports.map((report) => {
        const attrs = _filterAttrs(report);
        const cells = Array.from({ length: displayDays }, (_, idx) => {
          const day = _dailyAt(report, idx);
          const sunriseRaw = hhmm(day.sunrise_local_hhmm || day.sunrise_iso);
          const sunsetRaw = hhmm(day.sunset_local_hhmm || day.sunset_iso);
          const sunrise = hhmm(sunriseRaw, state.sunTimeToggleMode);
          const sunset = hhmm(sunsetRaw, state.sunTimeToggleMode);
          return `<td data-sun-time-raw="${_escapeHtml(sunriseRaw)}">${_escapeHtml(sunrise)}</td><td data-sun-time-raw="${_escapeHtml(sunsetRaw)}">${_escapeHtml(sunset)}</td>`;
        }).join("");
        return `<tr${attrs}>${_resortCellHtml(report)}${cells}</tr>`;
      }).join("") : _emptyStateRow(totalColumns, emptyMessage);
      return `
        <section class="forecast-section forecast-section-sun">
          <div class="section-header">
            <h2>Sunrise / Sunset</h2>
            <div class="unit-toggle" role="group" aria-label="Sunrise and sunset time format" data-sun-time-toggle="1" data-mode="${state.sunTimeToggleMode}">
              <button type="button" class="unit-btn" data-unit-mode="metric">24h</button>
              <button type="button" class="unit-btn" data-unit-mode="imperial">12h</button>
            </div>
          </div>
          <div
            class="sun-single-wrap"
            id="sun-single-wrap"
            data-sticky-single-table-section="${STICKY_SINGLE_TABLE_SECTION_KEYS.sun}"
            data-sticky-leading-cols="2"
            data-sticky-header-rows="2"
            data-sticky-max-visible-rows="10"
          >
            <table class="sun-single-table" id="sun-single-table">
              <colgroup><col class="col-favorite"><col class="col-query">${Array.from({ length: displayDays * 2 }, () => "<col class='col-sun'>").join("")}</colgroup>
              <thead><tr><th rowspan='2' class='favorite-col favorite-head'>${_favoriteAllButtonHtml(reports)}</th><th rowspan='2' class='query-col'>Resort</th>${labels.map((label) => `<th colspan='2'>${_dayLabelHtml(label)}</th>`).join("")}</tr><tr>${Array.from({ length: displayDays }, () => "<th>sunrise</th><th>sunset</th>").join("")}</tr></thead>
              <tbody>${rows}</tbody>
            </table>
          </div>
        </section>`;
    };

    const render = (reports, emptyMessage = "No resorts match the current filters.") => {
      const activeTab = resolveTab(state.forecastTab);
      const renderers = {
        summary: () => _renderCompactGridSection(reports, emptyMessage),
        snowfall: () => _renderPrecipSection("Snowfall", "snow", "cm", "in", reports, {
          prefix: "snowfall", sectionKey: STICKY_SINGLE_TABLE_SECTION_KEYS.snowfall,
          week1: (report) => report.week1_total_snowfall_cm,
          week2: (report) => report.week2_total_snowfall_cm,
          daily: (day) => day.snowfall_cm, color: _snowColor,
        }, emptyMessage),
        rainfall: () => _renderPrecipSection("Rainfall", "rain", "mm", "in", reports, {
          prefix: "rain", sectionKey: STICKY_SINGLE_TABLE_SECTION_KEYS.rainfall,
          week1: (report) => report.week1_total_rain_mm,
          week2: (report) => report.week2_total_rain_mm,
          daily: (day) => day.rain_mm, color: _rainColor,
        }, emptyMessage),
        temperature: () => _renderTemperatureSection(reports, emptyMessage),
        weather: () => _renderWeatherSection(reports, emptyMessage),
        daylight: () => _renderSunSection(reports, emptyMessage),
      };
      const tabs = FORECAST_TABS.map(({ key, label }) => {
        const selected = key === activeTab;
        return `<button type="button" class="forecast-tab${selected ? " is-active" : ""}" id="forecast-tab-${key}" role="tab" data-forecast-tab="${key}" aria-selected="${selected}" aria-controls="forecast-panel-${key}" tabindex="${selected ? "0" : "-1"}">${label}</button>`;
      }).join("");
      // Inactive tables are not created, keeping large resort collections responsive.
      const panels = FORECAST_TABS.map(({ key }) => `<div class="forecast-panel" id="forecast-panel-${key}" role="tabpanel" aria-labelledby="forecast-tab-${key}"${key === activeTab ? ' tabindex="0"' : ' hidden'}>${key === activeTab ? renderers[key]() : ""}</div>`).join("");
      return `${_renderForecastOverview(reports)}<div class="forecast-workspace"><div class="forecast-tabs" role="tablist" aria-label="Forecast view">${tabs}</div>${panels}</div>`;
    };
    return { render };
  };
  return { FORECAST_TABS, resolveTab, tabForKey, createRenderer };
}));
