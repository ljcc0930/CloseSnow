# Atomic Feature Request

## Request ID
- `resort-compare-02-daily-surface`

## Title
- Build the daily compare surface

## Feature Branch
- `ljcc/feature/resort-compare`

## Dependencies
- `resort-compare-01-selection-state`: requires stable compare selection parsing and max-count handling before UI rendering can be trusted.

## Background
- The main payload already contains enough daily information to compare a handful of resorts on snowfall, rain, temperature, and weather windows.
- A dedicated compare surface should reduce the decision load compared with the current table-first homepage.

## Goal
- Build a compare surface that shows selected resorts side by side using the existing daily payload, including:
- high-signal summary cards
- daily snowfall / rain / temperature comparison rows
- visible winner / strongest-signal cues for the currently selected metric windows
- graceful empty and under-selected states when fewer than two resorts are chosen

## Constraints / Forbidden Behaviors
- Do not fetch hourly data in this slice.
- Do not rebuild the core homepage table layout into a compare tool; keep the compare surface its own focused UI.
- Do not assume the compare surface is desktop-only.
- Do not hide key differences behind hover-only behavior.

## Acceptance Criteria
- [ ] Users can open a compare surface that renders the currently selected resorts side by side from the existing daily payload.
- [ ] The compare surface stays usable for 2, 3, and 4 selected resorts on both desktop and mobile.
- [ ] Empty-state and under-selected-state messaging clearly tells the user how to add more resorts.
- [ ] The compare rendering can be produced in static builds without requiring a live backend.

## Test Plan
- `python3 -m pytest -q tests/frontend/test_assets.py tests/frontend/test_static_site_pipeline.py tests/integration/test_web_server.py`
- `python3 -m src.cli static --output-dir /tmp/closesnow-resort-compare-daily --max-workers 8`
