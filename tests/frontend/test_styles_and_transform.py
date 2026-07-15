from __future__ import annotations

import json
import shutil
import subprocess
from pathlib import Path

import pytest
from src.web.asset_manifest import WEB_ASSET_MANIFEST
from src.web.weather_report_transform import (
    reports_to_rain_rows,
    reports_to_snow_rows,
    reports_to_sun_rows,
    reports_to_temp_rows,
)
from src.web.weather_table_styles import rain_color, render_measure_cell, snow_color, temp_color, to_float

REPO_ROOT = Path(__file__).resolve().parents[2]


def _node_binary() -> str:
    bundled_node = Path("/Applications/ChatGPT.app/Contents/Resources/cua_node/bin/node")
    node = shutil.which("node") or (str(bundled_node) if bundled_node.is_file() else "")
    if not node:
        pytest.skip("Node.js is required for shared frontend API tests")
    return node


def _run_field_guide_expression(expression: str):
    asset_path = REPO_ROOT / "assets" / "js" / "field_guide_foundation.js"
    runner = f"""
const fs = require("fs");
const storageState = {{}};
const dispatchedEvents = [];
global.window = {{
  localStorage: {{
    getItem: (key) => Object.prototype.hasOwnProperty.call(storageState, key) ? storageState[key] : null,
    setItem: (key, value) => {{ storageState[key] = String(value); }},
  }},
  addEventListener: () => {{}},
  dispatchEvent: (event) => {{ dispatchedEvents.push({{ type: event.type, detail: event.detail }}); }},
  CustomEvent: function (type, init) {{ this.type = type; this.detail = init.detail; }},
}};
eval(fs.readFileSync({json.dumps(str(asset_path))}, "utf8"));
const result = (() => ({expression}))();
process.stdout.write(JSON.stringify(result));
"""
    result = subprocess.run(
        [_node_binary(), "-e", runner],
        cwd=REPO_ROOT,
        check=True,
        capture_output=True,
        text=True,
    )
    return json.loads(result.stdout)


def _run_homepage_expression(expression: str):
    foundation_path = REPO_ROOT / "assets" / "js" / "field_guide_foundation.js"
    homepage_path = REPO_ROOT / "assets" / "js" / "field_guide_homepage.js"
    runner = f"""
const fs = require("fs");
const storageState = {{}};
global.window = {{
  localStorage: {{
    getItem: (key) => Object.prototype.hasOwnProperty.call(storageState, key) ? storageState[key] : null,
    setItem: (key, value) => {{ storageState[key] = String(value); }},
  }},
  addEventListener: () => {{}},
  dispatchEvent: () => {{}},
  CustomEvent: function (type, init) {{ this.type = type; this.detail = init.detail; }},
}};
eval(fs.readFileSync({json.dumps(str(foundation_path))}, "utf8"));
eval(fs.readFileSync({json.dumps(str(homepage_path))}, "utf8"));
const result = (() => ({expression}))();
process.stdout.write(JSON.stringify(result));
"""
    result = subprocess.run(
        [_node_binary(), "-e", runner],
        cwd=REPO_ROOT,
        check=True,
        capture_output=True,
        text=True,
    )
    return json.loads(result.stdout)


def test_to_float_and_color_functions():
    assert to_float(" 2.5 ") == 2.5
    assert to_float("") is None
    assert to_float("bad") is None

    assert snow_color(None) == ""
    assert snow_color(20) == "background:#FFE7CC;"
    assert "background:rgb(" in snow_color(5)

    assert temp_color(None) == ""
    assert temp_color(-20) == "background:#CFE8FF;"
    assert "background:rgb(" in temp_color(-5)
    assert "background:rgb(" in temp_color(5)
    assert temp_color(20) == "background:#FFD6D6;"

    assert rain_color(None) == ""
    assert rain_color(0) == "background:#FFFFFF;"
    assert "background:rgb(" in rain_color(1.5)
    assert rain_color(7.6) == "background:#CFEFD8;"
    assert rain_color(20) == "background:#CFEFD8;"


def test_render_measure_cell():
    td = render_measure_cell("1.5", kind="snow", style="background:#fff;", klass="x")
    assert "data-kind='snow'" in td
    assert "data-metric-value='1.500000'" in td
    assert "class='x'" in td
    assert "style='background:#fff;'" in td

    td2 = render_measure_cell("<x>", kind="rain")
    assert "&lt;x&gt;" in td2
    assert "data-kind" not in td2


def test_report_transforms():
    reports = [
        {
            "query": "Snowbird, UT",
            "display_name": "Snowbird, Utah",
            "matched_name": "Snowbird",
            "country": "US",
            "region": "west",
            "admin1": "UT",
            "pass_types": ["ikon", "indy"],
            "resort_id": "snowbird-ut",
            "default_resort": True,
            "ljcc_favorite": True,
            "week1_total_snowfall_cm": 12.34,
            "week2_total_snowfall_cm": 3.21,
            "week1_total_rain_mm": 2.2,
            "week2_total_rain_mm": 1.1,
            "daily": [
                {
                    "date": "2026-03-04",
                    "snowfall_cm": 1.0,
                    "rain_mm": 0.0,
                    "temperature_max_c": -1,
                    "temperature_min_c": -5,
                },
                {
                    "date": "2026-03-05",
                    "snowfall_cm": None,
                    "rain_mm": 0.5,
                    "temperature_max_c": 2,
                    "temperature_min_c": -2,
                    "sunrise_local_hhmm": "07:00",
                    "sunset_local_hhmm": "18:23",
                },
            ],
        }
    ]
    snow_rows = reports_to_snow_rows(reports)
    rain_rows = reports_to_rain_rows(reports)
    sun_rows = reports_to_sun_rows(reports)
    temp_rows = reports_to_temp_rows(reports)

    assert snow_rows[0]["query"] == "Snowbird, Utah"
    assert snow_rows[0]["week1_total_cm"] == "12.3"
    assert snow_rows[0]["day_1_cm"] == "1.0"
    assert snow_rows[0]["day_2_cm"] == ""
    assert snow_rows[0]["label_day_1"] == "03-04 Wed"
    assert snow_rows[0]["label_day_2"] == "03-05 Thu"
    assert snow_rows[0]["filter_pass_types"] == "ikon,indy"
    assert snow_rows[0]["filter_region"] == "west"
    assert snow_rows[0]["filter_country"] == "US"
    assert snow_rows[0]["filter_state"] == "UT"
    assert snow_rows[0]["resort_id"] == "snowbird-ut"
    assert snow_rows[0]["default_resort"] == "1"
    assert snow_rows[0]["ljcc_favorite"] == "1"

    assert rain_rows[0]["week1_total_rain_mm"] == "2.2"
    assert rain_rows[0]["day_1_rain_mm"] == "0.0"
    assert rain_rows[0]["day_2_rain_mm"] == "0.5"
    assert rain_rows[0]["label_day_1"] == "03-04 Wed"

    assert sun_rows[0]["day_1_sunrise"] == ""
    assert sun_rows[0]["day_1_sunset"] == ""
    assert sun_rows[0]["day_2_sunrise"] == "07:00"
    assert sun_rows[0]["day_2_sunset"] == "18:23"
    assert sun_rows[0]["label_day_2"] == "03-05 Thu"

    assert temp_rows[0]["matched_name"] == "Snowbird"
    assert temp_rows[0]["query"] == "Snowbird, Utah"
    assert temp_rows[0]["day_1_max_c"] == "-1"
    assert temp_rows[0]["day_2_above_0"] == "1"
    assert temp_rows[0]["label_day_2"] == "03-05 Thu"


def test_report_transforms_date_label_fallback_when_date_missing():
    reports = [{"query": "A", "daily": [{"snowfall_cm": 1.0}, {"snowfall_cm": 2.0}]}]
    snow_rows = reports_to_snow_rows(reports, display_days=2)
    assert snow_rows[0]["label_day_1"] == ""
    assert snow_rows[0]["label_day_2"] == ""


def test_sun_rows_fallback_to_iso_strings_when_hhmm_missing():
    reports = [
        {
            "query": "A",
            "daily": [
                {"date": "2026-03-04", "sunrise_iso": "2026-03-04T06:45", "sunset_iso": "2026-03-04T17:55"},
                {"date": "2026-03-05", "sunrise_iso": "bad", "sunset_iso": None},
            ],
        }
    ]
    sun_rows = reports_to_sun_rows(reports, display_days=2)
    assert sun_rows[0]["day_1_sunrise"] == "06:45"
    assert sun_rows[0]["day_1_sunset"] == "17:55"
    assert sun_rows[0]["day_2_sunrise"] == ""
    assert sun_rows[0]["day_2_sunset"] == ""


def test_field_guide_weather_icons_have_plain_labels_and_safe_svg_markup():
    result = _run_field_guide_expression(
        """(() => {
  const weather = window.CloseSnowFieldGuide.weather;
  return {
    snowName: weather.conditionName(71),
    rainName: weather.conditionName(61),
    unknownName: weather.conditionName(null),
    snowIcon: weather.iconHtml(71),
    escapedIcon: weather.iconHtml(0, { label: "Clear <strong>", className: "x\\\" onclick=\\\"bad" }),
    rainMetricIcon: weather.metricIconHtml("rain"),
  };
})()"""
    )

    assert result["snowName"] == "Snow"
    assert result["rainName"] == "Rain"
    assert result["unknownName"] == "Conditions unavailable"
    assert '<svg viewBox="0 0 24 24" aria-hidden="true"' in result["snowIcon"]
    assert 'role="img" aria-label="Snow"' in result["snowIcon"]
    assert 'data-weather-kind="snow"' in result["snowIcon"]
    assert "&lt;strong&gt;" in result["escapedIcon"]
    assert "&quot; onclick=&quot;bad" in result["escapedIcon"]
    assert 'aria-label="Rainfall"' in result["rainMetricIcon"]


def test_field_guide_copy_helpers_use_readable_fallbacks_and_existing_daily_values():
    result = _run_field_guide_expression(
        """(() => {
  const copy = window.CloseSnowFieldGuide.copy;
  const daily = [
    { weather_code: 71, snowfall_cm: 2.5, rain_mm: 0, temperature_max_c: 3, temperature_min_c: -4 },
    { weather_code: 3, snowfall_cm: 1.5, rain_mm: 1.2, temperature_max_c: 2, temperature_min_c: -5 },
  ];
  return {
    missing: copy.dailyOutlook([]),
    missingPrecip: copy.precipitationOutlook([{ weather_code: 3 }]),
    missingTemp: copy.temperatureOutlook({}),
    outlook: copy.dailyOutlook(daily, { mode: "metric" }),
  };
})()"""
    )

    assert result["missing"] == "Forecast details are not available yet."
    assert result["missingPrecip"] == "Snow and rain estimates are not available yet."
    assert result["missingTemp"] == "Temperature details are not available yet."
    assert result["outlook"] == (
        "Snow today. Expect 4.0 cm of snow and 1.2 mm of rain over the next 2 days. High 3 °C, low -4 °C."
    )


def test_field_guide_units_migrate_once_convert_all_supported_values_and_emit_event():
    result = _run_field_guide_expression(
        """(() => {
  const units = window.CloseSnowFieldGuide.units;
  storageState[units.STORAGE_KEY] = "invalid";
  storageState[units.LEGACY_STORAGE_KEYS[0]] = "imperial";
  const migrated = units.readPreference(window.localStorage);
  const formatted = {
    temperature: units.formatTemperature(0, migrated),
    snow: units.formatSnow(2.54, migrated),
    rain: units.formatRain(25.4, migrated),
    distance: units.formatDistance(1.609344, migrated),
    missing: units.formatSnow(null, migrated),
  };
  const normalized = units.setMode("not-a-mode");
  return {
    migrated,
    persisted: storageState[units.STORAGE_KEY],
    formatted,
    normalized,
    event: dispatchedEvents.at(-1),
  };
})()"""
    )

    assert result["migrated"] == "imperial"
    assert result["formatted"] == {
        "temperature": "32 °F",
        "snow": "1.0 in",
        "rain": "1.00 in",
        "distance": "1 mi",
        "missing": "—",
    }
    assert result["persisted"] == "metric"
    assert result["normalized"] == "metric"
    assert result["event"] == {"type": "closesnow:unitschange", "detail": {"mode": "metric"}}


def test_field_guide_styles_define_shared_semantics_and_compact_header():
    css = (REPO_ROOT / "assets" / "css" / "field_guide_foundation.css").read_text(encoding="utf-8")

    assert "--fg-glacier:" in css
    assert "--fg-pine:" in css
    assert "--fg-signal:" in css
    assert "--fg-paper:" in css
    assert "--fg-ink-subtle: #5f737d" in css
    assert "--fg-shadow-card:" in css
    assert "--fg-shadow-section:" in css
    assert "--shadow-card: var(--fg-shadow-card)" in css
    assert ".site-header-inner" in css
    assert "height: 56px" in css
    assert "font-variant-numeric: tabular-nums" in css
    assert ".fg-card" in css
    assert "outline: 3px solid var(--fg-focus)" in css
    assert "[data-field-guide-tabs]" in css
    assert "details[data-field-guide-disclosure]" in css
    assert "@media (forced-colors: active)" in css
    assert ".snapshot-card-weather .snapshot-icon {\n  color: var(--fg-glacier);" in css
    assert css.count("min-height: 44px") >= 3


def test_homepage_card_is_compact_uses_global_units_and_escapes_content():
    result = _run_homepage_expression(
        """(() => {
  const homepage = window.CloseSnowFieldGuideHomepage;
  const report = {
    resort_id: "safe-resort",
    display_name: "Peak <script>alert(1)</script>",
    admin1: "State <unsafe>",
    pass_types: ["ikon"],
    week1_total_snowfall_cm: 2.54,
    week2_total_snowfall_cm: 0,
    week1_total_rain_mm: 25.4,
    daily: [
      {
        date: "2026-03-03",
        weather_code: 71,
        temperature_max_c: 0,
        temperature_min_c: -10,
        snowfall_cm: 2.54,
        rain_mm: 25.4,
        sunrise_local_hhmm: "07:01",
        sunset_local_hhmm: "18:22",
      },
      {
        date: "2026-03-04",
        weather_code: 3,
        temperature_max_c: 2,
        temperature_min_c: -4,
        snowfall_cm: 0,
        rain_mm: 0,
        sunrise_iso: "2026-03-04T07:00",
        sunset_iso: "2026-03-04T18:23",
      },
    ],
  };
  return homepage.renderResortCard(report, { mode: "imperial", favorite: true });
})()"""
    )

    assert "Peak &lt;script&gt;alert(1)&lt;/script&gt;" in result
    assert "State &lt;unsafe&gt;" in result
    assert "<script>alert(1)</script>" not in result
    assert 'aria-pressed="true"' in result
    assert "Today" in result
    assert "Snow" in result
    assert "32 °F / 14 °F" in result
    assert "7-day snow" in result
    assert "1.0 in" in result
    assert "7-day rain" in result
    assert "1.00 in" in result
    assert "Peak Today" in result
    assert 'data-daily-signal-timeline data-metric-kind="snow"' in result
    assert 'data-timeline-scroll tabindex="0"' in result
    assert result.count('class="daily-signal-day"') == 2
    assert "Daily snowfall" in result
    assert "in / day" in result
    assert 'aria-label="Open the complete forecast for Peak &lt;script&gt;alert(1)&lt;/script&gt;"' in result
    assert "Full 2-day forecast" not in result
    assert "daily-detail-card" not in result
    assert "data-resort-disclosure" not in result


def test_homepage_compact_signals_and_pagination_are_honest():
    result = _run_homepage_expression(
        """(() => {
  const homepage = window.CloseSnowFieldGuideHomepage;
  const snowReport = {
    resort_id: "deep",
    display_name: "Deep Peak",
    week1_total_snowfall_cm: 18,
    week2_total_snowfall_cm: 4,
    week1_total_rain_mm: 2,
    daily: [
      { date: "2026-03-03", weather_code: 71, snowfall_cm: 12, rain_mm: 0, temperature_max_c: -1, temperature_min_c: -8 },
    ],
  };
  const rainReport = {
    resort_id: "wet",
    display_name: "Wet Ridge",
    week1_total_snowfall_cm: 0,
    week2_total_snowfall_cm: 0,
    week1_total_rain_mm: 42,
    daily: [
      { date: "2026-03-03", weather_code: 61, snowfall_cm: 0, rain_mm: 20, temperature_max_c: 8, temperature_min_c: 2 },
    ],
  };
  return {
    board: homepage.render([snowReport], { mode: "metric" }),
    rainCard: homepage.renderResortCard(rainReport, { mode: "metric" }),
    paged: homepage.render(Array.from({ length: 13 }, (_, index) => ({
      resort_id: `resort-${index}`,
      display_name: `Resort ${index}`,
      week1_total_snowfall_cm: index + 1,
      week1_total_rain_mm: 0,
      daily: [{ date: "2026-03-03", snowfall_cm: index + 1, rain_mm: 0 }],
    })), { mode: "metric", limit: 12 }),
    expanded: homepage.render(Array.from({ length: 13 }, (_, index) => ({
      resort_id: `resort-${index}`,
      display_name: `Resort ${index}`,
      week1_total_snowfall_cm: index + 1,
      week1_total_rain_mm: 0,
      daily: [{ date: "2026-03-03", snowfall_cm: index + 1, rain_mm: 0 }],
    })), { mode: "metric", limit: 13 }),
  };
})()"""
    )

    assert 'data-signal="snow"' in result["board"]
    assert "7-day snow" in result["board"]
    assert "18.0 cm" in result["board"]
    assert 'data-priority="primary"' in result["board"]
    assert 'data-signal="rain"' in result["rainCard"]
    assert "7-day rain" in result["rainCard"]
    assert "42.0 mm" in result["rainCard"]
    assert 'data-metric-kind="rain" data-priority="primary"' in result["rainCard"]
    assert 'data-daily-signal-timeline data-metric-kind="rain"' in result["rainCard"]
    assert "Daily rain · no snow in forecast" in result["rainCard"]
    assert result["paged"].count('data-resort-card="') == 12
    assert "data-show-more-results" in result["paged"]
    assert "Show 1 more resorts; 12 of 13 currently shown" in result["paged"]
    assert result["expanded"].count('data-resort-card="') == 13
    assert "data-show-more-results" not in result["expanded"]
    assert "insight-board" not in result["paged"]
    assert "daily-detail-card" not in result["paged"]


def test_homepage_daily_signal_timeline_caps_days_and_uses_shared_scale():
    result = _run_homepage_expression(
        """(() => {
  const homepage = window.CloseSnowFieldGuideHomepage;
  const days = Array.from({ length: 15 }, (_, index) => ({
    date: `2026-03-${String(index + 1).padStart(2, "0")}`,
    snowfall_cm: index === 4 ? 10 : 0,
    rain_mm: 0,
  }));
  const report = { resort_id: "deep", display_name: "Deep Peak", daily: days };
  return {
    scales: homepage.timelineScales([
      report,
      { daily: [{ date: "2026-03-01", snowfall_cm: 20, rain_mm: 4 }] },
    ]),
    timeline: homepage.renderSignalTimeline(report, { mode: "metric", snowScaleMax: 20 }),
  };
})()"""
    )

    assert result["scales"] == {"snow": 20, "rain": 10}
    assert result["timeline"].count('class="daily-signal-day"') == 14
    assert "--daily-signal-height:50%" in result["timeline"]
    assert "Next 7 days" in result["timeline"]
    assert "Days 8–14" in result["timeline"]
    assert "Mar 5: snowfall 10.0 cm" in result["timeline"]


def test_homepage_missing_and_no_results_copy_is_honest_and_readable():
    result = _run_homepage_expression(
        """(() => {
  const homepage = window.CloseSnowFieldGuideHomepage;
  return {
    missing: homepage.renderResortCard({ resort_id: "missing", display_name: "Missing Mountain", daily: [] }),
    partial: homepage.renderResortCard({ resort_id: "partial", display_name: "Partial Peak", week1_total_snowfall_cm: 0, daily: [] }),
    inactiveBoard: homepage.render([{ resort_id: "missing", display_name: "Missing Mountain", daily: [] }]),
    quietBoard: homepage.render([{ resort_id: "quiet", display_name: "Quiet Mountain", week1_total_snowfall_cm: 0, week1_total_rain_mm: 0, daily: [] }]),
    empty: homepage.render([], { emptyMessage: "Try clearing your filters." }),
  };
})()"""
    )

    assert "Pending · 7-day forecast" in result["missing"]
    assert "Not available" in result["missing"]
    assert "Quiet pattern" not in result["missing"]
    assert 'data-priority="primary"' not in result["missing"]
    assert "Pending · 7-day forecast" in result["partial"]
    assert "Quiet pattern" not in result["partial"]
    assert "Pending · 7-day forecast" in result["inactiveBoard"]
    assert "insight-board" not in result["inactiveBoard"]
    assert "Quiet · 7-day snow" in result["quietBoard"]
    assert "7-day rain" in result["quietBoard"]
    assert "0.0 cm" in result["quietBoard"]
    assert "0.0 mm" in result["quietBoard"]
    assert "No resorts match this view" in result["empty"]
    assert "Try clearing your filters." in result["empty"]


def test_resort_field_guide_groups_hourly_weather_and_preserves_daily_detail():
    js = (REPO_ROOT / "assets" / "js" / "resort_hourly.js").read_text(encoding="utf-8")
    css = (REPO_ROOT / "assets" / "css" / "resort_hourly.css").read_text(encoding="utf-8")
    template = (REPO_ROOT / "src" / "web" / "templates" / "resort_hourly_page.html").read_text(encoding="utf-8")

    assert "HOURLY_GROUPS" in js
    assert 'metrics: Object.freeze(["snowfall", "rain", "precipitation_probability"])' in js
    assert 'metrics: Object.freeze(["wind_speed_10m", "wind_direction_10m"])' in js
    assert 'metrics: Object.freeze(["visibility", "snow_depth"])' in js
    assert "renderHourlyNarrative" in js
    assert "snow and rain accumulation readings are unavailable." in js
    assert "renderWindDirectionCard" in js
    assert 'label.textContent = "Bottom line"' in js
    assert "snapshotEl.dataset.primarySignal = priority" in js
    assert "const sevenDayMetricTotal" in js
    assert ".filter((value) => value !== null)" in js
    assert 'snow === null ? "Awaiting model data"' in js
    assert 'rain === null ? "Awaiting model data"' in js
    assert "card.dataset.weatherSignal" in js
    assert "primaryMetricForGroup" in js
    assert "const orderedMetrics = primaryMetric" in js
    assert ": [...group.metrics]" in js
    assert "orderedMetrics.forEach" in js
    assert 'if (hasPositiveReading("snowfall")) return "snowfall"' in js
    assert 'if (hasPositiveReading("rain")) return "rain"' in js
    assert 'if (metricKey === primaryMetric) card.dataset.priority = "primary"' in js
    assert "fieldGuideWeather.iconHtml" in js
    assert "data-timeline-today" in js
    assert "const firstWeek = forecastDays.slice(0, 7)" in js
    assert "const laterForecast = forecastDays.slice(7)" in js
    assert '"Days 8–14"' in js
    assert "appendTimelineDisclosure(timelineRoot, laterForecastLabel" in js
    assert 'appendTimelineDisclosure(timelineRoot, "Past 14 days"' in js
    assert 'appendDefinition(daylight, "Sunrise"' in js
    assert 'appendDefinition(daylight, "Sunset"' in js
    assert "Resort Forecast:" not in js
    assert "subtitle.textContent = `Unit:" not in js

    assert ".resort-masthead" in css
    assert ".field-guide-timeline-track" in css
    assert ".timeline-disclosure" in css
    assert '.timeline-day-card[data-phase="today"]' in css
    assert '.snapshot-card[data-priority="primary"]' in css
    assert '.chart-card[data-priority="primary"]' in css
    assert ".hourly-view-tabs" in css
    assert "scroll-snap-type: x mandatory" in css
    assert ".wind-direction-grid" in css
    assert ".resort-hero-mountain" not in css
    assert ">Precipitation</button>" in template
    assert ">Wind</button>" in template
    assert ">Visibility &amp; depth</button>" in template
    hourly_charts_tag = template.split('id="hourly-charts"', 1)[1].split(">", 1)[0]
    assert 'role="tabpanel"' in hourly_charts_tag
    assert "aria-live" not in hourly_charts_tag
    assert '<details id="resort-airport-access-section"' in template
    assert '<details class="resort-identity-disclosure"' in template
    assert '<details class="hourly-meta-disclosure"' in template
    assert '<details class="raw-data-panel"' in template


def test_integration_removes_superseded_assets_and_defines_compact_results():
    manifest_paths = {asset.repository_path for asset in WEB_ASSET_MANIFEST}
    assert "assets/js/compact_daily_summary.js" not in manifest_paths
    assert "assets/js/weather_code_emoji.js" not in manifest_paths
    assert "assets/js/sticky_single_table_layout.js" not in manifest_paths

    homepage_css = (REPO_ROOT / "assets" / "css" / "weather_page.css").read_text(encoding="utf-8")
    assert ".report-overview" in homepage_css
    assert ".result-column-headings" in homepage_css
    assert "height: 96px" in homepage_css
    assert "min-height: 164px" in homepage_css
    assert ".daily-signal-timeline" in homepage_css
    assert "scroll-snap-type: x proximity" in homepage_css
    assert "touch-action: pan-x" in homepage_css
    assert "min-height: 224px" in homepage_css
    assert ".results-pagination" in homepage_css
    assert "transform: translateY" not in homepage_css

    weather_js = (REPO_ROOT / "assets" / "js" / "weather_page.js").read_text(encoding="utf-8")
    filter_js = (REPO_ROOT / "assets" / "js" / "weather_filter_state.js").read_text(encoding="utf-8")
    template = (REPO_ROOT / "src" / "web" / "templates" / "weather_page.html").read_text(encoding="utf-8")
    assert "const weeklyRainfall" in weather_js
    assert "const hasPositiveWeeklySnow" in weather_js
    assert "compareDescending(a, b, weeklyRainfall)" in weather_js
    assert "Favorite updated. Results reordered." in weather_js
    assert "const bindTimelineDragging" in weather_js
    assert 'querySelectorAll("[data-timeline-scroll]")' in weather_js
    assert 'return "7-Day Weather Signal"' in filter_js
    assert ">7-day weather signal</option>" in template
