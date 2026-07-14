# Atomic Feature Request

## Request ID
- `alpine-field-guide-03-resort-detail`

## Title
- Rebuild the resort daily and hourly field guide.

## Feature Branch
- `ljcc/feature/alpine-field-guide`

## Dependencies
- `alpine-field-guide-01-foundation`: shared theme, icon, copy, and unit APIs must be available before page composition begins.

## Background
- The current resort page repeats a large decorative hero, presents a wide historical/forecast strip, and gives seven hourly charts equal visual weight. Titles and units are technical, while the implications of snow, rain, wind, visibility, and timing are left for the user to interpret.

## Goal
- Create a resort-specific field guide that immediately names the mountain, summarizes the near-term outlook in plain language, presents daily history/forecast with clear time semantics, and organizes hourly storm, wind, and visibility information into focused readable views while preserving raw access.

## Constraints / Forbidden Behaviors
- Preserve existing resort URLs, static/dynamic hourly loading, range refresh, website/map links, nearby airports, daily history, 14-day forecast, all hourly metrics, coordinate-correction link behavior, and raw hourly data access.
- Do not change daily/hourly payload contracts or add hourly temperature that the contract does not provide.
- Do not show `Resort Forecast:` as redundant title text; the resort name is the primary heading.
- Do not use native emoji, generic `Unit:` subtitles, or seven equal-weight charts stacked without grouping.
- Do not modify homepage-specific composition beyond shared-foundation compatibility.

## Acceptance Criteria
- [ ] A compact resort masthead displays the resort name, location/pass context when available, local time/freshness, website/map actions, global units, and a plain-language seven-day outlook within the first viewport.
- [ ] Summary signals distinguish forecast snow, forecast rain, today's temperature/condition, and the most relevant timing without requiring users to compare raw rows.
- [ ] Daily history and forecast use card/timeline semantics with clear `Past`, `Today`, and `Forecast` labeling; each available day retains condition, high/low, snow, rain, sunrise, and sunset.
- [ ] Hourly data is organized into focused, keyboard-accessible views for precipitation/storm, wind, and visibility/depth rather than seven simultaneous equal-weight panels.
- [ ] Snow/rain are visualized with quantity-appropriate bars or areas, continuous measures with readable lines/areas, and wind direction with directional meaning; all views include concise explanatory text and accessible chart labels.
- [ ] Range selection and refresh still work for static and dynamic sources, and loading/error/no-data states explain what is unavailable.
- [ ] Nearby airports remain complete and readable, with distances following the shared unit preference where practical; raw hourly data remains available in disclosure.
- [ ] The page works at 1440px, 768px, and 390px without page-level overflow, hidden actions, or a decorative hero dominating mobile.
- [ ] Targeted tests cover resort title/content, grouped hourly views, daily completeness, units, metadata/actions, airport rendering, and error fallbacks.

## Test Plan
- `python3 scripts/lint_assets.py`
- `pytest -q tests/frontend/test_resort_hourly_context.py tests/frontend/test_renderers.py tests/frontend/test_static_site_pipeline.py tests/integration/test_gateway_render_integration.py tests/test_lint_assets.py`
- `python3 -m src.cli static --output-dir /tmp/closesnow-field-guide-resort --max-workers 8 --include-all-resorts`
- Browser-check at least one rain-heavy and one snow-positive generated resort page at 1440x1000, 768x1024, and 390x844; exercise hourly tabs, range refresh, actions, units, daily disclosure, and raw data.
