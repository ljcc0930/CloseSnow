from __future__ import annotations

from pathlib import Path

from src.web.weather_page_assets import ASSET_MIME_TYPES, asset_path, read_asset_bytes


def test_asset_path_points_to_repo_assets():
    css_path = asset_path("assets/css/weather_page.css")
    compact_js_path = asset_path("assets/js/compact_daily_summary.js")
    home_base_js_path = asset_path("assets/js/home_base.js")
    js_path = asset_path("assets/js/weather_page.js")
    hourly_css_path = asset_path("assets/css/resort_hourly.css")
    hourly_js_path = asset_path("assets/js/resort_hourly.js")
    assert str(css_path).endswith("assets/css/weather_page.css")
    assert str(compact_js_path).endswith("assets/js/compact_daily_summary.js")
    assert str(home_base_js_path).endswith("assets/js/home_base.js")
    assert str(js_path).endswith("assets/js/weather_page.js")
    assert str(hourly_css_path).endswith("assets/css/resort_hourly.css")
    assert str(hourly_js_path).endswith("assets/js/resort_hourly.js")


def test_read_asset_bytes_reads_known_assets():
    css = read_asset_bytes("assets/css/weather_page.css")
    compact_js = read_asset_bytes("assets/js/compact_daily_summary.js")
    home_base_js = read_asset_bytes("assets/js/home_base.js")
    js = read_asset_bytes("assets/js/weather_page.js")
    hourly_css = read_asset_bytes("assets/css/resort_hourly.css")
    hourly_js = read_asset_bytes("assets/js/resort_hourly.js")
    assert len(css) > 100
    assert len(compact_js) > 100
    assert len(home_base_js) > 100
    assert len(js) > 100
    assert len(hourly_css) > 100
    assert len(hourly_js) > 100
    assert ASSET_MIME_TYPES["assets/css/weather_page.css"].startswith("text/css")
    assert ASSET_MIME_TYPES["assets/js/compact_daily_summary.js"].startswith("application/javascript")
    assert ASSET_MIME_TYPES["assets/js/home_base.js"].startswith("application/javascript")
    assert ASSET_MIME_TYPES["assets/js/weather_page.js"].startswith("application/javascript")
    assert ASSET_MIME_TYPES["assets/css/resort_hourly.css"].startswith("text/css")
    assert ASSET_MIME_TYPES["assets/js/resort_hourly.js"].startswith("application/javascript")
    css_text = css.decode("utf-8", errors="ignore")
    compact_js_text = compact_js.decode("utf-8", errors="ignore")
    home_base_js_text = home_base_js.decode("utf-8", errors="ignore")
    hourly_css_text = hourly_css.decode("utf-8", errors="ignore")
    hourly_js_text = hourly_js.decode("utf-8", errors="ignore")
    js_text = js.decode("utf-8", errors="ignore")
    assert ".compact-grid-wrap" in css_text
    assert ".hourly-charts" in hourly_css_text
    assert ".resort-local-time" in hourly_css_text
    assert ".resort-timeline-section" in hourly_css_text
    assert ".hourly-meta-issue-link" in hourly_css_text
    assert ".compact-day-head-today-anchor" in hourly_css_text
    assert ".compact-day-cell-today-anchor" in hourly_css_text
    assert "background: #e5e7eb;" in hourly_css_text
    assert "background: #d7dde6;" in hourly_css_text
    assert "box-shadow: inset 1px 0 0 #f3f4f6, inset -1px 0 0 #f3f4f6;" in hourly_css_text
    assert "box-shadow: inset 3px 0 0 #0f766e, inset -3px 0 0 #0f766e;" not in hourly_css_text
    assert "grid-template-columns: repeat(2, minmax(0, 1fr));" in hourly_css_text
    assert "@media (max-width: 980px)" in hourly_css_text
    assert "grid-template-columns: 1fr;" in hourly_css_text
    assert "width: 100%;" in hourly_css_text
    assert "min-width: 0;" in hourly_css_text
    assert "window.CloseSnowCompactDailySummary" in compact_js_text
    assert "renderSingleResortHtml" in compact_js_text
    assert "labelMode" in compact_js_text
    assert 'return "Today";' in compact_js_text
    assert "summary_phase" in compact_js_text
    assert "summary_label" in compact_js_text
    assert "summary_is_today" in compact_js_text
    assert "data-compact-today-anchor" in compact_js_text
    assert "compact-day-head-phase-start" not in compact_js_text
    assert "compact-day-cell-phase-start" not in compact_js_text
    assert "window.CloseSnowHomeBase" in home_base_js_text
    assert 'const STORAGE_KEY = "closesnow_home_base_v1";' in home_base_js_text
    assert 'source: "home_base_source"' in home_base_js_text
    assert 'label: "home_base_label"' in home_base_js_text
    assert "writeHomeBaseToSearchParams" in home_base_js_text
    assert "findLookupMatches" in home_base_js_text
    assert "resolveLookupEntry" in home_base_js_text
    assert "Salt Lake City, UT" in home_base_js_text
    assert "window.CLOSESNOW_PAGE_BOOTSTRAP" in js_text
    assert "No resorts match the current filters." in js_text
    assert 'return "Today";' in js_text
    assert "renderHourlyCharts" in hourly_js_text
    assert "formatResortLocalTime" in hourly_js_text
    assert "renderTimelineSummary" in hourly_js_text
    assert "buildMergedTimelineDays" in hourly_js_text
    assert "centerTimelineOnToday" in hourly_js_text
    assert "timelineAutoCentered" in hourly_js_text
    assert "https://github.com/ljcc0930/CloseSnow/issues/new" in hourly_js_text
    assert "01-coordinate-correction.yml" in hourly_js_text
    assert "https://ljcc0930.github.io/CloseSnow" in hourly_js_text
    assert "https://www.google.com/maps/search/?api=1&query=" in hourly_js_text
    assert "buildCoordinateIssueUrl" in hourly_js_text
    assert "buildCoordinateMetaFragment" in hourly_js_text
    assert "(Wrong coordinates?)" in hourly_js_text
    assert 'return "Today";' in hourly_js_text
    assert "const resolveChartWidth = () => {" in hourly_js_text
    assert "const splitTimeLabel = (rawTime) => {" in hourly_js_text
    assert "window.addEventListener(\"resize\", rerenderChartsForResize);" in hourly_js_text
    assert "lastHourlyPayload = payload;" in hourly_js_text
    assert "const dateTspan = document.createElementNS(svgNs, \"tspan\");" in hourly_js_text
    assert "const timeTspan = document.createElementNS(svgNs, \"tspan\");" in hourly_js_text
    assert "const padBottom = 42;" in hourly_js_text
    assert "past14dDaily" in hourly_js_text


def test_coordinate_issue_template_contains_required_fields():
    template_path = Path(__file__).resolve().parents[2] / ".github" / "ISSUE_TEMPLATE" / "01-coordinate-correction.yml"
    template_text = template_path.read_text(encoding="utf-8")

    assert "name: Coordinate correction" in template_text
    assert "id: resort_name" in template_text
    assert "id: resort_page" in template_text
    assert "id: current_coordinates" in template_text
    assert "id: current_map_link" in template_text
    assert "id: corrected_coordinates" in template_text
    assert "id: corrected_map_link" in template_text
    assert "id: evidence" in template_text
