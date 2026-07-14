from __future__ import annotations

import json
import shutil
import subprocess
from pathlib import Path

import pytest
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
    assert ".site-header-inner" in css
    assert "height: 56px" in css
    assert "font-variant-numeric: tabular-nums" in css
    assert ".fg-card" in css
    assert "[data-field-guide-tabs]" in css
    assert "details[data-field-guide-disclosure]" in css
