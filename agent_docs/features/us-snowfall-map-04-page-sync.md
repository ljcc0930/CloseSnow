# Atomic Feature Request

## Request ID
- `us-snowfall-map-04-page-sync`

## Title
- Wire snowfall map into homepage state

## Feature Branch
- `ljcc/feature/us-snowfall-map`

## Dependencies
- `us-snowfall-map-01-contract`: requires stable report-level map summary fields so page wiring can pass one consistent report shape to the controller.
- `us-snowfall-map-02-map-shell`: requires the map section DOM and controller API contract.

## Background
- `assets/js/weather_page.js` currently rebuilds `#page-content-root` during normal filter and favorite flows. Without a dedicated sync layer, a new map controller will either go stale, leak instances, or drift away from the visible resort list.
- Page wiring should stay responsible for filter/search/favorites state, while the controller from `us-snowfall-map-03-map-controller` stays responsible for map rendering details.

## Goal
- Update homepage state/render logic so the map controller is created, refreshed, and destroyed predictably as `renderPage()` replaces DOM content.
- Keep one homepage-owned map state object that tracks:
- active snowfall metric
- selected resort id
- controller instance / availability
- On every render, pass the same visible report set used by the tables into the controller and keep row focus plus map focus synchronized.

## Constraints / Forbidden Behaviors
- Do not rewrite the homepage into a different rendering architecture just for the map.
- Do not duplicate or fork filtering logic outside `_filteredReports()`.
- Do not couple `weather_page.js` to a specific map-library implementation; consume only the public controller API from `window.CloseSnowUsSnowfallMap`.
- Do not let map failures block existing list/table rendering.

## Acceptance Criteria
- [ ] Homepage code owns a small map state object and recreates or rebinds the controller safely after `renderPage()` DOM replacement.
- [ ] Search, filters, and favorites update the controller with the same visible resort set used for the table sections; there is no separate map-only filtering path.
- [ ] The homepage exposes and preserves an active snowfall metric toggle for the map across rerenders.
- [ ] Marker selection can scroll/highlight the matching resort row, and row-driven interactions can tell the controller which resort is selected.
- [ ] If the controller asset is unavailable or initialization fails, the page keeps rendering existing content and degrades to a no-map state without uncaught errors.

## Test Plan
- `python3 -m pytest -q tests/frontend/test_assets.py tests/integration/test_web_server.py`
- `python3 -m src.cli static --output-dir /tmp/closesnow-us-snowfall-map-sync --max-workers 8`
