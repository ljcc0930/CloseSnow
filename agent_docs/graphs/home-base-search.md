# Home Base Search

## Summary
- Add a static-first home-base workflow so users can set where they are starting from, filter resorts by distance radius, sort by proximity, and open directions to nearby mountains without requiring a live routing backend.
- Version 1 should be honest about deployment limits: use client-side coordinate lookup plus great-circle distance on the existing resort coordinates, not server-side route-time computation.

## Feature Branch
- `ljcc/feature/home-base-search`

## Global Assumptions
- Static deployment is the primary target. Core filtering and sorting must work from shipped assets plus existing homepage payload data.
- A home base may come from browser geolocation, a bundled US location lookup, or direct latitude/longitude entry.
- V1 should expose distance and nearby radius clearly; exact turn-by-turn drive ETA is out of scope unless an optional external provider is configured later.

## Atomic Requests
- `home-base-search-01-location-model`: Define the client-side home-base state, lookup sources, and URL/local persistence contract.
- `home-base-search-02-distance-engine`: Compute resort distance/radius eligibility from home base and integrate distance-aware sorting/filtering.
- `home-base-search-03-homepage-ui`: Add homepage controls, nearby result cues, and directions handoff around the new distance state.

## Dependency Graph
- `home-base-search-01-location-model` -> `home-base-search-02-distance-engine`
- `home-base-search-01-location-model` -> `home-base-search-03-homepage-ui`
- `home-base-search-02-distance-engine` -> `home-base-search-03-homepage-ui`

## Notes
- Keep this feature independent from the snowfall map so it can ship against the current table-first homepage.
- If later route-time APIs are added, they should layer on top of the same home-base contract rather than replacing it.
