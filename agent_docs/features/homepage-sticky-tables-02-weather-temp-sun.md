# Atomic Feature Request

## Request ID
- `homepage-sticky-tables-02-weather-temp-sun`

## Title
- Convert weather, temperature, and sun tables

## Feature Branch
- `ljcc/feature/homepage-sticky-tables`

## Dependencies
- `homepage-sticky-tables-01-shared-layout`: This request relies on the shared single-table sticky layout contract and 10-row viewport behavior defined in the prerequisite slice.

## Background
- `Weather`, `Temperature`, and `Sunrise / Sunset` currently use split desktop tables with left/right wrappers and row-sync logic, even though they conceptually match the same interaction pattern already proven by `Daily Summary`.
- These sections do not need pinned `weekly` columns, so they are the cleanest next rollout once the shared sticky-table contract exists.

## Goal
- Replace the desktop split-table implementations for `Weather`, `Temperature`, and `Sunrise / Sunset` with shared sticky single-table layouts.
- Each converted section should keep `favorite` and `resort` visible while the day columns scroll horizontally, keep the header rows sticky, and cap any vertically scrollable viewport to at most 10 visible body rows.

## Constraints / Forbidden Behaviors
- Do not change the underlying metrics, values, labels, sorting, favorites, or filtering semantics for any of these sections.
- Do not regress the `Temperature` metric/imperial toggle, the `Sunrise / Sunset` 24h/12h toggle, or `Weather` emoji/WMO tooltip behavior.
- Do not change `Snowfall` or `Rainfall` in this request; precipitation stays for the dedicated follow-up slice.
- Do not preserve split-table scroll-sync logic for these sections once the single-table rollout is complete.

## Acceptance Criteria
- [ ] Desktop `Weather` renders as one table with sticky `favorite` and `resort` columns, a sticky day header row, and no remaining left/right split wrapper behavior.
- [ ] Desktop `Temperature` renders as one table with sticky `favorite` and `resort` columns, sticky multi-row headers, and preserved `min/max` subcolumn labeling.
- [ ] Desktop `Sunrise / Sunset` renders as one table with sticky `favorite` and `resort` columns, sticky multi-row headers, and preserved sunrise/sunset value rendering for both 24h and 12h toggle modes.
- [ ] Any converted section that scrolls vertically shows at most 10 body rows before scrolling, while shorter result sets do not reserve empty extra space.
- [ ] Desktop filtering, sorting, favorites, and relevant unit/time toggles continue to work after the layout conversion.

## Test Plan
- `python3 -m pytest tests/frontend/test_assets.py -q`
- `python3 -m src.cli static --output-dir /tmp/closesnow-homepage-sticky-tables --max-workers 8`
- Desktop manual check of `Weather`, `Temperature`, and `Sunrise / Sunset` with enough resorts to confirm sticky leading columns, sticky headers, horizontal scrolling, and 10-row vertical viewport behavior.
