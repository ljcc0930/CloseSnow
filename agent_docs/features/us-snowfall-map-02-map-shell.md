# Atomic Feature Request

## Request ID
- `us-snowfall-map-02-map-shell`

## Title
- Add main-page snowfall map shell

## Feature Branch
- `ljcc/feature/us-snowfall-map`

## Dependencies
- None.

## Background
- The homepage currently renders only list/table sections inside `#page-content-root`, and the asset manifest only serves the existing weather-page and resort-hourly CSS/JS.
- A map worker needs stable DOM hooks, a responsive section layout, and a dedicated client-module contract before marker behavior and page-state sync can be built safely.

## Goal
- Add a dedicated `US Snowfall Map` section near the top of the homepage content with a stable DOM structure for:
- the section header
- a snowfall metric toggle region
- a legend region
- a status / fallback message region
- the map canvas root
- Add new locally served assets for the map shell, including any vendored map-library distribution files needed by the existing no-bundler frontend.
- Publish a controller scaffold in `assets/js/us_snowfall_map.js` as `window.CloseSnowUsSnowfallMap.create(options)`, returning an object with these no-throw methods:
- `setVisibleReports(reports)`
- `setMetric(metricKey)`
- `setSelectedResort(resortId)`
- `resize()`
- `destroy()`

## Constraints / Forbidden Behaviors
- Do not implement real marker rendering, popup behavior, or page-state wiring in this slice.
- Do not fetch data separately from the homepage bootstrap payload.
- Do not regress static asset copying or dynamic asset serving for existing homepage and resort-hourly assets.
- Do not bury the map below the existing long table stack; the shell should appear before the daily summary grid.

## Acceptance Criteria
- [ ] The homepage template contains a stable map section with explicit IDs/classes for the section, controls, legend, status copy, and map root.
- [ ] New map CSS/JS assets, plus any vendored runtime files, are available through both static builds and the dynamic server asset path.
- [ ] The controller scaffold exports the exact controller API described above and can be instantiated safely before real map behavior exists.
- [ ] The shell layout is responsive on mobile and desktop without obscuring the existing filter/search bar or breaking current tables.

## Test Plan
- `python3 -m pytest -q tests/frontend/test_assets.py tests/frontend/test_static_site_pipeline.py tests/integration/test_web_server.py`
- `python3 -m src.cli static --output-dir /tmp/closesnow-us-snowfall-map-shell --max-workers 8`
