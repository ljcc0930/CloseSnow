# Atomic Feature Request

## Request ID
- `granular-region-filters-01-subregion-contract`

## Title
- Add subregion catalog and multi-value filter contract

## Feature Branch
- `ljcc/feature/granular-region-filters`

## Dependencies
- None.

## Background
- CloseSnow currently exposes only coarse `region` values (`west`, `east`, `intl`) in `resorts.yml`, `src/backend/resort_catalog.py`, `src/backend/pipeline.py`, and `src/backend/weather_data_server.py`.
- The requested UX needs the finer image-aligned groupings `Rockies`, `West Coast`, `Midwest`, `Mid-Atlantic`, `Northeast`, `Europe`, `Asia`, `Australia / New Zealand`, and `South America`.
- Many resorts could be grouped from `state` or `country`, but not all of them safely. `British Columbia` appears in both `Rockies` and `West Coast` in the reference, so the taxonomy must be explicit at the resort level instead of inferred from a broad geographic lookup.
- The homepage in API mode refetches `/api/data` on filter changes, so backend filter parsing and metadata have to support the finer taxonomy before the UI can rely on it.

## Goal
- Extend the resort catalog, report payload, and backend filter metadata so CloseSnow exposes a stable explicit `subregion` field with image-aligned values and supports multi-value `subregion` and `country` filtering without breaking the existing coarse `region` metadata.

## Constraints / Forbidden Behaviors
- Keep legacy coarse `region` values in `resorts.yml`, payload reports, and the existing broad filter semantics for compatibility; do not silently repurpose `region` to the new labels.
- Do not derive `subregion` only from `state` or `country` at runtime; ambiguous cases must be curated directly in catalog data.
- Do not expand the taxonomy beyond the image-aligned labels unless the user asks for that follow-up.
- Do not remove or weaken the current `pass_type`, search, `include_default`, `include_all`, or `search_all` behaviors.
- Keep `/api/data?region=...` and `/api/resorts?region=...` working as coarse filters even after `subregion` support lands.

## Acceptance Criteria
- [ ] `resorts.yml` entries gain an explicit `subregion` field whose normalized slug is one of `rockies`, `west-coast`, `midwest`, `mid-atlantic`, `northeast`, `europe`, `asia`, `australia-new-zealand`, or `south-america`.
- [ ] Catalog normalization and validation in `src/backend/resort_catalog.py` accept the new field and reject unknown subregion slugs while preserving the current coarse `region` validation.
- [ ] Enriched report payloads include `subregion`, and backend filter metadata exposes `available_filters.subregion` counts keyed by slug for homepage rendering.
- [ ] `/api/data` and `/api/resorts` accept repeatable or comma-separated `subregion` values and repeatable or comma-separated `country` values; single-value callers continue to work.
- [ ] `applied_filters.subregion` and `applied_filters.country` are returned as normalized arrays so the homepage can restore multiselect state predictably.
- [ ] Coarse `region` filtering remains available; when both `region` and `subregion` are present, the result set satisfies both constraints.
- [ ] Search-all mode still ignores pass type, region/subregion, country, and default-scope filters the same way the app behaves today.
- [ ] The BC edge case is made explicit in the implementation or tests, with at least one curated example such as `whistler-blackcomb-bc -> west-coast` while interior BC resorts stay `rockies`.
- [ ] README query-parameter docs and backend tests are updated to describe the new taxonomy and multi-value filter contract.

## Test Plan
- `pytest tests/backend/test_resort_catalog.py tests/backend/test_weather_data_server_filters.py tests/integration/test_web_server.py`
- `python3 -m src.cli static --output-dir /tmp/closesnow-region-filters --max-workers 8`
