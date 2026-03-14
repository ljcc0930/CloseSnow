# Atomic Feature Request

## Request ID
- `us-snowfall-map-polish-01-real-basemap`

## Title
- Replace faux stage with real basemap

## Feature Branch
- `ljcc/feature/us-snowfall-map`

## Dependencies
- None.

## Background
- The live map implementation currently projects resort coordinates onto a custom rectangular stage with decorative gradients and region labels rather than a real US map.
- That makes the feature feel like a prototype even when the underlying snowfall numbers are correct.

## Goal
- Replace the current faux geographic stage with a real, trustworthy US map presentation that uses actual geographic projection, pan/zoom behavior, and a clear reset-to-US view.
- Keep the solution compatible with static deployment and the existing `map_context` payload contract.

## Constraints / Forbidden Behaviors
- Do not regress the static-site build by requiring a private map backend.
- Do not discard the existing `map_context` data contract and rebuild the feature around a different payload model.
- Do not ship a “real map” that still lacks a clear reset / default US view.
- Do not make map initialization fragile when tiles or map assets fail.

## Acceptance Criteria
- [ ] The map renders against a real geographic basemap or equivalent geographic layer rather than the current custom gradient stage.
- [ ] Users can pan/zoom the map and reset to a sensible US default view.
- [ ] Resort markers remain driven by the existing `map_context` fields.
- [ ] Tile or basemap failures degrade to a scoped map fallback instead of breaking the page.

## Test Plan
- `python3 -m pytest -q tests/frontend/test_assets.py tests/frontend/test_static_site_pipeline.py tests/integration/test_web_server.py`
- `python3 -m src.cli static --output-dir /tmp/closesnow-us-map-real-basemap --max-workers 8`
