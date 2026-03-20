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
- `homepage-sticky-tables-01-shared-layout` must do more than define a visual contract; it also needs to carve section-level frontend ownership boundaries so follow-up workers can land mostly independent PRs.
- `Snowfall` and `Rainfall` need more sticky leading columns than the other sections because `Week 1` and `Week 2` must remain visible during horizontal scrolling.
- `Snowfall` and `Rainfall` remain one combined worker slice because they still share the same precipitation renderer shape and fixed-weekly requirement.

## Atomic Requests
- `homepage-sticky-tables-01-shared-layout`: Define the shared homepage single-table sticky layout contract, 10-row viewport policy, and section ownership boundaries for follow-up workers.
- `homepage-sticky-tables-02-weather-table`: Convert desktop `Weather` to the shared sticky single-table layout.
- `homepage-sticky-tables-03-precip-weekly-sticky`: Convert desktop `Snowfall` and `Rainfall` to sticky single-table layouts with fixed weekly columns.
- `homepage-sticky-tables-04-temperature-table`: Convert desktop `Temperature` to the shared sticky single-table layout.
- `homepage-sticky-tables-05-sun-table`: Convert desktop `Sunrise / Sunset` to the shared sticky single-table layout.

## Dependency Graph
- `homepage-sticky-tables-01-shared-layout` -> `homepage-sticky-tables-03-precip-weekly-sticky`
- `homepage-sticky-tables-01-shared-layout` -> `homepage-sticky-tables-02-weather-table`
- `homepage-sticky-tables-01-shared-layout` -> `homepage-sticky-tables-04-temperature-table`
- `homepage-sticky-tables-01-shared-layout` -> `homepage-sticky-tables-05-sun-table`

## Notes
- The final state should let workers remove per-section split-table row-height syncing and vertical scroll syncing for every section that successfully moves to a single-table layout.
- The maximum ready set after `homepage-sticky-tables-01-shared-layout` should be four independent worker requests: `Weather`, `Temperature`, `Sunrise / Sunset`, and combined precipitation.
