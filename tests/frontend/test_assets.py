from __future__ import annotations

from src.web.weather_page_assets import ASSET_MIME_TYPES, asset_path, read_asset_bytes


def test_asset_path_points_to_repo_assets():
    css_path = asset_path("assets/css/weather_page.css")
    compact_js_path = asset_path("assets/js/compact_daily_summary.js")
    js_path = asset_path("assets/js/weather_page.js")
    hourly_css_path = asset_path("assets/css/resort_hourly.css")
    hourly_js_path = asset_path("assets/js/resort_hourly.js")
    assert str(css_path).endswith("assets/css/weather_page.css")
    assert str(compact_js_path).endswith("assets/js/compact_daily_summary.js")
    assert str(js_path).endswith("assets/js/weather_page.js")
    assert str(hourly_css_path).endswith("assets/css/resort_hourly.css")
    assert str(hourly_js_path).endswith("assets/js/resort_hourly.js")


def test_read_asset_bytes_reads_known_assets():
    css = read_asset_bytes("assets/css/weather_page.css")
    compact_js = read_asset_bytes("assets/js/compact_daily_summary.js")
    js = read_asset_bytes("assets/js/weather_page.js")
    hourly_css = read_asset_bytes("assets/css/resort_hourly.css")
    hourly_js = read_asset_bytes("assets/js/resort_hourly.js")
    assert len(css) > 100
    assert len(compact_js) > 100
    assert len(js) > 100
    assert len(hourly_css) > 100
    assert len(hourly_js) > 100
    assert ASSET_MIME_TYPES["assets/css/weather_page.css"].startswith("text/css")
    assert ASSET_MIME_TYPES["assets/js/compact_daily_summary.js"].startswith("application/javascript")
    assert ASSET_MIME_TYPES["assets/js/weather_page.js"].startswith("application/javascript")
    assert ASSET_MIME_TYPES["assets/css/resort_hourly.css"].startswith("text/css")
    assert ASSET_MIME_TYPES["assets/js/resort_hourly.js"].startswith("application/javascript")
    css_text = css.decode("utf-8", errors="ignore")
    compact_js_text = compact_js.decode("utf-8", errors="ignore")
    hourly_css_text = hourly_css.decode("utf-8", errors="ignore")
    hourly_js_text = hourly_js.decode("utf-8", errors="ignore")
    js_text = js.decode("utf-8", errors="ignore")
    assert ".weather-left-table .query-col" in css_text
    assert ".hourly-charts" in hourly_css_text
    assert ".resort-local-time" in hourly_css_text
    assert "window.CloseSnowCompactDailySummary" in compact_js_text
    assert "renderSingleResortHtml" in compact_js_text
    assert "compact-day-card" in compact_js_text
    assert 'const _normalizeUnitMode = (value) => (value === "imperial" ? "imperial" : "metric");' in compact_js_text
    assert "const _formatCompactSnowValue = (value, unitMode) => {" in compact_js_text
    assert "const _formatCompactRainValue = (value, unitMode) => {" in compact_js_text
    assert 'data-compact-unit-kind="' in compact_js_text
    assert 'data-compact-metric-value="' in compact_js_text
    assert "renderHourlyCharts" in hourly_js_text
    assert "renderDailySummary();" in hourly_js_text
    assert "dailySummary" in hourly_js_text
    assert "resolved_latitude" in hourly_js_text
    assert "const formatResortLocalTime = (timeZone) => {" in hourly_js_text
    assert 'second: "2-digit"' in hourly_js_text
    assert 'timeZoneName: "short"' in hourly_js_text
    assert 'const localTimeEl = document.getElementById("resort-local-time");' in hourly_js_text
    assert 'localTimeEl.textContent = localTime ? `Local time: ${localTime}` : "";' in hourly_js_text
    assert "localTimeTimerId = window.setInterval(renderLocalTime, 1000);" in hourly_js_text
    assert "history.replaceState" not in js_text
    assert "window.location.assign(currentUrl.toString())" not in js_text
    assert "window.CLOSESNOW_PAGE_BOOTSTRAP" in js_text
    assert "const _resolveBootstrapUrl = (rawUrl) => {" in js_text
    assert "const _resolvedDataUrl = () => _resolveBootstrapUrl(pageBootstrap.dataUrl);" in js_text
    assert "const _isDynamicApiDataUrl = () => {" in js_text
    assert "const buildServerQueryParams = () => {" in js_text
    assert "const reloadDynamicPayloadForFilters = async () => {" in js_text
    assert "const loadPayload = async (url = _resolvedDataUrl()) => {" in js_text
    assert "const searchAllActive = Boolean(keyword) && appState.filterState.searchAll;" in js_text
    assert "if (searchAllActive) return true;" in js_text
    assert 'const FAVORITES_STORAGE_KEY = "closesnow_favorite_resorts_v1";' in js_text
    assert "const loadFavoriteResortIds = () => {" in js_text
    assert "const toggleFavoriteResortId = (resortId) => {" in js_text
    assert "const toggleFavoriteVisibleReports = (reports) => {" in js_text
    assert "const setFavoritesOnlyControls = (checked) => {" in js_text
    assert 'const favoritesOnlyToggle = document.getElementById("favorites-only-toggle");' in js_text
    assert 'const filterFavoritesOnlyInput = document.getElementById("filter-favorites-only");' in js_text
    assert "const applyFiltersImmediately = async () => {" in js_text
    assert 'filterPassTypeInputs.forEach((input) => {' in js_text
    assert 'input.addEventListener("change", applyFiltersImmediately);' in js_text
    assert 'filterRegionSelect.addEventListener("change", applyFiltersImmediately);' in js_text
    assert 'filterSortSelect.addEventListener("change", applyFiltersImmediately);' in js_text
    assert 'document.getElementById("filter-apply-btn")' not in js_text
    assert "const syncUrlFromFilterState = () => {" in js_text
    assert "window.history.replaceState" not in js_text
    assert 'const FILTER_STORAGE_KEY = "closesnow_filter_state_v1";' in js_text
    assert "const loadStoredFilterState = () => {" in js_text
    assert "const persistFilterState = () => {" in js_text
    assert "const _emptyStateRow = (colspan, message) =>" in js_text
    assert 'No favorite resorts match the current filters.' in js_text
    assert '没有匹配的雪场' in js_text
    assert "const renderPagePreservingScroll = () => {" in js_text
    assert "document.activeElement.blur();" in js_text
    assert "window.scrollTo(scrollX, scrollY);" in js_text
    assert 'if (text === "today_snow") return "today_snow";' in js_text
    assert 'if (text === "week_snow") return "week_snow";' in js_text
    assert 'if (sortBy === "today_snow") {' in js_text
    assert 'if (sortBy === "week_snow") {' in js_text
    assert "localStorage.setItem(FILTER_STORAGE_KEY" in js_text
    assert "localStorage.setItem(FAVORITES_STORAGE_KEY" in js_text
    assert "setFavoritesOnlyControls(favoritesOnlyToggle.checked);" in js_text
    assert "setFavoritesOnlyControls(filterFavoritesOnlyInput.checked);" in js_text
    assert 'const favoriteAllButton = event.target.closest(".favorite-all-btn[data-favorite-all=\'1\']");' in js_text
    assert "renderPagePreservingScroll();" in js_text
    assert "const autoSizeSplitTables = () => {" in js_text
    assert "wrapSelector: \".snowfall-right-wrap#snowfall-right-wrap\"" in js_text
    assert "const _autoSizeMobileQueryColumn = ({" in js_text
    assert "const _autoSizeDesktopLeftColumns = ({" in js_text
    assert "const _autoSizeQueryOnly = ({ tableSelector, wrapSelector, queryVarName }) => {" in js_text
    assert "const _autoSizeMobileRightColumns = ({" in js_text
    assert 'tableSelector: ".snowfall-left-wrap#snowfall-left-wrap-mobile .snowfall-left-table"' in js_text
    assert "minWidth: 150" in js_text
    assert "maxWidth: 240" in js_text
    assert 'tableSelector: ".weather-left-wrap .weather-left-table"' in js_text
    assert 'queryVarName: "--weather-query-w"' in js_text
    assert 'tableSelector: ".sun-left-wrap .sun-left-table"' in js_text
    assert 'queryVarName: "--sun-query-w"' in js_text
    assert "const _setFixedMobileHeights = (leftSelector, rightSelector, wrapSelector, stickyVar) => {" in js_text
    assert "const attachVerticalSync = (left, right) => {" in js_text
    assert "const attachSplitScrollSync = () => {" in js_text
    assert "const applyLayout = () => {" in js_text
    assert "const observeLayoutContainers = () => {" in js_text
    assert "const _setVisibleRowViewport = ({ leftSelector, rightSelector, rowsVisible = 5 }) => {" in js_text
    assert 'rowsVisible: 5,' in js_text
    assert ".snowfall-split-wrap.mobile-only" in js_text
    assert ".rain-split-wrap.mobile-only" in js_text
    assert "const syncSplitTableHeights = () => {" in js_text
    assert "syncSplitTableHeights();" in js_text
    assert "body.units-pending main" not in css_text
    assert ".query-col .resort-link" in css_text
    assert ".favorite-btn" in css_text
    assert "width: 28px;" in css_text
    assert "min-width: 28px;" in css_text
    assert ".favorite-col .favorite-btn," in css_text
    assert "margin: 0 auto;" in css_text
    assert "padding-left: 0;" in css_text
    assert "padding-right: 0;" in css_text
    assert ".resort-cell" in css_text
    assert ".compact-grid-wrap" in css_text
    assert ".compact-day-card" in css_text
    assert ".empty-state-cell" in css_text
    assert 'const _renderCompactGridSection = (reports, emptyMessage = "没有匹配的雪场") => {' in js_text
    assert 'aria-label="Daily Summary unit system"' in js_text
    assert 'data-compact-summary-toggle="1"' in js_text
    assert 'const COMPACT_SUMMARY_UNIT_KIND = "compact_summary";' in js_text
    assert 'const SUN_TIME_TOGGLE_KIND = "sun_time";' in js_text
    assert "const syncCompactSummaryToggle = () => {" in js_text
    assert "const syncSunTimeToggle = () => {" in js_text
    assert "const renderCompactSummaryValues = () => {" in js_text
    assert "const renderSunTimeValues = () => {" in js_text
    assert "const setCompactSummaryUnitMode = (mode) => {" in js_text
    assert "const setSunTimeToggleMode = (mode) => {" in js_text
    assert 'const oppositeUnitMode = (mode) => (mode === "imperial" ? "metric" : "imperial");' in js_text
    assert "renderCompactSummaryValues();" in js_text
    assert "syncCompactSummaryToggle();" in js_text
    assert "renderSunTimeValues();" in js_text
    assert "syncSunTimeToggle();" in js_text
    assert "setCompactSummaryUnitMode(oppositeUnitMode(appState.compactSummaryUnitMode));" in js_text
    assert "setSunTimeToggleMode(oppositeUnitMode(appState.sunTimeToggleMode));" in js_text
    assert "setUnitMode(kind, oppositeUnitMode(currentMode));" in js_text
    assert 'data-unit-mode="metric">Metric</button>' in js_text
    assert 'data-unit-mode="imperial">Imperial</button>' in js_text
    assert 'data-unit-mode="metric">24h</button>' in js_text
    assert 'data-unit-mode="imperial">12h</button>' in js_text
    assert 'data-sun-time-toggle="1"' in js_text
    assert 'data-sun-time-raw="' in js_text
    assert "compactDailySummary.dayLabelFor" in js_text
    assert "compactDailySummary.dayStyle(day)" in js_text
    assert "compactDailySummary.dayCellHtml(day, { unitMode: appState.compactSummaryUnitMode })" in js_text
    assert "text-overflow: ellipsis;" in css_text
    assert "white-space: nowrap;" in css_text
