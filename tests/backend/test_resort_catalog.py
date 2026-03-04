from __future__ import annotations

import json

from src.backend.resort_catalog import load_resort_catalog, read_resort_queries, search_resort_catalog


def test_load_resort_catalog_from_txt(tmp_path):
    p = tmp_path / "resorts.txt"
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
                    "state": "UT",
                    "country": "US",
                    "region": "west",
                    "pass_types": ["Ikon", "ikon"],
                }
            ]
        ),
        encoding="utf-8",
    )
    entries = load_resort_catalog(str(p))
    assert entries[0]["query"] == "Snowbird, UT"
    assert entries[0]["pass_types"] == ["ikon"]
    assert read_resort_queries(str(p)) == ["Snowbird, UT"]


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
