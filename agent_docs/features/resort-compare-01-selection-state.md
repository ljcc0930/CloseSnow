# Atomic Feature Request

## Request ID
- `resort-compare-01-selection-state`

## Title
- Define compare selection and URL state

## Feature Branch
- `ljcc/feature/resort-compare`

## Dependencies
- None.

## Background
- Users currently have to compare resorts mentally by scanning long tables or opening multiple resort pages.
- A compare feature only becomes useful if its selected resorts survive reloads, can be shared, and work identically in static and dynamic modes.

## Goal
- Introduce one compare-selection contract that:
- lets users add or remove resorts from a compare set
- enforces a stable max selection count
- persists compare state through query params and in-page restore logic
- can be consumed by both the main homepage and a dedicated compare surface

## Constraints / Forbidden Behaviors
- Do not require server-side session storage.
- Do not allow unbounded compare sets that make the UI unreadable.
- Do not hide compare selection in a way that makes it impossible to understand what is currently selected.
- Do not create a separate resort identity system beyond existing `resort_id`.

## Acceptance Criteria
- [ ] The compare selection model is defined around `resort_id` and a stable max-count rule.
- [ ] Users can restore the same compare selection from a shared URL on a static site.
- [ ] Selection state can be read by both the homepage and the compare surface without duplicating parsing logic.
- [ ] Invalid or unknown resort ids in the compare query state degrade safely instead of breaking page load.

## Test Plan
- `python3 -m pytest -q tests/frontend/test_assets.py tests/integration/test_web_server.py tests/integration/test_data_sources.py`
- `python3 -m src.cli static --output-dir /tmp/closesnow-resort-compare-selection --max-workers 8`
