from __future__ import annotations

from src.backend.weather_data_server import DEFAULT_RESORTS_FILE, select_resorts_from_query


def _sample_catalog():
    return [
        {
            "resort_id": "snowbird-ut",
            "query": "Snowbird, UT",
            "name": "Snowbird",
            "state": "UT",
            "country": "US",
            "region": "west",
            "pass_types": ["ikon"],
            "default_enabled": True,
        },
        {
            "resort_id": "mt-brighton-mi",
            "query": "Mt Brighton, MI",
            "name": "Mt Brighton",
            "state": "MI",
            "country": "US",
            "region": "east",
            "pass_types": ["epic"],
            "default_enabled": False,
        },
    ]


def test_select_resorts_defaults_to_default_scope(monkeypatch):
    monkeypatch.setattr("src.backend.weather_data_server.load_resort_catalog", lambda path: _sample_catalog())

    selected, resorts_file, applied, available, no_match = select_resorts_from_query({})

    assert selected == []
    assert resorts_file == DEFAULT_RESORTS_FILE
    assert no_match is False
    assert applied["include_default"] is True
    assert applied["search_all"] is True
    assert applied["include_all"] is False
    assert available["pass_type"]["ikon"] == 1
    assert available["pass_type"]["epic"] == 1


def test_select_resorts_search_all_ignores_other_filters(monkeypatch):
    monkeypatch.setattr("src.backend.weather_data_server.load_resort_catalog", lambda path: _sample_catalog())

    selected, resorts_file, applied, available, no_match = select_resorts_from_query(
        {
            "include_default": ["1"],
            "pass_type": ["ikon"],
            "region": ["west"],
            "country": ["US"],
            "search": ["brighton"],
            "search_all": ["1"],
        }
    )

    assert selected == ["Mt Brighton, MI"]
    assert resorts_file == ""
    assert no_match is False
    assert applied["include_default"] is True
    assert applied["search_all"] is True
    assert available["pass_type"]["epic"] == 1


def test_select_resorts_search_filtered_respects_filters(monkeypatch):
    monkeypatch.setattr("src.backend.weather_data_server.load_resort_catalog", lambda path: _sample_catalog())

    selected, resorts_file, applied, _available, no_match = select_resorts_from_query(
        {
            "include_default": ["1"],
            "pass_type": ["ikon"],
            "region": ["west"],
            "country": ["US"],
            "search": ["brighton"],
            "search_all": ["0"],
        }
    )

    assert selected == []
    assert resorts_file == ""
    assert no_match is True
    assert applied["include_default"] is True
    assert applied["search_all"] is False
