from __future__ import annotations

import json

from src.backend.airport_catalog import (
    find_nearby_airports,
    great_circle_distance_miles,
    load_airport_catalog,
)
from src.shared.config import DEFAULT_AIRPORTS_FILE


def test_load_airport_catalog_from_json(tmp_path):
    p = tmp_path / "airports.json"
    p.write_text(
        json.dumps(
            [
                {
                    "airport_id": "slc-salt-lake-city",
                    "iata_code": "slc",
                    "display_name": "Salt Lake City International Airport",
                    "location_label": "Salt Lake City, UT, US",
                    "latitude": "40.7884",
                    "longitude": -111.9778,
                },
                {"iata_code": "BAD", "display_name": "", "latitude": 0, "longitude": 0},
            ]
        ),
        encoding="utf-8",
    )
    entries = load_airport_catalog(str(p))
    assert len(entries) == 1
    assert entries[0]["iata_code"] == "SLC"
    assert entries[0]["latitude"] == 40.7884


def test_default_airport_catalog_contains_expected_entries():
    entries = load_airport_catalog(DEFAULT_AIRPORTS_FILE)
    assert any(entry["iata_code"] == "SLC" for entry in entries)
    assert any(entry["iata_code"] == "RNO" for entry in entries)
    assert any(entry["iata_code"] == "BTV" for entry in entries)


def test_find_nearby_airports_filters_and_sorts_by_distance():
    airports = [
        {
            "airport_id": "slc-salt-lake-city",
            "iata_code": "SLC",
            "display_name": "Salt Lake City International Airport",
            "location_label": "Salt Lake City, UT, US",
            "latitude": 40.7884,
            "longitude": -111.9778,
        },
        {
            "airport_id": "den-denver",
            "iata_code": "DEN",
            "display_name": "Denver International Airport",
            "location_label": "Denver, CO, US",
            "latitude": 39.8561,
            "longitude": -104.6737,
        },
        {
            "airport_id": "rno-reno-tahoe",
            "iata_code": "RNO",
            "display_name": "Reno-Tahoe International Airport",
            "location_label": "Reno, NV, US",
            "latitude": 39.4991,
            "longitude": -119.7681,
        },
    ]
    nearby = find_nearby_airports(
        resort_latitude=40.5764,
        resort_longitude=-111.6549,
        airports=airports,
        radius_miles=250.0,
    )
    assert [item["iata_code"] for item in nearby] == ["SLC"]
    assert nearby[0]["distance_miles"] > 0
    assert nearby[0]["distance_miles"] < 50


def test_find_nearby_airports_returns_empty_when_no_matches():
    airports = [
        {
            "airport_id": "jfk-new-york",
            "iata_code": "JFK",
            "display_name": "John F. Kennedy International Airport",
            "location_label": "New York, NY, US",
            "latitude": 40.6413,
            "longitude": -73.7781,
        }
    ]
    nearby = find_nearby_airports(
        resort_latitude=40.5764,
        resort_longitude=-111.6549,
        airports=airports,
        radius_miles=250.0,
    )
    assert nearby == []


def test_great_circle_distance_miles_is_symmetric():
    slc_to_den = great_circle_distance_miles(40.7884, -111.9778, 39.8561, -104.6737)
    den_to_slc = great_circle_distance_miles(39.8561, -104.6737, 40.7884, -111.9778)
    assert round(slc_to_den, 6) == round(den_to_slc, 6)
    assert slc_to_den > 350
