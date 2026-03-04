from __future__ import annotations

import re

from src.web.desktop.precipitation_renderer import (
    render_rainfall_desktop_layout,
    render_snowfall_desktop_layout,
)
from src.web.desktop.temperature_renderer import render_temperature_desktop_layout
from src.web.mobile.precipitation_renderer import (
    render_rainfall_mobile_layout,
    render_snowfall_mobile_layout,
)
from src.web.weather_html_renderer import build_html
from src.web.weather_page_render_core import render_payload_html
from src.web.weather_table_renderer import (
    _render_desktop_and_mobile,
    render_rain_table,
    render_snowfall_table,
    render_sun_table,
    render_temperature_table,
    render_weather_table,
)


def _snow_row():
    return {
        "query": "Snowbird <UT>",
        "week1_total_cm": "12.3",
        "week2_total_cm": "4.5",
        "day_1_cm": "1.0",
        "day_2_cm": "2.0",
        "label_day_1": "03-04 Wed",
        "label_day_2": "03-05 Thu",
        "filter_pass_types": "ikon",
        "filter_region": "west",
        "filter_country": "US",
        "resort_id": "snowbird-ut",
    }


def _rain_row():
    return {
        "query": "Snowbird <UT>",
        "week1_total_rain_mm": "2.2",
        "week2_total_rain_mm": "1.1",
        "day_1_rain_mm": "0.0",
        "day_2_rain_mm": "0.5",
        "label_day_1": "03-04 Wed",
        "label_day_2": "03-05 Thu",
    }


def _temp_row():
    return {
        "query": "Snowbird <UT>",
        "matched_name": "Snowbird",
        "day_2_max_c": "2",
        "day_1_max_c": "-1",
        "day_1_min_c": "-5",
        "day_2_min_c": "-2",
        "label_day_1": "03-04 Wed",
        "label_day_2": "03-05 Thu",
    }


def _weather_row():
    return {
        "query": "Snowbird <UT>",
        "day_1_weather_code": "0",
        "day_2_weather_code": "61",
        "day_3_weather_code": "",
        "label_day_1": "03-04 Wed",
        "label_day_2": "03-05 Thu",
        "label_day_3": "03-06 Fri",
    }


def _sun_row():
    return {
        "query": "Snowbird <UT>",
        "matched_name": "Snowbird",
        "day_1_sunrise": "07:01",
        "day_1_sunset": "18:22",
        "day_2_sunrise": "07:00",
        "day_2_sunset": "18:23",
        "label_day_1": "03-04 Wed",
        "label_day_2": "03-05 Thu",
    }


def test_snowfall_desktop_mobile_renderers():
    data = [_snow_row()]
    weekly = ["week1_total_cm", "week2_total_cm"]
    daily = ["day_1_cm", "day_2_cm"]
    desktop = render_snowfall_desktop_layout(data, weekly, daily)
    mobile = render_snowfall_mobile_layout(data, weekly, daily)
    assert "snowfall-split-wrap desktop-only" in desktop
    assert "snowfall-split-wrap mobile-only" in mobile
    assert "Snowbird &lt;UT&gt;" in desktop
    assert "week 1" in desktop
    assert "03-04 Wed" in desktop
    assert "03-04 Wed" in mobile


def test_rainfall_desktop_mobile_renderers():
    data = [_rain_row()]
    weekly = ["week1_total_rain_mm", "week2_total_rain_mm"]
    daily = ["day_1_rain_mm", "day_2_rain_mm"]
    desktop = render_rainfall_desktop_layout(data, weekly, daily)
    mobile = render_rainfall_mobile_layout(data, weekly, daily)
    assert "rain-split-wrap desktop-only" in desktop
    assert "rain-split-wrap mobile-only" in mobile
    assert "Snowbird &lt;UT&gt;" in desktop
    assert "week 2" in desktop
    assert "03-05 Thu" in desktop
    assert "03-04 Wed" in mobile


def test_temperature_desktop_renderer():
    html = render_temperature_desktop_layout([_temp_row()])
    assert "temperature-split-wrap" in html
    assert "03-04 Wed" in html
    assert "03-05 Thu" in html
    assert "Snowbird &lt;UT&gt;" in html


def test_renderers_fallback_to_generic_day_labels_when_dates_missing():
    snow = render_snowfall_desktop_layout(
        [{"query": "A", "week1_total_cm": "1.0", "week2_total_cm": "2.0", "day_1_cm": "0.1", "day_2_cm": "0.2"}],
        ["week1_total_cm", "week2_total_cm"],
        ["day_1_cm", "day_2_cm"],
    )
    temp = render_temperature_desktop_layout(
        [{"query": "A", "day_1_min_c": "-1", "day_1_max_c": "0", "day_2_min_c": "-2", "day_2_max_c": "1"}]
    )
    assert "today" in snow
    assert "day 2" in snow
    assert "today" in temp
    assert "day 2" in temp


def test_render_desktop_and_mobile_fallback():
    out = _render_desktop_and_mobile(
        data=[{"query": "A"}],
        weekly_headers=["week1"],
        daily_headers=["day_1"],
        desktop_renderer=lambda d, w, day: "desktop",
        mobile_renderer=None,
    )
    assert out == "desktop"


def test_table_renderer_sections_and_empty_states():
    assert "No data" in render_snowfall_table([])
    assert "No data" in render_rain_table([])
    assert "No data" in render_weather_table([])
    assert "No data" in render_sun_table([])
    assert "No data" in render_temperature_table([])

    snow = render_snowfall_table([_snow_row()])
    rain = render_rain_table([_rain_row()])
    weather = render_weather_table([_weather_row()])
    sun = render_sun_table([_sun_row()])
    temp = render_temperature_table([_temp_row()])
    assert "data-target-kind=\"snow\"" in snow
    assert "data-target-kind=\"rain\"" in rain
    assert "data-target-kind=\"temp\"" in temp
    assert "<h2>Weather</h2>" in weather
    assert "weather-split-wrap" in weather
    assert "<h2>Sunrise / Sunset</h2>" in sun
    assert "07:01" in sun
    assert "18:23" in sun
    assert "sunrise" in sun
    assert "sunset" in sun
    assert "03-04 Wed" in weather
    assert "☀️" in weather
    assert "🌧️" in weather
    assert "❓" in weather
    assert "data-pass-types='ikon'" in snow
    assert "href='resort/snowbird-ut'" in snow
    assert "cm" in snow and "in" in snow
    assert "mm" in rain and "in" in rain
    assert "°C" in temp and "°F" in temp


def test_build_html_contains_meta_sections():
    html = build_html(
        [_snow_row()],
        [_rain_row()],
        [_weather_row()],
        [_sun_row()],
        [_temp_row()],
        available_filters={"pass_type": {"ikon": 1}},
        applied_filters={"pass_type": ["ikon"], "include_all": False},
    )
    assert "<!doctype html>" in html
    assert "Ski Resorts Weather Forecast" in html
    assert "Powered by" in html
    assert "https://open-meteo.com/en/docs/ecmwf-api" in html
    assert "Feature requests" in html
    assert "<h2>Sunrise / Sunset</h2>" in html
    assert 'id="resort-search-input"' in html
    assert 'id="filter-open-btn"' in html
    assert 'id="filter-modal"' in html
    assert "window.CLOSESNOW_FILTER_META" in html
    assert "include_all" in html
    assert 'data-generated-utc="' in html
    assert re.search(r"data-generated-utc=\"[0-9T:\-]+Z\"", html)


def test_render_payload_html_wires_transform_and_builder(monkeypatch):
    calls = {}

    def fake_snow(reports, display_days=14):  # noqa: ANN001
        calls["snow_days"] = display_days
        return ["snow"]

    def fake_rain(reports, display_days=14):  # noqa: ANN001
        calls["rain_days"] = display_days
        return ["rain"]

    def fake_temp(reports, display_days=14):  # noqa: ANN001
        calls["temp_days"] = display_days
        return ["temp"]

    def fake_weather(reports, display_days=14):  # noqa: ANN001
        calls["weather_days"] = display_days
        return ["weather"]

    def fake_sun(reports, display_days=14):  # noqa: ANN001
        calls["sun_days"] = display_days
        return ["sun"]

    monkeypatch.setattr("src.web.weather_page_render_core.reports_to_snow_rows", fake_snow)
    monkeypatch.setattr("src.web.weather_page_render_core.reports_to_rain_rows", fake_rain)
    monkeypatch.setattr("src.web.weather_page_render_core.reports_to_weather_rows", fake_weather)
    monkeypatch.setattr("src.web.weather_page_render_core.reports_to_sun_rows", fake_sun)
    monkeypatch.setattr("src.web.weather_page_render_core.reports_to_temp_rows", fake_temp)
    monkeypatch.setattr(
        "src.web.weather_page_render_core.build_html",
        lambda snow, rain, weather, sun, temp, **kwargs: f"html:{snow}:{rain}:{weather}:{sun}:{temp}:{bool(kwargs)}",
    )
    out = render_payload_html(
        {
            "reports": [{"query": "A"}],
            "forecast_days": 16,
            "available_filters": {"pass_type": {"ikon": 1}},
            "applied_filters": {"pass_type": ["ikon"]},
        }
    )
    assert out == "html:['snow']:['rain']:['weather']:['sun']:['temp']:True"
    assert calls["snow_days"] == 15
    assert calls["rain_days"] == 15
    assert calls["weather_days"] == 15
    assert calls["sun_days"] == 15
    assert calls["temp_days"] == 15
