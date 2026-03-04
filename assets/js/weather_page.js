const leftWrap = document.getElementById("snowfall-left-wrap");
const rightWrap = document.getElementById("snowfall-right-wrap");
const leftTable = leftWrap ? leftWrap.querySelector(".snowfall-left-table") : null;
const rightTable = rightWrap ? rightWrap.querySelector(".snowfall-right-table") : null;
const snowfallDesktopSplitWrap = leftWrap ? leftWrap.closest(".snowfall-split-wrap") : null;

const leftWrapMobile = document.getElementById("snowfall-left-wrap-mobile");
const rightWrapMobile = document.getElementById("snowfall-right-wrap-mobile");
const leftTableMobile = leftWrapMobile ? leftWrapMobile.querySelector(".snowfall-left-table") : null;
const rightTableMobile = rightWrapMobile ? rightWrapMobile.querySelector(".snowfall-right-table") : null;
const snowfallMobileSplitWrap = leftWrapMobile ? leftWrapMobile.closest(".snowfall-split-wrap") : null;

const tempLeftWrap = document.getElementById("temperature-left-wrap");
const tempRightWrap = document.getElementById("temperature-right-wrap");
const tempLeftTable = tempLeftWrap ? tempLeftWrap.querySelector(".temperature-left-table") : null;
const tempRightTable = tempRightWrap ? tempRightWrap.querySelector(".temperature-right-table") : null;
const tempSplitWrap = tempLeftWrap ? tempLeftWrap.closest(".temperature-split-wrap") : null;

const rainLeftWrap = document.getElementById("rain-left-wrap");
const rainRightWrap = document.getElementById("rain-right-wrap");
const rainLeftTable = rainLeftWrap ? rainLeftWrap.querySelector(".rain-left-table") : null;
const rainRightTable = rainRightWrap ? rainRightWrap.querySelector(".rain-right-table") : null;
const rainDesktopSplitWrap = rainLeftWrap ? rainLeftWrap.closest(".rain-split-wrap") : null;

const rainLeftWrapMobile = document.getElementById("rain-left-wrap-mobile");
const rainRightWrapMobile = document.getElementById("rain-right-wrap-mobile");
const rainLeftTableMobile = rainLeftWrapMobile ? rainLeftWrapMobile.querySelector(".rain-left-table") : null;
const rainRightTableMobile = rainRightWrapMobile ? rainRightWrapMobile.querySelector(".rain-right-table") : null;
const rainMobileSplitWrap = rainLeftWrapMobile ? rainLeftWrapMobile.closest(".rain-split-wrap") : null;

const reportDateEl = document.getElementById("report-date");
if (reportDateEl) {
  const utcRaw = reportDateEl.getAttribute("data-generated-utc");
  const utcDate = utcRaw ? new Date(utcRaw) : null;
  if (utcDate && !Number.isNaN(utcDate.getTime())) {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "local";
    const localText = utcDate.toLocaleString(undefined, {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
      timeZoneName: "short",
    });
    reportDateEl.textContent = `Generated At: ${localText} (${tz})`;
  }
}

const MIN_QUERY_COL_PX = 220;
const MIN_WEEK_COL_PX = 110;
const MIN_DAY_COL_PX = 66;
const MAIN_HORIZONTAL_PADDING_PX = 40;
const TABLE_BORDER_BUFFER_PX = 8;
const MIN_DESKTOP_SNOW_3DAY_PX =
  MIN_QUERY_COL_PX + (MIN_WEEK_COL_PX * 2) + (MIN_DAY_COL_PX * 3) + MAIN_HORIZONTAL_PADDING_PX + TABLE_BORDER_BUFFER_PX;

const isCompactLayout = () => document.body.classList.contains("mobile-simple");
const shouldUseMobileSimple = () => window.innerWidth < MIN_DESKTOP_SNOW_3DAY_PX;
const updateLayoutMode = () => {
  document.body.classList.toggle("mobile-simple", shouldUseMobileSimple());
};

const measureTextWidth = (text, font) => {
  const canvas = measureTextWidth.canvas || (measureTextWidth.canvas = document.createElement("canvas"));
  const ctx = canvas.getContext("2d");
  ctx.font = font;
  return ctx.measureText(text || "").width;
};

const setFixedSnowMobileHeights = () => {
  if (!leftTableMobile || !rightTableMobile) return;
  const leftHeadRows = Array.from(leftTableMobile.tHead?.rows || []);
  const rightHeadRows = Array.from(rightTableMobile.tHead?.rows || []);
  const leftBodyRows = Array.from(leftTableMobile.tBodies[0]?.rows || []);
  const rightBodyRows = Array.from(rightTableMobile.tBodies[0]?.rows || []);

  const headRowHeights = [30, 30];
  leftHeadRows.forEach((row, idx) => { row.style.height = `${headRowHeights[idx] || 30}px`; });
  rightHeadRows.forEach((row, idx) => { row.style.height = `${headRowHeights[idx] || 30}px`; });
  leftBodyRows.forEach((row) => { row.style.height = "30px"; });
  rightBodyRows.forEach((row) => { row.style.height = "30px"; });

  if (snowfallMobileSplitWrap) {
    snowfallMobileSplitWrap.style.setProperty("--snow-header-row1-h", `${headRowHeights[0]}px`);
  }
};

const setFixedRainMobileHeights = () => {
  if (!rainLeftTableMobile || !rainRightTableMobile) return;
  const leftHeadRows = Array.from(rainLeftTableMobile.tHead?.rows || []);
  const rightHeadRows = Array.from(rainRightTableMobile.tHead?.rows || []);
  const leftBodyRows = Array.from(rainLeftTableMobile.tBodies[0]?.rows || []);
  const rightBodyRows = Array.from(rainRightTableMobile.tBodies[0]?.rows || []);

  const headRowHeights = [30, 30];
  leftHeadRows.forEach((row, idx) => { row.style.height = `${headRowHeights[idx] || 30}px`; });
  rightHeadRows.forEach((row, idx) => { row.style.height = `${headRowHeights[idx] || 30}px`; });
  leftBodyRows.forEach((row) => { row.style.height = "30px"; });
  rightBodyRows.forEach((row) => { row.style.height = "30px"; });

  if (rainMobileSplitWrap) {
    rainMobileSplitWrap.style.setProperty("--rain-header-row1-h", `${headRowHeights[0]}px`);
  }
};

const syncTableRowHeights = (lt, rt) => {
  if (!lt || !rt) return;
  const lHeadRows = Array.from(lt.tHead?.rows || []);
  const rHeadRows = Array.from(rt.tHead?.rows || []);
  const hlen = Math.min(lHeadRows.length, rHeadRows.length);
  for (let i = 0; i < hlen; i += 1) {
    lHeadRows[i].style.height = "";
    rHeadRows[i].style.height = "";
    const h = Math.max(lHeadRows[i].offsetHeight, rHeadRows[i].offsetHeight);
    lHeadRows[i].style.height = `${h}px`;
    rHeadRows[i].style.height = `${h}px`;
  }
  const lRows = Array.from(lt.tBodies[0]?.rows || []);
  const rRows = Array.from(rt.tBodies[0]?.rows || []);
  const len = Math.min(lRows.length, rRows.length);
  for (let i = 0; i < len; i += 1) {
    lRows[i].style.height = "";
    rRows[i].style.height = "";
    const h = Math.max(lRows[i].offsetHeight, rRows[i].offsetHeight);
    lRows[i].style.height = `${h}px`;
    rRows[i].style.height = `${h}px`;
  }
};

const syncStickySecondRowTop = (lt, rt, splitWrap, varName) => {
  if (!lt || !rt || !splitWrap) return;
  const leftFirstRow = lt.tHead?.rows?.[0];
  const rightFirstRow = rt.tHead?.rows?.[0];
  if (!leftFirstRow || !rightFirstRow) return;
  const h = Math.max(leftFirstRow.offsetHeight, rightFirstRow.offsetHeight);
  if (h > 0) {
    splitWrap.style.setProperty(varName, `${h}px`);
  }
};

const attachVerticalSync = (left, right) => {
  if (!left || !right) return;
  let syncing = false;
  const sync = (src, dst) => {
    if (syncing) return;
    syncing = true;
    dst.scrollTop = src.scrollTop;
    requestAnimationFrame(() => { syncing = false; });
  };
  left.addEventListener("scroll", () => sync(left, right), { passive: true });
  right.addEventListener("scroll", () => sync(right, left), { passive: true });
};

const autoSizeSnowDesktopLeftColumns = () => {
  if (!leftWrap || !leftTable) return;
  const rows = Array.from(leftTable.querySelectorAll("tbody tr"));
  const headerCells = Array.from(leftTable.querySelectorAll("thead tr:last-child th"));
  if (headerCells.length < 2) return;
  const sampleCell = leftTable.querySelector("tbody td") || headerCells[0];
  const font = window.getComputedStyle(sampleCell).font;

  const queryValues = rows.map((tr) => tr.children[0]?.textContent?.trim() || "");
  const queryHeader = leftTable.querySelector("thead .query-col")?.textContent?.trim() || "query";
  const queryMax = Math.max(
    measureTextWidth(queryHeader, font),
    ...queryValues.map((v) => measureTextWidth(v, font))
  );

  const weekValues = rows.flatMap((tr) => [
    tr.children[1]?.textContent?.trim() || "",
    tr.children[2]?.textContent?.trim() || "",
  ]);
  const weekHeaders = headerCells.map((th) => th.textContent?.trim() || "");
  const weekMax = Math.max(
    ...weekHeaders.map((v) => measureTextWidth(v, font)),
    ...weekValues.map((v) => measureTextWidth(v, font))
  );

  const queryWidth = Math.max(150, Math.min(240, Math.ceil(queryMax + 28)));
  const weekWidth = Math.max(90, Math.min(130, Math.ceil(weekMax + 24)));

  leftWrap.style.setProperty("--query-col-w", `${queryWidth}px`);
  leftWrap.style.setProperty("--week-col-w", `${weekWidth}px`);
};

const autoSizeSnowDesktopDayColumns = () => {
  if (!rightWrap || !rightTable) return;
  const dayCols = Array.from(rightTable.querySelectorAll("col.col-day"));
  const dayCount = dayCols.length;
  if (!dayCount) return;

  const minDayWidth = 66;
  const wrapWidth = rightWrap.clientWidth;
  const minTotal = minDayWidth * dayCount;

  if (wrapWidth >= minTotal) {
    const base = Math.floor(wrapWidth / dayCount);
    const remainder = wrapWidth - (base * dayCount);
    dayCols.forEach((col, idx) => {
      const w = base + (idx < remainder ? 1 : 0);
      col.style.width = `${w}px`;
    });
    rightTable.style.width = `${wrapWidth}px`;
    return;
  }

  dayCols.forEach((col) => {
    col.style.width = `${minDayWidth}px`;
  });
  rightTable.style.width = `${minTotal}px`;
};

const autoSizeSnowMobileQuery = () => {
  if (!leftWrapMobile || !leftTableMobile) return;
  const rows = Array.from(leftTableMobile.querySelectorAll("tbody tr"));
  const header = leftTableMobile.querySelector("thead .query-col");
  const sampleCell = leftTableMobile.querySelector("tbody td") || header;
  if (!sampleCell || !header) return;
  const font = window.getComputedStyle(sampleCell).font;

  const queryValues = rows.map((tr) => tr.children[0]?.textContent?.trim() || "");
  const queryHeader = header.textContent?.trim() || "Resort";
  const queryMax = Math.max(
    measureTextWidth(queryHeader, font),
    ...queryValues.map((v) => measureTextWidth(v, font))
  );
  const queryWidth = Math.max(130, Math.min(210, Math.ceil(queryMax + 22)));
  leftWrapMobile.style.setProperty("--query-col-w", `${queryWidth}px`);
};

const autoSizeSnowMobileRightColumns = () => {
  if (!rightWrapMobile || !rightTableMobile) return;
  const weekCols = Array.from(rightTableMobile.querySelectorAll("col.col-week-right"));
  const dayCols = Array.from(rightTableMobile.querySelectorAll("col.col-day"));
  const totalCols = weekCols.length + dayCols.length;
  if (!totalCols) return;

  const minWeekWidth = 92;
  const minDayWidth = 62;
  const minTotal = (minWeekWidth * weekCols.length) + (minDayWidth * dayCols.length);
  const wrapW = rightWrapMobile.clientWidth;

  if (wrapW >= minTotal) {
    const base = Math.floor(wrapW / totalCols);
    const rem = wrapW - (base * totalCols);
    [...weekCols, ...dayCols].forEach((col, idx) => {
      const w = base + (idx < rem ? 1 : 0);
      col.style.width = `${w}px`;
    });
    rightTableMobile.style.width = `${wrapW}px`;
    return;
  }

  weekCols.forEach((col) => { col.style.width = `${minWeekWidth}px`; });
  dayCols.forEach((col) => { col.style.width = `${minDayWidth}px`; });
  rightTableMobile.style.width = `${minTotal}px`;
};

const autoSizeRainDesktopLeftColumns = () => {
  if (!rainLeftWrap || !rainLeftTable) return;
  const rows = Array.from(rainLeftTable.querySelectorAll("tbody tr"));
  const headerCells = Array.from(rainLeftTable.querySelectorAll("thead tr:last-child th"));
  if (headerCells.length < 2) return;
  const sampleCell = rainLeftTable.querySelector("tbody td") || headerCells[0];
  if (!sampleCell) return;
  const font = window.getComputedStyle(sampleCell).font;

  const queryHeader = rainLeftTable.querySelector("thead .query-col")?.textContent?.trim() || "query";
  const queryValues = rows.map((tr) => tr.children[0]?.textContent?.trim() || "");
  const queryMax = Math.max(
    measureTextWidth(queryHeader, font),
    ...queryValues.map((v) => measureTextWidth(v, font))
  );

  const weekHeaders = headerCells.map((th) => th.textContent?.trim() || "");
  const weekValues = rows.flatMap((tr) =>
    Array.from(tr.children)
      .slice(1)
      .map((td) => td.textContent?.trim() || "")
  );
  const weekMax = Math.max(
    ...weekHeaders.map((v) => measureTextWidth(v, font)),
    ...weekValues.map((v) => measureTextWidth(v, font))
  );

  const queryW = Math.max(150, Math.min(240, Math.ceil(queryMax + 28)));
  const weekW = Math.max(90, Math.min(130, Math.ceil(weekMax + 24)));
  rainLeftWrap.style.setProperty("--rain-query-w", `${queryW}px`);
  rainLeftWrap.style.setProperty("--rain-week-w", `${weekW}px`);
};

const autoSizeRainDesktopDayColumns = () => {
  if (!rainRightWrap || !rainRightTable) return;
  const cols = Array.from(rainRightTable.querySelectorAll("col.col-day"));
  const count = cols.length;
  if (!count) return;
  const minW = 66;
  const wrapW = rainRightWrap.clientWidth;
  const minTotal = minW * count;
  if (wrapW >= minTotal) {
    const base = Math.floor(wrapW / count);
    const rem = wrapW - (base * count);
    cols.forEach((col, idx) => {
      const w = base + (idx < rem ? 1 : 0);
      col.style.width = `${w}px`;
    });
    rainRightTable.style.width = `${wrapW}px`;
    return;
  }
  cols.forEach((col) => { col.style.width = `${minW}px`; });
  rainRightTable.style.width = `${minTotal}px`;
};

const autoSizeRainMobileQuery = () => {
  if (!rainLeftWrapMobile || !rainLeftTableMobile) return;
  const rows = Array.from(rainLeftTableMobile.querySelectorAll("tbody tr"));
  const header = rainLeftTableMobile.querySelector("thead .query-col");
  const sampleCell = rainLeftTableMobile.querySelector("tbody td") || header;
  if (!sampleCell || !header) return;
  const font = window.getComputedStyle(sampleCell).font;

  const queryValues = rows.map((tr) => tr.children[0]?.textContent?.trim() || "");
  const queryHeader = header.textContent?.trim() || "Resort";
  const queryMax = Math.max(
    measureTextWidth(queryHeader, font),
    ...queryValues.map((v) => measureTextWidth(v, font))
  );
  const queryWidth = Math.max(130, Math.min(210, Math.ceil(queryMax + 22)));
  rainLeftWrapMobile.style.setProperty("--rain-query-w", `${queryWidth}px`);
};

const autoSizeRainMobileRightColumns = () => {
  if (!rainRightWrapMobile || !rainRightTableMobile) return;
  const weekCols = Array.from(rainRightTableMobile.querySelectorAll("col.col-week-right"));
  const dayCols = Array.from(rainRightTableMobile.querySelectorAll("col.col-day"));
  const totalCols = weekCols.length + dayCols.length;
  if (!totalCols) return;

  const minWeekWidth = 92;
  const minDayWidth = 62;
  const minTotal = (minWeekWidth * weekCols.length) + (minDayWidth * dayCols.length);
  const wrapW = rainRightWrapMobile.clientWidth;

  if (wrapW >= minTotal) {
    const base = Math.floor(wrapW / totalCols);
    const rem = wrapW - (base * totalCols);
    [...weekCols, ...dayCols].forEach((col, idx) => {
      const w = base + (idx < rem ? 1 : 0);
      col.style.width = `${w}px`;
    });
    rainRightTableMobile.style.width = `${wrapW}px`;
    return;
  }

  weekCols.forEach((col) => { col.style.width = `${minWeekWidth}px`; });
  dayCols.forEach((col) => { col.style.width = `${minDayWidth}px`; });
  rainRightTableMobile.style.width = `${minTotal}px`;
};

const autoSizeTempQuery = () => {
  if (!tempLeftWrap || !tempLeftTable) return;
  const rows = Array.from(tempLeftTable.querySelectorAll("tbody tr"));
  const sampleCell = tempLeftTable.querySelector("tbody td") || tempLeftTable.querySelector("thead th");
  if (!sampleCell) return;
  const font = window.getComputedStyle(sampleCell).font;
  const queryHeader = tempLeftTable.querySelector("thead .query-col")?.textContent?.trim() || "query";
  const queryValues = rows.map((tr) => tr.children[0]?.textContent?.trim() || "");
  const queryMax = Math.max(
    measureTextWidth(queryHeader, font),
    ...queryValues.map((v) => measureTextWidth(v, font))
  );
  const queryW = Math.max(150, Math.min(240, Math.ceil(queryMax + 28)));
  tempLeftWrap.style.setProperty("--temp-query-w", `${queryW}px`);
};

const autoSizeTempColumns = () => {
  if (!tempRightWrap || !tempRightTable) return;
  const cols = Array.from(tempRightTable.querySelectorAll("col.col-temp"));
  const count = cols.length;
  if (!count) return;
  const minW = 50;
  const wrapW = tempRightWrap.clientWidth;
  const minTotal = minW * count;
  if (wrapW >= minTotal) {
    const base = Math.floor(wrapW / count);
    const rem = wrapW - (base * count);
    cols.forEach((col, idx) => {
      const w = base + (idx < rem ? 1 : 0);
      col.style.width = `${w}px`;
    });
    tempRightTable.style.width = `${wrapW}px`;
    return;
  }
  cols.forEach((col) => { col.style.width = `${minW}px`; });
  tempRightTable.style.width = `${minTotal}px`;
};

attachVerticalSync(leftWrap, rightWrap);
attachVerticalSync(leftWrapMobile, rightWrapMobile);
attachVerticalSync(rainLeftWrap, rainRightWrap);
attachVerticalSync(rainLeftWrapMobile, rainRightWrapMobile);
attachVerticalSync(tempLeftWrap, tempRightWrap);

let tempLayoutRaf = 0;
const scheduleTempLayout = () => {
  if (tempLayoutRaf) cancelAnimationFrame(tempLayoutRaf);
  tempLayoutRaf = requestAnimationFrame(() => {
    autoSizeTempQuery();
    autoSizeTempColumns();
    syncTableRowHeights(tempLeftTable, tempRightTable);
    syncStickySecondRowTop(tempLeftTable, tempRightTable, tempSplitWrap, "--temp-header-row1-h");
  });
};

const applyLayout = () => {
  updateLayoutMode();
  if (isCompactLayout()) {
    autoSizeSnowMobileQuery();
    autoSizeSnowMobileRightColumns();
    setFixedSnowMobileHeights();
    autoSizeRainMobileQuery();
    autoSizeRainMobileRightColumns();
    setFixedRainMobileHeights();
    syncStickySecondRowTop(rainLeftTableMobile, rainRightTableMobile, rainMobileSplitWrap, "--rain-header-row1-h");
  } else {
    autoSizeSnowDesktopLeftColumns();
    autoSizeSnowDesktopDayColumns();
    syncTableRowHeights(leftTable, rightTable);
    syncStickySecondRowTop(leftTable, rightTable, snowfallDesktopSplitWrap, "--snow-header-row1-h");
    autoSizeRainDesktopLeftColumns();
    autoSizeRainDesktopDayColumns();
    syncTableRowHeights(rainLeftTable, rainRightTable);
    syncStickySecondRowTop(rainLeftTable, rainRightTable, rainDesktopSplitWrap, "--rain-header-row1-h");
  }
  scheduleTempLayout();
};

const UNIT_STORAGE_KEY_PREFIX = "closesnow_unit_mode_";
const UNIT_LABELS = {
  metric: { snow: "cm", rain: "mm", temp: "°C" },
  imperial: { snow: "in", rain: "in", temp: "°F" },
};
const VALID_UNIT_KINDS = new Set(["snow", "rain", "temp"]);
const unitToggles = Array.from(document.querySelectorAll(".unit-toggle[data-target-kind]"));

const getStoredUnitMode = (kind) => {
  try {
    const saved = localStorage.getItem(`${UNIT_STORAGE_KEY_PREFIX}${kind}`);
    if (saved === "imperial" || saved === "metric") return saved;
  } catch (e) {
    // Ignore localStorage access failures.
  }
  return "metric";
};

const formatMeasure = (metricValue, kind, mode) => {
  if (mode === "imperial") {
    if (kind === "snow") return (metricValue / 2.54).toFixed(1);
    if (kind === "rain") return (metricValue / 25.4).toFixed(2);
    if (kind === "temp") return ((metricValue * 9 / 5) + 32).toFixed(1);
  }
  if (kind === "rain") return metricValue.toFixed(1);
  if (kind === "snow" || kind === "temp") return metricValue.toFixed(1);
  return String(metricValue);
};

const renderUnitValues = (kind, mode) => {
  const cells = Array.from(document.querySelectorAll(`td[data-kind="${kind}"][data-metric-value]`));
  cells.forEach((cell) => {
    const metricRaw = cell.getAttribute("data-metric-value");
    const metricValue = metricRaw === null ? NaN : Number(metricRaw);
    if (!Number.isFinite(metricValue)) return;
    cell.textContent = formatMeasure(metricValue, kind, mode);
  });

  const unitLabels = Array.from(document.querySelectorAll(`[data-unit-kind="${kind}"]`));
  unitLabels.forEach((el) => {
    const text = UNIT_LABELS[mode]?.[kind];
    if (text) el.textContent = text;
  });
};

const syncToggleButtons = (kind, mode) => {
  const kindButtons = Array.from(
    document.querySelectorAll(`.unit-toggle[data-target-kind="${kind}"] .unit-btn[data-unit-mode]`)
  );
  kindButtons.forEach((btn) => {
    btn.classList.toggle("is-active", btn.getAttribute("data-unit-mode") === mode);
  });
};

const setUnitMode = (kind, mode, persist = true, relayout = true) => {
  if (!VALID_UNIT_KINDS.has(kind)) return;
  const nextMode = mode === "imperial" ? "imperial" : "metric";
  renderUnitValues(kind, nextMode);
  syncToggleButtons(kind, nextMode);
  if (persist) {
    try {
      localStorage.setItem(`${UNIT_STORAGE_KEY_PREFIX}${kind}`, nextMode);
    } catch (e) {
      // Ignore localStorage access failures.
    }
  }
  if (relayout) applyLayout();
};

const initializedKinds = new Set();
unitToggles.forEach((group) => {
  const kind = group.getAttribute("data-target-kind");
  if (!kind || !VALID_UNIT_KINDS.has(kind)) return;
  const buttons = Array.from(group.querySelectorAll(".unit-btn[data-unit-mode]"));
  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const mode = btn.getAttribute("data-unit-mode");
      setUnitMode(kind, mode || "metric");
    });
  });
  if (!initializedKinds.has(kind)) {
    setUnitMode(kind, getStoredUnitMode(kind), false, false);
    initializedKinds.add(kind);
  }
});

applyLayout();
window.addEventListener("resize", () => {
  applyLayout();
}, { passive: true });

if (window.ResizeObserver) {
  const ro = new ResizeObserver(() => applyLayout());
  if (leftWrap) ro.observe(leftWrap);
  if (rightWrap) ro.observe(rightWrap);
  if (leftWrapMobile) ro.observe(leftWrapMobile);
  if (rightWrapMobile) ro.observe(rightWrapMobile);
  if (rainLeftWrap) ro.observe(rainLeftWrap);
  if (rainRightWrap) ro.observe(rainRightWrap);
  if (rainLeftWrapMobile) ro.observe(rainLeftWrapMobile);
  if (rainRightWrapMobile) ro.observe(rainRightWrapMobile);
  if (tempLeftWrap) ro.observe(tempLeftWrap);
  if (tempRightWrap) ro.observe(tempRightWrap);
}
