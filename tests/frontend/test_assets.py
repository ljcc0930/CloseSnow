from __future__ import annotations

from src.web.weather_page_assets import ASSET_MIME_TYPES, asset_path, read_asset_bytes


def test_asset_path_points_to_repo_assets():
    css_path = asset_path("assets/css/weather_page.css")
    js_path = asset_path("assets/js/weather_page.js")
    hourly_css_path = asset_path("assets/css/resort_hourly.css")
    hourly_js_path = asset_path("assets/js/resort_hourly.js")
    assert str(css_path).endswith("assets/css/weather_page.css")
    assert str(js_path).endswith("assets/js/weather_page.js")
    assert str(hourly_css_path).endswith("assets/css/resort_hourly.css")
    assert str(hourly_js_path).endswith("assets/js/resort_hourly.js")


def test_read_asset_bytes_reads_known_assets():
    css = read_asset_bytes("assets/css/weather_page.css")
    js = read_asset_bytes("assets/js/weather_page.js")
    hourly_css = read_asset_bytes("assets/css/resort_hourly.css")
    hourly_js = read_asset_bytes("assets/js/resort_hourly.js")
    assert len(css) > 100
    assert len(js) > 100
    assert len(hourly_css) > 100
    assert len(hourly_js) > 100
    assert ASSET_MIME_TYPES["assets/css/weather_page.css"].startswith("text/css")
    assert ASSET_MIME_TYPES["assets/js/weather_page.js"].startswith("application/javascript")
    assert ASSET_MIME_TYPES["assets/css/resort_hourly.css"].startswith("text/css")
    assert ASSET_MIME_TYPES["assets/js/resort_hourly.js"].startswith("application/javascript")
    css_text = css.decode("utf-8", errors="ignore")
    hourly_css_text = hourly_css.decode("utf-8", errors="ignore")
    hourly_js_text = hourly_js.decode("utf-8", errors="ignore")
    js_text = js.decode("utf-8", errors="ignore")
    assert ".weather-left-table .query-col" in css_text
    assert ".hourly-charts" in hourly_css_text
    assert "renderHourlyCharts" in hourly_js_text
    assert "resolved_latitude" in hourly_js_text
    assert "history.replaceState" not in js_text
    assert "window.location.assign(currentUrl.toString())" not in js_text
    assert "window.CLOSESNOW_PAGE_BOOTSTRAP" in js_text
    assert "const _resolveBootstrapUrl = (rawUrl) => {" in js_text
    assert "fetch(_resolveBootstrapUrl(pageBootstrap.dataUrl))" in js_text
    assert "const applyFiltersImmediately = () => {" in js_text
    assert 'filterPassTypeInputs.forEach((input) => {' in js_text
    assert 'input.addEventListener("change", applyFiltersImmediately);' in js_text
    assert 'filterRegionSelect.addEventListener("change", applyFiltersImmediately);' in js_text
    assert 'filterSortSelect.addEventListener("change", applyFiltersImmediately);' in js_text
    assert 'document.getElementById("filter-apply-btn")' not in js_text
    assert "const syncUrlFromFilterState = () => {" in js_text
    assert "window.history.replaceState" not in js_text
    assert "const buildFilterQueryParams = () => {" not in js_text
    assert 'const FILTER_STORAGE_KEY = "closesnow_filter_state_v1";' in js_text
    assert "const loadStoredFilterState = () => {" in js_text
    assert "const persistFilterState = () => {" in js_text
    assert "localStorage.setItem(FILTER_STORAGE_KEY" in js_text
    assert "const autoSizeSplitTables = () => {" in js_text
    assert "wrapSelector: \".snowfall-right-wrap#snowfall-right-wrap\"" in js_text
    assert "const _autoSizeMobileQueryColumn = ({" in js_text
    assert "const _autoSizeDesktopLeftColumns = ({" in js_text
    assert "const _autoSizeQueryOnly = ({ tableSelector, wrapSelector, queryVarName }) => {" in js_text
    assert "const _autoSizeMobileRightColumns = ({" in js_text
    assert "const _setFixedMobileHeights = (leftSelector, rightSelector, wrapSelector, stickyVar) => {" in js_text
    assert "const attachVerticalSync = (left, right) => {" in js_text
    assert "const attachSplitScrollSync = () => {" in js_text
    assert "const applyLayout = () => {" in js_text
    assert "const observeLayoutContainers = () => {" in js_text
    assert ".snowfall-split-wrap.mobile-only" in js_text
    assert ".rain-split-wrap.mobile-only" in js_text
    assert "const syncSplitTableHeights = () => {" in js_text
    assert "syncSplitTableHeights();" in js_text
    assert "body.units-pending main" not in css_text
    assert ".query-col .resort-link" in css_text
    assert "text-overflow: ellipsis;" in css_text
    assert "white-space: nowrap;" in css_text
