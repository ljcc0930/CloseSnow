# Atomic Feature Request

## Request ID
- `resort-compare-03-hourly-share`

## Title
- Add hourly compare detail and share actions

## Feature Branch
- `ljcc/feature/resort-compare`

## Dependencies
- `resort-compare-01-selection-state`: requires stable selected resort ids and URL state.
- `resort-compare-02-daily-surface`: requires the base compare surface before layering on detail and sharing actions.

## Background
- Once daily comparison exists, the next decision question is usually about timing: storm arrival, overnight snow, rain crossover, and wind.
- The project already generates per-resort hourly artifacts, which makes hourly compare feasible in static mode.

## Goal
- Extend the compare surface so it can fetch and render selected resorts’ hourly artifacts for deeper side-by-side comparison.
- Add explicit sharing actions for the compare URL so users can send the same compare view to someone else.

## Constraints / Forbidden Behaviors
- Do not require a new compare-specific backend endpoint.
- Do not block the whole compare page if one resort’s hourly artifact is missing.
- Do not overload the compare screen with every possible hourly metric at once; prioritize the metrics that influence trip choice.
- Do not create a non-shareable in-memory compare mode that diverges from the URL.

## Acceptance Criteria
- [ ] The compare surface can load existing static hourly resort artifacts for the selected resorts and show hourly comparison where available.
- [ ] Missing hourly data for one resort degrades to a scoped warning instead of breaking the rest of the compare view.
- [ ] The current compare selection is easy to copy/share as a URL.
- [ ] The compare experience remains usable without a live backend when built statically.

## Test Plan
- `python3 -m pytest -q tests/frontend/test_assets.py tests/frontend/test_static_site_pipeline.py tests/integration/test_web_server.py`
- `python3 -m src.cli static --output-dir /tmp/closesnow-resort-compare-hourly --max-workers 8`
