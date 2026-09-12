// Responsive table measurements and observer lifecycle are isolated from page controls.
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.CloseSnowWeatherTableLayout = api;
}(typeof window !== "undefined" ? window : null, function () {
  "use strict";
  const createController = ({ state, window, document, contentRoot, stickySingleTableLayout = {} }) => {
    const COMPACT_BREAKPOINT_PX = 554;
    const LEADING_FAVORITE_COL_PX = 28;
    const scope = contentRoot || document;
    const measureTextWidth = (text, font) => {
      const cache = measureTextWidth.cache || (measureTextWidth.cache = new Map());
      const cacheKey = `${font}\u0000${text || ""}`;
      if (cache.has(cacheKey)) return cache.get(cacheKey);
      const canvas = measureTextWidth.canvas || (measureTextWidth.canvas = document.createElement("canvas"));
      const context = canvas.getContext("2d");
      context.font = font;
      const width = context.measureText(text || "").width;
      cache.set(cacheKey, width);
      if (cache.size > 4000) cache.clear();
      return width;
    };

    const getLayoutModeForWidth = (width = window.innerWidth) => (width < COMPACT_BREAKPOINT_PX ? "compact" : "desktop");

    const updateLayoutMode = () => {
      const layoutMode = getLayoutModeForWidth();
      state.layoutMode = layoutMode;
      document.body.classList.toggle("mobile-simple", layoutMode === "compact");
      return layoutMode;
    };

    const isCompactLayout = () => state.layoutMode === "compact";

    const _mobileLeadingQueryCap = (offset = LEADING_FAVORITE_COL_PX) => {
      const viewportWidth = Math.max(
        document.documentElement?.clientWidth || 0,
        window.innerWidth || 0,
      );
      return Math.max(0, Math.floor((viewportWidth / 2) - Math.max(0, offset)));
    };

    const _mobileHalfScreenCap = () => _mobileLeadingQueryCap(0);

    const _stickySingleTableWidthContext = ({
      wrapSelector,
      queryVarName,
      leadingWidth = LEADING_FAVORITE_COL_PX,
    }) => {
      const wrap = scope.querySelector(wrapSelector);
      if (!wrap) return { availableWidth: 0, reservedWidth: leadingWidth };
      const queryWidth = parseFloat(window.getComputedStyle(wrap).getPropertyValue(queryVarName)) || 0;
      const reservedWidth = leadingWidth + queryWidth;
      return {
        availableWidth: Math.max(0, wrap.clientWidth - reservedWidth),
        reservedWidth,
      };
    };

    const _compactMobileDailyWidthContext = () => {
      return _stickySingleTableWidthContext({
        wrapSelector: ".compact-grid-mobile-wrap",
        queryVarName: "--compact-mobile-query-w",
      });
    };

    const _resolveQueryColumnBounds = ({
      minWidth,
      maxWidth,
      capToMobileHalfScreen = false,
      mobileCapOffset = LEADING_FAVORITE_COL_PX,
    }) => {
      let resolvedMax = maxWidth;
      if (capToMobileHalfScreen && isCompactLayout()) {
        resolvedMax = Math.min(resolvedMax, _mobileLeadingQueryCap(mobileCapOffset));
      }
      return {
        minWidth: Math.min(minWidth, resolvedMax),
        maxWidth: resolvedMax,
      };
    };

    const _autoSizeQueryOnly = ({
      tableSelector,
      wrapSelector,
      queryVarName,
      minWidth = 150,
      maxWidth = 240,
      padding = 28,
      capToMobileHalfScreen = false,
      mobileCapOffset = LEADING_FAVORITE_COL_PX,
    }) => {
      const table = scope.querySelector(tableSelector);
      const wrap = scope.querySelector(wrapSelector);
      if (!table || !wrap) return;
      const rows = Array.from(table.querySelectorAll("tbody tr"));
      const header = table.querySelector("thead .query-col") || table.querySelector("thead th");
      const sampleCell = table.querySelector("tbody td") || header;
      if (!sampleCell || !header) return;
      const font = window.getComputedStyle(sampleCell).font;
      const queryIndex = header && header.cellIndex >= 0 ? header.cellIndex : 0;
      const values = rows.map((row) => row.children[queryIndex]?.textContent?.trim() || "");
      const headerText = header.textContent?.trim() || "query";
      const queryMax = Math.max(
        measureTextWidth(headerText, font),
        ...values.map((value) => measureTextWidth(value, font)),
      );
      const bounds = _resolveQueryColumnBounds({ minWidth, maxWidth, capToMobileHalfScreen, mobileCapOffset });
      wrap.style.setProperty(
        queryVarName,
        `${Math.max(bounds.minWidth, Math.min(bounds.maxWidth, Math.ceil(queryMax + padding)))}px`,
      );
    };

    const _stretchColumnsToWrap = ({
      wrapSelector,
      tableSelector,
      colSelector,
      minWidth,
      maxWidth = Number.POSITIVE_INFINITY,
      availableWidth = null,
      tableWidthOffset = 0,
    }) => {
      const wrap = scope.querySelector(wrapSelector);
      const table = scope.querySelector(tableSelector);
      if (!wrap || !table) return;
      const cols = Array.from(table.querySelectorAll(colSelector));
      const count = cols.length;
      if (!count) return;

      const effectiveMinWidth = Math.min(minWidth, maxWidth);
      const stretchWidth = Math.max(0, availableWidth === null ? wrap.clientWidth : availableWidth);
      const minTotal = effectiveMinWidth * count;
      if (stretchWidth >= minTotal) {
        const base = Math.floor(stretchWidth / count);
        const remainder = stretchWidth - (base * count);
        let totalWidth = 0;
        cols.forEach((col, index) => {
          const width = Math.max(effectiveMinWidth, Math.min(maxWidth, base + (index < remainder ? 1 : 0)));
          col.style.width = `${width}px`;
          totalWidth += width;
        });
        table.style.width = `${totalWidth + tableWidthOffset}px`;
        return;
      }

      cols.forEach((col) => {
        col.style.width = `${effectiveMinWidth}px`;
      });
      table.style.width = `${minTotal + tableWidthOffset}px`;
    };

    const sizeForecastTables = () => {
      _autoSizeQueryOnly({
        tableSelector: ".compact-grid-mobile-table",
        wrapSelector: ".compact-grid-mobile-wrap",
        queryVarName: "--compact-mobile-query-w",
        minWidth: isCompactLayout() ? 120 : 150,
        maxWidth: isCompactLayout() ? 180 : 240,
        padding: isCompactLayout() ? 22 : 28,
        capToMobileHalfScreen: isCompactLayout(),
      });
      _autoSizeQueryOnly({
        tableSelector: ".temperature-sticky-wrap .temperature-single-table",
        wrapSelector: ".temperature-sticky-wrap",
        queryVarName: "--temp-query-w",
        minWidth: 150,
        maxWidth: 220,
        capToMobileHalfScreen: isCompactLayout(),
      });
      _autoSizeQueryOnly({
        tableSelector: ".weather-table-wrap .weather-table",
        wrapSelector: ".weather-table-wrap",
        queryVarName: "--weather-query-w",
        minWidth: 150,
        maxWidth: 220,
        capToMobileHalfScreen: isCompactLayout(),
      });
      if (isCompactLayout()) {
        const mobileColumnMax = _mobileHalfScreenCap();
        const compactMobileDailyContext = _compactMobileDailyWidthContext();
        const temperatureContext = _stickySingleTableWidthContext({
          wrapSelector: ".temperature-sticky-wrap",
          queryVarName: "--temp-query-w",
        });
        const weatherContext = _stickySingleTableWidthContext({
          wrapSelector: ".weather-table-wrap",
          queryVarName: "--weather-query-w",
        });
        const sunContext = _stickySingleTableWidthContext({
          wrapSelector: ".sun-single-wrap",
          queryVarName: "--sun-query-w",
        });
        _stretchColumnsToWrap({
          wrapSelector: ".compact-grid-mobile-wrap",
          tableSelector: ".compact-grid-mobile-table",
          colSelector: "col.col-compact-day",
          minWidth: 98,
          maxWidth: mobileColumnMax,
          availableWidth: compactMobileDailyContext.availableWidth,
          tableWidthOffset: compactMobileDailyContext.reservedWidth,
        });
        _autoSizeQueryOnly({
          tableSelector: ".snowfall-sticky-wrap.mobile-only .snowfall-sticky-table",
          wrapSelector: ".snowfall-sticky-wrap.mobile-only",
          queryVarName: "--snowfall-query-w",
          minWidth: 150,
          maxWidth: 220,
          padding: 38,
          capToMobileHalfScreen: true,
          mobileCapOffset: 0,
        });
        _stretchColumnsToWrap({
          wrapSelector: ".temperature-sticky-wrap",
          tableSelector: ".temperature-single-table",
          colSelector: "col.col-temp",
          minWidth: 50,
          maxWidth: mobileColumnMax,
          availableWidth: temperatureContext.availableWidth,
          tableWidthOffset: temperatureContext.reservedWidth,
        });
        _autoSizeQueryOnly({
          tableSelector: ".rain-sticky-wrap.mobile-only .rain-sticky-table",
          wrapSelector: ".rain-sticky-wrap.mobile-only",
          queryVarName: "--rain-query-w",
          minWidth: 150,
          maxWidth: 220,
          padding: 38,
          capToMobileHalfScreen: true,
          mobileCapOffset: 0,
        });
        _stretchColumnsToWrap({
          wrapSelector: ".weather-table-wrap",
          tableSelector: ".weather-table",
          colSelector: "col.col-weather",
          minWidth: 68,
          maxWidth: mobileColumnMax,
          availableWidth: weatherContext.availableWidth,
          tableWidthOffset: weatherContext.reservedWidth,
        });
        _autoSizeQueryOnly({
          tableSelector: ".sun-single-wrap .sun-single-table",
          wrapSelector: ".sun-single-wrap",
          queryVarName: "--sun-query-w",
          minWidth: 150,
          maxWidth: 220,
          capToMobileHalfScreen: true,
        });
        _stretchColumnsToWrap({
          wrapSelector: ".sun-single-wrap",
          tableSelector: ".sun-single-table",
          colSelector: "col.col-sun",
          minWidth: 58,
          maxWidth: mobileColumnMax,
          availableWidth: sunContext.availableWidth,
          tableWidthOffset: sunContext.reservedWidth,
        });
        return;
      }
      _autoSizeQueryOnly({
        tableSelector: ".snowfall-sticky-wrap.desktop-only .snowfall-sticky-table",
        wrapSelector: ".snowfall-sticky-wrap.desktop-only",
        queryVarName: "--snowfall-query-w",
      });
      _autoSizeQueryOnly({
        tableSelector: ".rain-sticky-wrap.desktop-only .rain-sticky-table",
        wrapSelector: ".rain-sticky-wrap.desktop-only",
        queryVarName: "--rain-query-w",
      });
      _autoSizeQueryOnly({
        tableSelector: ".sun-single-wrap .sun-single-table",
        wrapSelector: ".sun-single-wrap",
        queryVarName: "--sun-query-w",
      });
      _stretchColumnsToWrap({
        wrapSelector: ".sun-single-wrap",
        tableSelector: ".sun-single-table",
        colSelector: "col.col-sun",
        minWidth: 58,
      });
    };

    let layoutFrame = 0;
    let layoutObserver = null;

    const applyLayout = () => {
      if (layoutFrame) window.cancelAnimationFrame(layoutFrame);
      layoutFrame = window.requestAnimationFrame(() => {
        layoutFrame = 0;
        updateLayoutMode();
        sizeForecastTables();
        if (typeof stickySingleTableLayout.applyFromDom === "function") {
          stickySingleTableLayout.applyFromDom({ root: scope });
        }
      });
    };

    const observeLayoutContainers = () => {
      if (!window.ResizeObserver) return;
      if (layoutObserver) layoutObserver.disconnect();
      layoutObserver = new window.ResizeObserver(() => applyLayout());
      const observed = new Set();
      [
        ".snowfall-sticky-wrap.desktop-only",
        ".snowfall-sticky-wrap.mobile-only",
        ".rain-sticky-wrap.desktop-only",
        ".rain-sticky-wrap.mobile-only",
        ".compact-grid-mobile-wrap",
        ".temperature-sticky-wrap",
        ".weather-table-wrap",
        ".sun-single-wrap",
      ].forEach((selector) => {
        const element = scope.querySelector(selector);
        if (!element || observed.has(element)) return;
        layoutObserver.observe(element);
        observed.add(element);
      });
      scope.querySelectorAll("[data-sticky-single-table-section]").forEach((element) => {
        if (observed.has(element)) return;
        layoutObserver.observe(element);
        observed.add(element);
      });
    };

    return { getLayoutModeForWidth, updateLayoutMode, applyLayout, observeLayoutContainers };
  };
  return { createController };
}));
