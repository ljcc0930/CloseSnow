from __future__ import annotations

from src.web.weather_report_transform import reports_to_rain_rows, reports_to_snow_rows, reports_to_temp_rows
from src.web.weather_table_styles import rain_color, render_measure_cell, snow_color, temp_color, to_float


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
            "matched_name": "Snowbird",
            "week1_total_snowfall_cm": 12.34,
            "week2_total_snowfall_cm": 3.21,
            "week1_total_rain_mm": 2.2,
            "week2_total_rain_mm": 1.1,
            "daily": [
                {"date": "2026-03-04", "snowfall_cm": 1.0, "rain_mm": 0.0, "temperature_max_c": -1, "temperature_min_c": -5},
                {"date": "2026-03-05", "snowfall_cm": None, "rain_mm": 0.5, "temperature_max_c": 2, "temperature_min_c": -2},
            ],
        }
    ]
    snow_rows = reports_to_snow_rows(reports)
    rain_rows = reports_to_rain_rows(reports)
    temp_rows = reports_to_temp_rows(reports)

    assert snow_rows[0]["query"] == "Snowbird, UT"
    assert snow_rows[0]["week1_total_cm"] == "12.3"
    assert snow_rows[0]["day_1_cm"] == "1.0"
    assert snow_rows[0]["day_2_cm"] == ""
    assert snow_rows[0]["label_day_1"] == "03-04 Wed"
    assert snow_rows[0]["label_day_2"] == "03-05 Thu"

    assert rain_rows[0]["week1_total_rain_mm"] == "2.2"
    assert rain_rows[0]["day_1_rain_mm"] == "0.0"
    assert rain_rows[0]["day_2_rain_mm"] == "0.5"
    assert rain_rows[0]["label_day_1"] == "03-04 Wed"

    assert temp_rows[0]["matched_name"] == "Snowbird"
    assert temp_rows[0]["day_1_max_c"] == "-1"
    assert temp_rows[0]["day_2_above_0"] == "1"
    assert temp_rows[0]["label_day_2"] == "03-05 Thu"


def test_report_transforms_date_label_fallback_when_date_missing():
    reports = [{"query": "A", "daily": [{"snowfall_cm": 1.0}, {"snowfall_cm": 2.0}]}]
    snow_rows = reports_to_snow_rows(reports, display_days=2)
    assert snow_rows[0]["label_day_1"] == ""
    assert snow_rows[0]["label_day_2"] == ""
