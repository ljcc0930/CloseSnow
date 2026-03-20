(function () {
  const STICKY_VIEWPORT_ROW_CAP = 10;

  const _asPositiveInt = (value, fallback) => {
    const parsed = Number.parseInt(String(value ?? ""), 10);
    if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
    return parsed;
  };

  const _headerRows = (table, requestedRows) => {
    const rows = Array.from(table.tHead?.rows || []);
    const maxRows = rows.length > 0 ? Math.min(2, rows.length) : 1;
    return Math.max(1, Math.min(_asPositiveInt(requestedRows, 1), maxRows));
  };

  const _leadingStickyColumns = (table, requestedColumns) => {
    const headRows = Array.from(table.tHead?.rows || []);
    const lastHeadRow = headRows[headRows.length - 1];
    const bodyRow = table.tBodies[0]?.rows?.[0];
    const maxColumns = bodyRow?.cells?.length || lastHeadRow?.cells?.length || 0;
    if (maxColumns <= 0) return 0;
    return Math.max(0, Math.min(_asPositiveInt(requestedColumns, 0), maxColumns));
  };

  const _clearStickyLeadingCells = (table) => {
    table.querySelectorAll(".sticky-leading-cell").forEach((cell) => {
      cell.classList.remove("sticky-leading-cell");
      cell.style.removeProperty("--sticky-leading-left");
      cell.style.removeProperty("left");
      cell.style.removeProperty("z-index");
    });
  };

  const _applyStickyHeaders = (table, requestedRows) => {
    const headerRows = _headerRows(table, requestedRows);
    table.dataset.stickyHeaderRows = String(headerRows);
    table.style.removeProperty("--sticky-header-row-2-top");
    if (headerRows < 2) return;

    const firstRow = table.tHead?.rows?.[0];
    const firstHeight = firstRow?.getBoundingClientRect?.().height || firstRow?.offsetHeight || 0;
    if (firstHeight > 0) {
      table.style.setProperty("--sticky-header-row-2-top", `${Math.ceil(firstHeight)}px`);
    }
  };

  const _rowCellMapsByVisualColumn = (rows) => {
    const pendingRowspans = [];
    return rows.map((row) => {
      const visualCells = [];
      let visualCol = 0;
      Array.from(row.cells || []).forEach((cell) => {
        while ((pendingRowspans[visualCol] || 0) > 0) {
          visualCol += 1;
        }
        const colSpan = Math.max(1, Number.parseInt(String(cell.colSpan || 1), 10) || 1);
        const rowSpan = Math.max(1, Number.parseInt(String(cell.rowSpan || 1), 10) || 1);
        for (let spanOffset = 0; spanOffset < colSpan; spanOffset += 1) {
          const targetCol = visualCol + spanOffset;
          visualCells[targetCol] = cell;
          if (rowSpan > 1) pendingRowspans[targetCol] = rowSpan;
        }
        visualCol += colSpan;
      });
      for (let col = 0; col < pendingRowspans.length; col += 1) {
        if ((pendingRowspans[col] || 0) > 0) {
          pendingRowspans[col] -= 1;
        }
      }
      return visualCells;
    });
  };

  const _stickyColumnWidth = (rowCellMaps, columnIndex) => {
    const exactCell = rowCellMaps
      .map((visualCells) => visualCells[columnIndex])
      .find((cell) => cell && Math.max(1, Number.parseInt(String(cell.colSpan || 1), 10) || 1) === 1);
    if (exactCell) {
      return exactCell.getBoundingClientRect?.().width || exactCell.offsetWidth || 0;
    }

    const spanningCell = rowCellMaps
      .map((visualCells) => visualCells[columnIndex])
      .find(Boolean);
    if (!spanningCell) return 0;

    const span = Math.max(1, Number.parseInt(String(spanningCell.colSpan || 1), 10) || 1);
    const totalWidth = spanningCell.getBoundingClientRect?.().width || spanningCell.offsetWidth || 0;
    return totalWidth / span;
  };

  const _applyStickyLeadingColumns = (table, requestedColumns) => {
    _clearStickyLeadingCells(table);

    const leadingColumns = _leadingStickyColumns(table, requestedColumns);
    table.dataset.stickyLeadingCols = String(leadingColumns);
    if (leadingColumns <= 0) return;

    const headRows = Array.from(table.tHead?.rows || []);
    const bodyRows = Array.from(table.tBodies[0]?.rows || []);
    const allRows = headRows.concat(bodyRows);
    if (allRows.length <= 0) return;
    const rowCellMaps = _rowCellMapsByVisualColumn(allRows);
    const positionedCells = new WeakSet();
    let runningLeft = 0;
    for (let colIndex = 0; colIndex < leadingColumns; colIndex += 1) {
      const width = _stickyColumnWidth(rowCellMaps, colIndex);
      allRows.forEach((row, rowIndex) => {
        const cell = rowCellMaps[rowIndex]?.[colIndex];
        if (!cell || positionedCells.has(cell)) return;
        positionedCells.add(cell);
        cell.classList.add("sticky-leading-cell");
        cell.style.setProperty("--sticky-leading-left", `${runningLeft}px`);
        cell.style.left = `${runningLeft}px`;
        const baseLayer = row.parentElement?.tagName === "THEAD" ? 8 : 6;
        cell.style.zIndex = String(baseLayer + Math.max(0, leadingColumns - colIndex));
      });
      runningLeft += Math.ceil(width);
    }
  };

  const _applyViewportCap = (wrap, table, requestedRows) => {
    wrap.style.removeProperty("max-height");
    const bodyRows = Array.from(table.tBodies[0]?.rows || []);
    if (bodyRows.length <= 0) return;

    const configuredRows = _asPositiveInt(requestedRows, STICKY_VIEWPORT_ROW_CAP);
    const visibleRows = Math.min(configuredRows, STICKY_VIEWPORT_ROW_CAP, bodyRows.length);
    const headRows = Array.from(table.tHead?.rows || []);
    const headerHeight = headRows.reduce((sum, row) => sum + (row.getBoundingClientRect?.().height || row.offsetHeight || 0), 0);
    const bodyHeight = bodyRows.slice(0, visibleRows)
      .reduce((sum, row) => sum + (row.getBoundingClientRect?.().height || row.offsetHeight || 0), 0);
    const total = Math.ceil(headerHeight + bodyHeight);
    if (total > 0) {
      wrap.style.maxHeight = `${total}px`;
    }
  };

  const _sectionContracts = (root) => Array.from(root.querySelectorAll("[data-sticky-single-table-section]"))
    .map((wrap) => {
      const table = wrap.querySelector("table");
      if (!table) return null;
      return {
        wrap,
        table,
        leadingStickyColumns: wrap.dataset.stickyLeadingCols,
        stickyHeaderRows: wrap.dataset.stickyHeaderRows,
        maxVisibleRows: wrap.dataset.stickyMaxVisibleRows,
      };
    })
    .filter(Boolean);

  const applyFromDom = ({ root = document } = {}) => {
    const contracts = _sectionContracts(root);
    contracts.forEach(({ wrap, table, leadingStickyColumns, stickyHeaderRows, maxVisibleRows }) => {
      wrap.classList.add("sticky-single-table-wrap");
      table.classList.add("sticky-single-table");
      _applyStickyHeaders(table, stickyHeaderRows);
      _applyStickyLeadingColumns(table, leadingStickyColumns);
      _applyViewportCap(wrap, table, maxVisibleRows);
    });
    return contracts.length;
  };

  window.CloseSnowStickySingleTableLayout = {
    STICKY_VIEWPORT_ROW_CAP,
    applyFromDom,
  };
}());
