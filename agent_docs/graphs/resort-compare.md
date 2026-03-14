# Resort Compare

## Summary
- Add a static-friendly comparison workflow so users can select a small set of resorts, open a dedicated compare surface, and decide between them without manually jumping across multiple resort pages.
- Version 1 should use the existing homepage payload plus already-generated resort hourly artifacts, so it remains compatible with static deployment.

## Feature Branch
- `ljcc/feature/resort-compare`

## Global Assumptions
- The comparison experience should support 2 to 4 resorts at a time.
- Static deployment is primary, so compare state must be reproducible from URL state and static JSON assets rather than server session state.
- Daily comparison should work from the main payload first; hourly enrichment may fetch existing per-resort hourly artifacts as a second step.

## Atomic Requests
- `resort-compare-01-selection-state`: Define compare selection rules, persistence, and shareable URL contract.
- `resort-compare-02-daily-surface`: Add the main compare UI for daily snowfall, rain, temperature, and summary metrics.
- `resort-compare-03-hourly-share`: Enrich the compare surface with per-resort hourly detail and sharing/export affordances.

## Dependency Graph
- `resort-compare-01-selection-state` -> `resort-compare-02-daily-surface`
- `resort-compare-01-selection-state` -> `resort-compare-03-hourly-share`
- `resort-compare-02-daily-surface` -> `resort-compare-03-hourly-share`

## Notes
- Keep selection logic reusable from both the homepage list and any future map or favorites surfaces.
- Avoid making the compare UI depend on unpublished runtime APIs; it should remain buildable as pure static output.
