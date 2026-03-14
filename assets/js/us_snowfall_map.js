(() => {
  const rootScope = typeof window !== "undefined" ? window : globalThis;
  const doc = typeof document !== "undefined" ? document : null;
  const DEFAULT_METRIC_KEY = "today";
  const METRIC_ORDER = ["today", "next_72h", "week1"];
  const METRIC_CONFIG = {
    today: {
      field: "today_snowfall_cm",
      buttonLabel: "24h",
      label: "24h snowfall",
      legend: ["0-5 cm", "5-15 cm", "15+ cm"],
    },
    next_72h: {
      field: "next_72h_snowfall_cm",
      buttonLabel: "72h",
      label: "72h snowfall",
      legend: ["0-10 cm", "10-25 cm", "25+ cm"],
    },
    week1: {
      field: "week1_total_snowfall_cm",
      buttonLabel: "7d",
      label: "7-day snowfall",
      legend: ["0-20 cm", "20-50 cm", "50+ cm"],
    },
  };
  const METRIC_ALIASES = {
    today_snow: "today",
    week_snow: "week1",
  };
  const US_FALLBACK_VIEW = {
    minLatitude: 24,
    maxLatitude: 50,
    minLongitude: -125,
    maxLongitude: -66,
  };

  const _element = (value) => (
    value && typeof value === "object" && typeof value.querySelector === "function" ? value : null
  );

  const _text = (value) => String(value || "").trim();

  const _escapeHtml = (value) => _text(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

  const _asFiniteNumber = (value) => {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  };

  const _normalizeMetricKey = (value) => {
    const raw = _text(value);
    const normalized = METRIC_ALIASES[raw] || raw;
    return METRIC_CONFIG[normalized] ? normalized : DEFAULT_METRIC_KEY;
  };

  const _metricConfig = (metricKey) => METRIC_CONFIG[_normalizeMetricKey(metricKey)];

  const _reportResortId = (report) => _text(report && report.resort_id);

  const _selectionKey = (report, index) => _reportResortId(report) || _text(report && report.query) || `report-${index + 1}`;

  const _displayName = (report) => _text(report && (report.display_name || report.matched_name || report.query || "Unnamed resort"));

  const _passTypesText = (report) => {
    const passTypes = Array.isArray(report && report.pass_types) ? report.pass_types : [];
    const values = passTypes.map((item) => _text(item)).filter(Boolean);
    if (!values.length) return "Independent access";
    return values.map((item) => item.charAt(0).toUpperCase() + item.slice(1)).join(" / ");
  };

  const _formatSnowfall = (value) => {
    const amount = _asFiniteNumber(value);
    if (amount === null) return "0 cm";
    if (amount >= 10) return `${Math.round(amount)} cm`;
    if (amount >= 1) return `${amount.toFixed(1)} cm`;
    if (amount <= 0) return "0 cm";
    return `${amount.toFixed(2)} cm`;
  };

  const _normalizeReports = (reports) => {
    if (!Array.isArray(reports)) return [];
    const seen = new Set();
    const out = [];
    reports.forEach((report, index) => {
      if (!report || typeof report !== "object") return;
      const key = _selectionKey(report, index);
      if (seen.has(key)) return;
      seen.add(key);
      out.push(report);
    });
    return out;
  };

  const _eligibleReports = (reports) => _normalizeReports(reports)
    .filter((report) => {
      const mapContext = report && typeof report.map_context === "object" ? report.map_context : null;
      if (!mapContext || mapContext.eligible !== true) return false;
      return _asFiniteNumber(mapContext.latitude) !== null && _asFiniteNumber(mapContext.longitude) !== null;
    });

  const _metricValue = (report, metricKey) => {
    const mapContext = report && typeof report.map_context === "object" ? report.map_context : null;
    const config = _metricConfig(metricKey);
    const amount = _asFiniteNumber(mapContext && mapContext[config.field]);
    return amount === null ? 0 : Math.max(0, amount);
  };

  const _fitView = (reports) => {
    if (!reports.length) return { ...US_FALLBACK_VIEW };
    let minLatitude = Infinity;
    let maxLatitude = -Infinity;
    let minLongitude = Infinity;
    let maxLongitude = -Infinity;
    reports.forEach((report) => {
      const mapContext = report.map_context || {};
      const latitude = _asFiniteNumber(mapContext.latitude);
      const longitude = _asFiniteNumber(mapContext.longitude);
      if (latitude === null || longitude === null) return;
      minLatitude = Math.min(minLatitude, latitude);
      maxLatitude = Math.max(maxLatitude, latitude);
      minLongitude = Math.min(minLongitude, longitude);
      maxLongitude = Math.max(maxLongitude, longitude);
    });
    if (!Number.isFinite(minLatitude) || !Number.isFinite(minLongitude)) return { ...US_FALLBACK_VIEW };
    const latitudeSpan = Math.max(5, maxLatitude - minLatitude);
    const longitudeSpan = Math.max(8, maxLongitude - minLongitude);
    return {
      minLatitude: minLatitude - latitudeSpan * 0.18,
      maxLatitude: maxLatitude + latitudeSpan * 0.18,
      minLongitude: minLongitude - longitudeSpan * 0.16,
      maxLongitude: maxLongitude + longitudeSpan * 0.16,
    };
  };

  const _projectPoint = (report, view) => {
    const mapContext = report.map_context || {};
    const latitude = _asFiniteNumber(mapContext.latitude);
    const longitude = _asFiniteNumber(mapContext.longitude);
    if (latitude === null || longitude === null) return null;
    const longitudeSpan = Math.max(1, view.maxLongitude - view.minLongitude);
    const latitudeSpan = Math.max(1, view.maxLatitude - view.minLatitude);
    const x = (longitude - view.minLongitude) / longitudeSpan;
    const y = 1 - ((latitude - view.minLatitude) / latitudeSpan);
    return {
      x: Math.min(0.96, Math.max(0.04, x)),
      y: Math.min(0.92, Math.max(0.08, y)),
    };
  };

  const _markerSize = (value) => {
    if (value >= 50) return 36;
    if (value >= 25) return 30;
    if (value >= 10) return 24;
    if (value > 0) return 18;
    return 14;
  };

  const _markerFill = (value) => {
    if (value >= 25) return "#1d4ed8";
    if (value >= 10) return "#3b82f6";
    if (value > 0) return "#93c5fd";
    return "#dbeafe";
  };

  const _markerGlow = (value, highlighted) => {
    if (highlighted) return "0 0 0 4px rgba(15, 118, 110, 0.22), 0 18px 34px rgba(15, 23, 42, 0.28)";
    if (value >= 25) return "0 14px 28px rgba(29, 78, 216, 0.34)";
    if (value >= 10) return "0 12px 24px rgba(59, 130, 246, 0.28)";
    return "0 10px 20px rgba(30, 41, 59, 0.18)";
  };

  const _popupHtml = (report, metricKey) => {
    const metric = _metricConfig(metricKey);
    const resortId = _reportResortId(report);
    const state = _text(report && report.admin1);
    const header = _escapeHtml(_displayName(report));
    const metricValue = _formatSnowfall(_metricValue(report, metricKey));
    const passTypes = _escapeHtml(_passTypesText(report));
    const stateText = state ? _escapeHtml(state.toUpperCase()) : "US";
    const linkHtml = resortId
      ? `<a class="us-snowfall-map-popup-link" href="resort/${encodeURIComponent(resortId)}">Open hourly page</a>`
      : "";
    return `
      <button type="button" class="us-snowfall-map-popup-close" data-map-popup-close="1" aria-label="Close snowfall map popup">Close</button>
      <div class="us-snowfall-map-popup-kicker">${_escapeHtml(metric.label)}</div>
      <strong class="us-snowfall-map-popup-title">${header}</strong>
      <div class="us-snowfall-map-popup-metric">${metricValue}</div>
      <div class="us-snowfall-map-popup-meta">${stateText} · ${passTypes}</div>
      ${linkHtml}
    `;
  };

  const _metricButtonsHtml = () => METRIC_ORDER.map((metricKey, index) => {
    const config = _metricConfig(metricKey);
    const active = index === 0 ? " is-active" : "";
    const pressed = index === 0 ? "true" : "false";
    return `<button type="button" class="unit-btn${active}" data-map-metric-key="${metricKey}" aria-pressed="${pressed}">${config.buttonLabel}</button>`;
  }).join("");

  const _legendHtml = () => {
    const config = _metricConfig(DEFAULT_METRIC_KEY);
    return [
      `<span class="us-snowfall-map-legend-chip" data-map-legend-stop="low">${config.legend[0]}</span>`,
      `<span class="us-snowfall-map-legend-chip" data-map-legend-stop="mid">${config.legend[1]}</span>`,
      `<span class="us-snowfall-map-legend-chip" data-map-legend-stop="high">${config.legend[2]}</span>`,
    ].join("");
  };

  const _mapStageHtml = () => `
    <div class="us-snowfall-map-stage" data-map-stage="1">
      <div class="us-snowfall-map-stage-accent" aria-hidden="true"></div>
      <div class="us-snowfall-map-region-label us-snowfall-map-region-label-west" aria-hidden="true">West</div>
      <div class="us-snowfall-map-region-label us-snowfall-map-region-label-central" aria-hidden="true">Central</div>
      <div class="us-snowfall-map-region-label us-snowfall-map-region-label-east" aria-hidden="true">East</div>
      <div class="us-snowfall-map-marker-layer" data-map-marker-layer="1"></div>
      <div class="us-snowfall-map-inline-message" data-map-inline-message="1"></div>
      <div class="us-snowfall-map-popup" data-map-popup="1" hidden></div>
    </div>
  `;

  const _findLegendChips = (legendElement) => {
    if (!legendElement) return [];
    let chips = Array.from(legendElement.querySelectorAll("[data-map-legend-stop]"));
    if (chips.length !== 3) {
      legendElement.innerHTML = _legendHtml();
      chips = Array.from(legendElement.querySelectorAll("[data-map-legend-stop]"));
    }
    return chips;
  };

  const _findMetricButtons = (metricToggle) => {
    if (!metricToggle) return [];
    let buttons = Array.from(metricToggle.querySelectorAll("[data-map-metric-key]"));
    if (buttons.length !== METRIC_ORDER.length) {
      metricToggle.innerHTML = _metricButtonsHtml();
      buttons = Array.from(metricToggle.querySelectorAll("[data-map-metric-key]"));
    }
    buttons.forEach((button) => {
      const metricKey = _normalizeMetricKey(button.getAttribute("data-map-metric-key"));
      button.setAttribute("data-map-metric-key", metricKey);
      button.textContent = _metricConfig(metricKey).buttonLabel;
    });
    return buttons;
  };

  const create = (options = {}) => {
    const noop = {
      setVisibleReports() {},
      setMetric() {},
      setSelectedResort() {},
      resize() {},
      destroy() {},
    };
    if (!doc) return noop;

    const section = _element(options.section) || doc.getElementById("us-snowfall-map-section");
    const metricToggle = _element(options.metricToggle) || doc.getElementById("us-snowfall-map-metric-toggle");
    const statusElement = _element(options.statusElement) || doc.getElementById("us-snowfall-map-status");
    const legendElement = _element(options.legendElement) || doc.getElementById("us-snowfall-map-legend");
    const mapRoot = _element(options.mapRoot) || doc.getElementById("us-snowfall-map-root");
    if (!section && !metricToggle && !statusElement && !legendElement && !mapRoot) return noop;

    const buttons = _findMetricButtons(metricToggle);
    const legendChips = _findLegendChips(legendElement);
    if (mapRoot) {
      mapRoot.innerHTML = _mapStageHtml();
      mapRoot.setAttribute("role", "region");
      mapRoot.setAttribute("aria-label", "US snowfall map");
    }

    const markerLayer = mapRoot ? mapRoot.querySelector("[data-map-marker-layer]") : null;
    const inlineMessage = mapRoot ? mapRoot.querySelector("[data-map-inline-message]") : null;
    const popupElement = mapRoot ? mapRoot.querySelector("[data-map-popup]") : null;
    const state = {
      destroyed: false,
      metricKey: _normalizeMetricKey(options.metricKey),
      selectedResortId: _text(options.selectedResortId),
      popupResortId: _text(options.selectedResortId),
      visibleReports: _normalizeReports(options.reports),
      errorMessage: "",
    };

    const renderStatus = (eligibleReports) => {
      if (!statusElement) return;
      const metric = _metricConfig(state.metricKey);
      if (state.errorMessage) {
        statusElement.textContent = `Snowfall map unavailable. ${state.errorMessage}`;
        return;
      }
      if (!eligibleReports.length) {
        const visibleCount = state.visibleReports.length;
        const scopeText = visibleCount ? "No visible resorts" : "No resorts";
        statusElement.textContent = `${scopeText} are map-ready for ${metric.label}. Non-US resorts and resorts without coordinates stay in the tables only.`;
        return;
      }
      const focused = state.selectedResortId
        ? ` Focused resort: ${_displayName(eligibleReports.find((report, index) => _selectionKey(report, index) === state.selectedResortId) || { resort_id: state.selectedResortId, query: state.selectedResortId })}.`
        : "";
      statusElement.textContent = `Showing ${eligibleReports.length} US resort${eligibleReports.length === 1 ? "" : "s"} for ${metric.label}.${focused}`;
    };

    const renderLegend = () => {
      if (!legendElement) return;
      const metric = _metricConfig(state.metricKey);
      legendElement.setAttribute("data-map-metric-key", state.metricKey);
      legendChips.forEach((chip, index) => {
        chip.textContent = metric.legend[index] || metric.legend[metric.legend.length - 1];
      });
    };

    const renderButtons = () => {
      if (metricToggle) metricToggle.setAttribute("data-mode", state.metricKey);
      buttons.forEach((button) => {
        const active = _normalizeMetricKey(button.getAttribute("data-map-metric-key")) === state.metricKey;
        button.classList.toggle("is-active", active);
        button.setAttribute("aria-pressed", active ? "true" : "false");
      });
    };

    const renderInlineMessage = (message, kind = "info") => {
      if (!inlineMessage) return;
      inlineMessage.hidden = false;
      inlineMessage.classList.toggle("is-error", kind === "error");
      inlineMessage.innerHTML = `<strong>${kind === "error" ? "Map offline" : "Map preview"}</strong><span>${_escapeHtml(message)}</span>`;
    };

    const hideInlineMessage = () => {
      if (!inlineMessage) return;
      inlineMessage.hidden = true;
      inlineMessage.classList.remove("is-error");
      inlineMessage.innerHTML = "";
    };

    const renderPopup = (eligibleReports) => {
      if (!popupElement) return;
      const activeKey = state.popupResortId || state.selectedResortId;
      const activeReport = eligibleReports.find((report, index) => _selectionKey(report, index) === activeKey);
      if (!activeReport) {
        popupElement.hidden = true;
        popupElement.innerHTML = "";
        return;
      }
      popupElement.hidden = false;
      popupElement.innerHTML = _popupHtml(activeReport, state.metricKey);
    };

    const renderMarkers = (eligibleReports) => {
      if (!markerLayer) return;
      markerLayer.innerHTML = "";
      const view = _fitView(eligibleReports);
      const ranked = eligibleReports
        .map((report, index) => ({
          report,
          index,
          key: _selectionKey(report, index),
          value: _metricValue(report, state.metricKey),
        }))
        .sort((left, right) => {
          const leftSelected = left.key === state.selectedResortId || left.key === state.popupResortId;
          const rightSelected = right.key === state.selectedResortId || right.key === state.popupResortId;
          if (leftSelected !== rightSelected) return leftSelected ? 1 : -1;
          return left.value - right.value;
        });

      ranked.forEach(({ report, index, key, value }) => {
        const point = _projectPoint(report, view);
        if (!point) return;
        const highlighted = key === state.selectedResortId || key === state.popupResortId;
        const marker = doc.createElement("button");
        marker.type = "button";
        marker.className = "us-snowfall-map-marker";
        if (highlighted) marker.classList.add("is-selected");
        marker.setAttribute("data-map-marker", "1");
        marker.setAttribute("data-resort-id", key);
        marker.setAttribute("aria-label", `${_displayName(report)}: ${_formatSnowfall(value)} ${_metricConfig(state.metricKey).label}`);
        marker.style.left = `${(point.x * 100).toFixed(3)}%`;
        marker.style.top = `${(point.y * 100).toFixed(3)}%`;
        marker.style.setProperty("--marker-size", `${_markerSize(value)}px`);
        marker.style.setProperty("--marker-fill", _markerFill(value));
        marker.style.setProperty("--marker-shadow", _markerGlow(value, highlighted));
        marker.style.setProperty("--marker-ring", highlighted ? "rgba(15, 118, 110, 0.9)" : "rgba(255, 255, 255, 0.92)");
        marker.innerHTML = `<span class="us-snowfall-map-marker-value">${_escapeHtml(_formatSnowfall(value))}</span>`;
        markerLayer.appendChild(marker);
      });
    };

    const render = () => {
      if (state.destroyed) return;
      try {
        state.errorMessage = "";
        const eligibleReports = _eligibleReports(state.visibleReports);
        renderButtons();
        renderLegend();
        if (section) {
          section.setAttribute("data-map-ready", "1");
          section.setAttribute("data-map-metric-key", state.metricKey);
        }
        if (mapRoot) {
          mapRoot.setAttribute("data-active-metric", state.metricKey);
          mapRoot.setAttribute("data-map-count", String(eligibleReports.length));
        }
        renderStatus(eligibleReports);
        renderMarkers(eligibleReports);
        renderPopup(eligibleReports);
        if (!eligibleReports.length) {
          renderInlineMessage(
            "No visible US resorts currently qualify for map markers. Try a broader set of resorts or switch back to the resort tables below.",
          );
        } else {
          hideInlineMessage();
        }
      } catch (error) {
        state.errorMessage = "The interactive controller failed to render, but the rest of the page is still available.";
        renderStatus([]);
        renderInlineMessage("The interactive controller failed to render, but the rest of the page is still available.", "error");
        if (popupElement) {
          popupElement.hidden = true;
          popupElement.innerHTML = "";
        }
      }
    };

    const onToggleClick = (event) => {
      const button = event.target && event.target.closest ? event.target.closest("[data-map-metric-key]") : null;
      if (!button) return;
      event.preventDefault();
      api.setMetric(button.getAttribute("data-map-metric-key"));
    };

    const onMapClick = (event) => {
      const marker = event.target && event.target.closest ? event.target.closest("[data-map-marker]") : null;
      if (marker) {
        event.preventDefault();
        state.popupResortId = _text(marker.getAttribute("data-resort-id"));
        render();
        return;
      }
      const closeButton = event.target && event.target.closest ? event.target.closest("[data-map-popup-close]") : null;
      if (closeButton) {
        event.preventDefault();
        state.popupResortId = "";
        render();
      }
    };

    if (metricToggle) metricToggle.addEventListener("click", onToggleClick);
    if (mapRoot) mapRoot.addEventListener("click", onMapClick);

    const api = {
      setVisibleReports(reports) {
        if (state.destroyed) return;
        state.visibleReports = _normalizeReports(reports);
        if (state.popupResortId) {
          const popupStillVisible = _eligibleReports(state.visibleReports)
            .some((report, index) => _selectionKey(report, index) === state.popupResortId);
          if (!popupStillVisible) state.popupResortId = "";
        }
        render();
      },
      setMetric(metricKey) {
        if (state.destroyed) return;
        state.metricKey = _normalizeMetricKey(metricKey);
        render();
      },
      setSelectedResort(resortId) {
        if (state.destroyed) return;
        state.selectedResortId = _text(resortId);
        state.popupResortId = state.selectedResortId;
        render();
      },
      resize() {
        if (state.destroyed) return;
        render();
      },
      destroy() {
        if (state.destroyed) return;
        state.destroyed = true;
        if (metricToggle) metricToggle.removeEventListener("click", onToggleClick);
        if (mapRoot) mapRoot.removeEventListener("click", onMapClick);
      },
    };

    render();
    return api;
  };

  const api = { create };
  if (typeof window !== "undefined") {
    window.CloseSnowUsSnowfallMap = api;
  } else {
    rootScope.CloseSnowUsSnowfallMap = api;
  }
})();
