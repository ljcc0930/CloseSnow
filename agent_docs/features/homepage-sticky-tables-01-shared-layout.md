# Atomic Feature Request

## Request ID
- `homepage-sticky-tables-01-shared-layout`

## Title
- Shared sticky table layout contract

## Feature Branch
- `ljcc/feature/homepage-sticky-tables`

## Dependencies
- None.

## Background
- `Daily Summary` now proves that a single-table layout with sticky leading columns and a sticky header can replace the older split-table desktop interaction.
- The remaining homepage sections still depend on split left/right wrappers, vertical scroll syncing, and row-height syncing inside `assets/js/weather_page.js` and `assets/css/weather_page.css`.
- Before more sections are converted, the homepage needs one shared sticky-table contract and one shared set of section ownership boundaries so later workers do not each clone their own version of the `Daily Summary` logic or collide in the same monolithic code path.

## Goal
- Establish the reusable homepage single-table sticky layout contract that later requests can apply to other sections.
- The shared contract must cover:
- sticky leading columns for the common `favorite + resort` shape
- optional support for more than two sticky leading columns so precipitation tables can later pin `weekly` columns too
- sticky header rows for one-row and two-row header variants
- a reusable vertical viewport rule that caps visible body rows at 10 when the section scrolls vertically
- section-level render/style ownership boundaries so `Weather`, `Temperature`, `Sunrise / Sunset`, and precipitation follow-up requests can proceed in parallel after this slice lands

## Constraints / Forbidden Behaviors
- Do not change backend payload shape, fetch behavior, or any API route.
- Do not regress the current `Daily Summary` unit toggle, filtering, sorting, favorites, or sticky-column behavior while extracting shared layout logic.
- Do not hard-code the shared contract to a single section; later requests must be able to reuse it without copying section-specific markup or sizing code again.
- Do not force precipitation-specific `weekly` assumptions into sections that only need `favorite + resort`.
- Do not leave later requests dependent on one shared section implementation file or one ambiguous styling block if that would keep the worker slices serialized in practice.

## Acceptance Criteria
- [ ] The homepage frontend has one shared sticky single-table layout path or helper contract that can be reused by later table sections instead of keeping section-specific split-table scaffolding.
- [ ] The shared layout contract explicitly supports configurable leading sticky columns, sticky header rows, and a reusable viewport cap of at most 10 visible body rows for vertically scrollable sections.
- [ ] The frontend code after this slice exposes clear section-level ownership boundaries for `Weather`, `Temperature`, `Sunrise / Sunset`, and precipitation follow-up work, so later workers do not have to rework the same `Daily Summary`-specific implementation surface.
- [ ] `Daily Summary` continues to render and behave correctly after the shared contract is introduced, including sticky leading columns, sticky header, filtering/sorting, and unit toggles.
- [ ] Any obsolete `Daily Summary` split-table-only sync logic that is no longer needed after the shared contract is introduced is removed or clearly isolated so later requests do not depend on it.

## Test Plan
- `python3 -m pytest tests/frontend/test_assets.py -q`
- `python3 -m src.cli static --output-dir /tmp/closesnow-homepage-sticky-tables --max-workers 8`
- Desktop manual check of `Daily Summary` with enough resorts to confirm horizontal scrolling, sticky leading columns, and a 10-row max viewport still behave correctly.
