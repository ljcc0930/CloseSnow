from __future__ import annotations

from typing import get_args, get_origin, get_type_hints

from src.contract.hourly_payload import HOURLY_METRIC_KEYS, HourlyPayload, HourlySeries
from src.contract.weather_payload_v1 import DailyForecastRow, NearbyAirport, WeatherPayloadV1, WeatherReport


def _list_item_type(annotation):
    assert get_origin(annotation) is list
    return get_args(annotation)[0]


def test_weather_payload_reports_use_explicit_typed_dicts():
    payload_hints = get_type_hints(WeatherPayloadV1)
    report_hints = get_type_hints(WeatherReport)

    assert _list_item_type(payload_hints["reports"]) is WeatherReport
    assert _list_item_type(report_hints["daily"]) is DailyForecastRow
    assert _list_item_type(report_hints["past_14d_daily"]) is DailyForecastRow
    assert _list_item_type(report_hints["nearby_airports"]) is NearbyAirport


def test_hourly_payload_uses_explicit_series_schema():
    payload_hints = get_type_hints(HourlyPayload)
    series_hints = get_type_hints(HourlySeries)

    assert payload_hints["hourly"] is HourlySeries
    assert _list_item_type(series_hints["time"]) is str
    for key in HOURLY_METRIC_KEYS:
        assert key in series_hints
