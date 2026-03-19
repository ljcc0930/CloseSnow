# Atomic Feature Request

## Request ID
- `granular-region-filters-02-multiselect-filter-ui`

## Title
- Replace homepage region and country dropdowns with multiselect controls

## Feature Branch
- `ljcc/feature/granular-region-filters`

## Dependencies
- `granular-region-filters-01-subregion-contract`: The UI needs the new `subregion` payload field, normalized `available_filters.subregion`, and dynamic API query support before it can switch away from the current single-value `region` select.

## Background
- The current homepage modal in `src/web/templates/weather_page.html` uses single-value `<select>` elements for `Region`, `Country`, and `Sort By`.
- `assets/js/weather_page.js` stores `region` and `country` as single values, updates option counts in place, persists that state to localStorage, and in API mode refetches `/api/data` whenever a filter changes.
- The requested UX needs a filter panel that follows the reference image more closely: finer region buckets and multiselect controls for region and country, while keeping sort selection lightweight.

## Goal
- Rework the homepage filter modal so `Region` uses the new image-aligned subregions as a checkbox-based multiselect, `Country` also becomes a checkbox-based multiselect, and `Sort By` remains a dropdown while preserving immediate filter application, localStorage persistence, and dynamic API refetch behavior.

## Constraints / Forbidden Behaviors
- Keep the existing pass type, favorites-only, default-scope, search-all, and search input flows.
- Keep the user-facing label as `Region`; do not expose raw internal field names like `subregion` in the modal copy.
- Do not add an Apply button or require modal submission; filter changes should continue applying immediately.
- Do not fork filter logic into separate behavior for local mode and API mode; the same UI state should drive both local filtering and server query generation.
- Do not leave remaining region or country dropdown selects in the modal.
- Keep sort single-choice and keep it as a `<select>`.
- Do not hand-maintain parallel logic in generated `site/assets/*`; source-of-truth edits belong in repo assets and template code.

## Acceptance Criteria
- [ ] The modal replaces the current region `<select>` with a checkbox group built from `available_filters.subregion` and renders the labels in this stable order: `Rockies`, `West Coast`, `Midwest`, `Mid-Atlantic`, `Northeast`, `Europe`, `Asia`, `Australia / New Zealand`, `South America`.
- [ ] Country filtering is rendered as a checkbox-based multiselect with friendly labels and counts rather than a dropdown.
- [ ] Sort is rendered as a dropdown and still allows exactly one active choice.
- [ ] Frontend filter state stores selected subregions and countries as sets or arrays, persists them in localStorage, restores them on load, and clears them correctly on Reset.
- [ ] `_filteredReports()` applies OR semantics within a filter family (any selected pass type, subregion, or country) and AND semantics across different filter families.
- [ ] Dynamic API mode emits repeatable query params for the selected `subregion` and `country` values in `buildServerQueryParams()` so backend refetches match local-mode filtering semantics.
- [ ] Filter summary text and the empty-state message remain accurate when multiple subregions or countries are selected at once.
- [ ] Template, JS, CSS, and frontend/integration tests move together so the static build output reflects the new filter behavior.

## Test Plan
- `pytest tests/frontend/test_renderers.py tests/frontend/test_assets.py tests/integration/test_web_server.py`
- `python3 -m src.cli static --output-dir /tmp/closesnow-region-filters --max-workers 8`
