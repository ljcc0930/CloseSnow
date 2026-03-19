# Atomic Feature Request

## Request ID
- `resort-airport-access-02-resort-payload`

## Title
- Propagate nearby airports into resort payloads

## Feature Branch
- `ljcc/feature/resort-airport-access`

## Dependencies
- `resort-airport-access-01-airport-catalog`: Payload work needs the curated airport catalog and shared selector so the main report flow and hourly endpoint compute the same airport list.

## Background
- Resort pages draw from two related data paths today: the full `reports[]` payload used to build `dailySummary` bootstrap data, and the per-resort hourly payload used by `/api/resort-hourly` and generated `hourly.json`.
- The nearby-airport module will only stay consistent across static and dynamic resort pages if both payload paths derive from the same airport-access helper and expose the same contract.

## Goal
- Enrich resort reports, resort bootstrap context, and per-resort hourly payloads with a stable nearby-airport contract so the frontend can render airport access data without extra global fetches.
- Use snake_case `nearby_airports` in Python-owned report/hourly payloads and map that list to camelCase `nearbyAirports` only at the browser bootstrap boundary.

## Constraints / Forbidden Behaviors
- Do not require resort-page JavaScript to fetch the full homepage `data.json` just to discover airport data.
- Do not fork airport selection logic between `compute_pipeline_payload`, `build_resort_daily_summary_context`, and `_hourly_payload_for_resort`.
- Do not break existing `weather_payload_v1` validation or current resort-page behavior when a resort has no qualifying airports.
- Do not silently omit the field shape from one path; static HTML bootstrap and hourly JSON/API should agree.

## Acceptance Criteria
- [ ] Resort report enrichment attaches a sorted `nearby_airports` list to each report using the shared selector and the resort's canonical coordinates.
- [ ] `build_resort_daily_summary_context(...)` maps `report["nearby_airports"]` into `dailySummary["nearbyAirports"]` for resort-page bootstrap.
- [ ] `/api/resort-hourly` responses and generated `site/resort/<resort_id>/hourly.json` include the same sorted `nearby_airports` data so the resort page still has airport access info if bootstrap data is missing or stale.
- [ ] Automated coverage verifies a sample resort's bootstrap HTML and hourly payload both contain the expected nearby-airport fields, while an empty-airports case still renders valid pages.

## Test Plan
- Add targeted tests around report enrichment, resort hourly context building, static hourly page generation, and `/api/resort-hourly`.
- Run `python3 -m pytest tests/backend/test_pipeline.py tests/backend/test_weather_data_server_hourly.py tests/frontend/test_resort_hourly_context.py tests/frontend/test_static_site_pipeline.py tests/integration/test_web_server.py -q`.
- Run `python3 -m src.cli static --output-dir /tmp/closesnow-airport-access-contract --max-workers 8 --resort "Snowbird, UT"` and inspect the generated `resort/snowbird-ut/index.html` plus `hourly.json` for airport data.
