from __future__ import annotations

import json
import re
from pathlib import Path

import pytest
from src.backend.runtime import WeatherPayloadBuildRequest, WeatherRuntimeOptions
from src.web.asset_manifest import WEB_ASSET_MANIFEST
from src.web.pipelines.static_site import render_hourly_pages, render_html, write_payload_json
from src.web.static_site_builder import (
    BUNDLE_MANIFEST_FILENAME,
    SITE_MANIFEST_FILENAME,
    StaticBuildRequest,
    StaticFetchRequest,
    StaticRenderRequest,
    build_static_site,
    fetch_static_bundle,
    load_static_bundle,
    render_static_bundle,
)
from src.web.static_site_validator import validate_static_site


def _hourly_context_from_html(html: str) -> dict:
    match = re.search(r"window\.CLOSESNOW_HOURLY_CONTEXT = (\{.*?\});", html, re.S)
    assert match is not None
    return json.loads(match.group(1))


def _static_hourly_payload(resort_id: str = "snowbird-ut") -> dict:
    return {
        "resort_id": resort_id,
        "query": "Snowbird, UT",
        "display_name": "Snowbird, Utah",
        "hours": 2,
        "hourly": {
            "time": ["2026-03-04T00:00", "2026-03-04T01:00"],
            "snowfall": [0.0, 0.1],
            "rain": [0.0, 0.0],
            "precipitation_probability": [20, 10],
            "snow_depth": [100, 100],
            "wind_speed_10m": [5.0, 6.0],
            "wind_direction_10m": [120, 110],
            "visibility": [9000, 8800],
        },
    }


def test_write_payload_json(tmp_path):
    p = tmp_path / "site" / "data.json"
    out = write_payload_json(str(p), {"a": 1})
    assert out == p
    assert json.loads(p.read_text(encoding="utf-8")) == {"a": 1}


def test_render_html(tmp_path, monkeypatch):
    p = tmp_path / "site" / "index.html"
    monkeypatch.setattr("src.web.pipelines.static_site.render_payload_html", lambda payload, **kwargs: "<html>x</html>")
    out = render_html(str(p), {"a": 1})
    assert out == p
    assert p.read_text(encoding="utf-8") == "<html>x</html>"


def test_render_hourly_pages(tmp_path):
    p = tmp_path / "site" / "index.html"
    payload = {
        "reports": [
            {
                "resort_id": "snowbird-ut",
                "query": "Snowbird, UT",
                "display_name": "Snowbird, Utah",
                "region": "west",
                "admin1": "UT",
                "country": "US",
                "pass_types": ["ikon"],
                "nearby_airports": [
                    {
                        "airport_id": "slc-salt-lake-city",
                        "iata_code": "SLC",
                        "display_name": "Salt Lake City International Airport",
                        "location_label": "Salt Lake City, UT, US",
                        "latitude": 40.7884,
                        "longitude": -111.9778,
                        "distance_miles": 22.4,
                    }
                ],
                "daily": [
                    {
                        "date": "2026-03-13",
                        "weather_code": 3,
                        "temperature_max_c": 3,
                        "temperature_min_c": -5,
                        "snowfall_cm": 2.0,
                        "rain_mm": 0.0,
                        "sunrise_local_hhmm": "07:24",
                        "sunset_local_hhmm": "19:31",
                    }
                ],
                "past_14d_daily": [
                    {"date": "2026-03-01", "weather_code": 3},
                    {"date": "2026-03-02", "weather_code": 45},
                    {"date": "2026-03-03", "weather_code": 61},
                    {"date": "2026-03-04", "weather_code": 71},
                    {"date": "2026-03-05", "weather_code": 3},
                    {"date": "2026-03-06", "weather_code": 1},
                    {"date": "2026-03-07", "weather_code": 2},
                    {"date": "2026-03-08", "weather_code": 0},
                    {"date": "2026-03-09", "weather_code": 3},
                    {"date": "2026-03-10", "weather_code": 45},
                    {"date": "2026-03-11", "weather_code": 61},
                    {"date": "2026-03-12", "weather_code": 71},
                    {"date": "2026-03-13", "weather_code": 3},
                    {"date": "2026-03-14", "weather_code": 1},
                ],
            },
            {"resort_id": "snowbird-ut"},
            {"resort_id": "alta-ut", "query": "Alta, UT", "daily": []},
        ]
    }
    outputs = render_hourly_pages(str(p), payload)
    assert [x.relative_to(tmp_path / "site").as_posix() for x in outputs] == [
        "resort/snowbird-ut/index.html",
        "resort/alta-ut/index.html",
    ]
    html = outputs[0].read_text(encoding="utf-8")
    assert "../../assets/css/resort_hourly.css" in html
    assert "../../assets/css/field_guide_foundation.css" in html
    assert html.index("../../assets/css/resort_hourly.css") < html.index("../../assets/css/field_guide_foundation.css")
    assert "../../assets/js/field_guide_foundation.js" in html
    assert "../../assets/js/compact_daily_summary.js" not in html
    assert "../../assets/js/resort_hourly_metrics.js" in html
    assert html.index("../../assets/js/resort_hourly_metrics.js") < html.index("../../assets/js/resort_hourly.js")
    assert "../../assets/js/weather_code_emoji.js" not in html
    assert "data-field-guide-unit-toggle" in html
    assert '<h1 id="hourly-title">Loading resort…</h1>' in html
    assert 'class="resort-masthead"' in html
    assert 'id="resort-context"' in html
    assert 'id="resort-outlook"' in html
    assert 'id="resort-snapshot"' in html
    assert 'id="resort-timeline-root"' in html
    assert 'role="tablist" aria-label="Hourly forecast layers"' in html
    assert 'data-hourly-group="storm"' in html
    assert 'data-hourly-group="wind"' in html
    assert 'data-hourly-group="visibility"' in html
    assert 'id="hourly-narrative"' in html
    assert 'id="hourly-charts"' in html
    assert 'class="raw-data-panel"' in html
    context = _hourly_context_from_html(html)
    assert context["resortId"] == "snowbird-ut"
    assert context["dailySummary"]["display_name"] == "Snowbird, Utah"
    assert context["dailySummary"]["region"] == "west"
    assert context["dailySummary"]["admin1"] == "UT"
    assert context["dailySummary"]["country"] == "US"
    assert context["dailySummary"]["pass_types"] == ["ikon"]
    assert context["dailySummary"]["nearbyAirports"][0]["iata_code"] == "SLC"
    assert context["dailySummary"]["past14dDaily"][0]["date"] == "2026-03-01"
    assert context["dailySummary"]["past14dDaily"][-1]["date"] == "2026-03-14"


def test_render_hourly_pages_uses_supplied_static_hourly_data(tmp_path):
    p = tmp_path / "site" / "index.html"
    payload = {
        "reports": [
            {
                "resort_id": "snowbird-ut",
                "query": "Snowbird, UT",
                "display_name": "Snowbird, Utah",
                "nearby_airports": [{"airport_id": "slc-salt-lake-city", "iata_code": "SLC"}],
                "daily": [{"date": "2026-03-13"}],
                "past_14d_daily": [{"date": "2026-03-06"}, {"date": "2026-03-07"}, {"date": "2026-03-08"}],
            }
        ]
    }

    hourly_payload = {
        "resort_id": "snowbird-ut",
        "query": "Snowbird, UT",
        "display_name": "Snowbird, Utah",
        "hours": 2,
        "hourly": {
            "time": ["2026-03-04T00:00", "2026-03-04T01:00"],
            "snowfall": [0.0, 0.1],
            "rain": [0.0, 0.0],
            "precipitation_probability": [20, 10],
            "snow_depth": [100, 100],
            "wind_speed_10m": [5.0, 6.0],
            "wind_direction_10m": [120, 110],
            "visibility": [9000, 8800],
        },
    }

    outputs = render_hourly_pages(str(p), payload, hourly_payloads={"snowbird-ut": hourly_payload})
    assert len(outputs) == 1
    hourly_json = tmp_path / "site" / "resort" / "snowbird-ut" / "hourly.json"
    assert hourly_json.exists()
    assert json.loads(hourly_json.read_text(encoding="utf-8")) == hourly_payload
    html = outputs[0].read_text(encoding="utf-8")
    context = _hourly_context_from_html(html)
    assert context["hourlyDataUrl"] == "./hourly.json"
    assert context["dailySummary"]["display_name"] == "Snowbird, Utah"
    assert context["dailySummary"]["nearbyAirports"][0]["iata_code"] == "SLC"
    assert len(context["dailySummary"]["past14dDaily"]) == 3


def test_render_hourly_pages_removes_stale_hourly_data_when_bundle_has_none(tmp_path):
    p = tmp_path / "site" / "index.html"
    payload = {
        "reports": [
            {
                "resort_id": "snowbird-ut",
                "query": "Snowbird, UT",
                "display_name": "Snowbird, Utah",
                "nearby_airports": [{"airport_id": "slc-salt-lake-city", "iata_code": "SLC"}],
                "daily": [{"date": "2026-03-13"}],
                "past_14d_daily": [{"date": "2026-03-06"}, {"date": "2026-03-07"}, {"date": "2026-03-08"}],
            }
        ]
    }

    hourly_json = tmp_path / "site" / "resort" / "snowbird-ut" / "hourly.json"
    hourly_json.parent.mkdir(parents=True)
    hourly_json.write_text('{"stale": true}', encoding="utf-8")

    outputs = render_hourly_pages(str(p), payload, hourly_payloads={"snowbird-ut": None})
    assert len(outputs) == 1
    assert not hourly_json.exists()
    html = outputs[0].read_text(encoding="utf-8")
    context = _hourly_context_from_html(html)
    assert "hourlyDataUrl" not in context
    assert context["dailySummary"]["display_name"] == "Snowbird, Utah"
    assert context["dailySummary"]["nearbyAirports"][0]["iata_code"] == "SLC"
    assert len(context["dailySummary"]["past14dDaily"]) == 3


def test_render_hourly_pages_preserves_safe_custom_resort_ids(tmp_path):
    index_path = tmp_path / "site" / "index.html"
    payload = {
        "reports": [
            {
                "resort_id": "Snowbird_UT",
                "query": "Snowbird, UT",
                "daily": [],
            }
        ]
    }

    outputs = render_hourly_pages(str(index_path), payload)

    assert outputs == [tmp_path / "site" / "resort" / "Snowbird_UT" / "index.html"]


def test_fetch_static_bundle_writes_daily_and_hourly_with_shared_runtime(monkeypatch, tmp_path, valid_payload):
    valid_payload["reports"][0]["resort_id"] = "snowbird-ut"
    output_json = tmp_path / "bundle" / "data.json"
    runtime = WeatherRuntimeOptions(
        cache_file=".cache/test.json",
        geocode_cache_hours=111,
        forecast_cache_hours=7,
        max_workers=6,
        api_retries=4,
    )
    payload_request = WeatherPayloadBuildRequest(
        resorts=("Snowbird, UT",),
        output_json=str(output_json),
        runtime=runtime,
    )
    captured = {}

    def fake_daily(request):  # noqa: ANN001
        captured["daily_request"] = request
        return valid_payload

    def fake_hourly(**kwargs):  # noqa: ANN001
        captured["hourly_kwargs"] = kwargs
        return {"snowbird-ut": _static_hourly_payload()}

    monkeypatch.setattr("src.web.static_site_builder.build_weather_payload_for_request", fake_daily)
    monkeypatch.setattr("src.web.static_site_builder.build_hourly_payloads_for_resorts", fake_hourly)

    result = fetch_static_bundle(StaticFetchRequest(payload_request, hourly_hours=48))

    assert captured["daily_request"] is payload_request
    assert captured["hourly_kwargs"] == {
        "resort_ids": ["snowbird-ut"],
        "hours": 48,
        "cache_file": ".cache/test.json",
        "geocode_cache_hours": 111,
        "forecast_cache_hours": 7,
        "max_workers": 6,
        "api_retries": 4,
    }
    assert json.loads(output_json.read_text(encoding="utf-8")) == valid_payload
    hourly_path = output_json.parent / "resort" / "snowbird-ut" / "hourly.json"
    assert json.loads(hourly_path.read_text(encoding="utf-8")) == _static_hourly_payload()
    manifest = json.loads((output_json.parent / BUNDLE_MANIFEST_FILENAME).read_text(encoding="utf-8"))
    assert manifest["hourly"] == {"snowbird-ut": "resort/snowbird-ut/hourly.json"}
    assert manifest["missing_hourly"] == []
    assert result.hourly_json_paths == (hourly_path.resolve(),)


def test_fetch_static_bundle_removes_failed_stale_hourly_but_preserves_unknown_files(
    monkeypatch, tmp_path, valid_payload
):
    valid_payload["reports"][0]["resort_id"] = "snowbird-ut"
    output_json = tmp_path / "bundle" / "data.json"
    request = StaticFetchRequest(WeatherPayloadBuildRequest(output_json=str(output_json)))
    monkeypatch.setattr(
        "src.web.static_site_builder.build_weather_payload_for_request",
        lambda payload_request: valid_payload,
    )
    monkeypatch.setattr(
        "src.web.static_site_builder.build_hourly_payloads_for_resorts",
        lambda **kwargs: {"snowbird-ut": _static_hourly_payload()},
    )
    fetch_static_bundle(request)
    route_dir = output_json.parent / "resort" / "snowbird-ut"
    custom_file = route_dir / "notes.txt"
    custom_file.write_text("keep", encoding="utf-8")

    monkeypatch.setattr(
        "src.web.static_site_builder.build_hourly_payloads_for_resorts",
        lambda **kwargs: {"snowbird-ut": {"error": "temporary failure"}},
    )
    result = fetch_static_bundle(request)

    assert not (route_dir / "hourly.json").exists()
    assert custom_file.read_text(encoding="utf-8") == "keep"
    manifest = json.loads((output_json.parent / BUNDLE_MANIFEST_FILENAME).read_text(encoding="utf-8"))
    assert manifest["hourly"] == {}
    assert manifest["missing_hourly"] == ["snowbird-ut"]
    assert result.bundle.missing_hourly_resort_ids == ("snowbird-ut",)


@pytest.mark.parametrize("invalid_kind", ["swapped-resort", "malformed-series"])
def test_fetch_static_bundle_rejects_mismatched_or_malformed_hourly_payloads(
    monkeypatch, tmp_path, valid_payload, invalid_kind
):
    valid_payload["reports"][0]["resort_id"] = "snowbird-ut"
    output_json = tmp_path / "bundle" / "data.json"
    invalid_hourly = _static_hourly_payload()
    if invalid_kind == "swapped-resort":
        invalid_hourly["resort_id"] = "alta-ut"
    else:
        invalid_hourly["hourly"]["snowfall"] = "not-a-list"
    monkeypatch.setattr(
        "src.web.static_site_builder.build_weather_payload_for_request",
        lambda request: valid_payload,
    )
    monkeypatch.setattr(
        "src.web.static_site_builder.build_hourly_payloads_for_resorts",
        lambda **kwargs: {"snowbird-ut": invalid_hourly},
    )

    result = fetch_static_bundle(StaticFetchRequest(WeatherPayloadBuildRequest(output_json=str(output_json))))

    assert result.bundle.missing_hourly_resort_ids == ("snowbird-ut",)
    assert not (output_json.parent / "resort" / "snowbird-ut" / "hourly.json").exists()
    manifest = json.loads((output_json.parent / BUNDLE_MANIFEST_FILENAME).read_text(encoding="utf-8"))
    assert manifest["hourly"] == {}


@pytest.mark.parametrize("invalid_kind", ["swapped-resort", "malformed-series"])
def test_load_static_bundle_rejects_manifest_hourly_with_wrong_identity_or_shape(
    monkeypatch, tmp_path, valid_payload, invalid_kind
):
    valid_payload["reports"][0]["resort_id"] = "snowbird-ut"
    output_json = tmp_path / "bundle" / "data.json"
    monkeypatch.setattr(
        "src.web.static_site_builder.build_weather_payload_for_request",
        lambda request: valid_payload,
    )
    monkeypatch.setattr(
        "src.web.static_site_builder.build_hourly_payloads_for_resorts",
        lambda **kwargs: {"snowbird-ut": _static_hourly_payload()},
    )
    fetch_static_bundle(StaticFetchRequest(WeatherPayloadBuildRequest(output_json=str(output_json))))
    hourly_path = output_json.parent / "resort" / "snowbird-ut" / "hourly.json"
    invalid_hourly = _static_hourly_payload()
    if invalid_kind == "swapped-resort":
        invalid_hourly["resort_id"] = "alta-ut"
    else:
        invalid_hourly["hourly"]["visibility"] = [9000]
    hourly_path.write_text(json.dumps(invalid_hourly), encoding="utf-8")

    bundle = load_static_bundle(str(output_json))

    assert bundle.hourly_payloads["snowbird-ut"] is None
    assert bundle.missing_hourly_resort_ids == ("snowbird-ut",)


def test_render_static_bundle_is_offline_and_self_contained_for_external_output(monkeypatch, tmp_path, valid_payload):
    valid_payload["reports"][0]["resort_id"] = "snowbird-ut"
    input_json = tmp_path / "bundle" / "weather.json"
    payload_request = WeatherPayloadBuildRequest(output_json=str(input_json))
    monkeypatch.setattr(
        "src.web.static_site_builder.build_weather_payload_for_request",
        lambda request: valid_payload,
    )
    monkeypatch.setattr(
        "src.web.static_site_builder.build_hourly_payloads_for_resorts",
        lambda **kwargs: {"snowbird-ut": _static_hourly_payload()},
    )
    fetch_static_bundle(StaticFetchRequest(payload_request))

    def fail_if_called(*args, **kwargs):  # noqa: ANN002, ANN003
        raise AssertionError("render attempted to fetch data")

    monkeypatch.setattr("src.web.static_site_builder.build_weather_payload_for_request", fail_if_called)
    monkeypatch.setattr("src.web.static_site_builder.build_hourly_payloads_for_resorts", fail_if_called)
    output_dir = tmp_path / "deploy"
    output_dir.mkdir()
    unknown_file = output_dir / "keep.txt"
    unknown_file.write_text("keep", encoding="utf-8")

    result = render_static_bundle(StaticRenderRequest(input_json=str(input_json), output_dir=str(output_dir)))

    assert json.loads((output_dir / "data.json").read_text(encoding="utf-8")) == valid_payload
    assert (
        json.loads((output_dir / "resort" / "snowbird-ut" / "hourly.json").read_text(encoding="utf-8"))
        == _static_hourly_payload()
    )
    assert '"dataUrl": "./data.json"' in result.index_html.read_text(encoding="utf-8")
    assert '"hourlyDataUrl": "./hourly.json"' in result.hourly_page_paths[0].read_text(encoding="utf-8")
    assert unknown_file.read_text(encoding="utf-8") == "keep"
    assert not validate_static_site(output_dir)
    assert all((output_dir / asset.repository_path).is_file() for asset in WEB_ASSET_MANIFEST)


def test_split_and_one_shot_static_builds_are_artifact_equivalent(monkeypatch, tmp_path, valid_payload):
    valid_payload["reports"][0]["resort_id"] = "snowbird-ut"
    monkeypatch.setattr(
        "src.web.static_site_builder.build_weather_payload_for_request",
        lambda request: valid_payload,
    )
    monkeypatch.setattr(
        "src.web.static_site_builder.build_hourly_payloads_for_resorts",
        lambda **kwargs: {"snowbird-ut": _static_hourly_payload()},
    )
    split_dir = tmp_path / "split"
    one_shot_dir = tmp_path / "one-shot"
    split_fetch = StaticFetchRequest(WeatherPayloadBuildRequest(output_json=str(split_dir / "data.json")))
    split_render = StaticRenderRequest(input_json=str(split_dir / "data.json"), output_dir=str(split_dir))
    fetch_static_bundle(split_fetch)
    render_static_bundle(split_render)

    one_shot_fetch = StaticFetchRequest(WeatherPayloadBuildRequest(output_json=str(one_shot_dir / "data.json")))
    one_shot_render = StaticRenderRequest(input_json=str(one_shot_dir / "data.json"), output_dir=str(one_shot_dir))
    build_static_site(StaticBuildRequest(fetch=one_shot_fetch, render=one_shot_render))

    def artifact_tree(root: Path) -> dict[str, bytes]:
        return {path.relative_to(root).as_posix(): path.read_bytes() for path in root.rglob("*") if path.is_file()}

    assert artifact_tree(split_dir) == artifact_tree(one_shot_dir)


def test_render_static_bundle_cleans_only_owned_stale_route_files(monkeypatch, tmp_path, valid_payload):
    valid_payload["reports"][0]["resort_id"] = "snowbird-ut"
    output_dir = tmp_path / "site"
    input_json = output_dir / "data.json"
    monkeypatch.setattr(
        "src.web.static_site_builder.build_weather_payload_for_request",
        lambda request: valid_payload,
    )
    monkeypatch.setattr(
        "src.web.static_site_builder.build_hourly_payloads_for_resorts",
        lambda **kwargs: {resort_id: _static_hourly_payload(resort_id) for resort_id in kwargs["resort_ids"]},
    )
    request = StaticFetchRequest(WeatherPayloadBuildRequest(output_json=str(input_json)))
    fetch_static_bundle(request)
    render_static_bundle(StaticRenderRequest(input_json=str(input_json), output_dir=str(output_dir)))
    old_route = output_dir / "resort" / "snowbird-ut"
    unknown_file = old_route / "notes.txt"
    unknown_file.write_text("keep", encoding="utf-8")

    valid_payload["reports"][0]["resort_id"] = "alta-ut"
    fetch_static_bundle(request)
    render_static_bundle(StaticRenderRequest(input_json=str(input_json), output_dir=str(output_dir)))

    assert not (old_route / "index.html").exists()
    assert not (old_route / "hourly.json").exists()
    assert unknown_file.read_text(encoding="utf-8") == "keep"
    assert (output_dir / "resort" / "alta-ut" / "index.html").is_file()
    assert (output_dir / "resort" / "alta-ut" / "hourly.json").is_file()


def test_external_render_replaces_stale_bundle_manifest_with_deployed_bundle(monkeypatch, tmp_path, valid_payload):
    valid_payload["reports"][0]["resort_id"] = "snowbird-ut"
    monkeypatch.setattr(
        "src.web.static_site_builder.build_weather_payload_for_request",
        lambda request: valid_payload,
    )
    monkeypatch.setattr(
        "src.web.static_site_builder.build_hourly_payloads_for_resorts",
        lambda **kwargs: {resort_id: _static_hourly_payload(resort_id) for resort_id in kwargs["resort_ids"]},
    )
    old_input = tmp_path / "old-bundle" / "data.json"
    output_dir = tmp_path / "deploy"
    fetch_static_bundle(StaticFetchRequest(WeatherPayloadBuildRequest(output_json=str(old_input))))
    render_static_bundle(StaticRenderRequest(input_json=str(old_input), output_dir=str(output_dir)))

    valid_payload["reports"][0]["resort_id"] = "alta-ut"
    new_input = tmp_path / "new-bundle" / "data.json"
    fetch_static_bundle(StaticFetchRequest(WeatherPayloadBuildRequest(output_json=str(new_input))))
    render_static_bundle(StaticRenderRequest(input_json=str(new_input), output_dir=str(output_dir)))

    manifest = json.loads((output_dir / BUNDLE_MANIFEST_FILENAME).read_text(encoding="utf-8"))
    assert manifest["daily_json"] == "data.json"
    assert manifest["hourly"] == {"alta-ut": "resort/alta-ut/hourly.json"}
    deployed_bundle = load_static_bundle(str(output_dir / "data.json"))
    assert deployed_bundle.missing_hourly_resort_ids == ()
    assert set(deployed_bundle.hourly_payloads) == {"alta-ut"}


def test_render_static_bundle_cleans_manifest_owned_stale_assets_only(monkeypatch, tmp_path, valid_payload):
    valid_payload["reports"][0]["resort_id"] = "snowbird-ut"
    input_json = tmp_path / "bundle" / "data.json"
    output_dir = tmp_path / "deploy"
    monkeypatch.setattr(
        "src.web.static_site_builder.build_weather_payload_for_request",
        lambda request: valid_payload,
    )
    monkeypatch.setattr(
        "src.web.static_site_builder.build_hourly_payloads_for_resorts",
        lambda **kwargs: {"snowbird-ut": _static_hourly_payload()},
    )
    fetch_static_bundle(StaticFetchRequest(WeatherPayloadBuildRequest(output_json=str(input_json))))
    render_request = StaticRenderRequest(input_json=str(input_json), output_dir=str(output_dir))
    render_static_bundle(render_request)

    stale_asset = output_dir / "assets" / "css" / "obsolete.css"
    unknown_asset = output_dir / "assets" / "css" / "user-theme.css"
    stale_asset.write_text("obsolete", encoding="utf-8")
    unknown_asset.write_text("custom", encoding="utf-8")
    site_manifest_path = output_dir / SITE_MANIFEST_FILENAME
    site_manifest = json.loads(site_manifest_path.read_text(encoding="utf-8"))
    site_manifest["assets"].append("assets/css/obsolete.css")
    site_manifest_path.write_text(json.dumps(site_manifest), encoding="utf-8")

    render_static_bundle(render_request)

    assert not stale_asset.exists()
    assert unknown_asset.read_text(encoding="utf-8") == "custom"


def test_static_builder_rejects_traversal_resort_ids_before_fetch_or_render(monkeypatch, tmp_path, valid_payload):
    valid_payload["reports"][0]["resort_id"] = ".."
    input_json = tmp_path / "bundle" / "data.json"
    fetch_request = StaticFetchRequest(WeatherPayloadBuildRequest(output_json=str(input_json)))
    monkeypatch.setattr(
        "src.web.static_site_builder.build_weather_payload_for_request",
        lambda request: valid_payload,
    )

    def fail_if_hourly_fetch_starts(**kwargs):  # noqa: ANN003
        raise AssertionError("invalid resort id reached hourly fetch")

    monkeypatch.setattr(
        "src.web.static_site_builder.build_hourly_payloads_for_resorts",
        fail_if_hourly_fetch_starts,
    )
    with pytest.raises(ValueError, match="Invalid resort_id"):
        fetch_static_bundle(fetch_request)
    assert not input_json.exists()

    write_payload_json(str(input_json), valid_payload)
    output_dir = tmp_path / "deploy"
    with pytest.raises(ValueError, match="Invalid resort_id"):
        render_static_bundle(StaticRenderRequest(input_json=str(input_json), output_dir=str(output_dir)))
    assert not output_dir.exists()


def test_render_static_bundle_rejects_symlink_escape_and_preserves_external_files(monkeypatch, tmp_path, valid_payload):
    valid_payload["reports"][0]["resort_id"] = "snowbird-ut"
    input_json = tmp_path / "bundle" / "data.json"
    monkeypatch.setattr(
        "src.web.static_site_builder.build_weather_payload_for_request",
        lambda request: valid_payload,
    )
    monkeypatch.setattr(
        "src.web.static_site_builder.build_hourly_payloads_for_resorts",
        lambda **kwargs: {"snowbird-ut": _static_hourly_payload()},
    )
    fetch_static_bundle(StaticFetchRequest(WeatherPayloadBuildRequest(output_json=str(input_json))))

    output_dir = tmp_path / "deploy"
    resort_root = output_dir / "resort"
    resort_root.mkdir(parents=True)
    outside_dir = tmp_path / "outside"
    outside_dir.mkdir()
    outside_index = outside_dir / "index.html"
    outside_hourly = outside_dir / "hourly.json"
    outside_index.write_text("external index", encoding="utf-8")
    outside_hourly.write_text("external hourly", encoding="utf-8")
    (resort_root / "snowbird-ut").symlink_to(outside_dir, target_is_directory=True)

    with pytest.raises(ValueError, match="must not contain symlinks"):
        render_static_bundle(StaticRenderRequest(input_json=str(input_json), output_dir=str(output_dir)))

    assert outside_index.read_text(encoding="utf-8") == "external index"
    assert outside_hourly.read_text(encoding="utf-8") == "external hourly"
