from __future__ import annotations

import threading

from src.backend.models import ResortLocation
from src.backend.services.hourly_payload_service import build_hourly_payload_for_resort, build_hourly_payloads_for_resorts


class _DummyJsonCache:
    def __init__(self) -> None:
        self.saved = False

    def save(self) -> None:
        self.saved = True
        return None


class _DummyCoordCache:
    def __init__(self) -> None:
        self.set_calls = []
        self.saved = False

    def set(self, key, value):  # noqa: ANN001
        self.set_calls.append((key, value))

    def save(self) -> None:
        self.saved = True


def test_hourly_payload_uses_catalog_coordinate_override(monkeypatch, tmp_path):
    monkeypatch.setattr(
        "src.backend.services.hourly_payload_service.load_supported_resort_catalog",
        lambda: [
            {
                "resort_id": "crystal-mountain-wa",
                "query": "Crystal Mountain, WA",
                "name": "Crystal Mountain",
                "display_name": "Crystal Mountain, WA",
                "website": "https://www.crystalmountainresort.com/",
                "state": "WA",
                "country": "US",
                "region": "west",
                "subregion": "west-coast",
                "pass_types": ["ikon"],
                "latitude": 46.9355117,
                "longitude": -121.4750288,
            }
        ],
    )
    monkeypatch.setattr("src.backend.services.hourly_payload_service.dated_cache_path", lambda path: str(tmp_path / "dated_cache.json"))
    monkeypatch.setattr("src.backend.services.hourly_payload_service.JsonCache", lambda path: _DummyJsonCache())
    coord_cache = _DummyCoordCache()
    monkeypatch.setattr("src.backend.services.hourly_payload_service.ResortCoordinateCache", lambda path: coord_cache)
    monkeypatch.setattr(
        "src.backend.services.hourly_payload_service.load_airport_catalog",
        lambda: [
            {
                "airport_id": "sea-seattle-tacoma",
                "iata_code": "SEA",
                "display_name": "Seattle-Tacoma International Airport",
                "location_label": "Seattle, WA, US",
                "latitude": 47.450249,
                "longitude": -122.308817,
            }
        ],
    )

    def fake_geocode(query, cache, ttl_seconds, coord_cache):  # noqa: ANN001
        assert query == "Crystal Mountain, WA"
        assert coord_cache.set_calls
        seed = coord_cache.set_calls[-1][1]
        return ResortLocation(
            query=query,
            name=str(seed["name"]),
            latitude=float(seed["latitude"]),
            longitude=float(seed["longitude"]),
            country=str(seed["country"]),
            admin1=str(seed["admin1"]),
        )

    monkeypatch.setattr("src.backend.services.hourly_payload_service.geocode", fake_geocode)
    monkeypatch.setattr(
        "src.backend.services.hourly_payload_service.fetch_hourly_forecast",
        lambda location, cache, ttl_seconds, hours: {
            "latitude": location.latitude,
            "longitude": location.longitude,
            "timezone": "America/Los_Angeles",
            "hourly": {"time": []},
        },
    )

    payload = build_hourly_payload_for_resort(
        resort_id="crystal-mountain-wa",
        hours=72,
        cache_file=".cache/open_meteo_cache.json",
        geocode_cache_hours=720,
        forecast_cache_hours=3,
    )

    assert payload is not None
    assert payload["matched_name"] == "Crystal Mountain"
    assert payload["input_latitude"] == 46.9355117
    assert payload["input_longitude"] == -121.4750288
    assert payload["resolved_latitude"] == 46.9355117
    assert payload["resolved_longitude"] == -121.4750288
    assert payload["nearby_airports"][0]["iata_code"] == "SEA"
    assert coord_cache.saved is True


def test_bulk_hourly_payloads_share_catalog_cache_and_airports(monkeypatch, tmp_path):
    monkeypatch.setattr(
        "src.backend.services.hourly_payload_service.load_supported_resort_catalog",
        lambda: [
            {
                "resort_id": "snowbird-ut",
                "query": "Snowbird, UT",
                "display_name": "Snowbird",
                "country": "US",
                "region": "west",
                "subregion": "rockies",
                "pass_types": ["ikon"],
                "latitude": 40.581,
                "longitude": -111.657,
            },
            {
                "resort_id": "alta-ut",
                "query": "Alta, UT",
                "display_name": "Alta",
                "country": "US",
                "region": "west",
                "subregion": "rockies",
                "pass_types": ["ikon"],
                "latitude": 40.588,
                "longitude": -111.637,
            },
        ],
    )
    monkeypatch.setattr("src.backend.services.hourly_payload_service.dated_cache_path", lambda path: str(tmp_path / "dated_cache.json"))
    json_cache = _DummyJsonCache()
    coord_cache = _DummyCoordCache()
    monkeypatch.setattr("src.backend.services.hourly_payload_service.JsonCache", lambda path: json_cache)
    monkeypatch.setattr("src.backend.services.hourly_payload_service.ResortCoordinateCache", lambda path: coord_cache)
    monkeypatch.setattr(
        "src.backend.services.hourly_payload_service.load_airport_catalog",
        lambda: [
            {
                "airport_id": "slc-salt-lake-city",
                "iata_code": "SLC",
                "display_name": "Salt Lake City International Airport",
                "location_label": "Salt Lake City, UT, US",
                "latitude": 40.7884,
                "longitude": -111.9778,
            }
        ],
    )

    geocoded_queries = []
    fetch_barrier = threading.Barrier(2)

    def fake_geocode(query, cache, ttl_seconds, coord_cache):  # noqa: ANN001
        geocoded_queries.append(query)
        seed = next(value for key, value in coord_cache.set_calls if key == query)
        return ResortLocation(
            query=query,
            name=str(seed["name"]),
            latitude=float(seed["latitude"]),
            longitude=float(seed["longitude"]),
            country=str(seed["country"]),
            admin1=str(seed["admin1"]),
        )

    monkeypatch.setattr("src.backend.services.hourly_payload_service.geocode", fake_geocode)

    def fake_fetch_hourly_forecast(location, cache, ttl_seconds, hours):  # noqa: ANN001
        fetch_barrier.wait(timeout=1)
        return {
            "latitude": location.latitude,
            "longitude": location.longitude,
            "timezone": "America/Denver",
            "hourly": {
                "time": ["2026-03-04T00:00", "2026-03-04T01:00", "2026-03-04T02:00"],
                "snowfall": [0.0, 0.1, 0.2],
                "rain": [0.0, 0.0, 0.0],
                "precipitation_probability": [20, 10, 5],
                "snow_depth": [100, 100, 101],
                "wind_speed_10m": [5.0, 6.0, 7.0],
                "wind_direction_10m": [120, 110, 100],
                "visibility": [9000, 8800, 8700],
            },
        }

    monkeypatch.setattr("src.backend.services.hourly_payload_service.fetch_hourly_forecast", fake_fetch_hourly_forecast)

    payloads = build_hourly_payloads_for_resorts(
        resort_ids=["snowbird-ut", "missing-id", "alta-ut"],
        hours=2,
        cache_file=".cache/open_meteo_cache.json",
        geocode_cache_hours=720,
        forecast_cache_hours=3,
        max_workers=2,
    )

    assert sorted(payloads) == ["alta-ut", "missing-id", "snowbird-ut"]
    assert payloads["missing-id"] is None
    assert payloads["snowbird-ut"]["hours"] == 2
    assert payloads["snowbird-ut"]["hourly"]["time"] == ["2026-03-04T00:00", "2026-03-04T01:00"]
    assert payloads["alta-ut"]["nearby_airports"][0]["iata_code"] == "SLC"
    assert sorted(geocoded_queries) == ["Alta, UT", "Snowbird, UT"]
    assert json_cache.saved is True
    assert coord_cache.saved is True
