# Atomic Feature Request

## Request ID
- `homepage-sticky-tables-02-weather-table`

## Title
- Convert weather table

## Feature Branch
- `ljcc/feature/homepage-sticky-tables`

## Dependencies
- `homepage-sticky-tables-01-shared-layout`: This request relies on the shared single-table sticky layout contract, the 10-row viewport rule, and the section ownership boundaries defined in the prerequisite slice.

## Background
- `Weather` currently uses a desktop split-table layout even though its interaction model is the closest match to the already-proven `Daily Summary` single-table pattern.
- Once the shared sticky-table primitives and section boundaries exist, `Weather` can move independently without waiting on the more complex precipitation or multi-value sections.

## Goal
- Replace the desktop split-table `Weather` implementation with a shared sticky single-table layout.
- The desktop section should keep `favorite` and `resort` visible while day columns scroll horizontally, keep the header sticky, and cap any vertically scrollable viewport to at most 10 visible body rows.

## Constraints / Forbidden Behaviors
- Do not change the underlying weather-code mapping, emoji rendering, WMO tooltip behavior, sorting, filtering, or favorites semantics.
- Do not modify `Temperature`, `Sunrise / Sunset`, `Snowfall`, or `Rainfall` in this request beyond any minimal shared-hook adoption already established by the prerequisite.
- Do not keep `Weather` dependent on leftover split-table scroll-sync or row-height-sync behavior after the conversion.

## Acceptance Criteria
- [ ] Desktop `Weather` renders as one table with sticky `favorite` and `resort` columns, a sticky day header row, and no remaining left/right split wrapper behavior.
- [ ] The desktop `Weather` table horizontally scrolls only through the day columns while the leading identity columns remain fixed.
- [ ] If the section scrolls vertically, it shows at most 10 body rows before scrolling; shorter result sets collapse naturally to the available rows.
- [ ] Desktop filtering, sorting, favorites, and WMO tooltip behavior continue to work after the layout conversion.

## Test Plan
- `python3 -m pytest tests/frontend/test_assets.py -q`
- `python3 -m src.cli static --output-dir /tmp/closesnow-homepage-sticky-tables --max-workers 8`
- Desktop manual check of `Weather` with enough resorts to confirm sticky leading columns, sticky header, horizontal scrolling, and 10-row vertical viewport behavior.
