# US Snowfall Map Polish

## Summary
- Promote the current US snowfall map from a decorative preview into a credible decision tool by replacing the faux geographic stage, tightening the information hierarchy, and improving dense-marker navigation.
- This design is based on the live build served at `http://127.0.0.1:4300/` from the worker worktree, where the map currently renders as a custom gradient stage with projected markers and preview-style copy rather than a production-grade geographic map.

## Feature Branch
- `ljcc/feature/us-snowfall-map`

## Global Assumptions
- Reuse the existing `map_context` contract already shipped on the current map branch.
- Static deployment remains a hard requirement, so any basemap or geometry solution must work in a static build with locally served assets or reliable static tile usage.
- The list/table homepage remains the broader page context; map polish should make the map more trustworthy and useful without replacing the rest of the page.

## Atomic Requests
- `us-snowfall-map-polish-01-real-basemap`: Replace the faux map stage with a real geographic basemap and map controls.
- `us-snowfall-map-polish-02-visual-redesign`: Redesign the map section copy, hierarchy, legend, popup, and mobile layout so it feels production-ready.
- `us-snowfall-map-polish-03-density-navigation`: Improve dense-marker navigation, selection, reset/focus controls, and filtered-result discoverability.

## Dependency Graph
- `us-snowfall-map-polish-01-real-basemap` -> `us-snowfall-map-polish-02-visual-redesign`
- `us-snowfall-map-polish-01-real-basemap` -> `us-snowfall-map-polish-03-density-navigation`

## Notes
- The current implementation in the live worker build places resort markers on a custom projected rectangle with “West / Central / East” labels rather than a true US geography, which undermines user trust even when the data is correct.
- The current subtitle and shell language still read like a preview, so visual polish needs to include productized copy, not just CSS changes.
