# Atomic Feature Request

## Request ID
- `us-snowfall-map-01-contract`

## Title
- Formalize US map-ready snowfall contract

## Feature Branch
- `ljcc/feature/us-snowfall-map`

## Dependencies
- None.

## Background
- The current homepage payload already carries `daily` snowfall rows plus resolved coordinates, but the data shape is still loose enough that a new map would have to infer eligibility, geography, and snowfall windows ad hoc inside client code.
- The map feature needs one stable report-level contract shared by static `data.json`, dynamic `/api/data`, and all data-source validators before frontend workers start building the UI.

## Goal
- Extend payload construction so every successful report exposes a stable map summary contract:
- `country_code`: required upper-case country code sourced from catalog metadata for supported resorts.
- `map_context`: required object with:
- `eligible`: boolean, true only when `country_code == "US"` and both coordinates are finite.
- `latitude`: float or null.
- `longitude`: float or null.
- `today_snowfall_cm`: float.
- `next_72h_snowfall_cm`: float.
- `week1_total_snowfall_cm`: float.
- Derive these map snowfall metrics once on the backend from the same daily data already used by the list view, so downstream UI code does not need to recompute date-window totals.

## Constraints / Forbidden Behaviors
- Do not add a second homepage API fetch just for the map.
- Do not move existing resort filtering or search semantics out of the current server/data-source flow.
- Do not introduce a new schema version for this slice alone unless a broader contract change is unavoidable; prefer extending `weather_payload_v1` compatibly.
- Do not mark non-US or coordinate-missing resorts as map-eligible.

## Acceptance Criteria
- [ ] Each successful report includes the required `country_code` and `map_context` fields with the exact semantics described above.
- [ ] `map_context.next_72h_snowfall_cm` is derived server-side from the same forecast window for both static and live payload generation.
- [ ] Contract validation rejects malformed `country_code` or `map_context` structures in file/API load paths.
- [ ] Existing homepage and resort-hourly payload consumers continue to function without requiring a separate data source.

## Test Plan
- `python3 -m pytest -q tests/backend/test_report_builder.py tests/integration/test_contract_validators.py tests/integration/test_data_sources.py`
- `python3 -m src.cli static --output-dir /tmp/closesnow-us-snowfall-map-contract --max-workers 8`
