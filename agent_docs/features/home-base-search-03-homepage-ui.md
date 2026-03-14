# Atomic Feature Request

## Request ID
- `home-base-search-03-homepage-ui`

## Title
- Add home-base controls and nearby resort UI

## Feature Branch
- `ljcc/feature/home-base-search`

## Dependencies
- `home-base-search-01-location-model`: requires the persisted home-base contract for control initialization and URL restore.
- `home-base-search-02-distance-engine`: requires computed distance/radius context for badges, counts, and sort options.

## Background
- Distance logic alone is not useful unless the homepage makes it easy to set an origin, see which resorts are nearby, and hand off to actual navigation tools.
- The homepage already has a dense control bar, so new UI needs to fit cleanly into the current search/filter pattern rather than becoming a detached side feature.

## Goal
- Add a homepage home-base control cluster that supports:
- setting or clearing the current home base
- choosing a nearby radius
- sorting by distance
- showing each eligible resort’s distance in the list
- Provide a clear directions handoff from resort rows or selected nearby resorts to an external maps provider.

## Constraints / Forbidden Behaviors
- Do not bury the control behind an unrelated modal if it is required for routine nearby search.
- Do not replace the existing favorites/search/filter controls.
- Do not show exact drive-time copy unless a real route provider exists.
- Do not make directions links appear for resorts that lack usable coordinates.

## Acceptance Criteria
- [ ] Users can set, adjust, and clear a home base directly from the homepage without breaking current controls.
- [ ] Radius selection updates the visible resort list and nearby counts using the shared distance engine.
- [ ] Resort rows show distance cues only when the active home base and resort coordinates are both available.
- [ ] Nearby results can hand off to an external maps directions URL with the selected home base and resort destination.
- [ ] The control layout remains usable on mobile and desktop static builds.

## Test Plan
- `python3 -m pytest -q tests/frontend/test_assets.py tests/integration/test_web_server.py`
- `python3 -m src.cli static --output-dir /tmp/closesnow-home-base-ui --max-workers 8`
