# Main Page Favorites Local Update Design

Date: 2026-03-13
Status: proposed
Scope: reduce main-page favorite interactions that currently force a full `renderPage()` refresh.

## 1. Goal

Make the common favorite interactions feel lighter by updating the existing DOM in place when a full rerender is not actually required.

Primary target:

1. clicking a single resort heart
2. clicking `favorite all`

on the main page while keeping the current filter and sort behavior correct.

## 2. Current State

Favorite interactions live in [`assets/js/weather_page.js`](/Users/ljcc/workspace/CloseSnow/assets/js/weather_page.js).

Current flow:

1. update `appState.favoriteResortIds`
2. persist to `localStorage`
3. call `renderPagePreservingScroll()`
4. `renderPagePreservingScroll()` still calls `renderPage()`

Why that was originally convenient:

1. heart fill state changes
2. `favorite all` header state changes
3. `favorites only` may add/remove rows
4. `Favorites First` sort may reorder rows
5. empty-state rows may appear/disappear

The downside:

1. every section is destroyed and rebuilt
2. split-table wrappers lose their own internal scroll positions unless we restore them
3. a simple heart toggle does much more work than needed

## 3. Product Decision

Split favorite interactions into two paths:

1. local DOM update path
2. full rerender fallback path

Use the local path whenever the favorite change does not alter the visible row set or row ordering.

## 4. Safe Local-Update Cases

Local DOM sync is safe when both of these are true:

1. `favoritesOnly` is off
2. sort mode is not `favorites`

Why this is safe:

1. the same resorts remain visible
2. row order does not depend on favorite state
3. only button states and `favorite all` affordances need updating

In these cases we can update:

1. all `.favorite-btn[data-resort-id]` buttons already in the DOM
2. all `.favorite-all-btn[data-favorite-all='1']` buttons already in the DOM

without rebuilding the page.

## 5. Full-Rerender Cases

Keep the existing full rerender path when either condition is true:

1. `favoritesOnly` is on
2. sort mode is `favorites`

Why rerender is still needed:

1. rows may disappear or appear
2. row order may change
3. empty-state tables may need to switch in or out

For these cases we keep `renderPagePreservingScroll()` so current scroll restoration still applies.

## 6. DOM Sync Responsibilities

Add small helpers that separate state changes from rendering strategy.

Recommended helper responsibilities:

1. compute whether a favorite interaction needs full rerender
2. update a single heart button's `data-favorite-active`, `aria-pressed`, and `aria-label`
3. sweep all rendered heart buttons and resync them from `appState.favoriteResortIds`
4. recompute `favorite all` active state for the currently visible report set

This keeps the render strategy explicit:

1. mutate state
2. choose local sync or rerender

## 7. Implementation Plan

Files expected in this slice:

1. [`assets/js/weather_page.js`](/Users/ljcc/workspace/CloseSnow/assets/js/weather_page.js)
2. [`tests/frontend/test_assets.py`](/Users/ljcc/workspace/CloseSnow/tests/frontend/test_assets.py)
3. [`docs/REFACTOR_PROGRESS_LEDGER.md`](/Users/ljcc/workspace/CloseSnow/docs/REFACTOR_PROGRESS_LEDGER.md)

Phase 1:

1. local-sync single-favorite toggles when safe
2. local-sync `favorite all` when safe
3. preserve current rerender fallback for filter/sort-sensitive cases

Out of scope for this slice:

1. changing the favorite data model
2. removing `renderPage()` from every favorite-related path
3. browser-automation coverage

## 8. Validation

Automated:

1. update asset tests to assert local-sync helpers and rerender-fallback checks exist
2. run targeted frontend tests
3. run a static build to ensure asset output is still generated correctly

Manual sanity expectation:

1. simple heart toggles should no longer rebuild the full page when `favoritesOnly` is off and sort is not `Favorites First`
2. `favoritesOnly` and `Favorites First` should still behave correctly through the existing rerender path
