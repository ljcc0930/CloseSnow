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

const sunLeftWrap = document.getElementById("sun-left-wrap");
const sunRightWrap = document.getElementById("sun-right-wrap");
const sunLeftTable = sunLeftWrap ? sunLeftWrap.querySelector(".sun-left-table") : null;
const sunRightTable = sunRightWrap ? sunRightWrap.querySelector(".sun-right-table") : null;
const sunSplitWrap = sunLeftWrap ? sunLeftWrap.closest(".sun-split-wrap") : null;

const weatherLeftWrap = document.getElementById("weather-left-wrap");
const weatherRightWrap = document.getElementById("weather-right-wrap");
const weatherLeftTable = weatherLeftWrap ? weatherLeftWrap.querySelector(".weather-left-table") : null;
const weatherRightTable = weatherRightWrap ? weatherRightWrap.querySelector(".weather-right-table") : null;
const weatherSplitWrap = weatherLeftWrap ? weatherLeftWrap.closest(".weather-split-wrap") : null;

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
const resortSearchInput = document.getElementById("resort-search-input");
const resortSearchClear = document.getElementById("resort-search-clear");
const filterOpenBtn = document.getElementById("filter-open-btn");
const filterModal = document.getElementById("filter-modal");
const filterApplyBtn = document.getElementById("filter-apply-btn");
const filterResetBtn = document.getElementById("filter-reset-btn");
const filterCloseBtn = document.getElementById("filter-close-btn");
const filterSummary = document.getElementById("filter-summary");
const filterRegionSelect = document.getElementById("filter-region-select");
const filterCountrySelect = document.getElementById("filter-country-select");
const filterSortSelect = document.getElementById("filter-sort-select");
const filterIncludeAllInput = document.getElementById("filter-include-all");
const filterPassTypeInputs = Array.from(document.querySelectorAll("input[name='filter-pass-type']"));
const filterMetaRaw = window.CLOSESNOW_FILTER_META;
const filterMeta =
  filterMetaRaw && typeof filterMetaRaw === "object" && !Array.isArray(filterMetaRaw) ? filterMetaRaw : {};
const filterMetaAvailable =
  filterMeta.available_filters && typeof filterMeta.available_filters === "object"
    ? filterMeta.available_filters
    : {};
const filterMetaApplied =
  filterMeta.applied_filters && typeof filterMeta.applied_filters === "object"
    ? filterMeta.applied_filters
    : {};
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

const autoSizeSunQuery = () => {
  if (!sunLeftWrap || !sunLeftTable) return;
  const rows = Array.from(sunLeftTable.querySelectorAll("tbody tr"));
  const sampleCell = sunLeftTable.querySelector("tbody td") || sunLeftTable.querySelector("thead th");
  if (!sampleCell) return;
  const font = window.getComputedStyle(sampleCell).font;
  const queryHeader = sunLeftTable.querySelector("thead .query-col")?.textContent?.trim() || "query";
  const queryValues = rows.map((tr) => tr.children[0]?.textContent?.trim() || "");
  const queryMax = Math.max(
    measureTextWidth(queryHeader, font),
    ...queryValues.map((v) => measureTextWidth(v, font))
  );
  const queryW = Math.max(150, Math.min(240, Math.ceil(queryMax + 28)));
  sunLeftWrap.style.setProperty("--sun-query-w", `${queryW}px`);
};

const autoSizeSunColumns = () => {
  if (!sunRightWrap || !sunRightTable) return;
  const cols = Array.from(sunRightTable.querySelectorAll("col.col-sun"));
  const count = cols.length;
  if (!count) return;
  const minW = 58;
  const wrapW = sunRightWrap.clientWidth;
  const minTotal = minW * count;
  if (wrapW >= minTotal) {
    const base = Math.floor(wrapW / count);
    const rem = wrapW - (base * count);
    cols.forEach((col, idx) => {
      const w = base + (idx < rem ? 1 : 0);
      col.style.width = `${w}px`;
    });
    sunRightTable.style.width = `${wrapW}px`;
    return;
  }
  cols.forEach((col) => { col.style.width = `${minW}px`; });
  sunRightTable.style.width = `${minTotal}px`;
};

const autoSizeWeatherQuery = () => {
  if (!weatherLeftWrap || !weatherLeftTable) return;
  const rows = Array.from(weatherLeftTable.querySelectorAll("tbody tr"));
  const sampleCell = weatherLeftTable.querySelector("tbody td") || weatherLeftTable.querySelector("thead th");
  if (!sampleCell) return;
  const font = window.getComputedStyle(sampleCell).font;
  const queryHeader = weatherLeftTable.querySelector("thead .query-col")?.textContent?.trim() || "query";
  const queryValues = rows.map((tr) => tr.children[0]?.textContent?.trim() || "");
  const queryMax = Math.max(
    measureTextWidth(queryHeader, font),
    ...queryValues.map((v) => measureTextWidth(v, font))
  );
  const queryW = Math.max(150, Math.min(240, Math.ceil(queryMax + 28)));
  weatherLeftWrap.style.setProperty("--weather-query-w", `${queryW}px`);
};

const autoSizeWeatherColumns = () => {
  if (!weatherRightWrap || !weatherRightTable) return;
  const cols = Array.from(weatherRightTable.querySelectorAll("col.col-weather"));
  const count = cols.length;
  if (!count) return;
  const minW = 68;
  const wrapW = weatherRightWrap.clientWidth;
  const minTotal = minW * count;
  if (wrapW >= minTotal) {
    const base = Math.floor(wrapW / count);
    const rem = wrapW - (base * count);
    cols.forEach((col, idx) => {
      const w = base + (idx < rem ? 1 : 0);
      col.style.width = `${w}px`;
    });
    weatherRightTable.style.width = `${wrapW}px`;
    return;
  }
  cols.forEach((col) => { col.style.width = `${minW}px`; });
  weatherRightTable.style.width = `${minTotal}px`;
};

const _normalizeSearch = (text) => (text || "").trim().toLowerCase();
const _isTruthyParam = (raw) => ["1", "true", "yes", "on"].includes(_normalizeSearch(raw));
const VALID_SORT_BY = new Set(["state", "name"]);
const normalizeSortBy = (raw) => {
  const normalized = _normalizeSearch(raw);
  return VALID_SORT_BY.has(normalized) ? normalized : "state";
};

const _primaryResortRows = () => {
  const pairedRows = Array.from(leftTable?.tBodies?.[0]?.rows || []);
  if (pairedRows.length > 0) return pairedRows;
  return Array.from(weatherLeftTable?.tBodies?.[0]?.rows || []);
};

const tablePairs = [
  [leftTable, rightTable],
  [leftTableMobile, rightTableMobile],
  [rainLeftTable, rainRightTable],
  [rainLeftTableMobile, rainRightTableMobile],
  [tempLeftTable, tempRightTable],
  [sunLeftTable, sunRightTable],
  [weatherLeftTable, weatherRightTable],
];

const _tagDefaultOrderForPair = (left, right) => {
  if (!left || !right) return;
  const leftRows = Array.from(left.tBodies[0]?.rows || []);
  const rightRows = Array.from(right.tBodies[0]?.rows || []);
  const count = Math.min(leftRows.length, rightRows.length);
  for (let i = 0; i < count; i += 1) {
    if (!leftRows[i].dataset.defaultOrder) leftRows[i].dataset.defaultOrder = String(i);
    if (!rightRows[i].dataset.defaultOrder) rightRows[i].dataset.defaultOrder = String(i);
  }
};

const _tagDefaultOrder = () => {
  tablePairs.forEach(([left, right]) => _tagDefaultOrderForPair(left, right));
};

const _rowQueryText = (row) => (row?.cells?.[0]?.textContent || "").trim();

const _rowSortName = (row) => {
  const query = _rowQueryText(row);
  const parts = query.split(",");
  const candidate = parts.length > 0 ? parts[0] : query;
  return _normalizeSearch(candidate);
};

const _rowSortState = (row) => {
  const state = _normalizeSearch(row?.dataset?.state || "");
  if (state) return state;
  const query = _rowQueryText(row);
  const parts = query.split(",");
  if (parts.length < 2) return "";
  return _normalizeSearch(parts[parts.length - 1]);
};

const _sortedIndices = (rows) => {
  const entries = rows.map((row, idx) => {
    const defaultOrder = Number(row.dataset.defaultOrder);
    return {
      idx,
      defaultOrder: Number.isFinite(defaultOrder) ? defaultOrder : idx,
      name: _rowSortName(row),
      state: _rowSortState(row),
    };
  });

  const byDefaultOrder = (a, b) => a.defaultOrder - b.defaultOrder;
  const byNameThenDefault = (a, b) => {
    const nameCmp = a.name.localeCompare(b.name);
    if (nameCmp !== 0) return nameCmp;
    return byDefaultOrder(a, b);
  };
  const byStateThenNameThenDefault = (a, b) => {
    const aState = a.state || "\uffff";
    const bState = b.state || "\uffff";
    const stateCmp = aState.localeCompare(bState);
    if (stateCmp !== 0) return stateCmp;
    const nameCmp = a.name.localeCompare(b.name);
    if (nameCmp !== 0) return nameCmp;
    return byDefaultOrder(a, b);
  };

  const sortBy = normalizeSortBy(filterState.sortBy);
  if (sortBy === "name") {
    entries.sort(byNameThenDefault);
  } else if (sortBy === "state") {
    entries.sort(byStateThenNameThenDefault);
  } else {
    entries.sort(byDefaultOrder);
  }
  return entries.map((entry) => entry.idx);
};

const _applySortToPair = (left, right, orderIndices) => {
  if (!left || !right) return;
  const leftBody = left.tBodies[0];
  const rightBody = right.tBodies[0];
  if (!leftBody || !rightBody) return;
  const leftRows = Array.from(leftBody.rows);
  const rightRows = Array.from(rightBody.rows);
  const count = Math.min(leftRows.length, rightRows.length);
  if (count === 0 || orderIndices.length !== count) return;

  const leftFrag = document.createDocumentFragment();
  const rightFrag = document.createDocumentFragment();
  let appended = 0;
  orderIndices.forEach((idx) => {
    if (idx < 0 || idx >= count) return;
    leftFrag.appendChild(leftRows[idx]);
    rightFrag.appendChild(rightRows[idx]);
    appended += 1;
  });
  if (appended !== count) return;
  leftBody.appendChild(leftFrag);
  rightBody.appendChild(rightFrag);
};

const applySortOrder = () => {
  const primaryRows = _primaryResortRows();
  if (!primaryRows.length) return;
  const orderIndices = _sortedIndices(primaryRows);
  tablePairs.forEach(([left, right]) => _applySortToPair(left, right, orderIndices));
};

const deriveAvailableFiltersFromRows = () => {
  const rows = _primaryResortRows();
  const passTypeCounts = {};
  const regionCounts = {};
  const countryCounts = {};

  rows.forEach((row) => {
    const passTypes = (row?.dataset?.passTypes || "")
      .split(",")
      .map((v) => _normalizeSearch(v))
      .filter((v) => v);
    const region = _normalizeSearch(row?.dataset?.region || "");
    const country = (row?.dataset?.country || "").trim().toUpperCase();
    passTypes.forEach((passType) => {
      passTypeCounts[passType] = (passTypeCounts[passType] || 0) + 1;
    });
    if (region) {
      regionCounts[region] = (regionCounts[region] || 0) + 1;
    }
    if (country) {
      countryCounts[country] = (countryCounts[country] || 0) + 1;
    }
  });

  return {
    pass_type: passTypeCounts,
    region: regionCounts,
    country: countryCounts,
  };
};

const availableFiltersForUi = () => {
  const passType = filterMetaAvailable.pass_type || {};
  const region = filterMetaAvailable.region || {};
  const country = filterMetaAvailable.country || {};
  const hasMeta = Object.keys(passType).length || Object.keys(region).length || Object.keys(country).length;
  if (hasMeta) {
    return {
      pass_type: passType,
      region,
      country,
    };
  }
  return deriveAvailableFiltersFromRows();
};

const updatePassTypeCountLabels = (passTypeCounts) => {
  document.querySelectorAll("[data-pass-count]").forEach((el) => {
    const key = _normalizeSearch(el.getAttribute("data-pass-count") || "");
    const count = Number(passTypeCounts[key] || 0);
    el.textContent = count > 0 ? `(${count})` : "";
  });
};

const updateRegionOptionLabels = (regionCounts) => {
  if (!filterRegionSelect) return;
  Array.from(filterRegionSelect.options || []).forEach((opt) => {
    const value = _normalizeSearch(opt.value || "");
    const baseLabel = opt.getAttribute("data-base-label") || opt.textContent.replace(/\s+\(\d+\)$/, "");
    opt.setAttribute("data-base-label", baseLabel);
    if (!value) {
      opt.textContent = baseLabel;
      return;
    }
    const count = Number(regionCounts[value] || 0);
    opt.textContent = count > 0 ? `${baseLabel} (${count})` : baseLabel;
  });
};

const populateCountryOptions = (countryCounts) => {
  if (!filterCountrySelect) return;
  const selected = (filterCountrySelect.value || "").trim().toUpperCase();
  filterCountrySelect.innerHTML = "";
  const allOption = document.createElement("option");
  allOption.value = "";
  allOption.textContent = "All";
  filterCountrySelect.appendChild(allOption);

  const entries = Object.entries(countryCounts || {})
    .filter(([code, count]) => /^[A-Z]{2}$/.test(code) && Number(count) > 0)
    .sort((a, b) => a[0].localeCompare(b[0]));
  entries.forEach(([code, count]) => {
    const option = document.createElement("option");
    option.value = code;
    option.textContent = `${code} (${count})`;
    filterCountrySelect.appendChild(option);
  });
  if (selected && entries.some(([code]) => code === selected)) {
    filterCountrySelect.value = selected;
  }
};

const initializeFilterControls = () => {
  const available = availableFiltersForUi();
  updatePassTypeCountLabels(available.pass_type || {});
  updateRegionOptionLabels(available.region || {});
  populateCountryOptions(available.country || {});
};

const parsePassTypeValues = (values) => {
  const out = [];
  values.forEach((raw) => {
    String(raw || "")
      .split(",")
      .map((v) => _normalizeSearch(v))
      .filter((v) => v)
      .forEach((v) => out.push(v));
  });
  return Array.from(new Set(out));
};

const filterState = {
  passTypes: new Set(),
  region: "",
  country: "",
  sortBy: "state",
  includeDefault: true,
};

const _rowPassTypeSet = (row) => {
  const raw = row?.dataset?.passTypes || "";
  return new Set(
    raw
      .split(",")
      .map((v) => _normalizeSearch(v))
      .filter((v) => v)
  );
};

const _rowSearchText = (row) => {
  const query = _normalizeSearch(row?.cells?.[0]?.textContent || "");
  const passTypes = String(row?.dataset?.passTypes || "")
    .split(",")
    .map((v) => _normalizeSearch(v))
    .filter((v) => v)
    .join(" ");
  const state = _normalizeSearch(row?.dataset?.state || "");
  return `${query} ${state} ${passTypes}`.trim();
};

const rowMatchesFilters = (row, keyword) => {
  if (keyword) {
    const searchable = _rowSearchText(row);
    if (!searchable.includes(keyword)) return false;
  }

  if (filterState.passTypes.size > 0) {
    const rowPassTypes = _rowPassTypeSet(row);
    let anyPassTypeMatch = false;
    for (const passType of filterState.passTypes) {
      if (rowPassTypes.has(passType)) {
        anyPassTypeMatch = true;
        break;
      }
    }
    if (!anyPassTypeMatch) return false;
  }

  if (filterState.region) {
    const rowRegion = _normalizeSearch(row?.dataset?.region || "");
    if (rowRegion !== filterState.region) return false;
  }
  if (filterState.country) {
    const rowCountry = (row?.dataset?.country || "").trim().toUpperCase();
    if (rowCountry !== filterState.country) return false;
  }
  return true;
};

const filterPairedTables = (left, right, keyword) => {
  if (!left || !right) return;
  const leftRows = Array.from(left.tBodies[0]?.rows || []);
  const rightRows = Array.from(right.tBodies[0]?.rows || []);
  leftRows.forEach((row, idx) => {
    const visible = rowMatchesFilters(row, keyword);
    row.style.display = visible ? "" : "none";
    if (rightRows[idx]) rightRows[idx].style.display = visible ? "" : "none";
  });
};

const syncFilterSummary = () => {
  if (!filterSummary) return;
  const rows = _primaryResortRows();
  const visible = rows.filter((row) => row.style.display !== "none").length;
  const total = rows.length;
  const scope = total > 0 ? (visible === total ? `${visible}` : `${visible}/${total}`) : "0";
  const parts = [];
  if (filterState.passTypes.size > 0) parts.push(`pass: ${Array.from(filterState.passTypes).join(", ")}`);
  if (filterState.region) parts.push(`region: ${filterState.region}`);
  if (filterState.country) parts.push(`country: ${filterState.country}`);
  if (filterState.sortBy !== "state") parts.push(`sort: ${filterState.sortBy}`);
  if (filterState.includeDefault && parts.length > 0) parts.push("scope: default");
  if (parts.length > 0) {
    filterSummary.textContent = `${parts.join(" | ")} | visible: ${scope}`;
    return;
  }
  filterSummary.textContent = filterState.includeDefault
    ? `Default resorts (${scope})`
    : `All Epic + Ikon resorts (${scope})`;
};

const applyResortSearchFilter = () => {
  const keyword = _normalizeSearch(resortSearchInput?.value || "");
  applySortOrder();
  filterPairedTables(leftTable, rightTable, keyword);
  filterPairedTables(leftTableMobile, rightTableMobile, keyword);
  filterPairedTables(rainLeftTable, rainRightTable, keyword);
  filterPairedTables(rainLeftTableMobile, rainRightTableMobile, keyword);
  filterPairedTables(tempLeftTable, tempRightTable, keyword);
  filterPairedTables(sunLeftTable, sunRightTable, keyword);
  filterPairedTables(weatherLeftTable, weatherRightTable, keyword);
  syncFilterSummary();
  applyLayout();
};

const openFilterModal = () => {
  if (!filterModal) return;
  filterModal.hidden = false;
};

const closeFilterModal = () => {
  if (!filterModal) return;
  filterModal.hidden = true;
};

const applyFilterStateFromControls = () => {
  filterState.passTypes = new Set(
    filterPassTypeInputs
      .filter((el) => el.checked)
      .map((el) => _normalizeSearch(el.value))
      .filter((v) => v)
  );
  filterState.region = _normalizeSearch(filterRegionSelect?.value || "");
  filterState.country = (filterCountrySelect?.value || "").trim().toUpperCase();
  filterState.sortBy = normalizeSortBy(filterSortSelect?.value || "state");
  filterState.includeDefault = filterIncludeAllInput ? Boolean(filterIncludeAllInput.checked) : true;
};

const applyControlsFromQueryOrMeta = () => {
  const params = new URLSearchParams(window.location.search);
  const urlPassTypes = parsePassTypeValues(params.getAll("pass_type"));
  const urlRegion = _normalizeSearch(params.get("region") || "");
  const urlCountry = (params.get("country") || "").trim().toUpperCase();
  const hasUrlSortBy = params.has("sort_by");
  const urlSortBy = normalizeSortBy(params.get("sort_by") || "");
  const urlSearch = params.get("search");
  const hasUrlIncludeDefault = params.has("include_default");
  const urlIncludeDefault = _isTruthyParam(params.get("include_default") || "");
  const hasUrlIncludeAll = params.has("include_all");
  const urlIncludeAll = _isTruthyParam(params.get("include_all") || "");

  const metaPassTypes = parsePassTypeValues(Array.isArray(filterMetaApplied.pass_type) ? filterMetaApplied.pass_type : []);
  const metaRegion = _normalizeSearch(filterMetaApplied.region || "");
  const metaCountry = String(filterMetaApplied.country || "").trim().toUpperCase();
  const metaSortBy = normalizeSortBy(filterMetaApplied.sort_by || "");
  const metaSearch = String(filterMetaApplied.search || "");
  const hasMetaIncludeDefault = Object.prototype.hasOwnProperty.call(filterMetaApplied, "include_default");
  const metaIncludeDefault = Boolean(filterMetaApplied.include_default);
  const metaIncludeAll = Boolean(filterMetaApplied.include_all);

  const passTypes = urlPassTypes.length > 0 ? urlPassTypes : metaPassTypes;
  const region = urlRegion || metaRegion;
  const country = urlCountry || metaCountry;
  const sortBy = hasUrlSortBy ? urlSortBy : metaSortBy;
  const search = urlSearch !== null ? urlSearch : metaSearch;
  const includeDefault = hasUrlIncludeDefault
    ? urlIncludeDefault
    : (hasUrlIncludeAll ? !urlIncludeAll : (hasMetaIncludeDefault ? metaIncludeDefault : !metaIncludeAll));

  filterPassTypeInputs.forEach((el) => {
    el.checked = passTypes.includes(_normalizeSearch(el.value));
  });
  if (filterRegionSelect) {
    filterRegionSelect.value = region;
  }
  if (filterCountrySelect) {
    const normalizedCountry = country.toUpperCase();
    const hasCountryOption = Array.from(filterCountrySelect.options || []).some((opt) => opt.value === normalizedCountry);
    filterCountrySelect.value = hasCountryOption ? normalizedCountry : "";
  }
  if (filterSortSelect) {
    filterSortSelect.value = sortBy;
  }
  if (filterIncludeAllInput) {
    filterIncludeAllInput.checked = includeDefault;
  }
  if (resortSearchInput && search) {
    resortSearchInput.value = search;
  }
};

const buildFilterQueryParams = () => {
  const params = new URLSearchParams();
  const existing = new URLSearchParams(window.location.search);
  existing.getAll("resort").forEach((value) => {
    if (value) params.append("resort", value);
  });

  Array.from(filterState.passTypes)
    .sort()
    .forEach((passType) => {
      params.append("pass_type", passType);
    });
  if (filterState.region) params.set("region", filterState.region);
  if (filterState.country) params.set("country", filterState.country);
  if (filterState.sortBy !== "state") params.set("sort_by", filterState.sortBy);
  params.set("include_default", filterState.includeDefault ? "1" : "0");
  const keyword = (resortSearchInput?.value || "").trim();
  if (keyword) params.set("search", keyword);
  return params;
};

const syncUrlAndReloadIfNeeded = () => {
  const nextParams = buildFilterQueryParams();
  const currentUrl = new URL(window.location.href);
  const currentQuery = currentUrl.search.replace(/^\?/, "");
  const nextQuery = nextParams.toString();
  if (currentQuery === nextQuery) return false;
  currentUrl.search = nextQuery;
  window.location.assign(currentUrl.toString());
  return true;
};

const resetFilterControls = () => {
  filterPassTypeInputs.forEach((el) => {
    el.checked = false;
  });
  if (filterRegionSelect) filterRegionSelect.value = "";
  if (filterCountrySelect) filterCountrySelect.value = "";
  if (filterSortSelect) filterSortSelect.value = "state";
  if (filterIncludeAllInput) filterIncludeAllInput.checked = true;
};

attachVerticalSync(leftWrap, rightWrap);
attachVerticalSync(leftWrapMobile, rightWrapMobile);
attachVerticalSync(rainLeftWrap, rainRightWrap);
attachVerticalSync(rainLeftWrapMobile, rainRightWrapMobile);
attachVerticalSync(tempLeftWrap, tempRightWrap);
attachVerticalSync(sunLeftWrap, sunRightWrap);
attachVerticalSync(weatherLeftWrap, weatherRightWrap);

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

let sunLayoutRaf = 0;
const scheduleSunLayout = () => {
  if (sunLayoutRaf) cancelAnimationFrame(sunLayoutRaf);
  sunLayoutRaf = requestAnimationFrame(() => {
    autoSizeSunQuery();
    autoSizeSunColumns();
    syncTableRowHeights(sunLeftTable, sunRightTable);
    syncStickySecondRowTop(sunLeftTable, sunRightTable, sunSplitWrap, "--sun-header-row1-h");
  });
};

let weatherLayoutRaf = 0;
const scheduleWeatherLayout = () => {
  if (weatherLayoutRaf) cancelAnimationFrame(weatherLayoutRaf);
  weatherLayoutRaf = requestAnimationFrame(() => {
    autoSizeWeatherQuery();
    autoSizeWeatherColumns();
    syncTableRowHeights(weatherLeftTable, weatherRightTable);
    syncStickySecondRowTop(weatherLeftTable, weatherRightTable, weatherSplitWrap, "--weather-header-row1-h");
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
  scheduleSunLayout();
  scheduleWeatherLayout();
};

const UNIT_STORAGE_KEY_PREFIX = "closesnow_unit_mode_";
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
    cell.classList.remove("unit-changing");
    // Restart CSS animation when the same class is applied repeatedly.
    void cell.offsetWidth; // eslint-disable-line no-unused-expressions
    cell.classList.add("unit-changing");
  });
};

const syncToggleButtons = (kind, mode) => {
  const kindToggles = Array.from(document.querySelectorAll(`.unit-toggle[data-target-kind="${kind}"]`));
  kindToggles.forEach((toggle) => {
    toggle.setAttribute("data-mode", mode);
  });
  const kindButtons = Array.from(
    document.querySelectorAll(`.unit-toggle[data-target-kind="${kind}"] .unit-btn[data-unit-mode]`)
  );
  kindButtons.forEach((btn) => {
    btn.classList.toggle("is-active", btn.getAttribute("data-unit-mode") === mode);
  });
};

const getCurrentUnitMode = (kind) => {
  const activeBtn = document.querySelector(
    `.unit-toggle[data-target-kind="${kind}"] .unit-btn.is-active`
  );
  const activeMode = activeBtn?.getAttribute("data-unit-mode");
  return activeMode === "imperial" ? "imperial" : "metric";
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
      const current = getCurrentUnitMode(kind);
      const next = current === "metric" ? "imperial" : "metric";
      setUnitMode(kind, next);
    });
  });
  if (!initializedKinds.has(kind)) {
    setUnitMode(kind, getStoredUnitMode(kind), false, false);
    initializedKinds.add(kind);
  }
});

initializeFilterControls();
_tagDefaultOrder();
applyControlsFromQueryOrMeta();
if (resortSearchInput) {
  resortSearchInput.addEventListener("input", applyResortSearchFilter);
  resortSearchInput.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    applyFilterStateFromControls();
    syncUrlAndReloadIfNeeded();
  });
}
if (resortSearchClear && resortSearchInput) {
  resortSearchClear.addEventListener("click", () => {
    resortSearchInput.value = "";
    applyResortSearchFilter();
    resortSearchInput.focus();
  });
}
if (filterOpenBtn) {
  filterOpenBtn.addEventListener("click", openFilterModal);
}
if (filterCloseBtn) {
  filterCloseBtn.addEventListener("click", closeFilterModal);
}
if (filterApplyBtn) {
  filterApplyBtn.addEventListener("click", () => {
    applyFilterStateFromControls();
    if (syncUrlAndReloadIfNeeded()) return;
    closeFilterModal();
    applyResortSearchFilter();
  });
}
if (filterResetBtn) {
  filterResetBtn.addEventListener("click", () => {
    resetFilterControls();
    if (resortSearchInput) resortSearchInput.value = "";
    applyFilterStateFromControls();
    if (syncUrlAndReloadIfNeeded()) return;
    closeFilterModal();
    applyResortSearchFilter();
  });
}
if (filterModal) {
  filterModal.addEventListener("click", (event) => {
    if (event.target === filterModal) closeFilterModal();
  });
}
document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  if (!filterModal || filterModal.hidden) return;
  closeFilterModal();
});
applyLayout();
applyFilterStateFromControls();
applyResortSearchFilter();
requestAnimationFrame(() => {
  document.body.classList.remove("units-pending");
});
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
  if (sunLeftWrap) ro.observe(sunLeftWrap);
  if (sunRightWrap) ro.observe(sunRightWrap);
  if (weatherLeftWrap) ro.observe(weatherLeftWrap);
  if (weatherRightWrap) ro.observe(weatherRightWrap);
}
