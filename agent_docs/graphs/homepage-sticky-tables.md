# Homepage Sticky Tables

## Summary
- Extend the homepage table stack so the remaining desktop sections reuse the `Daily Summary` single-table + sticky-column scroll pattern instead of split left/right tables.
- The rollout covers `Weather`, `Temperature`, `Sunrise / Sunset`, `Snowfall`, and `Rainfall`.
- `Snowfall` and `Rainfall` must keep `Weekly` columns fixed while daily columns continue to scroll horizontally.
- Any section that supports vertical scrolling should clamp the initial viewport to at most 10 body rows and then scroll within the section, while shorter datasets should collapse naturally to the available row count.

## Feature Branch
- `ljcc/feature/homepage-sticky-tables`

## Global Assumptions
- No backend or payload-contract changes are required; this is a homepage rendering and layout refactor in existing frontend assets.
- `Daily Summary` is the reference interaction model for single-table sticky behavior, but the rollout should avoid cloning one-off logic per section.
- `Snowfall` and `Rainfall` need more sticky leading columns than the other sections because `Week 1` and `Week 2` must remain visible during horizontal scrolling.
- The current homepage table stack is still concentrated in `assets/js/weather_page.js` and `assets/css/weather_page.css`, so the rollout is intentionally sequenced to reduce merge conflicts across worker slices.

## Atomic Requests
- `homepage-sticky-tables-01-shared-layout`: Define the shared homepage single-table sticky layout contract and 10-row viewport policy.
- `homepage-sticky-tables-02-weather-temp-sun`: Convert `Weather`, `Temperature`, and `Sunrise / Sunset` desktop sections to the shared sticky single-table layout.
- `homepage-sticky-tables-03-precip-weekly-sticky`: Convert desktop `Snowfall` and `Rainfall` to sticky single-table layouts with fixed weekly columns.

## Dependency Graph
- `homepage-sticky-tables-01-shared-layout` -> `homepage-sticky-tables-02-weather-temp-sun`
- `homepage-sticky-tables-01-shared-layout` -> `homepage-sticky-tables-03-precip-weekly-sticky`
- `homepage-sticky-tables-02-weather-temp-sun` -> `homepage-sticky-tables-03-precip-weekly-sticky`

## Notes
- The final state should let workers remove per-section split-table row-height syncing and vertical scroll syncing for every section that successfully moves to a single-table layout.
- `homepage-sticky-tables-03-precip-weekly-sticky` depends on the simpler metric-section rollout first so the precipitation slice can reuse an already-validated sticky-table pattern before layering in fixed weekly columns.
