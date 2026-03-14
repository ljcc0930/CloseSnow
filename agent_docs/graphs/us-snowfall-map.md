# US Snowfall Map

## Summary
- Add a map-first overview to the main page that plots supported US ski resorts and visualizes snowfall intensity directly on a United States map, while keeping the current tables, filters, favorites, and resort hourly pages as the primary workflow.
- Keep the implementation friendly to the existing stack: plain JS/CSS assets, static-site compatible output, and the same `data.json` / `/api/data` payload already used by the homepage.

## Feature Branch
- `ljcc/feature/us-snowfall-map`

## Global Assumptions
- Version 1 only renders resorts whose `country_code` is `US` and whose payload exposes usable resolved coordinates. International resorts remain list-only in this feature.
- The map is additive. Do not remove or redesign the current daily-summary tables, server-side filters, or resort hourly pages as part of this request.
- Use locally served map-library assets and attribution-safe basemap behavior. If tiles fail to load, the page must still render usable list content and an inline map fallback state.

## Atomic Requests
- `us-snowfall-map-01-contract`: Formalize US map-ready snowfall contract in the main payload.
- `us-snowfall-map-02-map-shell`: Add the main-page map section, asset plumbing, and controller API scaffold.
- `us-snowfall-map-03-map-controller`: Build the standalone snowfall map controller module.
- `us-snowfall-map-04-page-sync`: Wire the map controller into homepage filters, favorites, and row focus.

## Dependency Graph
- `us-snowfall-map-01-contract` -> `us-snowfall-map-03-map-controller`
- `us-snowfall-map-02-map-shell` -> `us-snowfall-map-03-map-controller`
- `us-snowfall-map-01-contract` -> `us-snowfall-map-04-page-sync`
- `us-snowfall-map-02-map-shell` -> `us-snowfall-map-04-page-sync`

## Notes
- `us-snowfall-map-03-map-controller` and `us-snowfall-map-04-page-sync` should be able to proceed in parallel once the payload contract and shell/controller API are stable.
- Prefer dedicated map summary fields over recomputing cross-day snowfall windows ad hoc in multiple frontend paths.
