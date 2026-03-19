from __future__ import annotations

import json

from src.backend.resort_catalog import (
    load_resort_catalog,
    read_resort_queries,
    search_resort_catalog,
    validate_resort_catalog,
)
from src.shared.config import DEFAULT_RESORTS_FILE


def test_load_resort_catalog_from_txt(tmp_path):
    p = tmp_path / "plain_resorts.txt"
    p.write_text("Snowbird, UT\n# comment\n\nSnowbird, UT\nSolitude, UT\n", encoding="utf-8")
    entries = load_resort_catalog(str(p))
    assert [x["query"] for x in entries] == ["Snowbird, UT", "Solitude, UT"]
    assert entries[0]["resort_id"] == "snowbird-ut"


def test_load_resort_catalog_from_yml_json(tmp_path):
    p = tmp_path / "resorts.yml"
    p.write_text(
        json.dumps(
            [
                {
                    "resort_id": "snowbird-ut",
                    "query": "Snowbird, UT",
                    "name": "Snowbird",
                    "city": "Salt Lake County",
                    "address": "Snowbird, Salt Lake County, Utah, United States",
                    "state": "UT",
                    "country": "US",
                    "region": "west",
                    "pass_types": ["Ikon", "ikon"],
                    "latitude": "40.58",
                    "longitude": -111.65,
                }
            ]
        ),
        encoding="utf-8",
    )
    entries = load_resort_catalog(str(p))
    assert entries[0]["query"] == "Snowbird, UT"
    assert entries[0]["pass_types"] == ["ikon"]
    assert entries[0]["latitude"] == 40.58
    assert entries[0]["longitude"] == -111.65
    assert entries[0]["city"] == "Salt Lake County"
    assert entries[0]["address"] == "Snowbird, Salt Lake County, Utah, United States"
    assert entries[0]["state_name"] == "Utah"
    assert entries[0]["country_name"] == "United States"
    assert "utah" in [x.lower() for x in entries[0]["search_terms"]]
    assert "united states" in [x.lower() for x in entries[0]["search_terms"]]
    assert read_resort_queries(str(p)) == ["Snowbird, UT"]


def test_read_resort_queries_respects_default_enabled(tmp_path):
    p = tmp_path / "resorts.yml"
    p.write_text(
        json.dumps(
            [
                {"resort_id": "snowbird-ut", "query": "Snowbird, UT", "country": "US", "region": "west", "pass_types": ["ikon"]},
                {
                    "resort_id": "alpental-wa",
                    "query": "Alpental, WA",
                    "country": "US",
                    "region": "west",
                    "pass_types": ["indy"],
                    "default_enabled": False,
                },
            ]
        ),
        encoding="utf-8",
    )
    assert read_resort_queries(str(p)) == ["Snowbird, UT"]
    assert read_resort_queries(str(p), include_all=True) == ["Snowbird, UT", "Alpental, WA"]


def test_validate_resort_catalog_reports_integrity_errors():
    errors = validate_resort_catalog(
        [
            {
                "resort_id": "snowbird-ut",
                "query": "Snowbird, UT",
                "country": "US",
                "region": "west",
                "pass_types": ["ikon"],
            },
            {
                "resort_id": "snowbird-ut",
                "query": "Snowbird, UT",
                "country": "USA",
                "region": "bad-region",
                "pass_types": ["unknown"],
            },
        ]
    )
    assert any("duplicate resort_id" in msg for msg in errors)
    assert any("duplicate query" in msg for msg in errors)
    assert any("invalid country" in msg for msg in errors)
    assert any("invalid region" in msg for msg in errors)
    assert any("invalid pass_types" in msg for msg in errors)


def test_validate_resort_catalog_rejects_partial_coordinates():
    errors = validate_resort_catalog(
        [
            {
                "resort_id": "crystal-mountain-wa",
                "query": "Crystal Mountain, WA",
                "country": "US",
                "region": "west",
                "pass_types": ["ikon"],
                "latitude": 46.9355,
            }
        ]
    )
    assert any("latitude and longitude must be provided together" in msg for msg in errors)


def test_search_resort_catalog_supports_multi_term():
    entries = [
        {
            "resort_id": "snowbird-ut",
            "query": "Snowbird, UT",
            "name": "Snowbird",
            "state": "UT",
            "country": "US",
            "region": "west",
            "pass_types": ["ikon"],
        },
        {
            "resort_id": "mt-brighton-mi",
            "query": "Mt Brighton, MI",
            "name": "Mt Brighton",
            "state": "MI",
            "country": "US",
            "region": "east",
            "pass_types": ["epic"],
        },
    ]
    assert [x["resort_id"] for x in search_resort_catalog(entries, "brighton epic")] == ["mt-brighton-mi"]
    assert [x["resort_id"] for x in search_resort_catalog(entries, "west ikon")] == ["snowbird-ut"]


def test_search_resort_catalog_supports_long_form_locations_and_city_address():
    entries = [
        {
            "resort_id": "arapahoe-basin-co",
            "query": "Arapahoe Basin, CO",
            "name": "Arapahoe Basin",
            "city": "Summit County",
            "address": "Arapahoe Basin, Summit County, Colorado, United States",
            "state": "CO",
            "state_name": "Colorado",
            "country": "US",
            "country_name": "United States",
            "region": "west",
            "pass_types": ["ikon"],
            "search_terms": ["Colorado", "United States", "Summit County"],
        },
        {
            "resort_id": "steamboat-co",
            "query": "Steamboat, CO",
            "name": "Steamboat",
            "city": "Steamboat Springs",
            "address": "Steamboat Springs, Routt County, Colorado, United States",
            "state": "CO",
            "state_name": "Colorado",
            "country": "US",
            "country_name": "United States",
            "region": "west",
            "pass_types": ["ikon"],
            "search_terms": ["Colorado", "United States", "Steamboat Springs"],
        },
        {
            "resort_id": "whistler-blackcomb-bc",
            "query": "Whistler Blackcomb, BC",
            "name": "Whistler Blackcomb",
            "city": "Whistler Resort Municipality",
            "address": "Whistler Resort Municipality, British Columbia, Canada",
            "state": "BC",
            "state_name": "British Columbia",
            "country": "CA",
            "country_name": "Canada",
            "region": "west",
            "pass_types": ["epic"],
            "search_terms": ["British Columbia", "Canada", "Whistler Resort Municipality"],
        },
    ]

    assert [x["resort_id"] for x in search_resort_catalog(entries, "colorado")] == [
        "arapahoe-basin-co",
        "steamboat-co",
    ]
    assert [x["resort_id"] for x in search_resort_catalog(entries, "united states")] == [
        "arapahoe-basin-co",
        "steamboat-co",
    ]
    assert [x["resort_id"] for x in search_resort_catalog(entries, "usa")] == [
        "arapahoe-basin-co",
        "steamboat-co",
    ]
    assert [x["resort_id"] for x in search_resort_catalog(entries, "british columbia")] == ["whistler-blackcomb-bc"]
    assert [x["resort_id"] for x in search_resort_catalog(entries, "canada")] == ["whistler-blackcomb-bc"]
    assert [x["resort_id"] for x in search_resort_catalog(entries, "steamboat springs")] == ["steamboat-co"]
    assert [x["resort_id"] for x in search_resort_catalog(entries, "summit county")] == ["arapahoe-basin-co"]


def test_default_catalog_keeps_crystal_mountain_coordinate_override():
    entries = load_resort_catalog(DEFAULT_RESORTS_FILE)
    item = next(x for x in entries if x["resort_id"] == "crystal-mountain-wa")
    assert item["latitude"] == 46.9355117
    assert item["longitude"] == -121.4750288


def test_default_catalog_keeps_heavenly_coordinate_override():
    entries = load_resort_catalog(DEFAULT_RESORTS_FILE)
    item = next(x for x in entries if x["resort_id"] == "heavenly-ca")
    assert item["latitude"] == 38.9361599
    assert item["longitude"] == -119.9389618


def test_default_catalog_keeps_snow_valley_coordinate_override():
    entries = load_resort_catalog(DEFAULT_RESORTS_FILE)
    item = next(x for x in entries if x["resort_id"] == "snow-valley-ca")
    assert item["latitude"] == 34.2249953
    assert item["longitude"] == -117.0353312
