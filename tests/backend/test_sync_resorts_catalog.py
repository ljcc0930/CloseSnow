from __future__ import annotations

from scripts import sync_resorts_catalog as sync_catalog


def test_flatten_ikon_destination_names_respects_page_rules():
    destinations = [
        {
            "name": "Parent Alpha",
            "ignoreSubDestinations": False,
            "subDestinations": [{"name": "Alpha One"}, {"title": "Alpha Two"}],
        },
        {
            "name": "Parent Beta",
            "ignoreSubDestinations": True,
            "subDestinations": [{"name": "Beta Child"}],
        },
        {"title": "Parent Gamma"},
        {
            "name": "Parent Alpha",
            "ignoreSubDestinations": False,
            "subDestinations": [{"name": "Alpha One"}],
        },
    ]

    assert sync_catalog.flatten_ikon_destination_names(destinations) == [
        "Alpha One",
        "Alpha Two",
        "Parent Beta",
        "Parent Gamma",
    ]


def test_validate_ikon_destinations_coverage_accepts_known_alias():
    entries = [
        {
            "name": "Arai Snow Resort, Japan",
            "query": "Arai Snow Resort, Japan",
            "pass_types": ["ikon"],
        }
    ]

    errors = sync_catalog.validate_ikon_destinations_coverage(entries, ["Arai Mountain Resort"])
    assert errors == []


def test_validate_ikon_destinations_coverage_reports_missing_names():
    entries = [
        {
            "name": "Steamboat",
            "query": "Steamboat",
            "pass_types": ["ikon"],
        }
    ]

    errors = sync_catalog.validate_ikon_destinations_coverage(
        entries,
        ["Steamboat", "Winter Park Resort"],
    )

    assert len(errors) == 1
    assert "Winter Park Resort" in errors[0]

def test_merge_entries_skips_aspen_snowmass_aggregate():
    existing = [
        {
            "resort_id": "snowmass-co",
            "query": "Snowmass, CO",
            "name": "Snowmass",
            "state": "CO",
            "country": "US",
            "region": "west",
            "pass_types": ["ikon"],
            "default_enabled": True,
        },
    ]

    sources = [
        sync_catalog.CatalogResort(
            query="Aspen Snowmass, CO",
            name="Aspen Snowmass",
            state="CO",
            country="US",
            region="west",
            pass_type="ikon",
        )
    ]

    merged = sync_catalog.merge_entries(existing, sources)
    assert all(entry["resort_id"] != "aspen-snowmass-co" for entry in merged)
    assert any(entry["resort_id"] == "snowmass-co" for entry in merged)


def test_merge_entries_skips_skibig3_aggregate():
    existing = [
        {
            "resort_id": "sunshine-village-ab",
            "query": "Sunshine Village, AB",
            "name": "Sunshine Village",
            "state": "AB",
            "country": "CA",
            "region": "west",
            "pass_types": ["ikon"],
            "default_enabled": False,
        },
    ]

    sources = [
        sync_catalog.CatalogResort(
            query="SkiBig3, AB",
            name="SkiBig3",
            state="AB",
            country="CA",
            region="west",
            pass_type="ikon",
        )
    ]

    merged = sync_catalog.merge_entries(existing, sources)
    assert all(entry["resort_id"] != "skibig3-ab" for entry in merged)
    assert any(entry["resort_id"] == "sunshine-village-ab" for entry in merged)
