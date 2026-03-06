# CloseSnow Static Page Performance Refactor Plan

Date: 2026-03-05
Status: implemented
Scope: main forecast page static and static-like runtime performance

## 1. Goal

Reduce main page load time and interaction latency for both:

1. fully static Pages deployment
2. dynamic frontend page rendered from the same payload contract

The refactor must preserve current runtime boundaries:

1. static: `fetch -> render`
2. coupled dynamic: `serve`
3. decoupled dynamic: `serve-data + serve-web`
4. communication modes: `local | api | file`

## 2. Current Problem Statement

The current main page is slow primarily because it pays all rendering cost up front:

1. Server-side render expands all five sections into full HTML tables before the browser starts.
2. The browser loads a large DOM tree even when most resorts are hidden by client-side filters.
3. Frontend initialization performs repeated layout measurement and row synchronization across multiple large tables.
4. Filtering is implemented as DOM hide/show, not data-driven rerender, so the browser still carries the full page weight.

Observed local indicators:

1. `index.html` is about `243638` bytes for the current local artifact.
2. `site/index.html` is about `170246` bytes for the current static artifact.
3. `assets/js/weather_page.js` is about `49244` bytes and performs repeated `applyLayout()` calls plus row height syncing via `offsetHeight` / `offsetWidth`.

## 3. Current Bottlenecks By Layer

## 3.1 Frontend render path

Current ownership:

1. `src/web/weather_page_render_core.py`
2. `src/web/weather_html_renderer.py`
3. `src/web/weather_table_renderer.py`
4. `src/web/templates/weather_page.html`

Current bottleneck:

1. `render_payload_html(...)` transforms the full payload into five fully-expanded HTML sections.
2. Resort rows are duplicated across snowfall, rainfall, temperature, weather, and sun sections.
3. Static output size scales roughly with `resorts_count * section_count * day_count`.

## 3.2 Frontend browser runtime

Current ownership:

1. `assets/js/weather_page.js`

Current bottleneck:

1. The page binds DOM references for every table and wrapper at startup.
2. `applyLayout()` triggers expensive width/height measurement across multiple tables.
3. `ResizeObserver` and `window.resize` both call layout refresh.
4. Filtering hides rows with `display:none` instead of reducing DOM cardinality.
5. Unit toggle updates every matching cell in the page and may trigger relayout.

## 3.3 Data boundary

Current ownership:

1. `src/contract/*`
2. `src/web/data_sources/*`
3. `src/backend/weather_data_server.py`

Constraint:

1. Payload contract and data source split are already in a good place.
2. The performance issue is mostly page assembly and browser-side DOM cost, not backend payload generation.

## 4. Refactor Direction

Adopt a shell-first, data-driven frontend for the main page:

1. Keep `weather_payload_v1` as the main transport contract.
2. Stop pre-rendering all resort rows into the initial main page HTML.
3. Ship a lightweight page shell plus filter metadata and a data URL or embedded minimal bootstrap config.
4. Fetch or load payload JSON in the browser and render visible rows client-side.
5. Treat filters as pure frontend state over in-memory data.

This keeps static and dynamic behavior aligned:

1. static page loads `site/data.json`
2. `serve-web --data-mode file` loads a JSON artifact
3. `serve-web --data-mode api` loads `/api/data`
4. `serve` can still render through local mode, but the browser-side page model stays the same

## 5. Target Architecture

## 5.1 Main page shell

Initial HTML should contain:

1. page title and header
2. filter controls
3. empty or skeleton section containers
4. asset references
5. small bootstrap config:
   - data source URL
   - filter metadata
   - render mode/version

Initial HTML should not contain:

1. all resort rows for every section
2. duplicated per-cell metric markup for all resorts

## 5.2 Client-side data rendering

Frontend JS should:

1. load payload once
2. derive row models once
3. keep normalized row state in memory
4. rerender only visible rows after filter/sort changes
5. batch layout work after render

## 5.3 Layout strategy

Replace row-by-row measurement-heavy sync where possible:

1. prefer CSS layout and stable column sizing
2. reduce hard dependency on `syncTableRowHeights(...)`
3. throttle resize work
4. do not rerun full layout on every filter keystroke if row count is unchanged or small

## 6. Recommended Delivery Slices

## Slice 1. Introduce shell mode for main page

Goal:

1. render lightweight HTML shell instead of full table markup

Files likely to change:

1. `src/web/weather_page_render_core.py`
2. `src/web/weather_html_renderer.py`
3. `src/web/templates/weather_page.html`
4. `src/web/weather_page_server.py`
5. `src/web/pipelines/static_site.py`

Behavior:

1. static render writes shell HTML and still writes `data.json`
2. frontend page gets a bootstrap config for where payload data lives
3. existing hourly pages stay unchanged

Compatibility rule:

1. keep existing routes and payload endpoints

## Slice 2. Add client-side row-model renderer

Goal:

1. move `reports -> rows -> table DOM` from Python-only render path to reusable browser render path

Files likely to change:

1. new `assets/js/weather_page_renderer.js` or equivalent module
2. `assets/js/weather_page.js`
3. optional new `src/web/bootstrap_payload_context.py` helper if config generation needs cleanup

Behavior:

1. page loads payload JSON and builds sections client-side
2. initial render shows only active dataset, not pre-expanded HTML

Compatibility rule:

1. preserve filter semantics and URL sync behavior

## Slice 3. Replace hide/show filtering with rerendered visible rows

Goal:

1. make filters operate on in-memory row state rather than existing DOM rows

Files likely to change:

1. `assets/js/weather_page.js`

Behavior:

1. filter changes rebuild visible row lists
2. hidden resorts are removed from DOM instead of just hidden
3. row count reduction directly reduces layout cost

## Slice 4. Reduce layout thrash

Goal:

1. shrink expensive measurement work after render

Files likely to change:

1. `assets/js/weather_page.js`
2. `assets/css/weather_page.css`

Behavior:

1. remove duplicated resize triggers where possible
2. debounce `ResizeObserver`
3. avoid `offsetHeight` sync unless strictly necessary
4. skip layout work for sections not yet rendered or not visible

## Slice 5. Progressive section rendering

Goal:

1. improve time-to-interactive further once shell mode exists

Behavior:

1. render snowfall and rainfall first
2. defer temperature, weather, and sun until idle time or next frame batches

This remained optional after slices 1-4 and was not required to achieve the main performance goal.

## 7. Explicit Non-Goals

Do not change in this refactor unless separately justified:

1. backend forecast contract shape
2. hourly page API and rendering flow
3. resort catalog filtering semantics
4. static `hourly.json` generation
5. decoupled `serve-data` API ownership

## 8. Risks

## 8.1 SEO / no-JS rendering tradeoff

Moving the main page to shell-first rendering reduces prerendered HTML content.

Mitigation:

1. keep page metadata and basic headings server-rendered
2. keep `data.json` static and cacheable
3. if needed later, add a low-row-count server-render fallback for bots, but do not block the main refactor on that

## 8.2 Duplicated transform logic across Python and JS

If Python keeps one row-transform path and JS adds another, behavior may drift.

Mitigation:

1. move toward one canonical row-model definition
2. keep output field names explicit and test fixture-driven

## 8.3 Static/dynamic divergence

If shell bootstrap differs by mode, behavior may fork again.

Mitigation:

1. use the same frontend renderer for static, `file`, `api`, and local-backed page mode
2. keep mode differences limited to payload acquisition only

## 9. Validation Plan

For each slice, run at minimum:

```bash
python3 -m pytest tests/frontend -q
python3 -m pytest tests/integration/test_web_server.py -q
python3 -m pytest tests/smoke/test_static_pipeline_smoke.py -q
python3 -m src.cli static --output-html index.html
```

Additional checks for this theme:

```bash
wc -c index.html site/index.html
rg -n "weather_page.js|CLOSESNOW_FILTER_META|report-date" index.html site/index.html
```

Success criteria:

1. static and dynamic pages still load successfully
2. filter semantics remain consistent across static and dynamic modes
3. generated main HTML size decreases materially
4. browser-side render path does not break hourly page flow

## 10. Recommended First Slice

Implemented result:

1. shell-first main page HTML now bootstraps from payload JSON
2. main page rows render in-browser from `weather_payload_v1`
3. filters rerender visible rows from in-memory data instead of hiding full DOM
4. expensive row-sync layout logic was removed from the main page path

Outcome:

1. static shell size dropped from large pre-expanded HTML to a small bootstrap document
2. static and dynamic main-page behavior are aligned through one browser-side renderer
3. payload contract, hourly page flow, and decoupled `serve-data` ownership remained intact
