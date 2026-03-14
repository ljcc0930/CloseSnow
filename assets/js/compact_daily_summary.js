(function () {
  const _asFiniteNumber = (value) => {
    if (value === null || value === undefined || value === "") return null;
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
  };

  const _escapeHtml = (value) => String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");

  const _formatDayLabel = (raw) => {
    const text = String(raw || "").trim();
    if (!text) return "";
    const [datePart] = text.split("T");
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(datePart);
    if (!match) return text;
    const [, , month, day] = match;
    const weekday = new Date(`${datePart}T12:00:00Z`).toLocaleDateString("en-US", {
      weekday: "short",
      timeZone: "UTC",
    });
    return `${month}-${day}\n${weekday}`;
  };

  const _weatherEmoji = (rawCode) => {
    const code = Number(rawCode);
    if (!Number.isFinite(code)) return "❓";
    if (code === 0) return "☀️";
    if (code === 1) return "🌤️";
    if (code === 2) return "⛅";
    if (code === 3) return "☁️";
    if (code === 45 || code === 48) return "🌫️";
    if ([51, 53, 55, 56, 57].includes(code)) return "🌦️";
    if ([61, 63, 65, 80, 81, 82].includes(code)) return "🌧️";
    if ([71, 73, 75, 77, 85, 86].includes(code)) return "❄️";
    if ([95, 96, 99].includes(code)) return "⛈️";
    return "❓";
  };

  const _snowColor = (value) => {
    const v = _asFiniteNumber(value);
    if (v === null) return "";
    if (v > 15) return "background:#FFE7CC;";
    const x = Math.min(Math.max(v, 0), 15) / 15;
    const r = Math.round(255 + ((207 - 255) * x));
    const g = Math.round(255 + ((232 - 255) * x));
    return `background:rgb(${r},${g},255);`;
  };

  const _tempColor = (value) => {
    const v = _asFiniteNumber(value);
    if (v === null) return "";
    if (v < -10) return "background:#CFE8FF;";
    if (v < 0) {
      const x = (v + 10) / 10;
      const r = Math.round(207 + ((255 - 207) * x));
      const g = Math.round(232 + ((255 - 232) * x));
      return `background:rgb(${r},${g},255);`;
    }
    if (v <= 20) {
      if (v <= 4) return "background:#FFFFFF;";
      const x = (v - 4) / 16;
      const g = Math.round(255 + ((214 - 255) * x));
      const b = Math.round(255 + ((214 - 255) * x));
      return `background:rgb(255,${g},${b});`;
    }
    return "background:#FFD6D6;";
  };

  const _formatCompactValue = (value, digits = 1) => {
    const num = _asFiniteNumber(value);
    return num === null ? "--" : num.toFixed(digits);
  };

  const _formatCompactTempValue = (value) => {
    const num = _asFiniteNumber(value);
    if (num === null) return "--";
    return String(Math.round(num));
  };

  const dayLabelFor = (day, index = 0) => {
    const label = _formatDayLabel(day?.date);
    if (label) return label;
    return index === 0 ? "today" : `day ${index + 1}`;
  };

  const dayStyle = (day) => {
    const snowfall = _asFiniteNumber(day?.snowfall_cm);
    if (snowfall !== null && snowfall > 0) return _snowColor(snowfall);
    return _tempColor(day?.temperature_max_c);
  };

  const dayCellHtml = (day) => {
    const weatherCode = day?.weather_code;
    const weatherEmoji = _weatherEmoji(weatherCode);
    const highTemp = _formatCompactTempValue(day?.temperature_max_c);
    const lowTemp = _formatCompactTempValue(day?.temperature_min_c);
    const snowValue = _formatCompactValue(day?.snowfall_cm);
    const rainValue = _formatCompactValue(day?.rain_mm);
    return `
      <div class="compact-day-card">
        <div class="compact-row compact-row-primary">
          <div class="compact-weather" title="${_escapeHtml(weatherCode === null || weatherCode === undefined || weatherCode === "" ? "WMO code: unknown" : `WMO code: ${weatherCode}`)}">${weatherEmoji}</div>
          <div class="compact-temp-stack">
            <div class="compact-temp-high">${_escapeHtml(highTemp)}</div>
            <div class="compact-temp-low">${_escapeHtml(lowTemp)}</div>
          </div>
        </div>
        <div class="compact-row compact-row-secondary">
          <div class="compact-pair compact-snow"><span class="compact-pair-icon">❄</span><span class="compact-pair-value">${_escapeHtml(snowValue)}</span></div>
          <div class="compact-pair compact-rain"><span class="compact-pair-icon">☔</span><span class="compact-pair-value">${_escapeHtml(rainValue)}</span></div>
        </div>
      </div>`;
  };

  const renderSingleResortHtml = (daily) => {
    const days = Array.isArray(daily) ? daily : [];
    if (!days.length) return "<p class='daily-summary-empty'>No forecast data</p>";
    return `
      <div class="resort-daily-summary-wrap">
        <table class="resort-daily-summary-table">
          <colgroup>${days.map(() => "<col class='col-compact-day'>").join("")}</colgroup>
          <thead><tr>${days.map((day, index) => `<th>${dayLabelFor(day, index).split("\n").map((part, partIndex) => `<span class="day-label-${partIndex === 0 ? "date" : "weekday"}">${_escapeHtml(part)}</span>`).join("")}</th>`).join("")}</tr></thead>
          <tbody><tr>${days.map((day) => {
            const style = dayStyle(day);
            const styleAttr = style ? ` style='${style}'` : "";
            return `<td class='compact-day-cell'${styleAttr}>${dayCellHtml(day)}</td>`;
          }).join("")}</tr></tbody>
        </table>
      </div>`;
  };

  window.CloseSnowCompactDailySummary = {
    dayCellHtml,
    dayLabelFor,
    dayStyle,
    renderSingleResortHtml,
  };
}());
