from __future__ import annotations

from src.backend.models import ResortLocation
from src.backend.report_builder import as_float_list, build_daily_rows, build_report, extract_hhmm, safe_sum


def test_as_float_list_and_safe_sum():
    values = as_float_list([1, "2.5", "bad", None])
    assert values == [1.0, 2.5, None, None]
    assert safe_sum(values) == 3.5


def test_build_daily_rows_handles_misaligned_lengths():
    daily = {
        "time": ["2026-03-01", "2026-03-02"],
        "snowfall_sum": [1],
        "rain_sum": [0.5, 0.0, 2.0],
        "precipitation_sum": [1.5],
        "temperature_2m_max": [2, -1],
        "temperature_2m_min": [-5],
        "weather_code": [61, "3"],
        "sunrise": ["2026-03-01T06:55", "2026-03-02T06:53", "2026-03-03T06:51"],
        "sunset": ["2026-03-01T17:42"],
    }
    rows = build_daily_rows(daily)
    assert len(rows) == 3
    assert rows[0]["date"] == "2026-03-01"
    assert rows[1]["snowfall_cm"] is None
    assert rows[2]["date"] is None
    assert rows[0]["above_0"] == 1
    assert rows[1]["above_0"] == 0
    assert rows[0]["weather_code"] == 61
    assert rows[1]["weather_code"] == 3
    assert rows[2]["weather_code"] is None
    assert rows[0]["sunrise_local_hhmm"] == "06:55"
    assert rows[0]["sunset_local_hhmm"] == "17:42"
    assert rows[2]["sunrise_local_hhmm"] == "06:51"
    assert rows[2]["sunset_local_hhmm"] is None


def test_extract_hhmm():
    assert extract_hhmm("2026-03-01T07:10") == "07:10"
    assert extract_hhmm("07:11:59") == "07:11"
    assert extract_hhmm("bad") is None
    assert extract_hhmm(None) is None


def test_build_report_contains_totals_and_history():
    location = ResortLocation(
        query="Snowbird, UT",
        name="Snowbird",
        latitude=40.5,
        longitude=-111.6,
        country="US",
        admin1="UT",
    )
    forecast = {
        "timezone": "America/Denver",
        "latitude": 40.5,
        "longitude": -111.6,
        "daily": {
            "time": ["2026-03-01", "2026-03-02", "2026-03-03"],
            "snowfall_sum": [1, 2, 3],
            "rain_sum": [0.1, 0.2, 0.3],
            "precipitation_sum": [1.1, 2.2, 3.3],
            "temperature_2m_max": [-1, 1, 2],
            "temperature_2m_min": [-5, -3, -2],
            "weather_code": [3, 71, 75],
            "sunrise": ["2026-03-01T06:55", "2026-03-02T06:53", "2026-03-03T06:51"],
            "sunset": ["2026-03-01T17:42", "2026-03-02T17:44", "2026-03-03T17:45"],
        },
    }
    history = {
        "daily": {
            "time": ["2026-02-28", "2026-02-27"],
            "snowfall_sum": [5, 6],
            "rain_sum": [0.0, 0.1],
            "precipitation_sum": [5.0, 6.1],
            "temperature_2m_max": [-3, -2],
            "temperature_2m_min": [-8, -6],
            "weather_code": [71, 73],
            "sunrise": ["2026-02-28T06:58", "2026-02-27T07:00"],
            "sunset": ["2026-02-28T17:40", "2026-02-27T17:39"],
        }
    }
    report = build_report(location, forecast, history=history)
    assert report["query"] == "Snowbird, UT"
    assert report["matched_name"] == "Snowbird"
    assert report["forecast_timezone"] == "America/Denver"
    assert report["week1_total_snowfall_cm"] == 6.0
    assert report["week2_total_snowfall_cm"] == 0.0
    assert len(report["daily"]) == 3
    assert len(report["past_14d_daily"]) == 2
    assert report["daily"][0]["weather_code"] == 3
    assert report["daily"][0]["sunrise_local_hhmm"] == "06:55"
    assert report["daily"][0]["sunset_local_hhmm"] == "17:42"
