# CloseSnow Refactor Design: Resort Favorites / Heart Feature

Date: 2026-03-13  
Owner: CloseSnow (main forecast page)

## 1. Goal

Add a per-user "heart / favorite" feature for resorts on the main page without introducing accounts, server-side persistence, or breaking the current static-site-first architecture.

Primary outcome:
- users can heart a resort
- favorites persist in the browser
- users can filter to favorites or sort favorites first

## 2. Why This Needs Refactor

Current code already contains a field named `ljcc_favorite`, but it does **not** mean "user favorited this resort".

Current meaning:
- backend maps catalog `default_enabled` to payload `ljcc_favorite`
- frontend uses that value as a default-scope marker for filtering
- UI label exposes this as `Default resorts only`

This creates a naming collision:
- product meaning A: site-curated default resorts
- product meaning B: user-clicked favorites / hearts

If we implement hearts on top of `ljcc_favorite`, we will mix:
- editorial default scope
- user preference state

That would make filtering, sorting, and future persistence ambiguous.

## 3. Current Baseline

Relevant behavior in current code:

1. Backend:
- `src/backend/pipeline.py` enriches each report with:
  - `resort_id`
  - `pass_types`
  - `region`
  - `ljcc_favorite = default_enabled`

2. Frontend transform/render:
- `src/web/weather_report_transform.py` carries `ljcc_favorite` into row metadata
- `src/web/weather_table_renderer.py` and renderer helpers output `data-default-enabled`

3. Browser app state:
- `assets/js/weather_page.js` stores:
  - unit preference
  - filter state
- it does not yet store user favorites

4. UI:
- `src/web/templates/weather_page.html` has search + filter controls
- no heart button exists today

## 4. Refactor Direction

Separate the two concepts explicitly:

1. Keep existing default-scope semantics:
- `default_enabled` in catalog
- payload marker for "site default resort"

2. Add a new frontend-only concept:
- `favorite_resort_ids`
- browser persisted via `localStorage`

3. Do not require backend writes:
- static mode and GitHub Pages stay supported
- dynamic mode works with the same frontend logic

## 5. Architecture Decision

Use browser-local persistence as v1.

Why:
- current app is static-first
- no user account system exists
- no backend storage contract is needed
- behavior is consistent across `static`, `serve`, and `serve-web`

Persistence key:
- `closesnow_favorite_resorts_v1`

Stored shape:

```json
["snowbird-ut", "solitude-ut", "steamboat-co"]
```

## 6. Naming Refactor

Recommended rename plan:

1. Backend payload:
- add `default_resort: bool` as the canonical meaning
- keep `ljcc_favorite` temporarily as compatibility alias if needed

2. Frontend data attributes:
- rename `data-default-enabled` to `data-default-resort`

3. Browser-only state:
- `favoriteResortIds: Set<string>`

4. UI copy:
- current scope label remains `Default resorts only`
- new heart feature uses `Favorites`

## 7. Scope

## 7.1 In Scope

- heart button beside each resort name on the main page
- local persistence by `resort_id`
- favorites-only filter
- favorites-first sort option
- favorite state reflected across all main-page sections

## 7.2 Out of Scope

- login/account sync
- cross-device sync
- backend POST/PUT favorite APIs
- hourly page favorite management
- migrating existing users from any previous heart system

## 8. UX Requirements

## 8.1 Heart Placement

For each resort row on the main page:
- show a heart toggle near the resort name
- empty state: not favorited
- filled state: favorited

Interaction:
- click toggles favorite
- toggle should not navigate to resort hourly page
- state updates immediately across visible sections

## 8.2 Controls

Add the following controls near existing search/filter UI:

1. Favorites only
- checkbox toggle
- when enabled, only favorited resorts are shown

2. Favorites first
- sort mode or checkbox
- non-favorites still remain visible
- favorited resorts are grouped above non-favorites

Recommended sort behavior:
- `favorites` sort groups favorites first, then applies current secondary sort

## 8.3 Empty States

If `Favorites only` is enabled and no favorites exist:
- show a friendly empty state
- example: `No favorite resorts yet. Tap the heart icon to save some.`

## 9. Data / State Design

## 9.1 Payload Contract

No required backend write API for v1.

Optional cleanup:
- payload reports expose:
  - `default_resort: bool`
  - `resort_id: str`

Compatibility option:
- keep `ljcc_favorite` for one transition window
- frontend should treat it as `default_resort`, not user favorite

## 9.2 Frontend State

Extend `appState` in `assets/js/weather_page.js`:

```js
favoriteResortIds: new Set(),
filterState: {
  ...,
  favoritesOnly: false,
  sortBy: "state" | "name" | "favorites",
}
```

## 9.3 Storage

Add helpers:
- `loadFavoriteResortIds()`
- `persistFavoriteResortIds()`
- `toggleFavoriteResortId(resortId)`
- `isFavoriteResort(resortId)`

Rules:
- ignore empty or missing `resort_id`
- deduplicate IDs
- fail open if `localStorage` is unavailable

## 10. Rendering Changes

## 10.1 HTML Template

Files:
- `src/web/templates/weather_page.html`

Changes:
- add favorites control(s) near current filter bar
- optionally add a small legend/help text

## 10.2 Browser Rendering

Files:
- `assets/js/weather_page.js`

Changes:
1. Update resort cell rendering:
- wrap name/link with a row header container
- inject heart button using `resort_id`

2. Event handling:
- event delegation on favorite buttons
- prevent link navigation when clicking heart

3. Filter integration:
- `favoritesOnly` narrows visible reports

4. Sort integration:
- `favorites` sort groups by favorite state first

5. Rerender strategy:
- after favorite toggle, rerender all sections from in-memory payload
- do not refetch data

## 10.3 Python Static Render Path

Files:
- `src/web/weather_table_renderer.py`
- `src/web/desktop/*`
- `src/web/split_metric_renderer.py`
- `src/web/desktop/temperature_renderer.py`
- `src/web/desktop/sun_renderer.py`

Needed because:
- static HTML shell and Python-side render helpers should emit heart button placeholders consistently
- browser hydration/rerender should produce matching structure

Recommended pattern:
- add a shared renderer helper for the resort cell:
  - resort link
  - favorite button scaffold
  - data attributes for `resort_id`

## 11. Refactor Plan by Layer

## 11.1 Backend

Files:
- `src/backend/pipeline.py`
- optional contract validator updates

Changes:
1. Rename or alias `ljcc_favorite` to `default_resort`
2. Keep `resort_id` mandatory for favorite-capable rows
3. Do not add user-specific persistence to backend

Risk:
- changing field names too early can break current frontend tests

Safe rollout:
1. add `default_resort`
2. keep `ljcc_favorite` as alias
3. migrate frontend
4. remove alias later

## 11.2 Frontend Python Render Layer

Files:
- `src/web/weather_report_transform.py`
- `src/web/weather_table_renderer.py`
- `src/web/split_metric_renderer.py`
- `src/web/desktop/temperature_renderer.py`
- `src/web/desktop/sun_renderer.py`

Changes:
1. replace semantic use of `ljcc_favorite` with `default_resort`
2. emit `resort_id` and default marker cleanly
3. add favorite button scaffold into query cell

## 11.3 Frontend Browser Layer

Files:
- `assets/js/weather_page.js`
- `assets/css/weather_page.css`
- `src/web/templates/weather_page.html`

Changes:
1. load/persist favorite IDs
2. rerender rows with favorite state
3. add favorites-only filter
4. add favorites-first sort
5. style heart button and selected state

## 12. Proposed Execution Order

1. Semantic cleanup:
- introduce `default_resort` naming without changing behavior

2. Rendering scaffold:
- add heart button markup to resort cells
- add CSS selected/unselected states

3. Browser persistence:
- add `localStorage` favorite set load/save/toggle helpers

4. Filtering and sorting:
- add `favoritesOnly`
- add `favorites` sort

5. Empty state + polish:
- add no-favorites message
- verify layout on desktop/mobile

6. Optional cleanup:
- remove `ljcc_favorite` alias after frontend is fully migrated

## 13. Validation Plan

## 13.1 Automated Tests

Add/update:
- `tests/frontend/test_renderers.py`
- `tests/frontend/test_assets.py`
- `tests/frontend/test_styles_and_transform.py`
- optional integration checks in `tests/integration/test_web_server.py`

Test cases:
1. renderer outputs favorite button scaffold with `resort_id`
2. favorite-selected state renders correctly
3. favorites-only filter hides non-favorites
4. favorites-first sort orders correctly
5. default-scope behavior still works
6. empty `resort_id` rows do not crash

## 13.2 Static Validation

```bash
python3 -m src.cli static --output-html index.html
rg -n "favorite|heart|Favorites only|favorites" index.html
```

Expected:
- main page shell contains favorite controls and heart button markup

## 13.3 Test Commands

```bash
python3 -m pytest tests/frontend/test_renderers.py -q
python3 -m pytest tests/frontend/test_styles_and_transform.py -q
python3 -m pytest tests/frontend/test_assets.py -q
python3 -m src.cli static --output-html index.html
```

## 14. Risks

1. Naming confusion during migration
- mitigated by introducing `default_resort` before heart behavior

2. Row markup drift between Python render and browser rerender
- mitigated by sharing one resort-cell rendering shape as much as possible

3. Missing `resort_id` for some rows
- mitigated by graceful fallback: no heart button, no crash

4. localStorage unavailable or blocked
- mitigated by fail-open behavior with non-persistent favorites

## 15. Acceptance Criteria

This refactor is complete when:

1. Main page rows show a heart toggle for resorts with `resort_id`
2. Clicking heart updates UI immediately without reload
3. Favorites persist across page reload in the same browser
4. `Favorites only` works without breaking current filter semantics
5. `Favorites first` sorting works consistently across sections
6. "default resorts" semantics remain separate from user favorites
7. Static render and dynamic render both work

## 16. Future Extensions

Possible v2 directions:
- expose favorites on hourly pages
- export/import favorite list
- sync favorites via user account
- add a dedicated `My Resorts` landing mode
