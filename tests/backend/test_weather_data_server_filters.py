from __future__ import annotations

from src.backend.services.resort_selection_service import select_resorts_from_query
from src.shared.config import DEFAULT_RESORTS_FILE


def _sample_catalog():
    return [
        {
            "resort_id": "snowbird-ut",
            "query": "Snowbird, UT",
            "name": "Snowbird",
            "city": "Salt Lake County",
            "address": "Snowbird, Salt Lake County, Utah, United States",
            "state": "UT",
            "state_name": "Utah",
            "country": "US",
            "country_name": "United States",
            "region": "west",
            "subregion": "rockies",
            "pass_types": ["ikon"],
            "default_enabled": True,
        },
        {
            "resort_id": "mt-brighton-mi",
            "query": "Mt Brighton, MI",
            "name": "Mt Brighton",
            "city": "Brighton",
            "address": "Brighton, Livingston County, Michigan, United States",
            "state": "MI",
            "state_name": "Michigan",
            "country": "US",
            "country_name": "United States",
            "region": "east",
            "subregion": "midwest",
            "pass_types": ["epic"],
            "default_enabled": False,
        },
    ]


def test_select_resorts_defaults_to_default_scope(monkeypatch):
    monkeypatch.setattr("src.backend.services.resort_selection_service.load_resort_catalog", lambda path: _sample_catalog())

    selected, resorts_file, applied, available, no_match = select_resorts_from_query({})

    assert selected == []
    assert resorts_file == DEFAULT_RESORTS_FILE
    assert no_match is False
    assert applied["include_default"] is True
    assert applied["search_all"] is True
    assert applied["include_all"] is False
    assert applied["subregion"] == []
    assert applied["country"] == []
    assert available["pass_type"]["ikon"] == 1
    assert available["pass_type"]["epic"] == 1


def test_select_resorts_search_all_ignores_other_filters(monkeypatch):
    monkeypatch.setattr("src.backend.services.resort_selection_service.load_resort_catalog", lambda path: _sample_catalog())

    selected, resorts_file, applied, available, no_match = select_resorts_from_query(
        {
            "include_default": ["1"],
            "pass_type": ["ikon"],
            "region": ["west"],
            "subregion": ["rockies"],
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
    assert applied["subregion"] == ["rockies"]
    assert applied["country"] == ["US"]
    assert available["pass_type"]["epic"] == 1


def test_select_resorts_search_filtered_respects_filters(monkeypatch):
    monkeypatch.setattr("src.backend.services.resort_selection_service.load_resort_catalog", lambda path: _sample_catalog())

    selected, resorts_file, applied, _available, no_match = select_resorts_from_query(
        {
            "include_default": ["1"],
            "pass_type": ["ikon"],
            "region": ["west"],
            "subregion": ["rockies"],
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


def test_select_resorts_accepts_multi_value_subregion_and_country(monkeypatch):
    monkeypatch.setattr("src.backend.services.resort_selection_service.load_resort_catalog", lambda path: _sample_catalog())

    selected, resorts_file, applied, _available, no_match = select_resorts_from_query(
        {
            "subregion": ["rockies,midwest"],
            "country": ["US,CA"],
            "include_all": ["1"],
        }
    )

    assert selected == ["Snowbird, UT", "Mt Brighton, MI"]
    assert resorts_file == ""
    assert no_match is False
    assert applied["subregion"] == ["rockies", "midwest"]
    assert applied["country"] == ["US", "CA"]


def test_select_resorts_supports_long_form_state_country_and_city(monkeypatch):
    monkeypatch.setattr("src.backend.services.resort_selection_service.load_resort_catalog", lambda path: _sample_catalog())

    selected_state, _file, _applied, _available, no_match_state = select_resorts_from_query(
        {"search": ["utah"], "search_all": ["1"], "include_all": ["1"]}
    )
    assert selected_state == ["Snowbird, UT"]
    assert no_match_state is False

    selected_country, _file, _applied, _available, no_match_country = select_resorts_from_query(
        {"search": ["united states"], "search_all": ["1"], "include_all": ["1"]}
    )
    assert selected_country == ["Snowbird, UT", "Mt Brighton, MI"]
    assert no_match_country is False

    selected_city, _file, _applied, _available, no_match_city = select_resorts_from_query(
        {"search": ["salt lake county"], "search_all": ["1"], "include_all": ["1"]}
    )
    assert selected_city == ["Snowbird, UT"]
    assert no_match_city is False
