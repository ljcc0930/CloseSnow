(() => {
  const rootScope = typeof window !== "undefined" ? window : globalThis;
  const DEFAULT_METRIC_KEY = "today_snow";
  const METRIC_LABELS = {
    today_snow: "24h snowfall",
    week_snow: "7-day snowfall",
  };

  const _element = (value) => (
    value && typeof value === "object" && typeof value.querySelector === "function" ? value : null
  );

  const _text = (value) => String(value || "").trim();

  const _normalizeMetricKey = (value) => {
    const text = _text(value);
    return text || DEFAULT_METRIC_KEY;
  };

  const _metricLabel = (metricKey) => METRIC_LABELS[metricKey] || metricKey || METRIC_LABELS[DEFAULT_METRIC_KEY];

  const _visibleResortIds = (reports) => {
    if (!Array.isArray(reports)) return [];
    const seen = new Set();
    const out = [];
    reports.forEach((report) => {
      const resortId = typeof report === "string" ? report : _text(report && report.resort_id);
      if (!resortId || seen.has(resortId)) return;
      seen.add(resortId);
      out.push(resortId);
    });
    return out;
  };

  const create = (options = {}) => {
    const section = _element(options.section) || document.getElementById("us-snowfall-map-section");
    const metricToggle = _element(options.metricToggle) || document.getElementById("us-snowfall-map-metric-toggle");
    const statusElement = _element(options.statusElement) || document.getElementById("us-snowfall-map-status");
    const legendElement = _element(options.legendElement) || document.getElementById("us-snowfall-map-legend");
    const mapRoot = _element(options.mapRoot) || document.getElementById("us-snowfall-map-root");
    const buttons = metricToggle ? Array.from(metricToggle.querySelectorAll("[data-map-metric-key]")) : [];
    const state = {
      destroyed: false,
      metricKey: _normalizeMetricKey(options.metricKey),
      selectedResortId: _text(options.selectedResortId),
      visibleResortIds: _visibleResortIds(options.reports),
    };

    const render = () => {
      if (state.destroyed) return;
      const metricLabel = _metricLabel(state.metricKey);
      const visibleCount = state.visibleResortIds.length;
      if (metricToggle) {
        metricToggle.setAttribute("data-mode", state.metricKey === "week_snow" ? "imperial" : "metric");
      }
      buttons.forEach((button) => {
        const active = _text(button.getAttribute("data-map-metric-key")) === state.metricKey;
        button.classList.toggle("is-active", active);
        button.setAttribute("aria-pressed", active ? "true" : "false");
      });
      if (section) {
        section.setAttribute("data-map-ready", "1");
        section.setAttribute("data-map-metric-key", state.metricKey);
        section.classList.toggle("us-snowfall-map-compact", Boolean(mapRoot && mapRoot.clientWidth > 0 && mapRoot.clientWidth < 640));
      }
      if (legendElement) {
        legendElement.setAttribute("data-map-metric-key", state.metricKey);
      }
      if (mapRoot) {
        mapRoot.setAttribute("data-active-metric", state.metricKey);
      }
      if (statusElement) {
        const countText = visibleCount > 0
          ? `${visibleCount} resort${visibleCount === 1 ? "" : "s"} staged for future markers.`
          : "Waiting for marker data to attach.";
        const selectionText = state.selectedResortId ? ` Focused resort: ${state.selectedResortId}.` : "";
        statusElement.textContent = `Map shell ready for ${metricLabel}. ${countText}${selectionText}`;
      }
    };

    const onToggleClick = (event) => {
      const button = event.target.closest("[data-map-metric-key]");
      if (!button) return;
      event.preventDefault();
      api.setMetric(button.getAttribute("data-map-metric-key"));
    };

    if (metricToggle) {
      metricToggle.addEventListener("click", onToggleClick);
    }

    const api = {
      setVisibleReports(reports) {
        if (state.destroyed) return;
        state.visibleResortIds = _visibleResortIds(reports);
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
        render();
      },
      resize() {
        if (state.destroyed) return;
        render();
      },
      destroy() {
        if (state.destroyed) return;
        state.destroyed = true;
        if (metricToggle) {
          metricToggle.removeEventListener("click", onToggleClick);
        }
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
