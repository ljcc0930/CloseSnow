    const leftWrap = document.getElementById("snowfall-left-wrap");
    const rightWrap = document.getElementById("snowfall-right-wrap");
    const leftTable = leftWrap ? leftWrap.querySelector(".snowfall-left-table") : null;
    const rightTable = rightWrap ? rightWrap.querySelector(".snowfall-right-table") : null;
    const tempLeftWrap = document.getElementById("temperature-left-wrap");
    const tempRightWrap = document.getElementById("temperature-right-wrap");
    const tempLeftTable = tempLeftWrap ? tempLeftWrap.querySelector(".temperature-left-table") : null;
    const tempRightTable = tempRightWrap ? tempRightWrap.querySelector(".temperature-right-table") : null;
    const rainLeftWrap = document.getElementById("rain-left-wrap");
    const rainRightWrap = document.getElementById("rain-right-wrap");
    const rainLeftTable = rainLeftWrap ? rainLeftWrap.querySelector(".rain-left-table") : null;
    const rainRightTable = rainRightWrap ? rainRightWrap.querySelector(".rain-right-table") : null;
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
        const utcText = utcDate.toISOString().replace("T", " ").replace(".000Z", " UTC").replace("Z", " UTC");
        reportDateEl.textContent = `Generated At (Local): ${localText} (${tz}) | UTC: ${utcText}`;
      }
    }
    const MIN_QUERY_COL_PX = 220;
    const MIN_WEEK_COL_PX = 110;
    const MIN_DAY_COL_PX = 66;
    const MAIN_HORIZONTAL_PADDING_PX = 40; // main has 20px left + 20px right on desktop
    const TABLE_BORDER_BUFFER_PX = 8; // borders/dividers/safety margin
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
    const autoSizeLeftColumns = () => {
      if (isCompactLayout()) return;
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
    const autoSizeDayColumns = () => {
      if (isCompactLayout()) return;
      if (!rightWrap || !rightTable) return;
      const dayCols = Array.from(rightTable.querySelectorAll("col.col-day"));
      const dayCount = dayCols.length;
      if (!dayCount) return;

      const minDayWidth = 66;
      const wrapWidth = rightWrap.clientWidth;
      const minTotal = minDayWidth * dayCount;

      // If there is enough space, distribute every remaining pixel across columns
      // so table width equals wrapper width exactly and no gap remains.
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
    const autoSizeRainQuery = () => {
      if (isCompactLayout()) return;
      if (!rainLeftWrap || !rainLeftTable) return;
      const rows = Array.from(rainLeftTable.querySelectorAll("tbody tr"));
      const sampleCell = rainLeftTable.querySelector("tbody td") || rainLeftTable.querySelector("thead th");
      if (!sampleCell) return;
      const font = window.getComputedStyle(sampleCell).font;
      const queryHeader = rainLeftTable.querySelector("thead .query-col")?.textContent?.trim() || "query";
      const values = rows.map((tr) => tr.children[0]?.textContent?.trim() || "");
      const maxW = Math.max(
        measureTextWidth(queryHeader, font),
        ...values.map((v) => measureTextWidth(v, font))
      );
      const queryW = Math.max(150, Math.min(240, Math.ceil(maxW + 28)));
      rainLeftWrap.style.setProperty("--rain-query-w", `${queryW}px`);
    };
    const autoSizeRainColumns = () => {
      if (isCompactLayout()) return;
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
    const autoSizeTempQuery = () => {
      if (isCompactLayout()) return;
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
      if (isCompactLayout()) return;
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
    const syncTableRowHeights = (lt, rt) => {
      if (!lt || !rt) return;
      const lHeadRows = Array.from(lt.tHead?.rows || []);
      const rHeadRows = Array.from(rt.tHead?.rows || []);
      const hlen = Math.min(lHeadRows.length, rHeadRows.length);
      for (let i = 0; i < hlen; i += 1) {
        lHeadRows[i].style.height = "";
        rHeadRows[i].style.height = "";
        const h = Math.max(lHeadRows[i].getBoundingClientRect().height, rHeadRows[i].getBoundingClientRect().height);
        lHeadRows[i].style.height = `${h}px`;
        rHeadRows[i].style.height = `${h}px`;
      }
      const lRows = Array.from(lt.tBodies[0]?.rows || []);
      const rRows = Array.from(rt.tBodies[0]?.rows || []);
      const len = Math.min(lRows.length, rRows.length);
      for (let i = 0; i < len; i += 1) {
        lRows[i].style.height = "";
        rRows[i].style.height = "";
        const h = Math.max(lRows[i].getBoundingClientRect().height, rRows[i].getBoundingClientRect().height);
        lRows[i].style.height = `${h}px`;
        rRows[i].style.height = `${h}px`;
      }
    };
    if (leftWrap && rightWrap) {
      let syncing = false;
      const sync = (src, dst) => {
        if (isCompactLayout()) return;
        if (syncing) return;
        syncing = true;
        dst.scrollTop = src.scrollTop;
        requestAnimationFrame(() => { syncing = false; });
      };
      leftWrap.addEventListener("scroll", () => sync(leftWrap, rightWrap), { passive: true });
      rightWrap.addEventListener("scroll", () => sync(rightWrap, leftWrap), { passive: true });
    }
    if (rainLeftWrap && rainRightWrap) {
      rainRightWrap.addEventListener("scroll", () => {
        if (isCompactLayout()) return;
        rainLeftWrap.scrollTop = rainRightWrap.scrollTop;
      }, { passive: true });
    }
    if (tempLeftWrap && tempRightWrap) {
      tempRightWrap.addEventListener("scroll", () => {
        if (isCompactLayout()) return;
        tempLeftWrap.scrollTop = tempRightWrap.scrollTop;
      }, { passive: true });
    }
    let tempLayoutRaf = 0;
    const scheduleTempLayout = () => {
      if (isCompactLayout()) return;
      if (tempLayoutRaf) cancelAnimationFrame(tempLayoutRaf);
      tempLayoutRaf = requestAnimationFrame(() => {
        autoSizeTempQuery();
        autoSizeTempColumns();
        syncTableRowHeights(tempLeftTable, tempRightTable);
      });
    };
    const applyDesktopLayout = () => {
      autoSizeLeftColumns();
      autoSizeDayColumns();
      autoSizeRainQuery();
      autoSizeRainColumns();
      scheduleTempLayout();
    };
    const refreshLayout = () => {
      updateLayoutMode();
      if (isCompactLayout()) return;
      applyDesktopLayout();
    };
    refreshLayout();
    window.addEventListener("resize", () => {
      refreshLayout();
    }, { passive: true });
    if (window.ResizeObserver && tempLeftWrap && tempRightWrap) {
      const ro = new ResizeObserver(() => refreshLayout());
      ro.observe(tempLeftWrap);
      ro.observe(tempRightWrap);
      if (tempLeftTable) ro.observe(tempLeftTable);
      if (tempRightTable) ro.observe(tempRightTable);
    }
  
