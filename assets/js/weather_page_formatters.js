(function () {
  const normalizeSearch = (value) => String(value || "").trim().toLowerCase();

  const escapeHtml = (value) => String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");

  const isTruthyParam = (value) => {
    const text = normalizeSearch(value);
    return text === "1" || text === "true" || text === "yes" || text === "on";
  };

  const asFiniteNumber = (value) => {
    if (value === null || value === undefined || value === "") return null;
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
  };

  const formatMetric = (value) => {
    const num = asFiniteNumber(value);
    return num === null ? "" : num.toFixed(1);
  };

  const formatTemp = (value) => {
    const num = asFiniteNumber(value);
    if (num === null) return "";
    if (Number.isInteger(num)) return String(num);
    return num.toFixed(1);
  };

  const formatDayLabel = (dateText) => {
    const text = String(dateText || "").trim();
    if (!text) return "";
    const parts = text.split("-");
    if (parts.length !== 3) return "";
    const [year, month, day] = parts;
    const dt = new Date(`${year}-${month}-${day}T00:00:00`);
    if (Number.isNaN(dt.getTime())) return "";
    const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    return `${month}-${day} ${weekdays[dt.getDay()]}`;
  };

  const dayLabelHtml = (label) => {
    const text = String(label || "").trim();
    if (!text) return "";
    const parts = text.split(/\s+/, 2);
    if (parts.length === 2 && parts[0].includes("-")) {
      return `<span class='day-label-date'>${escapeHtml(parts[0])}</span><span class='day-label-weekday'>${escapeHtml(parts[1])}</span>`;
    }
    return escapeHtml(text);
  };

  const snowColor = (value) => {
    const v = asFiniteNumber(value);
    if (v === null) return "";
    if (v > 15) return "background:#FFE7CC;";
    const x = Math.min(Math.max(v, 0), 15) / 15;
    const r = Math.round(255 + ((207 - 255) * x));
    const g = Math.round(255 + ((232 - 255) * x));
    return `background:rgb(${r},${g},255);`;
  };

  const rainColor = (value) => {
    const v = asFiniteNumber(value);
    if (v === null) return "";
    if (v <= 0) return "background:#FFFFFF;";
    if (v >= 7.6) return "background:#CFEFD8;";
    const x = v / 7.6;
    const r = Math.round(255 + ((207 - 255) * x));
    const g = Math.round(255 + ((239 - 255) * x));
    const b = Math.round(255 + ((216 - 255) * x));
    return `background:rgb(${r},${g},${b});`;
  };

  const tempColor = (value) => {
    const v = asFiniteNumber(value);
    if (v === null) return "";
    if (v < -10) return "background:#DCEFF8;";
    if (v < 0) {
      const x = (v + 10) / 10;
      const r = Math.round(220 + ((248 - 220) * x));
      const g = Math.round(239 + ((251 - 239) * x));
      return `background:rgb(${r},${g},252);`;
    }
    if (v <= 20) {
      if (v <= 4) return "background:#FFFFFF;";
      const x = (v - 4) / 16;
      const g = Math.round(255 + ((248 - 255) * x));
      const b = Math.round(255 + ((240 - 255) * x));
      return `background:rgb(255,${g},${b});`;
    }
    return "background:#FFF2E8;";
  };

  const metricCellHtml = (rawValue, kind, style = "", klass = "") => {
    const value = String(rawValue || "").trim();
    const klassAttr = klass ? ` class='${klass}'` : "";
    const styleAttr = style ? ` style='${style}'` : "";
    const numeric = asFiniteNumber(value);
    if (numeric === null) {
      return `<td${klassAttr}${styleAttr}>${escapeHtml(value)}</td>`;
    }
    return `<td${klassAttr}${styleAttr} data-kind='${kind}' data-metric-value='${numeric.toFixed(6)}'>${escapeHtml(value)}</td>`;
  };

  window.CloseSnowWeatherPageFormatters = {
    asFiniteNumber,
    dayLabelHtml,
    escapeHtml,
    formatDayLabel,
    formatMetric,
    formatTemp,
    isTruthyParam,
    metricCellHtml,
    normalizeSearch,
    rainColor,
    snowColor,
    tempColor,
  };
}());
