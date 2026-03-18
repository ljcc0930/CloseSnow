# Atomic Feature Request

## Request ID
- `coordinate-fixes-26-snow-valley-ca`

## Title
- Correct Snow Valley catalog coordinates

## Feature Branch
- `ljcc/feature/resort-coordinate-corrections-march-2026`

## Dependencies
- None.

## Background
- GitHub issue #26 reports that `https://ljcc0930.github.io/CloseSnow/resort/snow-valley-ca/` currently shows `34.250000, -117.000000`, which is not the intended Snow Valley, CA resort location.
- `resorts.yml` already supports explicit `latitude` and `longitude` overrides, and `src/backend/weather_data_server.py` seeds those catalog coordinates into the resort coordinate cache before building hourly/static resort payloads.
- This request is intentionally scoped as a data correction for the `snow-valley-ca` catalog entry, not as a new coordinate-handling feature.

## Goal
- Add a verified explicit coordinate override for the `snow-valley-ca` entry in `resorts.yml` so CloseSnow resolves Snow Valley, CA to the corrected resort location instead of the issue-reported point `34.250000, -117.000000`.
- Keep the fix isolated to this resort so the merged PR can be traced directly back to GitHub issue #26.

## Constraints / Forbidden Behaviors
- Do not change `resort_id`, `query`, `display_name`, pass metadata, or unrelated resort entries unless coordinate verification proves an identity field is internally inconsistent and that follow-on change is called out explicitly in the PR.
- Do not use approximate town-center, county-center, or highway coordinates as a substitute for the resort's actual base-area or intended map point.
- Do not introduce a new cache format, schema field, or fallback path for this slice; use the existing catalog `latitude` / `longitude` override path.
- Do not close the issue with guessed coordinates if authoritative evidence is unavailable; write `.fail` with the missing evidence instead.

## Acceptance Criteria
- [ ] The `resorts.yml` entry for `snow-valley-ca` includes explicit `latitude` and `longitude` values that map to a verified Snow Valley, CA resort location rather than `34.250000, -117.000000`.
- [ ] Building the resort through the existing hourly/static flow resolves the corrected coordinates from the catalog override path instead of falling back to the uncontrolled geocoder result from the current issue state.
- [ ] No unrelated resort catalog entries or coordinate-handling code paths change in the same PR.
- [ ] The PR description cites the verification source used to justify the replacement coordinates so a reviewer can audit the correction quickly.

## Test Plan
- `python3 -c 'from src.backend.resort_catalog import load_resort_catalog; entry = next(x for x in load_resort_catalog("resorts.yml") if x["resort_id"] == "snow-valley-ca"); assert entry["latitude"] is not None and entry["longitude"] is not None; print(entry["latitude"], entry["longitude"])'`
- `python3 -m pytest -q tests/backend/test_resort_catalog.py tests/backend/test_weather_data_server_hourly.py`
- `python3 -m src.cli static --output-dir /tmp/coordinate-fixes-26-snow-valley-ca --max-workers 8`
- `python3 -c 'import json; payload = json.load(open("/tmp/coordinate-fixes-26-snow-valley-ca/resort/snow-valley-ca/hourly.json")); assert (payload.get("resolved_latitude"), payload.get("resolved_longitude")) != tuple(float(x.strip()) for x in "34.250000, -117.000000".split(",")); print(payload.get("resolved_latitude"), payload.get("resolved_longitude"))'`
