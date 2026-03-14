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
  const MAP_SELECTION_EVENT = "closesnow:map-resort-select";
  const MAP_CANVAS_WIDTH = 1000;
  const MAP_CANVAS_HEIGHT = 620;
  const MIN_SCALE = 1;
  const MAX_SCALE = 5;
  const SCALE_STEP = 1.25;
  const DRAG_THRESHOLD_PX = 4;
  const DENSITY_CLUSTER_THRESHOLD_PX = 34;
  const FIT_PADDING_PX = 72;
  const MIN_SELECTION_FOCUS_SCALE = 2;
  const GEO_REGIONS = {
    lower48: {
      label: "Lower 48",
      bounds: {
        minLatitude: 24,
        maxLatitude: 50,
        minLongitude: -125,
        maxLongitude: -66,
      },
      slot: {
        x: 70,
        y: 52,
        width: 860,
        height: 420,
      },
      latitudes: [30, 40, 50],
      longitudes: [-120, -110, -100, -90, -80],
    },
    alaska: {
      label: "Alaska",
      bounds: {
        minLatitude: 52,
        maxLatitude: 72,
        minLongitude: -170,
        maxLongitude: -130,
      },
      slot: {
        x: 40,
        y: 478,
        width: 230,
        height: 108,
      },
      latitudes: [55, 65],
      longitudes: [-165, -150, -135],
    },
    hawaii: {
      label: "Hawaii",
      bounds: {
        minLatitude: 18.5,
        maxLatitude: 22.5,
        minLongitude: -161,
        maxLongitude: -154.5,
      },
      slot: {
        x: 312,
        y: 516,
        width: 128,
        height: 48,
      },
      latitudes: [20],
      longitudes: [-159, -157, -155],
    },
  };
  const LOWER48_OUTLINE = [
    [-124.75, 48.4],
    [-124.55, 46.4],
    [-124.35, 44.2],
    [-124.25, 42.1],
    [-123.9, 40.9],
    [-123.5, 39.7],
    [-122.9, 38.6],
    [-122.6, 37.8],
    [-122.5, 36.9],
    [-121.8, 35.8],
    [-121.1, 35.0],
    [-120.1, 34.6],
    [-118.6, 34.0],
    [-117.1, 32.6],
    [-114.8, 32.5],
    [-111.0, 31.3],
    [-109.05, 31.33],
    [-108.2, 31.8],
    [-106.5, 31.8],
    [-104.5, 29.8],
    [-102.1, 29.2],
    [-100.1, 28.9],
    [-97.5, 25.9],
    [-96.1, 27.1],
    [-94.8, 28.7],
    [-92.8, 29.2],
    [-90.6, 29.1],
    [-89.1, 30.2],
    [-87.2, 30.5],
    [-85.2, 29.9],
    [-83.2, 29.0],
    [-82.4, 27.4],
    [-80.8, 24.8],
    [-80.0, 26.6],
    [-80.3, 28.8],
    [-80.8, 30.7],
    [-81.3, 31.8],
    [-80.5, 32.9],
    [-79.0, 33.7],
    [-78.3, 34.8],
    [-77.1, 35.6],
    [-76.3, 37.1],
    [-75.7, 38.1],
    [-74.8, 39.6],
    [-73.8, 40.4],
    [-72.5, 41.0],
    [-71.2, 41.7],
    [-70.5, 43.0],
    [-69.8, 44.4],
    [-68.8, 46.0],
    [-67.1, 47.0],
    [-69.0, 47.3],
    [-71.3, 45.4],
    [-73.3, 45.0],
    [-74.9, 44.8],
    [-76.8, 44.9],
    [-79.0, 43.5],
    [-81.6, 42.3],
    [-83.4, 41.9],
    [-84.8, 46.0],
    [-87.4, 47.0],
    [-89.5, 47.7],
    [-95.0, 49.0],
    [-110.0, 49.0],
    [-120.0, 49.0],
    [-124.75, 48.4],
  ];
  const ALASKA_OUTLINE = [
    [-168.0, 70.0],
    [-162.0, 68.0],
    [-158.0, 66.5],
    [-154.0, 64.5],
    [-149.0, 61.2],
    [-145.5, 60.2],
    [-141.0, 59.0],
    [-138.0, 57.2],
    [-140.0, 55.2],
    [-146.0, 56.0],
    [-150.0, 57.0],
    [-154.0, 58.0],
    [-158.5, 58.0],
    [-161.5, 56.2],
    [-164.5, 55.0],
    [-168.0, 55.2],
    [-170.0, 57.0],
    [-168.0, 60.0],
    [-166.0, 63.0],
    [-165.0, 66.0],
    [-168.0, 70.0],
  ];
  const HAWAII_ISLANDS = [
    { longitude: -159.55, latitude: 22.08, rx: 7, ry: 4.6 },
    { longitude: -158.0, latitude: 21.45, rx: 7, ry: 4.4 },
    { longitude: -157.05, latitude: 21.12, rx: 6, ry: 3.6 },
    { longitude: -156.55, latitude: 20.85, rx: 7.5, ry: 4.5 },
    { longitude: -155.6, latitude: 19.65, rx: 11, ry: 7.2 },
  ];

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

  const _svgNumber = (value) => Number(value).toFixed(2);

  const _asFiniteNumber = (value) => {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  };

  const _clamp = (value, min, max) => Math.min(max, Math.max(min, value));

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

  const _mapContext = (report) => (report && typeof report.map_context === "object" ? report.map_context : null);

  const _regionKey = (report) => {
    const mapContext = _mapContext(report);
    const latitude = _asFiniteNumber(mapContext && mapContext.latitude);
    const longitude = _asFiniteNumber(mapContext && mapContext.longitude);
    if (latitude === null || longitude === null) return "";
    const admin1 = _text(report && report.admin1).toLowerCase();
    if (admin1 === "alaska") return "alaska";
    if (admin1 === "hawaii") return "hawaii";
    if (latitude >= 52 && longitude <= -130) return "alaska";
    if (latitude <= 23 && longitude <= -154) return "hawaii";
    const lower48 = GEO_REGIONS.lower48.bounds;
    if (
      latitude >= lower48.minLatitude
      && latitude <= lower48.maxLatitude
      && longitude >= lower48.minLongitude
      && longitude <= lower48.maxLongitude
    ) {
      return "lower48";
    }
    return "";
  };

  const _eligibleReports = (reports) => _normalizeReports(reports)
    .filter((report) => {
      const mapContext = _mapContext(report);
      if (!mapContext || mapContext.eligible !== true) return false;
      return Boolean(_regionKey(report));
    });

  const _metricValue = (report, metricKey) => {
    const mapContext = _mapContext(report);
    const config = _metricConfig(metricKey);
    const amount = _asFiniteNumber(mapContext && mapContext[config.field]);
    return amount === null ? 0 : Math.max(0, amount);
  };

  const _projectCoordinate = (latitude, longitude, regionKey) => {
    const region = GEO_REGIONS[regionKey];
    if (!region) return null;
    const { bounds, slot } = region;
    const lonSpan = Math.max(0.0001, bounds.maxLongitude - bounds.minLongitude);
    const latSpan = Math.max(0.0001, bounds.maxLatitude - bounds.minLatitude);
    const xRatio = (longitude - bounds.minLongitude) / lonSpan;
    const yRatio = 1 - ((latitude - bounds.minLatitude) / latSpan);
    return {
      x: slot.x + (_clamp(xRatio, 0, 1) * slot.width),
      y: slot.y + (_clamp(yRatio, 0, 1) * slot.height),
    };
  };

  const _projectReportPoint = (report) => {
    const mapContext = _mapContext(report);
    const latitude = _asFiniteNumber(mapContext && mapContext.latitude);
    const longitude = _asFiniteNumber(mapContext && mapContext.longitude);
    const regionKey = _regionKey(report);
    if (latitude === null || longitude === null || !regionKey) return null;
    const point = _projectCoordinate(latitude, longitude, regionKey);
    if (!point) return null;
    return {
      ...point,
      regionKey,
    };
  };

  const _pathFromCoordinates = (coordinates, regionKey, closePath = true) => {
    if (!Array.isArray(coordinates) || !coordinates.length) return "";
    const points = coordinates
      .map(([longitude, latitude]) => _projectCoordinate(latitude, longitude, regionKey))
      .filter(Boolean);
    if (!points.length) return "";
    return points.map((point, index) => `${index === 0 ? "M" : "L"} ${_svgNumber(point.x)} ${_svgNumber(point.y)}`).join(" ")
      + (closePath ? " Z" : "");
  };

  const _graticulePath = (regionKey) => {
    const region = GEO_REGIONS[regionKey];
    if (!region) return "";
    const segments = [];
    region.latitudes.forEach((latitude) => {
      const left = _projectCoordinate(latitude, region.bounds.minLongitude, regionKey);
      const right = _projectCoordinate(latitude, region.bounds.maxLongitude, regionKey);
      if (left && right) segments.push(`M ${_svgNumber(left.x)} ${_svgNumber(left.y)} L ${_svgNumber(right.x)} ${_svgNumber(right.y)}`);
    });
    region.longitudes.forEach((longitude) => {
      const top = _projectCoordinate(region.bounds.maxLatitude, longitude, regionKey);
      const bottom = _projectCoordinate(region.bounds.minLatitude, longitude, regionKey);
      if (top && bottom) segments.push(`M ${_svgNumber(top.x)} ${_svgNumber(top.y)} L ${_svgNumber(bottom.x)} ${_svgNumber(bottom.y)}`);
    });
    return segments.join(" ");
  };

  const _ellipseHtml = (longitude, latitude, regionKey, rx, ry) => {
    const point = _projectCoordinate(latitude, longitude, regionKey);
    if (!point) return "";
    return `<ellipse class="us-snowfall-map-island" cx="${_svgNumber(point.x)}" cy="${_svgNumber(point.y)}" rx="${_svgNumber(rx)}" ry="${_svgNumber(ry)}"></ellipse>`;
  };

  const _regionSlotHtml = (regionKey) => {
    const region = GEO_REGIONS[regionKey];
    if (!region) return "";
    const { slot, label } = region;
    const labelX = slot.x + 14;
    const labelY = slot.y + 20;
    return `
      <rect class="us-snowfall-map-slot" x="${_svgNumber(slot.x)}" y="${_svgNumber(slot.y)}" width="${_svgNumber(slot.width)}" height="${_svgNumber(slot.height)}" rx="18" ry="18"></rect>
      <text class="us-snowfall-map-region-label" x="${_svgNumber(labelX)}" y="${_svgNumber(labelY)}">${_escapeHtml(label)}</text>
    `;
  };

  const _geographicBasemapHtml = () => {
    const lower48Path = _pathFromCoordinates(LOWER48_OUTLINE, "lower48");
    const alaskaPath = _pathFromCoordinates(ALASKA_OUTLINE, "alaska");
    if (!lower48Path || !alaskaPath) {
      throw new Error("Missing geographic landmass path.");
    }
    return `
      <svg class="us-snowfall-map-basemap" viewBox="0 0 ${MAP_CANVAS_WIDTH} ${MAP_CANVAS_HEIGHT}" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
        <rect class="us-snowfall-map-water" x="0" y="0" width="${MAP_CANVAS_WIDTH}" height="${MAP_CANVAS_HEIGHT}"></rect>
        ${_regionSlotHtml("lower48")}
        ${_regionSlotHtml("alaska")}
        ${_regionSlotHtml("hawaii")}
        <path class="us-snowfall-map-graticule" d="${_graticulePath("lower48")}"></path>
        <path class="us-snowfall-map-graticule" d="${_graticulePath("alaska")}"></path>
        <path class="us-snowfall-map-graticule" d="${_graticulePath("hawaii")}"></path>
        <path class="us-snowfall-map-shoreline" d="${lower48Path}"></path>
        <path class="us-snowfall-map-landmass" d="${lower48Path}"></path>
        <path class="us-snowfall-map-shoreline" d="${alaskaPath}"></path>
        <path class="us-snowfall-map-landmass" d="${alaskaPath}"></path>
        ${HAWAII_ISLANDS.map((island) => _ellipseHtml(island.longitude, island.latitude, "hawaii", island.rx, island.ry)).join("")}
      </svg>
    `;
  };

  const _fallbackBasemapHtml = () => `
    <svg class="us-snowfall-map-basemap is-fallback" viewBox="0 0 ${MAP_CANVAS_WIDTH} ${MAP_CANVAS_HEIGHT}" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      <rect class="us-snowfall-map-water" x="0" y="0" width="${MAP_CANVAS_WIDTH}" height="${MAP_CANVAS_HEIGHT}"></rect>
      ${_regionSlotHtml("lower48")}
      ${_regionSlotHtml("alaska")}
      ${_regionSlotHtml("hawaii")}
      <path class="us-snowfall-map-graticule" d="${_graticulePath("lower48")}"></path>
      <path class="us-snowfall-map-graticule" d="${_graticulePath("alaska")}"></path>
      <path class="us-snowfall-map-graticule" d="${_graticulePath("hawaii")}"></path>
      <text class="us-snowfall-map-fallback-label" x="92" y="264">Basemap unavailable</text>
      <text class="us-snowfall-map-fallback-copy" x="92" y="292">Showing a scoped coordinate frame instead of the geographic layer.</text>
    </svg>
  `;

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

  const _clusterMarkerSize = (count) => {
    if (count >= 12) return 46;
    if (count >= 8) return 42;
    if (count >= 4) return 38;
    return 34;
  };

  const _distance = (left, right) => Math.hypot(left.x - right.x, left.y - right.y);

  const _clusterThreshold = (scale) => DENSITY_CLUSTER_THRESHOLD_PX / Math.max(scale || MIN_SCALE, MIN_SCALE);

  const _projectedEntries = (eligibleReports, metricKey, selectedResortId, popupResortId) => eligibleReports
    .map((report, index) => ({
      report,
      index,
      key: _selectionKey(report, index),
      value: _metricValue(report, metricKey),
      point: _projectReportPoint(report),
    }))
    .filter((entry) => entry.point)
    .map((entry) => ({
      ...entry,
      highlighted: entry.key === selectedResortId || entry.key === popupResortId,
    }))
    .sort((left, right) => {
      if (left.highlighted !== right.highlighted) return left.highlighted ? 1 : -1;
      return left.value - right.value;
    });

  const _clusterEntries = (entries, scale) => {
    const threshold = _clusterThreshold(scale);
    const groups = [];
    const remaining = entries.slice();

    while (remaining.length) {
      const seed = remaining.shift();
      if (!seed) continue;
      if (seed.highlighted) {
        groups.push({ type: "single", entries: [seed], point: seed.point, value: seed.value });
        continue;
      }
      const cluster = [seed];
      let changed = true;
      while (changed) {
        changed = false;
        for (let index = remaining.length - 1; index >= 0; index -= 1) {
          const candidate = remaining[index];
          if (!candidate || candidate.highlighted || candidate.point.regionKey !== seed.point.regionKey) continue;
          const closeToCluster = cluster.some((entry) => _distance(entry.point, candidate.point) <= threshold);
          if (!closeToCluster) continue;
          cluster.push(candidate);
          remaining.splice(index, 1);
          changed = true;
        }
      }
      if (cluster.length === 1) {
        groups.push({ type: "single", entries: cluster, point: cluster[0].point, value: cluster[0].value });
        continue;
      }
      const point = cluster.reduce((acc, entry) => ({
        x: acc.x + entry.point.x,
        y: acc.y + entry.point.y,
        regionKey: entry.point.regionKey,
      }), { x: 0, y: 0, regionKey: cluster[0].point.regionKey });
      groups.push({
        type: "cluster",
        entries: cluster,
        point: {
          x: point.x / cluster.length,
          y: point.y / cluster.length,
          regionKey: point.regionKey,
        },
        value: Math.max(...cluster.map((entry) => entry.value)),
      });
    }

    return groups;
  };

  const _fitTransformForEntries = (entries, viewportWidth, viewportHeight) => {
    if (!entries.length || !viewportWidth || !viewportHeight) {
      return {
        scale: MIN_SCALE,
        translateX: 0,
        translateY: 0,
      };
    }
    const xs = entries.map((entry) => entry.point.x);
    const ys = entries.map((entry) => entry.point.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const width = Math.max(32, maxX - minX);
    const height = Math.max(32, maxY - minY);
    const availableWidth = Math.max(120, viewportWidth - (FIT_PADDING_PX * 2));
    const availableHeight = Math.max(120, viewportHeight - (FIT_PADDING_PX * 2));
    const scale = _clamp(
      Math.min(MAX_SCALE, Math.min(availableWidth / width, availableHeight / height)),
      entries.length === 1 ? MIN_SELECTION_FOCUS_SCALE : MIN_SCALE,
      MAX_SCALE,
    );
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    const viewportCenterX = viewportWidth / 2;
    const viewportCenterY = viewportHeight / 2;
    return {
      scale,
      translateX: -((centerX - viewportCenterX) * scale),
      translateY: -((centerY - viewportCenterY) * scale),
    };
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
    <div class="us-snowfall-map-toolbar" data-map-toolbar="1">
      <div class="us-snowfall-map-toolbar-meta">
        <div class="us-snowfall-map-view-badge" data-map-view-badge="1">Full US view</div>
        <div class="us-snowfall-map-scope-badge" data-map-scope-badge="1">0 visible</div>
      </div>
      <div class="us-snowfall-map-toolbar-actions">
        <button type="button" class="us-snowfall-map-control" data-map-control="zoom-in" aria-label="Zoom in">+</button>
        <button type="button" class="us-snowfall-map-control" data-map-control="zoom-out" aria-label="Zoom out">-</button>
        <button type="button" class="us-snowfall-map-control us-snowfall-map-control-results" data-map-control="fit-results" data-map-show-results="1" aria-label="Show the current visible resort results">Results</button>
        <button type="button" class="us-snowfall-map-control us-snowfall-map-control-selected" data-map-control="show-selected" data-map-show-selected="1" aria-label="Show the selected resort">Selected</button>
        <button type="button" class="us-snowfall-map-control us-snowfall-map-control-reset" data-map-control="reset" data-map-reset-view="1" aria-label="Reset to the full US view">Reset</button>
      </div>
    </div>
    <div class="us-snowfall-map-viewport" data-map-viewport="1">
      <div class="us-snowfall-map-canvas" data-map-canvas="1">
        <div class="us-snowfall-map-basemap-layer" data-map-basemap="1"></div>
        <div class="us-snowfall-map-marker-layer" data-map-marker-layer="1"></div>
      </div>
      <div class="us-snowfall-map-inline-message" data-map-inline-message="1" hidden></div>
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
    const onSelectResort = typeof options.onSelectResort === "function" ? options.onSelectResort : null;
    if (mapRoot) {
      mapRoot.innerHTML = _mapStageHtml();
      mapRoot.setAttribute("role", "region");
      mapRoot.setAttribute("aria-label", "US snowfall map");
    }

    const viewport = mapRoot ? mapRoot.querySelector("[data-map-viewport]") : null;
    const canvas = mapRoot ? mapRoot.querySelector("[data-map-canvas]") : null;
    const basemapLayer = mapRoot ? mapRoot.querySelector("[data-map-basemap]") : null;
    const markerLayer = mapRoot ? mapRoot.querySelector("[data-map-marker-layer]") : null;
    const inlineMessage = mapRoot ? mapRoot.querySelector("[data-map-inline-message]") : null;
    const popupElement = mapRoot ? mapRoot.querySelector("[data-map-popup]") : null;
    const viewBadge = mapRoot ? mapRoot.querySelector("[data-map-view-badge]") : null;
    const scopeBadge = mapRoot ? mapRoot.querySelector("[data-map-scope-badge]") : null;
    const zoomInButton = mapRoot ? mapRoot.querySelector('[data-map-control="zoom-in"]') : null;
    const zoomOutButton = mapRoot ? mapRoot.querySelector('[data-map-control="zoom-out"]') : null;
    const showResultsButton = mapRoot ? mapRoot.querySelector('[data-map-control="fit-results"]') : null;
    const showSelectedButton = mapRoot ? mapRoot.querySelector('[data-map-control="show-selected"]') : null;
    const resetButton = mapRoot ? mapRoot.querySelector('[data-map-control="reset"]') : null;
    const state = {
      destroyed: false,
      metricKey: _normalizeMetricKey(options.metricKey),
      selectedResortId: _text(options.selectedResortId),
      popupResortId: _text(options.selectedResortId),
      visibleReports: _normalizeReports(options.reports),
      errorMessage: "",
      basemapMode: "geographic",
      transform: {
        scale: MIN_SCALE,
        translateX: 0,
        translateY: 0,
      },
      drag: null,
      suppressClick: false,
      lastProjectedEntries: [],
      lastClusterGroups: [],
    };

    const emitSelectedResort = (resortId) => {
      const normalized = _text(resortId);
      if (!normalized) return;
      if (onSelectResort) {
        try {
          onSelectResort(normalized);
        } catch (error) {
          // Ignore selection callback failures.
        }
        return;
      }
      if (typeof window !== "undefined" && typeof window.dispatchEvent === "function" && typeof CustomEvent === "function") {
        window.dispatchEvent(new CustomEvent(MAP_SELECTION_EVENT, {
          detail: { resortId: normalized },
        }));
      }
    };

    const isDefaultTransform = () => (
      Math.abs(state.transform.scale - MIN_SCALE) < 0.001
      && Math.abs(state.transform.translateX) < 0.5
      && Math.abs(state.transform.translateY) < 0.5
    );

    const updateViewBadge = () => {
      if (!viewBadge) return;
      if (state.basemapMode !== "geographic") {
        viewBadge.textContent = isDefaultTransform() ? "Fallback US view" : `Fallback ${state.transform.scale.toFixed(1)}x`;
        return;
      }
      viewBadge.textContent = isDefaultTransform() ? "Full US view" : `Zoom ${state.transform.scale.toFixed(1)}x`;
    };

    const syncControls = () => {
      const selectedEntry = state.lastProjectedEntries.find((entry) => entry.key === state.selectedResortId);
      if (zoomInButton) zoomInButton.disabled = state.transform.scale >= MAX_SCALE - 0.001;
      if (zoomOutButton) zoomOutButton.disabled = state.transform.scale <= MIN_SCALE + 0.001;
      if (showResultsButton) showResultsButton.disabled = state.lastProjectedEntries.length === 0;
      if (showSelectedButton) showSelectedButton.disabled = !selectedEntry;
      if (resetButton) resetButton.disabled = isDefaultTransform();
    };

    const renderScopeBadge = (eligibleReports) => {
      if (!scopeBadge) return;
      const visibleCount = state.visibleReports.length;
      if (!visibleCount) {
        scopeBadge.textContent = "0 visible";
        return;
      }
      if (!eligibleReports.length) {
        scopeBadge.textContent = `${visibleCount} visible`;
        return;
      }
      scopeBadge.textContent = eligibleReports.length === visibleCount
        ? `${visibleCount} visible`
        : `${eligibleReports.length}/${visibleCount} map-ready`;
    };

    const clampTransform = (nextTransform) => {
      const width = viewport ? viewport.clientWidth : 0;
      const height = viewport ? viewport.clientHeight : 0;
      if (!width || !height) {
        return {
          scale: _clamp(nextTransform.scale, MIN_SCALE, MAX_SCALE),
          translateX: 0,
          translateY: 0,
        };
      }
      const scale = _clamp(nextTransform.scale, MIN_SCALE, MAX_SCALE);
      const maxTranslateX = ((scale - 1) * width) / 2;
      const maxTranslateY = ((scale - 1) * height) / 2;
      return {
        scale,
        translateX: _clamp(nextTransform.translateX, -maxTranslateX, maxTranslateX),
        translateY: _clamp(nextTransform.translateY, -maxTranslateY, maxTranslateY),
      };
    };

    const applyTransform = () => {
      if (!canvas) return;
      canvas.style.transform = `translate(${state.transform.translateX}px, ${state.transform.translateY}px) scale(${state.transform.scale})`;
      updateViewBadge();
      syncControls();
    };

    const setTransform = (nextTransform) => {
      state.transform = clampTransform(nextTransform);
      applyTransform();
    };

    const setScale = (nextScale) => {
      setTransform({
        scale: nextScale,
        translateX: state.transform.translateX,
        translateY: state.transform.translateY,
      });
      render();
    };

    const resetView = () => {
      setTransform({
        scale: MIN_SCALE,
        translateX: 0,
        translateY: 0,
      });
      render();
    };

    const focusEntries = (entries) => {
      if (!viewport || !entries.length) return;
      setTransform(_fitTransformForEntries(entries, viewport.clientWidth, viewport.clientHeight));
      render();
    };

    const ensureBasemap = () => {
      if (!basemapLayer || !mapRoot) return;
      try {
        basemapLayer.innerHTML = _geographicBasemapHtml();
        state.basemapMode = "geographic";
        mapRoot.setAttribute("data-map-mode", "geographic");
      } catch (error) {
        basemapLayer.innerHTML = _fallbackBasemapHtml();
        state.basemapMode = "fallback";
        mapRoot.setAttribute("data-map-mode", "fallback");
      }
      updateViewBadge();
      syncControls();
    };

    const renderStatus = (eligibleReports) => {
      if (!statusElement) return;
      const metric = _metricConfig(state.metricKey);
      const visibleCount = state.visibleReports.length;
      if (state.errorMessage) {
        statusElement.textContent = `Snowfall map unavailable. ${state.errorMessage}`;
        return;
      }
      const interactionText = state.basemapMode === "geographic"
        ? "Drag to pan, click dense count bubbles to zoom into nearby resorts, and use Results, Selected, or Reset to recover orientation."
        : "Basemap fallback is active. Drag to pan, click dense count bubbles to zoom into nearby resorts, and use Results, Selected, or Reset to recover orientation.";
      if (!visibleCount) {
        statusElement.textContent = `No visible resorts remain in the active result set for ${metric.label}. Adjust filters or search to restore results. ${interactionText}`;
        return;
      }
      if (!eligibleReports.length) {
        statusElement.textContent = `Visible resorts do not currently project onto the US snowfall map for ${metric.label}. They remain available in the resort tables below. ${interactionText}`;
        return;
      }
      const focused = state.selectedResortId
        ? ` Focused resort: ${_displayName(eligibleReports.find((report, index) => _selectionKey(report, index) === state.selectedResortId) || { resort_id: state.selectedResortId, query: state.selectedResortId })}.`
        : "";
      const visibilityText = eligibleReports.length === visibleCount
        ? `Showing ${eligibleReports.length} US resort${eligibleReports.length === 1 ? "" : "s"}`
        : `Showing ${eligibleReports.length} map-ready resort${eligibleReports.length === 1 ? "" : "s"} out of ${visibleCount} visible result${visibleCount === 1 ? "" : "s"}`;
      statusElement.textContent = `${visibilityText} for ${metric.label}.${focused} ${interactionText}`;
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
      inlineMessage.innerHTML = `<strong>${kind === "error" ? "Map offline" : "Map note"}</strong><span>${_escapeHtml(message)}</span>`;
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

    const renderMarkers = (projectedEntries) => {
      if (!markerLayer) return;
      markerLayer.innerHTML = "";
      const groups = _clusterEntries(projectedEntries, state.transform.scale);
      state.lastClusterGroups = groups;
      groups.forEach((group, groupIndex) => {
        if (group.type === "cluster") {
          const marker = doc.createElement("button");
          marker.type = "button";
          marker.className = "us-snowfall-map-marker is-cluster";
          marker.setAttribute("data-map-marker", "1");
          marker.setAttribute("data-map-cluster", "1");
          marker.setAttribute("data-map-cluster-id", String(groupIndex));
          marker.setAttribute("data-map-region", group.point.regionKey);
          marker.setAttribute(
            "aria-label",
            `${group.entries.length} nearby resorts clustered together. Click to zoom into this dense region.`,
          );
          marker.style.left = `${((group.point.x / MAP_CANVAS_WIDTH) * 100).toFixed(3)}%`;
          marker.style.top = `${((group.point.y / MAP_CANVAS_HEIGHT) * 100).toFixed(3)}%`;
          marker.style.setProperty("--marker-size", `${_clusterMarkerSize(group.entries.length)}px`);
          marker.style.setProperty("--marker-fill", "#0f766e");
          marker.style.setProperty("--marker-shadow", "0 16px 30px rgba(15, 118, 110, 0.28)");
          marker.style.setProperty("--marker-ring", "rgba(255, 255, 255, 0.96)");
          marker.innerHTML = `<span class="us-snowfall-map-marker-value us-snowfall-map-marker-count">${group.entries.length}</span>`;
          markerLayer.appendChild(marker);
          return;
        }
        const [{ report, key, value, point, highlighted }] = group.entries;
        const marker = doc.createElement("button");
        marker.type = "button";
        marker.className = "us-snowfall-map-marker";
        if (highlighted) marker.classList.add("is-selected");
        marker.setAttribute("data-map-marker", "1");
        marker.setAttribute("data-resort-id", key);
        marker.setAttribute("data-map-region", point.regionKey);
        marker.setAttribute("aria-label", `${_displayName(report)}: ${_formatSnowfall(value)} ${_metricConfig(state.metricKey).label}`);
        marker.style.left = `${((point.x / MAP_CANVAS_WIDTH) * 100).toFixed(3)}%`;
        marker.style.top = `${((point.y / MAP_CANVAS_HEIGHT) * 100).toFixed(3)}%`;
        marker.style.setProperty("--marker-size", `${_markerSize(value)}px`);
        marker.style.setProperty("--marker-fill", _markerFill(value));
        marker.style.setProperty("--marker-shadow", _markerGlow(value, highlighted));
        marker.style.setProperty("--marker-ring", highlighted ? "rgba(15, 118, 110, 0.9)" : "rgba(255, 255, 255, 0.92)");
        marker.innerHTML = `<span class="us-snowfall-map-marker-value">${_escapeHtml(_formatSnowfall(value))}</span>`;
        markerLayer.appendChild(marker);
      });
    };

    const renderNotes = (eligibleReports) => {
      if (state.errorMessage) {
        renderInlineMessage("The interactive controller failed to render, but the rest of the page is still available.", "error");
        return;
      }
      if (!state.visibleReports.length) {
        renderInlineMessage("No visible resorts remain after the current filters or search. Broaden the list or Reset the map once results return.");
        return;
      }
      if (state.basemapMode !== "geographic") {
        renderInlineMessage("Basemap unavailable. Showing a scoped coordinate fallback while keeping resort markers interactive.");
        return;
      }
      if (!eligibleReports.length) {
        renderInlineMessage(
          "No visible resorts currently fall inside the active US map scope. They remain in the resort tables below, and Results will recover the map once map-ready resorts return.",
        );
        return;
      }
      const clusterCount = state.lastClusterGroups.filter((group) => group.type === "cluster").length;
      if (clusterCount > 0) {
        renderInlineMessage("Dense resort clusters are grouped. Click a count bubble to zoom into nearby resorts, or use Results / Selected to refocus quickly.");
        return;
      }
      hideInlineMessage();
    };

    const render = () => {
      if (state.destroyed) return;
      try {
        state.errorMessage = "";
        ensureBasemap();
        const eligibleReports = _eligibleReports(state.visibleReports);
        const projectedEntries = _projectedEntries(
          eligibleReports,
          state.metricKey,
          state.selectedResortId,
          state.popupResortId,
        );
        state.lastProjectedEntries = projectedEntries;
        renderButtons();
        renderScopeBadge(eligibleReports);
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
        renderMarkers(projectedEntries);
        renderPopup(eligibleReports);
        renderNotes(eligibleReports);
        applyTransform();
      } catch (error) {
        state.errorMessage = "The interactive controller failed to render, but the rest of the page is still available.";
        state.lastProjectedEntries = [];
        state.lastClusterGroups = [];
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
      if (state.suppressClick) {
        state.suppressClick = false;
        return;
      }
      const control = event.target && event.target.closest ? event.target.closest("[data-map-control]") : null;
      if (control) {
        event.preventDefault();
        const action = _text(control.getAttribute("data-map-control"));
        if (action === "zoom-in") setScale(state.transform.scale * SCALE_STEP);
        if (action === "zoom-out") setScale(state.transform.scale / SCALE_STEP);
        if (action === "fit-results") focusEntries(state.lastProjectedEntries);
        if (action === "show-selected") {
          const selectedEntry = state.lastProjectedEntries.find((entry) => entry.key === state.selectedResortId);
          if (selectedEntry) focusEntries([selectedEntry]);
        }
        if (action === "reset") resetView();
        return;
      }
      const marker = event.target && event.target.closest ? event.target.closest("[data-map-marker]") : null;
      if (marker) {
        event.preventDefault();
        if (_text(marker.getAttribute("data-map-cluster")) === "1") {
          const clusterId = Number(marker.getAttribute("data-map-cluster-id"));
          const cluster = Number.isInteger(clusterId) ? state.lastClusterGroups[clusterId] : null;
          if (cluster && Array.isArray(cluster.entries) && cluster.entries.length) {
            focusEntries(cluster.entries);
          }
          return;
        }
        state.popupResortId = _text(marker.getAttribute("data-resort-id"));
        state.selectedResortId = state.popupResortId;
        emitSelectedResort(state.popupResortId);
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

    const onPointerDown = (event) => {
      if (!viewport || state.destroyed) return;
      if (event.button !== undefined && event.button !== 0) return;
      if (event.target && event.target.closest && event.target.closest("[data-map-marker], [data-map-control], [data-map-popup]")) return;
      event.preventDefault();
      state.drag = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        originTranslateX: state.transform.translateX,
        originTranslateY: state.transform.translateY,
        moved: false,
      };
      if (viewport.setPointerCapture) {
        try {
          viewport.setPointerCapture(event.pointerId);
        } catch (error) {
          // Ignore pointer capture failures.
        }
      }
      viewport.classList.add("is-panning");
    };

    const onPointerMove = (event) => {
      if (!state.drag || state.drag.pointerId !== event.pointerId) return;
      const deltaX = event.clientX - state.drag.startX;
      const deltaY = event.clientY - state.drag.startY;
      if (!state.drag.moved && (Math.abs(deltaX) > DRAG_THRESHOLD_PX || Math.abs(deltaY) > DRAG_THRESHOLD_PX)) {
        state.drag.moved = true;
        state.suppressClick = true;
      }
      setTransform({
        scale: state.transform.scale,
        translateX: state.drag.originTranslateX + deltaX,
        translateY: state.drag.originTranslateY + deltaY,
      });
    };

    const endPointerDrag = (event) => {
      if (!state.drag || state.drag.pointerId !== event.pointerId) return;
      if (viewport && viewport.releasePointerCapture) {
        try {
          viewport.releasePointerCapture(event.pointerId);
        } catch (error) {
          // Ignore pointer capture failures.
        }
      }
      if (state.drag.moved && typeof rootScope.setTimeout === "function") {
        rootScope.setTimeout(() => {
          state.suppressClick = false;
        }, 0);
      }
      if (viewport) viewport.classList.remove("is-panning");
      state.drag = null;
    };

    const onWheel = (event) => {
      if (!viewport || state.destroyed) return;
      event.preventDefault();
      const factor = event.deltaY < 0 ? SCALE_STEP : (1 / SCALE_STEP);
      setScale(state.transform.scale * factor);
    };

    if (metricToggle) metricToggle.addEventListener("click", onToggleClick);
    if (mapRoot) mapRoot.addEventListener("click", onMapClick);
    if (viewport) viewport.addEventListener("pointerdown", onPointerDown);
    if (viewport) viewport.addEventListener("pointermove", onPointerMove);
    if (viewport) viewport.addEventListener("pointerup", endPointerDrag);
    if (viewport) viewport.addEventListener("pointercancel", endPointerDrag);
    if (viewport) viewport.addEventListener("wheel", onWheel, { passive: false });

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
        setTransform(state.transform);
      },
      destroy() {
        if (state.destroyed) return;
        state.destroyed = true;
        if (metricToggle) metricToggle.removeEventListener("click", onToggleClick);
        if (mapRoot) mapRoot.removeEventListener("click", onMapClick);
        if (viewport) viewport.removeEventListener("pointerdown", onPointerDown);
        if (viewport) viewport.removeEventListener("pointermove", onPointerMove);
        if (viewport) viewport.removeEventListener("pointerup", endPointerDrag);
        if (viewport) viewport.removeEventListener("pointercancel", endPointerDrag);
        if (viewport) viewport.removeEventListener("wheel", onWheel);
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
