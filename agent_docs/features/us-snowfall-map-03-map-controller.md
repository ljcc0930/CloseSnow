# Atomic Feature Request

## Request ID
- `us-snowfall-map-03-map-controller`

## Title
- Build US snowfall map controller

## Feature Branch
- `ljcc/feature/us-snowfall-map`

## Dependencies
- `us-snowfall-map-01-contract`: requires stable `country_code` and `map_context` fields for marker eligibility and snowfall metrics.
- `us-snowfall-map-02-map-shell`: requires the map DOM hooks, asset plumbing, and controller API scaffold.

## Background
- Once the payload contract and shell exist, the remaining map logic should live in one dedicated module instead of expanding the already-large homepage script.
- This module should own map-library initialization, marker rendering, popups, legend updates, viewport fitting, and graceful failure behavior without reading global homepage filter state directly.

## Goal
- Implement `window.CloseSnowUsSnowfallMap.create(options)` in `assets/js/us_snowfall_map.js` as a standalone controller that consumes `setVisibleReports(...)`, `setMetric(...)`, and `setSelectedResort(...)` calls and renders an interactive US snowfall map.
- The controller should:
- render markers only for reports whose `map_context.eligible` is true
- support `today`, `next_72h`, and `week1` snowfall display modes
- encode snowfall intensity with both marker color and marker size
- fit the viewport to currently visible eligible markers, with a sensible US fallback when none are available
- show popups with resort name, active snowfall total, state, pass-type text, and a link to the resort hourly page

## Constraints / Forbidden Behaviors
- Do not pull filter state or favorites directly out of `weather_page.js`; the controller must work from the report list and metric passed into its public API.
- Do not edit server-side filtering semantics or create map-only query parameters.
- Do not render non-US resorts on the map, even if they remain visible elsewhere on the page.
- Do not throw uncaught errors when map-library initialization or tile loading fails.

## Acceptance Criteria
- [ ] The controller implements the public API from `us-snowfall-map-02-map-shell` and keeps its own internal marker/legend/popup state.
- [ ] Marker radius and color update when the active metric changes between `today`, `next_72h`, and `week1`.
- [ ] The viewport fits the currently visible eligible US markers, with a stable US fallback view when no markers are available.
- [ ] Popups show the active snowfall metric value plus a working resort-page link derived from `resort_id`.
- [ ] Empty eligible-result sets and library/tile failures render inline fallback messaging instead of breaking the rest of the page.
- [ ] The controller exposes selection/highlight behavior through `setSelectedResort(...)` so the homepage can keep row focus and map focus aligned.

## Test Plan
- `python3 -m pytest -q tests/frontend/test_assets.py tests/integration/test_web_server.py`
- `python3 -m src.cli static --output-dir /tmp/closesnow-us-snowfall-map-controller --max-workers 8`
