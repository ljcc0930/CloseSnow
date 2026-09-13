// A focused, accessible hourly forecast workspace. All geometry uses observed
// values and discrete source hours; display styling never interpolates data.
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.CloseSnowHourlyExplorer = api;
}(typeof window !== "undefined" ? window : null, function () {
  "use strict";

  const numberFormat = new Intl.NumberFormat("en-US", { maximumFractionDigits: 20 });
  const formatNumber = (value) => value === null ? "—" : numberFormat.format(value);
  const finiteNumber = (value) => {
    if (typeof value !== "number" && typeof value !== "string") return null;
    if (typeof value === "string" && !value.trim()) return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  };
  const definitions = {
    snowfall: { label: "Snowfall", mode: "bars", summary: "Total snowfall", icon: "M12 2v20M3.3 7l17.4 10M3.3 17 20.7 7M9 4l3 3 3-3M9 20l3-3 3 3" },
    rain: { label: "Rain", mode: "bars", summary: "Total rainfall", icon: "M12 3s-6 6.7-6 11a6 6 0 0 0 12 0c0-4.3-6-11-6-11Z" },
    precipitation_probability: { label: "Rain / snow chance", mode: "line", summary: "Highest chance", icon: "M5 19 19 5M9 7a2 2 0 1 1-4 0 2 2 0 0 1 4 0ZM19 17a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z" },
    snow_depth: { label: "Snow depth", mode: "line", summary: "End-of-period depth", icon: "M4 18h16M4 13h16M4 8h16M9 4h6" },
    wind_speed_10m: { label: "Wind speed", mode: "line", summary: "Strongest wind", icon: "M3 8h12a3 3 0 1 0-3-3M3 12h15a3 3 0 1 1-3 3M3 16h5" },
    wind_direction_10m: { label: "Wind direction", mode: "direction", summary: "First forecast bearing", icon: "m12 3 7 18-7-4-7 4 7-18Z" },
    visibility: { label: "Visibility", mode: "line", summary: "Lowest visibility", icon: "M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12ZM15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" },
  };
  const normalizeSeries = (hourly, key) => {
    const times = Array.isArray(hourly?.time) ? hourly.time : [];
    const values = Array.isArray(hourly?.[key]) ? hourly[key] : [];
    return { times, values: times.map((_, index) => finiteNumber(values[index])) };
  };
  const clockValue = (time) => {
    const match = String(time || "").match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/);
    return match ? Date.parse(`${match[1]}T${match[2]}:00Z`) : NaN;
  };
  const timeLabel = (time) => {
    const date = new Date(clockValue(time));
    if (!Number.isFinite(date.getTime())) return { day: "", shortDay: "", date: "", hour: String(time || ""), full: String(time || "") };
    const options = { timeZone: "UTC" };
    const day = date.toLocaleDateString("en-US", { ...options, weekday: "short" });
    const monthDay = date.toLocaleDateString("en-US", { ...options, month: "short", day: "numeric" });
    const hour = String(time).slice(11, 16);
    return { day, shortDay: `${day} ${date.getUTCDate()}`, date: monthDay, hour, full: `${day}, ${monthDay} · ${hour}` };
  };
  const bearingLabel = (value) => value === null ? "—" : `${formatNumber(value)}° ${["N", "NE", "E", "SE", "S", "SW", "W", "NW"][Math.round(value / 45) % 8]}`;
  const unitFor = (metric) => metric.key === "wind_direction_10m" ? "°" : metric.unit;
  const valueLabel = (metric, value) => metric.key === "wind_direction_10m" ? bearingLabel(value)
    : value === null ? "No data" : `${formatNumber(value)} ${unitFor(metric)}`;
  const summarize = (metric, values) => {
    const known = values.map((value, index) => ({ value, index })).filter((item) => item.value !== null);
    if (!known.length) return { primary: null, low: null, high: null, at: null, count: 0, total: null };
    const low = known.reduce((a, b) => b.value < a.value ? b : a);
    const high = known.reduce((a, b) => b.value > a.value ? b : a);
    const total = Math.round(known.reduce((sum, item) => sum + item.value, 0) * 1e8) / 1e8;
    const config = definitions[metric.key];
    let primary = high.value;
    let at = high.index;
    if (config.mode === "bars") primary = total;
    if (metric.key === "visibility") { primary = low.value; at = low.index; }
    if (metric.key === "snow_depth") { primary = known.at(-1).value; at = known.at(-1).index; }
    if (config.mode === "direction") { primary = known[0].value; at = known[0].index; }
    return { primary, low: low.value, high: high.value, at, count: known.length, total };
  };
  const niceStep = (raw) => {
    const scale = 10 ** Math.floor(Math.log10(raw || 1));
    return [1, 2, 2.5, 5, 10].find((factor) => factor * scale >= raw) * scale;
  };
  const axisFor = (key, values) => {
    if (key === "precipitation_probability") return { min: 0, max: 100, ticks: [0, 25, 50, 75, 100] };
    if (key === "wind_direction_10m") return { min: 0, max: 360, ticks: [0, 90, 180, 270, 360] };
    const finite = values.filter((value) => value !== null);
    const low = Math.min(0, ...finite);
    const high = Math.max(0, ...finite);
    let min = low;
    let max = high === low ? high + 1 : high + (high - low) * 0.12;
    if (key === "snow_depth" && finite.length) {
      const observedMin = Math.min(...finite);
      const observedMax = Math.max(...finite);
      const padding = Math.max(0.05, (observedMax - observedMin) * 0.2);
      min = Math.max(0, observedMin - padding);
      max = observedMax + padding;
    }
    const step = niceStep((max - min) / 4);
    min = Number((Math.floor(min / step) * step).toPrecision(12));
    max = Number((Math.ceil(max / step) * step).toPrecision(12));
    const ticks = Array.from({ length: Math.round((max - min) / step) + 1 }, (_, index) => Number((min + index * step).toPrecision(12)));
    return { min, max, ticks };
  };
  const segmentsFor = (values, times = []) => {
    const segments = [];
    let segment = [];
    values.forEach((value, index) => {
      const timeGap = index > 0 && clockValue(times[index]) - clockValue(times[index - 1]) > 90 * 60 * 1000;
      if (value === null || timeGap) {
        if (segment.length) segments.push(segment);
        segment = [];
      }
      if (value !== null) segment.push({ value, index });
    });
    if (segment.length) segments.push(segment);
    return segments;
  };
  const dayBands = (times) => {
    const bands = [];
    times.forEach((time, index) => {
      const day = String(time).slice(0, 10);
      if (!bands.length || bands.at(-1).day !== day) bands.push({ day, start: index, end: index + 1, label: timeLabel(time) });
      else bands.at(-1).end = index + 1;
    });
    return bands;
  };
  const clockTicks = (times, width) => {
    if (!times.length) return [];
    const first = clockValue(times[0]);
    const last = clockValue(times.at(-1));
    if (!Number.isFinite(first) || !Number.isFinite(last)) return [0];
    const hour = 3600000;
    const maxTicks = Math.max(2, Math.min(9, Math.floor(width / 74)));
    const interval = [3, 6, 12, 24, 48, 72, 96, 168].find((step) => step >= (last - first) / hour / maxTicks) || 168;
    const midnight = Math.floor(first / (24 * hour)) * 24 * hour;
    const ticks = [];
    times.forEach((time, index) => {
      if ((clockValue(time) - midnight) % (interval * hour) === 0) ticks.push(index);
    });
    return ticks.length ? ticks : [0];
  };
  const pathsFor = (values, times, x, y, baseline) => segmentsFor(values, times).map((segment) => {
    const line = segment.map((point, index) => `${index ? "L" : "M"}${x(point.index).toFixed(2)} ${y(point.value).toFixed(2)}`).join(" ");
    const area = segment.length < 2 ? "" : `${line} L${x(segment.at(-1).index).toFixed(2)} ${baseline.toFixed(2)} L${x(segment[0].index).toFixed(2)} ${baseline.toFixed(2)} Z`;
    return { line, area, segment };
  });

  const create = (rootElement, metrics) => {
    const document = rootElement.ownerDocument;
    const window = document.defaultView;
    const svgNs = "http://www.w3.org/2000/svg";
    const make = (tag, className, text = "") => {
      const node = document.createElement(tag);
      node.className = className;
      if (text !== "") node.textContent = text;
      return node;
    };
    const svgNode = (tag, attrs, text = "") => {
      const node = document.createElementNS(svgNs, tag);
      Object.entries(attrs).forEach(([name, value]) => node.setAttribute(name, String(value)));
      if (text !== "") node.textContent = text;
      return node;
    };
    const setAttributes = (node, attrs) => Object.entries(attrs).forEach(([name, value]) => node.setAttribute(name, String(value)));
    const shortRange = (metric, summary) => {
      if (!summary.count) return "No data";
      if (definitions[metric.key].mode === "bars") return `${formatNumber(summary.total)} ${unitFor(metric)}`;
      if (metric.key === "wind_direction_10m") return bearingLabel(summary.primary);
      return `${formatNumber(summary.primary)} ${unitFor(metric)}`;
    };
    let payload = { hourly: {} };
    let selectedKey = metrics[0]?.key;
    let selectedIndex = 0;
    let series = { times: [], values: [] };
    let activeMetric = metrics[0];
    let chartWidth = 0;
    let cursor = null;
    let selectedMark = null;
    let selectionBand = null;
    let xFor = () => 0;
    let yFor = () => 0;
    let slotWidth = 0;
    let plotLeft = 0;
    let plotWidth = 0;
    let plotTop = 0;
    let plotBottom = 0;
    let inspect = false;
    let destroyed = false;
    const tabNodes = new Map();

    const nav = make("div", "explorer-metrics");
    setAttributes(nav, { role: "tablist", "aria-label": "Hourly weather metric" });
    const panel = make("div", "explorer-panel");
    panel.id = "hourly-explorer-panel";
    setAttributes(panel, { role: "tabpanel", "aria-label": "Hourly weather chart" });
    const heading = make("div", "explorer-heading");
    const primary = make("div", "explorer-primary");
    const eyebrow = make("p", "explorer-eyebrow");
    const primaryReading = make("div", "explorer-primary-reading");
    const primaryValue = make("strong", "explorer-primary-value");
    const primaryUnit = make("span", "explorer-primary-unit");
    const primaryCaption = make("p", "explorer-primary-caption");
    primaryReading.append(primaryValue, primaryUnit);
    primary.append(eyebrow, primaryReading, primaryCaption);
    const stats = make("div", "explorer-stats");
    const statLabel = make("span", "explorer-stat-label");
    const statValue = make("strong", "explorer-stat-value");
    const statDate = make("span", "explorer-stat-date");
    stats.append(statLabel, statValue, statDate);
    heading.append(primary, stats);
    const chart = make("div", "explorer-chart");
    const svg = svgNode("svg", { class: "explorer-svg", "aria-hidden": "true" });
    const tooltip = make("div", "explorer-tooltip");
    tooltip.hidden = true;
    const tooltipTime = make("span", "explorer-tooltip-time");
    const tooltipValue = make("strong", "explorer-tooltip-value");
    const tooltipLabel = make("span", "explorer-tooltip-label");
    tooltip.append(tooltipTime, tooltipValue, tooltipLabel);
    const empty = make("div", "explorer-empty");
    empty.hidden = true;
    empty.innerHTML = '<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M7 28h26M9 23l7-7 6 4 9-11M9 32v2m11-2v2m11-2v2"/><path d="M6 5 34 33"/></svg><strong>No hourly data for this period</strong><span>Available observations will appear here.</span>';
    chart.append(svg, tooltip, empty);
    const inspection = make("div", "explorer-inspection");
    const inspectReading = make("div", "explorer-inspect-reading");
    const inspectTime = make("span", "explorer-inspect-time");
    const inspectValue = make("strong", "explorer-inspect-value");
    inspectReading.append(inspectTime, inspectValue);
    const seek = make("input", "explorer-seek");
    seek.type = "range";
    setAttributes(seek, { min: "0", max: "0", step: "1", "aria-label": "Forecast hour" });
    const seekEnds = make("div", "explorer-seek-ends");
    const seekStart = make("span", "");
    const seekEnd = make("span", "");
    seekEnds.append(seekStart, seekEnd);
    inspection.append(inspectReading, seek, seekEnds);
    const coverage = make("p", "explorer-coverage");
    panel.append(heading, chart, inspection, coverage);
    rootElement.replaceChildren(nav, panel);

    const currentSummary = () => summarize(activeMetric, series.values);
    const updateReading = () => {
      if (!series.times.length) return;
      const time = timeLabel(series.times[selectedIndex]);
      const value = series.values[selectedIndex];
      inspectTime.textContent = time.full;
      inspectValue.textContent = valueLabel(activeMetric, value);
      tooltipTime.textContent = time.full;
      tooltipValue.textContent = valueLabel(activeMetric, value);
      tooltipLabel.textContent = value === null ? "Observation unavailable" : definitions[activeMetric.key].mode === "bars" ? `${definitions[activeMetric.key].label} this hour` : definitions[activeMetric.key].label;
      seek.value = String(selectedIndex);
      seek.setAttribute("aria-valuetext", `${time.full}: ${valueLabel(activeMetric, value)}`);
      if (!cursor) return;
      const x = xFor(selectedIndex);
      setAttributes(cursor, { x1: x, x2: x, visibility: inspect ? "visible" : "hidden" });
      setAttributes(selectionBand, { x: x - slotWidth / 2, width: slotWidth, visibility: inspect ? "visible" : "hidden" });
      setAttributes(selectedMark, { cx: x, cy: value === null ? plotBottom : yFor(value), visibility: inspect && value !== null ? "visible" : "hidden" });
      tooltip.hidden = !inspect;
      tooltip.style.left = `${Math.max(8, Math.min(chartWidth - 182, x - 86))}px`;
    };
    const selectHour = (index, shouldInspect = true) => {
      if (!series.times.length) return;
      selectedIndex = Math.max(0, Math.min(series.times.length - 1, Math.round(index)));
      inspect = shouldInspect;
      updateReading();
    };
    const draw = () => {
      const rect = chart.getBoundingClientRect();
      chartWidth = Math.max(220, Math.round(rect.width || rootElement.clientWidth || 960));
      const narrow = chartWidth < 600;
      const height = narrow ? 300 : 320;
      const axis = axisFor(activeMetric.key, series.values);
      plotLeft = narrow ? 33 : 44;
      plotWidth = chartWidth - plotLeft - (narrow ? 9 : 16);
      plotTop = 42;
      plotBottom = height - 34;
      slotWidth = plotWidth / Math.max(1, series.times.length);
      xFor = (index) => plotLeft + (index + 0.5) * slotWidth;
      yFor = (value) => plotBottom - (value - axis.min) / (axis.max - axis.min) * (plotBottom - plotTop);
      svg.replaceChildren();
      setAttributes(svg, { viewBox: `0 0 ${chartWidth} ${height}`, height });
      const summary = currentSummary();
      empty.hidden = summary.count > 0;
      svg.style.display = summary.count === 0 ? "none" : "";
      inspection.hidden = !series.times.length || summary.count === 0;
      if (!summary.count) { tooltip.hidden = true; cursor = null; return; }
      const bands = dayBands(series.times);
      bands.forEach((band, index) => {
        const left = plotLeft + band.start * slotWidth;
        const right = plotLeft + band.end * slotWidth;
        if (index % 2 === 1) svg.appendChild(svgNode("rect", { class: "explorer-day-fill", x: left, y: plotTop - 8, width: right - left, height: plotBottom - plotTop + 8 }));
        if (index > 0) svg.appendChild(svgNode("line", { class: "explorer-day-boundary", x1: left, x2: left, y1: plotTop - 8, y2: plotBottom }));
        if (right - left > (narrow ? 40 : 65)) svg.appendChild(svgNode("text", {
          class: "explorer-day-label", x: (left + right) / 2, y: 18, "text-anchor": "middle",
        }, narrow ? band.label.shortDay : `${band.label.day}, ${band.label.date}`));
      });
      axis.ticks.forEach((value) => {
        const y = yFor(value);
        svg.appendChild(svgNode("line", { class: value === axis.min ? "explorer-baseline" : "explorer-grid", x1: plotLeft, x2: plotLeft + plotWidth, y1: y, y2: y }));
        const label = activeMetric.key === "wind_direction_10m" ? ["N", "E", "S", "W", "N"][value / 90]
          : Math.abs(value) >= 1000 ? `${Number((value / 1000).toFixed(2))}k` : String(Number(value.toPrecision(6)));
        svg.appendChild(svgNode("text", { class: "explorer-axis-label", x: plotLeft - 10, y: y + 3.5, "text-anchor": "end" }, label));
      });
      clockTicks(series.times, plotWidth).forEach((index) => {
        const x = xFor(index);
        const nearStart = x < plotLeft + 20;
        const nearEnd = x > plotLeft + plotWidth - 20;
        svg.appendChild(svgNode("text", { class: "explorer-axis-label explorer-clock-label", x, y: height - 9, "text-anchor": nearStart ? "start" : nearEnd ? "end" : "middle" }, timeLabel(series.times[index]).hour));
      });
      const config = definitions[activeMetric.key];
      if (config.mode === "bars") {
        series.values.forEach((value, index) => {
          if (value === null) {
            svg.appendChild(svgNode("line", { class: "explorer-missing-mark", x1: xFor(index) - 1.5, x2: xFor(index) + 1.5, y1: plotBottom + 6, y2: plotBottom + 6 }));
            return;
          }
          if (value === 0) {
            svg.appendChild(svgNode("line", { class: "explorer-zero-mark", x1: xFor(index) - Math.max(0.6, slotWidth * 0.2), x2: xFor(index) + Math.max(0.6, slotWidth * 0.2), y1: plotBottom, y2: plotBottom }));
          } else {
            const y = yFor(value);
            svg.appendChild(svgNode("rect", { class: "explorer-bar", x: xFor(index) - slotWidth * 0.34, y, width: slotWidth * 0.68, height: plotBottom - y, rx: Math.min(2.5, slotWidth * 0.2), "data-hour": index }));
          }
        });
      } else if (config.mode === "direction") {
        series.values.forEach((value, index) => {
          if (value !== null) svg.appendChild(svgNode("circle", { class: "explorer-bearing", cx: xFor(index), cy: yFor(value), r: narrow ? 2.2 : 2.7, "data-hour": index }));
        });
      } else {
        const defs = svgNode("defs", {});
        const gradient = svgNode("linearGradient", { id: "hourly-explorer-fill", x1: 0, y1: 0, x2: 0, y2: 1 });
        gradient.append(svgNode("stop", { offset: "0%", class: "explorer-gradient-start" }), svgNode("stop", { offset: "100%", class: "explorer-gradient-end" }));
        defs.appendChild(gradient);
        svg.appendChild(defs);
        pathsFor(series.values, series.times, xFor, yFor, plotBottom).forEach((segment) => {
          if (segment.area) svg.appendChild(svgNode("path", { class: "explorer-area", d: segment.area, fill: "url(#hourly-explorer-fill)" }));
          svg.appendChild(svgNode("path", { class: "explorer-line", d: segment.line }));
          if (segment.segment.length === 1) svg.appendChild(svgNode("circle", { class: "explorer-isolated-point", cx: xFor(segment.segment[0].index), cy: yFor(segment.segment[0].value), r: 3 }));
        });
      }
      selectionBand = svgNode("rect", { class: "explorer-selection-band", y: plotTop, height: plotBottom - plotTop, visibility: "hidden" });
      cursor = svgNode("line", { class: "explorer-cursor", y1: plotTop, y2: plotBottom, visibility: "hidden" });
      selectedMark = svgNode("circle", { class: "explorer-selected-point", r: 4.5, visibility: "hidden" });
      svg.append(selectionBand, cursor, selectedMark);
      updateReading();
    };
    const renderActive = () => {
      activeMetric = metrics.find((metric) => metric.key === selectedKey) || metrics[0];
      selectedKey = activeMetric.key;
      const config = definitions[activeMetric.key];
      series = normalizeSeries(payload.hourly, selectedKey);
      selectedIndex = Math.min(selectedIndex, Math.max(0, series.times.length - 1));
      rootElement.style.setProperty("--explorer-accent", activeMetric.color);
      tabNodes.forEach(({ button }, key) => {
        button.setAttribute("aria-selected", key === selectedKey ? "true" : "false");
        button.tabIndex = key === selectedKey ? 0 : -1;
      });
      panel.setAttribute("aria-labelledby", `hourly-metric-${selectedKey}`);
      const summary = currentSummary();
      const partial = summary.count > 0 && summary.count < series.times.length;
      eyebrow.textContent = config.summary;
      primaryValue.textContent = selectedKey === "wind_direction_10m" ? bearingLabel(summary.primary) : formatNumber(summary.primary);
      primaryUnit.textContent = selectedKey === "wind_direction_10m" ? "" : unitFor(activeMetric);
      primaryUnit.hidden = summary.primary === null;
      const period = series.times.length;
      primaryCaption.textContent = summary.count ? `${period}-hour outlook${partial && config.mode === "bars" ? " · incomplete total" : ""}` : "No observations available";
      statLabel.textContent = config.mode === "bars" ? "Peak in one hour" : selectedKey === "snow_depth" ? "Forecast range" : "Expected at";
      statValue.textContent = !summary.count ? "—" : config.mode === "bars" ? valueLabel(activeMetric, summary.high)
        : selectedKey === "snow_depth" ? `${formatNumber(summary.low)}–${formatNumber(summary.high)} ${unitFor(activeMetric)}`
          : timeLabel(series.times[summary.at]).hour;
      statDate.textContent = summary.count ? `${timeLabel(series.times[summary.at]).day}, ${timeLabel(series.times[summary.at]).date}` : "";
      coverage.textContent = partial ? `${summary.count} of ${period} hourly observations available. Gaps indicate missing data.` : "";
      coverage.hidden = !partial;
      setAttributes(seek, { max: Math.max(0, period - 1), "aria-label": `${config.label}, forecast hour` });
      seek.disabled = period <= 1;
      seekStart.textContent = period ? `${timeLabel(series.times[0]).date} · ${timeLabel(series.times[0]).hour}` : "";
      seekEnd.textContent = period ? `${timeLabel(series.times.at(-1)).date} · ${timeLabel(series.times.at(-1)).hour}` : "";
      draw();
    };
    const chooseMetric = (key, focus = false) => {
      selectedKey = key;
      inspect = false;
      renderActive();
      const button = tabNodes.get(key)?.button;
      if (focus) button?.focus({ preventScroll: true });
      if (button) {
        // Reveal only the horizontal metric strip. Element.scrollIntoView also
        // scrolls page ancestors, which can displace the chart on every choice.
        const strip = nav.getBoundingClientRect();
        const tab = button.getBoundingClientRect();
        const leftOverflow = strip.left + 8 - tab.left;
        const rightOverflow = tab.left + tab.width - (strip.left + strip.width - 8);
        const delta = leftOverflow > 0 ? -leftOverflow : rightOverflow > 0 ? rightOverflow : 0;
        const maxScroll = Math.max(0, nav.scrollWidth - nav.clientWidth);
        if (delta && Number.isFinite(maxScroll)) nav.scrollLeft = Math.max(0, Math.min(maxScroll, nav.scrollLeft + delta));
      }
    };
    metrics.forEach((metric, index) => {
      const config = definitions[metric.key];
      const button = make("button", "explorer-metric");
      button.type = "button";
      button.id = `hourly-metric-${metric.key}`;
      setAttributes(button, { role: "tab", "aria-controls": panel.id, "aria-selected": index === 0 ? "true" : "false" });
      button.tabIndex = index === 0 ? 0 : -1;
      const label = make("span", "explorer-metric-label");
      label.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${config.icon}"/></svg>`;
      label.appendChild(make("span", "", config.label));
      const reading = make("strong", "explorer-metric-reading", "—");
      button.append(label, reading);
      button.addEventListener("click", () => chooseMetric(metric.key));
      button.addEventListener("keydown", (event) => {
        const nextIndex = { ArrowRight: (index + 1) % metrics.length, ArrowLeft: (index - 1 + metrics.length) % metrics.length, Home: 0, End: metrics.length - 1 }[event.key];
        if (nextIndex === undefined) return;
        event.preventDefault();
        chooseMetric(metrics[nextIndex].key, true);
      });
      nav.appendChild(button);
      tabNodes.set(metric.key, { button, reading });
    });
    const pointerHour = (event) => {
      const rect = svg.getBoundingClientRect();
      if (!rect.width || !Number.isFinite(event.clientX)) return;
      const x = (event.clientX - rect.left) / rect.width * chartWidth;
      selectHour((x - plotLeft) / slotWidth - 0.5);
    };
    chart.addEventListener("pointermove", pointerHour);
    chart.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      pointerHour(event);
      if (Number.isFinite(event.pointerId)) chart.setPointerCapture?.(event.pointerId);
    });
    const stopPointer = (event) => {
      if (chart.hasPointerCapture?.(event.pointerId)) chart.releasePointerCapture(event.pointerId);
    };
    chart.addEventListener("pointerup", stopPointer);
    chart.addEventListener("pointercancel", stopPointer);
    chart.addEventListener("pointerleave", () => { if (document.activeElement !== seek) { inspect = false; updateReading(); } });
    seek.addEventListener("input", () => selectHour(Number(seek.value)));
    seek.addEventListener("focus", () => { inspect = true; updateReading(); });
    seek.addEventListener("blur", () => { inspect = false; updateReading(); });
    const resize = () => { if (!destroyed) draw(); };
    let observer = null;
    if (window?.ResizeObserver) { observer = new window.ResizeObserver(resize); observer.observe(chart); }
    return {
      update(nextPayload) {
        payload = nextPayload || { hourly: {} };
        metrics.forEach((metric) => {
          const metricSeries = normalizeSeries(payload.hourly, metric.key);
          const summary = summarize(metric, metricSeries.values);
          tabNodes.get(metric.key).reading.textContent = shortRange(metric, summary);
        });
        renderActive();
      },
      resize,
      destroy() { destroyed = true; observer?.disconnect(); },
    };
  };

  return { create, normalizeSeries, axisFor, segmentsFor, pathsFor, clockTicks, dayBands, timeLabel, summarize, bearingLabel, formatNumber };
}));
