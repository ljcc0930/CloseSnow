from __future__ import annotations

import csv
import json

from src.backend.writers import write_rain_csv, write_snow_csv, write_temp_csv, write_unified_json


def _sample_reports():
    return [
        {
            "query": "Snowbird, UT",
            "matched_name": "Snowbird",
            "week1_total_snowfall_cm": 12.34,
            "week2_total_snowfall_cm": 3.21,
            "daily": [
                {"snowfall_cm": 1.1, "rain_mm": 0.0, "temperature_max_c": -1, "temperature_min_c": -5, "above_0": 0},
                {"snowfall_cm": 2.2, "rain_mm": 0.5, "temperature_max_c": 2, "temperature_min_c": -3, "above_0": 1},
            ],
        }
    ]


def test_write_snow_csv(tmp_path):
    path = tmp_path / "snow.csv"
    write_snow_csv(str(path), _sample_reports())
    rows = list(csv.DictReader(path.open(encoding="utf-8")))
    assert len(rows) == 1
    assert rows[0]["query"] == "Snowbird, UT"
    assert rows[0]["week1_total_cm"] == "12.34"
    assert rows[0]["day_1_cm"] == "1.1"
    assert rows[0]["day_15_cm"] == ""


def test_write_rain_csv(tmp_path):
    path = tmp_path / "rain.csv"
    write_rain_csv(str(path), _sample_reports())
    rows = list(csv.DictReader(path.open(encoding="utf-8")))
    assert len(rows) == 1
    assert rows[0]["query"] == "Snowbird, UT"
    assert rows[0]["day_1_rain_mm"] == "0.0"
    assert rows[0]["day_2_rain_mm"] == "0.5"
    assert rows[0]["day_15_rain_mm"] == ""


def test_write_temp_csv(tmp_path):
    path = tmp_path / "temp.csv"
    write_temp_csv(str(path), _sample_reports())
    rows = list(csv.DictReader(path.open(encoding="utf-8")))
    assert len(rows) == 1
    assert rows[0]["query"] == "Snowbird, UT"
    assert rows[0]["matched_name"] == "Snowbird"
    assert rows[0]["day_1_max_c"] == "-1"
    assert rows[0]["day_2_min_c"] == "-3"
    assert rows[0]["day_2_above_0"] == "1"


def test_write_unified_json(tmp_path):
    path = tmp_path / "payload.json"
    payload = {"a": 1, "b": {"c": 2}}
    write_unified_json(str(path), payload)
    parsed = json.loads(path.read_text(encoding="utf-8"))
    assert parsed == payload

