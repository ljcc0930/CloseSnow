# Atomic Feature Request

## Request ID
- `us-snowfall-map-polish-03-density-navigation`

## Title
- Improve marker density and navigation

## Feature Branch
- `ljcc/feature/us-snowfall-map`

## Dependencies
- `us-snowfall-map-polish-01-real-basemap`: requires a real geographic map surface before cluster/navigation behavior can be trustworthy.

## Background
- Once the map uses real geography, the next usability problem is density: nearby resorts in Colorado, Utah, Tahoe, Vermont, and New England can crowd together quickly.
- The current map/list sync is functional, but it lacks the navigational affordances needed for dense result sets.

## Goal
- Improve the map so users can reliably navigate dense resort clusters and recover orientation after heavy filtering.
- Add the most important affordances around:
- marker density handling or clustering
- selected resort focus / refocus
- visible-result feedback for filtered lists
- explicit map reset and “show selected resort” style navigation

## Constraints / Forbidden Behaviors
- Do not leave dense resort regions as overlapping, unreadable marker piles.
- Do not make keyboard or touch users rely on pixel-perfect marker clicks only.
- Do not let map navigation diverge from the filtered resort list state.
- Do not introduce behavior that hides selected resorts without a clear way to recover them.

## Acceptance Criteria
- [ ] Dense resort regions remain navigable through clustering, spreading, or another explicit density strategy.
- [ ] Users have a clear way to reset the map and refocus on the currently selected resort or filtered result set.
- [ ] Map selection and the resort list stay synchronized when filters or selection change.
- [ ] The map communicates when no visible resorts are currently in the active geographic or filter scope.

## Test Plan
- `python3 -m pytest -q tests/frontend/test_assets.py tests/integration/test_web_server.py`
- `python3 -m src.cli static --output-dir /tmp/closesnow-us-map-density --max-workers 8`
