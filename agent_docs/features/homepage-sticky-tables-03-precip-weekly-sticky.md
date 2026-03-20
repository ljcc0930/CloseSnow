# Atomic Feature Request

## Request ID
- `homepage-sticky-tables-03-precip-weekly-sticky`

## Title
- Convert snowfall and rainfall with fixed weekly

## Feature Branch
- `ljcc/feature/homepage-sticky-tables`

## Dependencies
- `homepage-sticky-tables-01-shared-layout`: This request needs the shared single-table sticky layout contract, including support for configurable leading sticky columns, the 10-row viewport rule, and section ownership boundaries that let precipitation work land independently.

## Background
- `Snowfall` and `Rainfall` are the most complex homepage table sections because their desktop layout currently splits `favorite + resort + weekly` columns from the scrolling daily columns.
- The user requirement is stricter here than for the other sections: `Week 1` and `Week 2` must remain fixed alongside the left-side identity columns while daily columns continue to scroll horizontally.

## Goal
- Replace the desktop split-table implementations for `Snowfall` and `Rainfall` with sticky single-table layouts that keep `favorite`, `resort`, `week 1`, and `week 2` fixed while daily columns scroll horizontally.
- Apply the same vertical-scroll viewport rule as the other converted sections so a vertically scrollable precipitation table shows at most 10 body rows before scrolling.

## Constraints / Forbidden Behaviors
- Do not change precipitation values, cell coloring, `Weekly` labels, `Daily` labels, filtering, sorting, favorites, or metric/imperial toggles.
- Do not let `week 1` or `week 2` scroll out of view when the user scrolls horizontally through daily columns.
- Do not regress the existing mobile precipitation layouts unless a minimal compatibility fix is required to keep mobile behavior intact.
- Do not leave behind desktop split-table row-sync or vertical scroll-sync logic for precipitation once the single-table layout is complete.

## Acceptance Criteria
- [ ] Desktop `Snowfall` renders as one table whose sticky leading columns include `favorite`, `resort`, `week 1`, and `week 2`, while the daily columns scroll horizontally.
- [ ] Desktop `Rainfall` renders with the same sticky-column structure and horizontal-scroll behavior as `Snowfall`.
- [ ] Weekly columns remain visible and aligned while the user scrolls horizontally through the daily forecast columns.
- [ ] Any vertically scrollable desktop precipitation table shows at most 10 body rows before scrolling, while shorter result sets collapse to the available rows.
- [ ] Metric/imperial toggles, filtering, sorting, favorites, labels, and cell color semantics continue to behave the same after the conversion.

## Test Plan
- `python3 -m pytest tests/frontend/test_assets.py -q`
- `python3 -m src.cli static --output-dir /tmp/closesnow-homepage-sticky-tables --max-workers 8 --include-all-resorts`
- Desktop manual check of `Snowfall` and `Rainfall` with enough resorts to confirm fixed weekly columns, horizontal daily scrolling, and a 10-row vertical viewport.
