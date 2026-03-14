# Atomic Feature Request

## Request ID
- `home-base-search-02-distance-engine`

## Title
- Compute resort distance and radius filters

## Feature Branch
- `ljcc/feature/home-base-search`

## Dependencies
- `home-base-search-01-location-model`: requires a stable home-base object before distance calculations and URL rehydration can be trusted.

## Background
- Once a home base exists, the homepage needs a deterministic way to decide which resorts are nearby and how to order them.
- The existing payload already carries resolved resort coordinates, so the distance engine should work from current payload data instead of adding a new fetch path.

## Goal
- Add one client-side distance utility flow that:
- computes miles and kilometers from the active home base to each resort with usable coordinates
- marks resorts as inside or outside the selected radius
- supports distance-based sorting and nearby-result counts
- exposes the computed distance context to the existing render path without duplicating filter logic in multiple places

## Constraints / Forbidden Behaviors
- Do not call third-party routing APIs in this slice.
- Do not fork the current `_filteredReports()` behavior into a separate home-base-only result set.
- Do not treat missing resort coordinates as zero distance.
- Do not degrade performance by repeatedly recomputing every distance on unrelated UI updates.

## Acceptance Criteria
- [ ] Distance is computed from the current home base against the existing resort coordinate fields for every visible resort with usable coordinates.
- [ ] Radius filtering and distance sorting work off the same computed distance context rather than ad hoc per-section logic.
- [ ] Resorts without coordinates are handled explicitly as unavailable for distance ranking, not silently treated as nearby.
- [ ] Existing pass type, region, country, favorites, and text search filters continue to work in combination with the new distance filter.

## Test Plan
- `python3 -m pytest -q tests/frontend/test_assets.py tests/integration/test_web_server.py tests/integration/test_data_sources.py`
- `python3 -m src.cli static --output-dir /tmp/closesnow-home-base-distance --max-workers 8`
