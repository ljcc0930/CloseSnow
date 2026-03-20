# Atomic Feature Request

## Request ID
- `homepage-sticky-tables-05-sun-table`

## Title
- Convert sun table

## Feature Branch
- `ljcc/feature/homepage-sticky-tables`

## Dependencies
- `homepage-sticky-tables-01-shared-layout`: This request relies on the shared single-table sticky layout contract, the 10-row viewport rule, and the section ownership boundaries defined in the prerequisite slice.

## Background
- `Sunrise / Sunset` currently uses a split desktop layout even though its interaction model is structurally similar to `Temperature`: sticky identity columns plus horizontally scrolling day-based value columns.
- Once the shared sticky-table primitives exist, the `Sunrise / Sunset` rollout can proceed independently from the other sections.

## Goal
- Replace the desktop split-table `Sunrise / Sunset` implementation with a shared sticky single-table layout.
- The section should keep `favorite` and `resort` visible while day columns scroll horizontally, preserve the two-row sticky header structure, and cap any vertically scrollable viewport to at most 10 visible body rows.

## Constraints / Forbidden Behaviors
- Do not change sunrise/sunset values, label text, 24h/12h toggle behavior, filtering, sorting, or favorites semantics.
- Do not modify `Weather`, `Temperature`, `Snowfall`, or `Rainfall` in this request beyond any minimal shared-hook adoption already established by the prerequisite.
- Do not preserve split-table scroll-sync or row-height-sync behavior for the sun section after the conversion.

## Acceptance Criteria
- [ ] Desktop `Sunrise / Sunset` renders as one table with sticky `favorite` and `resort` columns and preserved two-row sticky headers for day labels and `sunrise/sunset` subcolumns.
- [ ] The desktop `Sunrise / Sunset` table horizontally scrolls through day subcolumns while the leading identity columns remain fixed.
- [ ] If the section scrolls vertically, it shows at most 10 body rows before scrolling; shorter result sets collapse naturally to the available rows.
- [ ] The 24h/12h toggle, filtering, sorting, and favorites continue to work after the layout conversion.

## Test Plan
- `python3 -m pytest tests/frontend/test_assets.py -q`
- `python3 -m src.cli static --output-dir /tmp/closesnow-homepage-sticky-tables --max-workers 8`
- Desktop manual check of `Sunrise / Sunset` with enough resorts to confirm sticky leading columns, sticky multi-row headers, horizontal scrolling, and 10-row vertical viewport behavior.
