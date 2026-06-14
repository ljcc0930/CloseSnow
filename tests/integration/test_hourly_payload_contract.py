from __future__ import annotations

from src.contract.hourly_payload import HOURLY_METRIC_KEYS, trim_hourly_payload


def test_trim_hourly_payload_trims_known_metric_keys():
    payload = {
        "hourly": {
            "time": ["2026-03-04T00:00", "2026-03-04T01:00", "2026-03-04T02:00"],
            "snowfall": [0.0, 0.1, 0.2],
            "rain": [0.0, 0.0, 0.0],
            "precipitation_probability": [20, 10, 5],
            "snow_depth": [100, 101, 102],
            "wind_speed_10m": [5.0, 6.0, 7.0],
            "wind_direction_10m": [120, 110, 100],
            "visibility": [9000, 8800, 8700],
        },
    }

    count, hourly = trim_hourly_payload(payload, 2)

    assert count == 2
    assert hourly["time"] == ["2026-03-04T00:00", "2026-03-04T01:00"]
    for key in HOURLY_METRIC_KEYS:
        assert hourly[key] == payload["hourly"][key][:2]


def test_trim_hourly_payload_fills_missing_or_invalid_metrics():
    count, hourly = trim_hourly_payload(
        {
            "hourly": {
                "time": ["2026-03-04T00:00"],
                "snowfall": "bad",
            },
        },
        12,
    )

    assert count == 1
    assert hourly["time"] == ["2026-03-04T00:00"]
    assert hourly["snowfall"] == []
    assert hourly["visibility"] == []
