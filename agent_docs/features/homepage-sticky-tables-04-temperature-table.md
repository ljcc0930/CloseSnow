# Atomic Feature Request

## Request ID
- `homepage-sticky-tables-04-temperature-table`

## Title
- Convert temperature table

## Feature Branch
- `ljcc/feature/homepage-sticky-tables`

## Dependencies
- `homepage-sticky-tables-01-shared-layout`: This request relies on the shared single-table sticky layout contract, the 10-row viewport rule, and the section ownership boundaries defined in the prerequisite slice.

## Background
- `Temperature` currently depends on a split desktop layout with a fixed left table and a scrolling right table, even though its data model can fit the same sticky single-table pattern as `Daily Summary`.
- Unlike `Snowfall` and `Rainfall`, it does not need pinned `weekly` columns, so it can be delivered as an independent worker slice after the shared-layout prerequisite lands.

## Goal
- Replace the desktop split-table `Temperature` implementation with a shared sticky single-table layout.
- The section should keep `favorite` and `resort` visible while the day columns scroll horizontally, preserve the two-row `day / min-max` header structure, and cap any vertically scrollable viewport to at most 10 visible body rows.

## Constraints / Forbidden Behaviors
- Do not change temperature values, min/max ordering, label text, metric/imperial toggle behavior, filtering, sorting, or favorites semantics.
- Do not modify `Weather`, `Sunrise / Sunset`, `Snowfall`, or `Rainfall` in this request beyond any minimal shared-hook adoption already established by the prerequisite.
- Do not preserve split-table scroll-sync or row-height-sync behavior for the temperature section after the conversion.

## Acceptance Criteria
- [ ] Desktop `Temperature` renders as one table with sticky `favorite` and `resort` columns and preserved two-row sticky headers for day labels and `min/max` subcolumns.
- [ ] The desktop `Temperature` table horizontally scrolls through day subcolumns while the leading identity columns remain fixed.
- [ ] If the section scrolls vertically, it shows at most 10 body rows before scrolling; shorter result sets collapse naturally to the available rows.
- [ ] Metric/imperial toggles, filtering, sorting, and favorites continue to work after the layout conversion.

## Test Plan
- `python3 -m pytest tests/frontend/test_assets.py -q`
- `python3 -m src.cli static --output-dir /tmp/closesnow-homepage-sticky-tables --max-workers 8`
- Desktop manual check of `Temperature` with enough resorts to confirm sticky leading columns, sticky multi-row headers, horizontal scrolling, and 10-row vertical viewport behavior.
