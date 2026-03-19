from __future__ import annotations

from src.backend.models import ResortLocation
from src.backend.weather_data_server import _hourly_payload_for_resort


class _DummyJsonCache:
    def save(self) -> None:
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
        "src.backend.weather_data_server.load_resort_catalog",
        lambda path: [
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
    monkeypatch.setattr("src.backend.weather_data_server.dated_cache_path", lambda path: str(tmp_path / "dated_cache.json"))
    monkeypatch.setattr("src.backend.weather_data_server.JsonCache", lambda path: _DummyJsonCache())
    coord_cache = _DummyCoordCache()
    monkeypatch.setattr("src.backend.weather_data_server.ResortCoordinateCache", lambda path: coord_cache)

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

    monkeypatch.setattr("src.backend.weather_data_server.geocode", fake_geocode)
    monkeypatch.setattr(
        "src.backend.weather_data_server.fetch_hourly_forecast",
        lambda location, cache, ttl_seconds, hours: {
            "latitude": location.latitude,
            "longitude": location.longitude,
            "timezone": "America/Los_Angeles",
            "hourly": {"time": []},
        },
    )

    payload = _hourly_payload_for_resort(
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
    assert coord_cache.saved is True
