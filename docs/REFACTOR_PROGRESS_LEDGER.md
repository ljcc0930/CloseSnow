# CloseSnow Refactor Progress Ledger

This file is the recovery anchor for long-running refactor work.

Always read in this order before continuing:

1. `docs/FRONTEND_COMM_BACKEND_REFACTOR_GUIDE.md`
2. `docs/CODEBASE_VALIDATION_PLAYBOOK.md`
3. `docs/REFACTOR_PROGRESS_LEDGER.md` (this file)

---

## Current Objective

Implement the v4 classification/simplification objective:

`Frontend -> Communication -> Backend`

while keeping existing CLI/server/static behavior runnable at every step.

Status: v4 classification+merge pass implemented and validated on 2026-03-04 local.

---

## Current Baseline (Confirmed)

1. Backend fetch pipeline supports concurrent resort processing with `--max-workers`.
2. Cache read/write paths are lock-protected for concurrent access.
3. Frontend has per-table unit toggles (`cm/in`, `mm/in`, `C/F`) with persisted browser preference.
4. Desktop/mobile renderer split exists with merged precipitation wrappers by platform.
5. Two planning docs already exist:
   - `docs/FRONTEND_COMM_BACKEND_REFACTOR_GUIDE.md`
   - `docs/CODEBASE_VALIDATION_PLAYBOOK.md`
6. Automated pytest suite exists under `tests/` and is runnable via `python3 -m pytest -q`.
7. Current Codex convention for local static preview/validation runs is `--max-workers 8`; older ledger entries that used `2` were temporary throttled runs.

---

## Completed Milestones

## 2026-03-14 11:40 (local)

### Scope
- Add resort-page coordinate verification/reporting links and a dedicated GitHub coordinate-correction issue form.

### Changes
- Files:
  - `.github/ISSUE_TEMPLATE/01-coordinate-correction.yml`
  - `assets/css/resort_hourly.css`
  - `assets/js/resort_hourly.js`
  - `docs/FEATURE_DESIGN_RESORT_COORDINATE_VERIFICATION_LINKS.md`
  - `tests/frontend/test_assets.py`
  - `docs/REFACTOR_PROGRESS_LEDGER.md`
- Behavior impact:
  - Resort hourly pages now render resolved coordinates as a Google Maps link instead of plain text.
  - The same meta row now appends a red `（坐标不对）` link that opens a prefilled GitHub issue form for coordinate corrections.
  - The new issue form captures resort name, resort page URL, current wrong coordinates, current Google Maps link, corrected coordinates, corrected Google Maps link, and supporting notes.

### Validation
- Commands:
  - `python3 -m compileall src`
  - `python3 -m pytest tests/frontend/test_assets.py tests/frontend/test_static_site_pipeline.py tests/integration/test_web_server.py -q`
  - `python3 -m src.cli static --output-dir /tmp/closesnow-coordinate-verify --max-workers 8`
  - `rg -n "coordinate-correction|坐标不对|maps/search/\\?api=1&query=|hourly-meta-issue-link" /tmp/closesnow-coordinate-verify/assets/js/resort_hourly.js /tmp/closesnow-coordinate-verify/assets/css/resort_hourly.css -S`
- Results:
  - compile check: passed
  - targeted frontend/static/integration suites: `18 passed`
  - static preview rebuild: succeeded (`Done: /tmp/closesnow-coordinate-verify/data.json`, `Done: /tmp/closesnow-coordinate-verify/index.html`, `Done: 28 resort hourly page(s)`)
  - asset grep: confirmed the generated resort hourly JS/CSS include the Google Maps link builder, the dedicated coordinate-correction template name, the `（坐标不对）` label, and the issue-link styling hook

### Risks / Notes
- The issue prefill prefers the current GitHub Pages resort URL when available and otherwise falls back to the canonical `https://ljcc0930.github.io/CloseSnow/resort/<id>/` path; custom non-Pages deployments will need to edit that field before submitting if they want to preserve their own host.
- The resort-page metadata still uses the resolved hourly payload coordinates only; this slice does not add coordinate displays to any page that did not already show coordinates.

### Next Slice
- If we later expose coordinates on the main multi-resort page too, reuse the same GitHub form ids and Google Maps link pattern there instead of inventing a second reporting flow.

## 2026-03-13 22:30 (local)

### Scope
- Capitalize all user-facing fallback day labels that previously started with lowercase `today` so they now render as `Today`.

### Changes
- Files:
  - `assets/js/compact_daily_summary.js`
  - `assets/js/resort_hourly.js`
  - `assets/js/weather_page.js`
  - `src/web/day_label_html.py`
  - `src/web/split_metric_renderer.py`
  - `src/web/weather_table_renderer.py`
  - `src/web/desktop/temperature_renderer.py`
  - `src/web/desktop/sun_renderer.py`
  - `tests/frontend/test_assets.py`
  - `tests/frontend/test_day_label_html.py`
  - `tests/frontend/test_renderers.py`
  - `docs/REFACTOR_PROGRESS_LEDGER.md`
- Behavior impact:
  - Main-page daily labels, resort timeline labels, and server-rendered fallback headers now show `Today` instead of lowercase `today`.
  - Existing internal keys such as `today_snow` remain unchanged because they are routing/sort values, not user-facing labels.
  - Frontend regression coverage now checks the updated JS assets and day-label rendering helpers for the capitalized fallback.

### Validation
- Commands:
  - `python3 -m compileall src`
  - `python3 -m pytest tests/frontend/test_assets.py tests/frontend/test_day_label_html.py tests/frontend/test_renderers.py tests/frontend/test_static_site_pipeline.py tests/integration/test_web_server.py -q`
  - `python3 -m src.cli static --output-dir /tmp/closesnow-resort-history --max-workers 8`
  - `rg -n 'Today|today' /tmp/closesnow-resort-history/index.html /tmp/closesnow-resort-history/assets/js/weather_page.js /tmp/closesnow-resort-history/assets/js/resort_hourly.js /tmp/closesnow-resort-history/assets/js/compact_daily_summary.js -S`
- Results:
  - compile check: passed
  - targeted frontend/static/integration suites: `28 passed`
  - static preview rebuild: succeeded (`Done: /tmp/closesnow-resort-history/data.json`, `Done: /tmp/closesnow-resort-history/index.html`, `Done: 28 resort hourly page(s)`)
  - artifact grep: confirmed generated JS assets now emit `Today` for fallback day labels while preserving internal `today_snow` values

### Risks / Notes
- This slice only capitalizes fallback labels; explicit date strings and user-facing sort labels like `Today's Snowfall` were already correctly capitalized.

### Next Slice
- If we later want full title casing for generic fallback labels too, consider whether `day 2` should become `Day 2` in the same family of renderers.

## 2026-03-13 22:18 (local)

### Scope
- Change the resort timeline's `today` marker from no side lines to the same subtle divider lines used by the main weather tables.

### Changes
- Files:
  - `assets/css/resort_hourly.css`
  - `tests/frontend/test_assets.py`
  - `docs/REFACTOR_PROGRESS_LEDGER.md`
- Behavior impact:
  - The `today` header and body cells now render matching left/right inset lines using the main table divider color `#f3f4f6`.
  - The `today` header keeps its slightly darker background, so the current day remains visible without reintroducing the older thick teal anchors.
  - Asset regression coverage now checks for the new thin divider box-shadow string while still rejecting the old thick teal line styling.

### Validation
- Commands:
  - `python3 -m compileall src`
  - `python3 -m pytest tests/frontend/test_assets.py tests/frontend/test_static_site_pipeline.py tests/integration/test_web_server.py -q`
  - `python3 -m src.cli static --output-dir /tmp/closesnow-resort-history --max-workers 8`
- Results:
  - compile check: passed
  - targeted frontend/static/integration suites: `17 passed`
  - static preview rebuild: succeeded (`Done: /tmp/closesnow-resort-history/data.json`, `Done: /tmp/closesnow-resort-history/index.html`, `Done: 28 resort hourly page(s)`)

### Risks / Notes
- This slice only changes the visual weight/color of the `today` side markers; the timeline structure and centering behavior remain unchanged.

### Next Slice
- If the `today` marker still needs tuning, adjust the header fill and divider contrast independently now that the line weight matches the main tables.

## 2026-03-13 22:17 (local)

### Scope
- Remove the thick vertical anchor lines on both sides of the resort timeline's `today` column while keeping the subtler header emphasis.

### Changes
- Files:
  - `assets/css/resort_hourly.css`
  - `tests/frontend/test_assets.py`
  - `docs/REFACTOR_PROGRESS_LEDGER.md`
- Behavior impact:
  - The `today` header and body cells no longer render the teal inset bars on their left and right edges.
  - The slightly darker `today` header background remains in place, so the current day is still visually identifiable without the heavy separators.
  - Frontend asset regression coverage now checks that the old double-line box-shadow string is absent from the resort hourly CSS.

### Validation
- Commands:
  - `python3 -m compileall src`
  - `python3 -m pytest tests/frontend/test_assets.py tests/frontend/test_static_site_pipeline.py tests/integration/test_web_server.py -q`
  - `python3 -m src.cli static --output-dir /tmp/closesnow-resort-history --max-workers 8`
- Results:
  - compile check: passed
  - targeted frontend/static/integration suites: `17 passed`
  - static preview rebuild: succeeded (`Done: /tmp/closesnow-resort-history/data.json`, `Done: /tmp/closesnow-resort-history/index.html`, `Done: 28 resort hourly page(s)`)

### Risks / Notes
- This slice only removes the `today` anchor line styling; timeline centering, ordering, and header color treatment are unchanged.

### Next Slice
- If the `today` marker still feels too strong or too subtle after review, tune the header fill color independently from the removed line styling.

## 2026-03-13 23:25 (local)

### Scope
- Make the Codex-facing static validation convention explicitly use `8` workers instead of the old ad-hoc `2` worker preview runs.

### Changes
- Files:
  - `AGENTS.md`
  - `docs/REFACTOR_PROGRESS_LEDGER.md`
- Behavior impact:
  - Repository-local agent guidance now tells Codex to use `python3 -m src.cli static --output-dir ... --max-workers 8` for routine preview and validation commands.
  - The ledger baseline now clarifies that historical `--max-workers 2` commands are not the current convention.
  - Future local static rebuilds for this repo should default back to the CLI's normal `8` worker behavior unless a user asks to throttle it.

### Validation
- Commands:
  - `python3 -m compileall src`
  - `python3 -m src.cli static --output-dir /tmp/closesnow-resort-history --max-workers 8`
- Results:
  - compile check: passed
  - static preview rebuild with `8` workers: succeeded (`Done: /tmp/closesnow-resort-history/data.json`, `Done: /tmp/closesnow-resort-history/index.html`, `Done: 28 resort hourly page(s)`)

### Risks / Notes
- Recent historical entries still show the exact `2`-worker commands that were run at the time; this slice preserves that history and adds an explicit current convention instead of rewriting old records.

### Next Slice
- If more developer-facing docs start drifting, mirror the same `8`-worker convention into any new runbooks or helper scripts as they are added.

## 2026-03-13 23:10 (local)

### Scope
- Lock the static CLI worker default at `8` in tests and align `serve-static` docs with the shipped default.

### Changes
- Files:
  - `tests/integration/test_cli.py`
  - `README.md`
  - `docs/REFACTOR_PROGRESS_LEDGER.md`
- Behavior impact:
  - `static` and `serve-static` parser regression tests now explicitly assert `max_workers == 8`.
  - The `serve-static` README usage line and notes now document the default `8` worker behavior instead of leaving it implicit.
  - A default static build without passing `--max-workers` was rerun successfully to verify the path still works end-to-end.

### Validation
- Commands:
  - `python3 -m compileall src`
  - `python3 -m pytest tests/integration/test_cli.py -q`
  - `python3 -m src.cli static --output-dir /tmp/closesnow-static-workers-default`
- Results:
  - compile check: passed
  - targeted CLI integration suite: `26 passed`
  - static build with default worker count: succeeded (`Done: /tmp/closesnow-static-workers-default/data.json`, `Done: /tmp/closesnow-static-workers-default/index.html`, `Done: 28 resort hourly page(s)`)

### Risks / Notes
- The CLI runtime default was already `8` in `src/cli.py`; this slice hardens that expectation with tests and docs rather than changing backend behavior.

### Next Slice
- If we want the same default called out everywhere, mirror the `8` worker note into any remaining legacy entrypoints outside the unified CLI docs.

## 2026-03-13 22:57 (local)

### Scope
- Split resort hourly chart x-axis tick labels into two lines so date and time are easier to scan.

### Changes
- Files:
  - `assets/js/resort_hourly.js`
  - `tests/frontend/test_assets.py`
  - `docs/REFACTOR_PROGRESS_LEDGER.md`
- Behavior impact:
  - Each x-axis tick now renders the date on the first line and the time on the second line using SVG `tspan` nodes.
  - The chart bottom padding is slightly larger so the two-line labels do not crowd the axis line.
  - The existing local static preview at `/tmp/closesnow-resort-history` now serves the two-line x-axis label version after refresh.

### Validation
- Commands:
  - `python3 -m compileall src`
  - `python3 -m pytest tests/frontend/test_assets.py tests/frontend/test_static_site_pipeline.py tests/integration/test_web_server.py -q`
  - `python3 -m src.cli static --output-dir /tmp/closesnow-resort-history --max-workers 2`
  - `rg -n "const splitTimeLabel = \\(rawTime\\) => \\{|const dateTspan = document.createElementNS\\(svgNs, \\\"tspan\\\"\\);|const timeTspan = document.createElementNS\\(svgNs, \\\"tspan\\\"\\);|const padBottom = 42;" /tmp/closesnow-resort-history/assets/js/resort_hourly.js -S`
- Results:
  - compile check: passed
  - targeted frontend/static/integration suites: `17 passed`
  - static preview rebuild: succeeded (`Done: /tmp/closesnow-resort-history/data.json`, `Done: /tmp/closesnow-resort-history/index.html`, `Done: 28 resort hourly page(s)`)
  - asset grep: confirmed rebuilt preview assets contain the two-line x-axis label helpers and increased bottom padding

### Risks / Notes
- This slice keeps the same number of x-axis ticks; it only changes their formatting from one line to two.

### Next Slice
- Consider whether the date line should switch from `MM-DD` to weekday labels on narrower screens if the two-line ticks still feel dense.

## 2026-03-13 22:47 (local)

### Scope
- Make resort hourly line charts fit their chart-card block width instead of using a fixed oversized display width.

### Changes
- Files:
  - `assets/js/resort_hourly.js`
  - `assets/css/resort_hourly.css`
  - `tests/frontend/test_assets.py`
  - `docs/REFACTOR_PROGRESS_LEDGER.md`
- Behavior impact:
  - Chart SVGs now render with `width: 100%` inside each chart card instead of a fixed `1440px` display width.
  - The chart renderer now measures the current chart-grid block width and picks a matching internal SVG width so the plot geometry fits the card instead of relying on horizontal scroll.
  - Window resizes now trigger a lightweight chart rerender so the charts continue fitting the current block width after layout changes.

### Validation
- Commands:
  - `python3 -m compileall src`
  - `python3 -m pytest tests/frontend/test_assets.py tests/frontend/test_static_site_pipeline.py tests/integration/test_web_server.py -q`
  - `python3 -m src.cli static --output-dir /tmp/closesnow-resort-history --max-workers 2`
  - `rg -n "width: 100%;|min-width: 0;|const resolveChartWidth = \\(\\) => \\{|window.addEventListener\\(\\\"resize\\\", rerenderChartsForResize\\);" /tmp/closesnow-resort-history/assets/css/resort_hourly.css /tmp/closesnow-resort-history/assets/js/resort_hourly.js -S`
- Results:
  - compile check: passed
  - targeted frontend/static/integration suites: `17 passed`
  - static preview rebuild: succeeded (`Done: /tmp/closesnow-resort-history/data.json`, `Done: /tmp/closesnow-resort-history/index.html`, `Done: 28 resort hourly page(s)`)
  - asset grep: confirmed rebuilt preview assets now use block-fitting chart width CSS and the dynamic width/resize rerender helpers

### Risks / Notes
- The charts now optimize for fitting the current block width, so very dense hour ranges trade some horizontal spacing for a no-scroll default presentation.

### Next Slice
- Consider whether the chart width heuristic should vary by selected hour count so shorter windows can look a bit more spacious while still fitting the card.

## 2026-03-13 22:39 (local)

### Scope
- Cap the resort hourly chart grid at two canvases per row while keeping a single-column fallback on narrower screens.

### Changes
- Files:
  - `assets/css/resort_hourly.css`
  - `tests/frontend/test_assets.py`
  - `docs/REFACTOR_PROGRESS_LEDGER.md`
- Behavior impact:
  - Desktop and wider tablet layouts now render the hourly chart cards in at most two columns.
  - Narrower screens below `980px` fall back to a single-column chart stack.
  - The existing local static preview at `/tmp/closesnow-resort-history` now reflects the two-column cap after refresh.

### Validation
- Commands:
  - `python3 -m compileall src`
  - `python3 -m pytest tests/frontend/test_assets.py tests/frontend/test_static_site_pipeline.py tests/integration/test_web_server.py -q`
  - `python3 -m src.cli static --output-dir /tmp/closesnow-resort-history --max-workers 2`
  - `rg -n "grid-template-columns: repeat\\(2, minmax\\(0, 1fr\\)\\);|@media \\(max-width: 980px\\)|grid-template-columns: 1fr;" /tmp/closesnow-resort-history/assets/css/resort_hourly.css -S`
- Results:
  - compile check: passed
  - targeted frontend/static/integration suites: `17 passed`
  - static preview rebuild: succeeded (`Done: /tmp/closesnow-resort-history/data.json`, `Done: /tmp/closesnow-resort-history/index.html`, `Done: 28 resort hourly page(s)`)
  - asset grep: confirmed the rebuilt preview CSS uses the fixed two-column grid plus the narrow-screen single-column media query

### Risks / Notes
- Since each chart is still intentionally wide, two-column layouts on medium-width screens may still rely on horizontal scrolling inside individual chart cards.

### Next Slice
- Consider making the chart grid switch to one column a bit earlier if the wide 1440px canvases feel too cramped on smaller tablets.

## 2026-03-13 22:31 (local)

### Scope
- Double the resort hourly chart width so each line chart has more horizontal room for dense hour ranges.

### Changes
- Files:
  - `assets/js/resort_hourly.js`
  - `assets/css/resort_hourly.css`
  - `tests/frontend/test_assets.py`
  - `docs/REFACTOR_PROGRESS_LEDGER.md`
- Behavior impact:
  - Hourly chart SVGs now render on a 1440px internal canvas instead of 720px.
  - The rendered chart element now keeps a 1440px display width by default while still honoring `min-width: 100%`, so narrow cards scroll horizontally instead of compressing the chart as aggressively.
  - The existing local static preview at `/tmp/closesnow-resort-history` now serves the wider chart version after refresh.

### Validation
- Commands:
  - `python3 -m compileall src`
  - `python3 -m pytest tests/frontend/test_assets.py tests/frontend/test_static_site_pipeline.py tests/integration/test_web_server.py -q`
  - `python3 -m src.cli static --output-dir /tmp/closesnow-resort-history --max-workers 2`
  - `rg -n "const width = 1440;|width: 1440px;|min-width: 100%;" /tmp/closesnow-resort-history/assets/js/resort_hourly.js /tmp/closesnow-resort-history/assets/css/resort_hourly.css -S`
- Results:
  - compile check: passed
  - targeted frontend/static/integration suites: `17 passed`
  - static preview rebuild: succeeded (`Done: /tmp/closesnow-resort-history/data.json`, `Done: /tmp/closesnow-resort-history/index.html`, `Done: 28 resort hourly page(s)`)
  - asset grep: confirmed rebuilt preview assets contain the doubled chart width settings in both JS and CSS

### Risks / Notes
- Wider charts improve point spacing, but on narrower screens users will now rely more on the existing horizontal scroll inside each chart card.

### Next Slice
- Consider making chart width scale with selected hour count so `24h` stays tighter while `120h` gets the full wide treatment.

## 2026-03-13 22:22 (local)

### Scope
- Refine the merged resort timeline styling so `today` is bracketed by symmetric vertical lines and all header cells share one base color.

### Changes
- Files:
  - `assets/css/resort_hourly.css`
  - `assets/js/compact_daily_summary.js`
  - `tests/frontend/test_assets.py`
  - `docs/REFACTOR_PROGRESS_LEDGER.md`
- Behavior impact:
  - The `today` column now gets matching left/right vertical lines instead of inheriting the old one-sided phase-start divider.
  - History and forecast header cells now use the same base header color.
  - The `today` header cell is slightly darker than the rest to keep it visually anchored without using different phase colors.

### Validation
- Commands:
  - `python3 -m compileall src`
  - `python3 -m pytest tests/frontend/test_assets.py tests/frontend/test_static_site_pipeline.py tests/integration/test_web_server.py -q`
  - `python3 -m src.cli static --output-dir /tmp/closesnow-resort-history --max-workers 2`
  - `rg -n "compact-day-head-today-anchor|compact-day-cell-today-anchor|background: #e5e7eb;|background: #d7dde6;|compact-day-head-phase-start|compact-day-cell-phase-start" /tmp/closesnow-resort-history/assets/css/resort_hourly.css /tmp/closesnow-resort-history/assets/js/compact_daily_summary.js -S`
- Results:
  - compile check: passed
  - targeted frontend/static/integration suites: `17 passed`
  - static preview rebuild: succeeded (`Done: /tmp/closesnow-resort-history/data.json`, `Done: /tmp/closesnow-resort-history/index.html`, `Done: 28 resort hourly page(s)`)
  - asset grep: confirmed rebuilt assets now use the `today` anchor classes and updated header color values, without the old phase-start class names in the summary renderer

### Risks / Notes
- This slice changes only styling hooks and class assignment in the compact-summary renderer; the timeline order and centering behavior are unchanged.

### Next Slice
- Consider whether the `today` cell body should also get a tiny label or chip if the darker header alone is still too subtle on smaller screens.

## 2026-03-13 22:13 (local)

### Scope
- Center the merged resort timeline on `today` by default so the forecast boundary opens near the middle of the viewport.

### Changes
- Files:
  - `assets/js/compact_daily_summary.js`
  - `assets/js/resort_hourly.js`
  - `tests/frontend/test_assets.py`
  - `docs/REFACTOR_PROGRESS_LEDGER.md`
- Behavior impact:
  - The first forecast column in the merged `Past 14 days + forecast` strip now gets an explicit `today` anchor marker.
  - On initial resort-page render, the horizontal compact-summary scroller auto-scrolls so the `today` column is centered as much as the available width allows.
  - The auto-centering runs once per page load, so user-driven horizontal scrolling is not repeatedly overridden.

### Validation
- Commands:
  - `python3 -m compileall src`
  - `python3 -m pytest tests/frontend/test_assets.py tests/frontend/test_static_site_pipeline.py tests/integration/test_web_server.py -q`
  - `python3 -m src.cli static --output-dir /tmp/closesnow-resort-history --max-workers 2`
  - `rg -n "centerTimelineOnToday|data-compact-today-anchor|summary_is_today" /tmp/closesnow-resort-history/assets/js/compact_daily_summary.js /tmp/closesnow-resort-history/assets/js/resort_hourly.js -S`
- Results:
  - compile check: passed
  - targeted frontend/static/integration suites: `17 passed`
  - static preview rebuild: succeeded (`Done: /tmp/closesnow-resort-history/data.json`, `Done: /tmp/closesnow-resort-history/index.html`, `Done: 28 resort hourly page(s)`)
  - asset grep: confirmed the rebuilt preview assets contain the `today` anchor markers and auto-centering function

### Risks / Notes
- This slice validates the centering logic through rebuilt assets and tests, but it does not include a browser automation assertion for the exact pixel position after render.

### Next Slice
- Consider adding a small `today` badge or forecast-boundary marker if users need an even stronger visual cue beyond centering alone.

## 2026-03-13 22:05 (local)

### Scope
- Merge the resort page's separate forecast/history strips into one continuous `Past 14 days + forecast` timeline.

### Changes
- Files:
  - `src/web/templates/resort_hourly_page.html`
  - `assets/css/resort_hourly.css`
  - `assets/js/compact_daily_summary.js`
  - `assets/js/resort_hourly.js`
  - `tests/frontend/test_assets.py`
  - `tests/frontend/test_static_site_pipeline.py`
  - `tests/integration/test_web_server.py`
  - `docs/REFACTOR_PROGRESS_LEDGER.md`
- Behavior impact:
  - Resort pages now render one combined compact strip instead of separate `Past 14 days` and `Daily forecast` sections.
  - The merged strip shows history first and forecast second, with a visual phase divider at the forecast boundary.
  - The local static preview already serving `/tmp/closesnow-resort-history` now reflects the merged timeline after refresh.

### Validation
- Commands:
  - `python3 -m compileall src`
  - `python3 -m pytest tests/frontend/test_resort_hourly_context.py tests/frontend/test_static_site_pipeline.py tests/frontend/test_assets.py tests/integration/test_web_server.py -q`
  - `python3 -m src.cli static --output-dir /tmp/closesnow-resort-history --max-workers 2`
  - `curl -sS http://127.0.0.1:8011/resort/snowbird-ut/ | rg -n "Past 14 days \\+ forecast|resort-timeline-section|compact-day-cell-phase-start|resort-daily-summary-section|resort-history-section" -S`
- Results:
  - compile check: passed
  - targeted frontend/static/integration suites: `19 passed`
  - static preview rebuild: succeeded (`Done: /tmp/closesnow-resort-history/data.json`, `Done: /tmp/closesnow-resort-history/index.html`, `Done: 28 resort hourly page(s)`)
  - local preview probe: confirmed the served resort page now exposes the merged `resort-timeline-section` heading and no longer includes the old split section ids

### Risks / Notes
- The merged timeline still relies on client-side rendering from the same bootstrap payload; only the page structure and compact-summary assembly changed.

### Next Slice
- Consider whether the combined timeline should get small `History` / `Forecast` badges above the divider if users need even stronger phase cues.

## 2026-03-13 21:56 (local)

### Scope
- Expand the resort forecast history strip from `Past 7 days` to `Past 14 days`, matching the available `past_14d_daily` backend payload.

### Changes
- Files:
  - `src/web/resort_hourly_context.py`
  - `src/web/templates/resort_hourly_page.html`
  - `assets/js/resort_hourly.js`
  - `tests/frontend/test_resort_hourly_context.py`
  - `tests/frontend/test_static_site_pipeline.py`
  - `tests/frontend/test_assets.py`
  - `tests/integration/test_web_server.py`
  - `docs/REFACTOR_PROGRESS_LEDGER.md`
- Behavior impact:
  - Resort forecast pages now expose up to 14 history rows in bootstrap as `past14dDaily`.
  - The resort page history section is now labeled `Past 14 days` and renders the full available recent-history window instead of truncating to 7 days.
  - Static preview output in `/tmp/closesnow-resort-history` has been refreshed in place, so the existing local static server serves the 14-day version after reload.

### Validation
- Commands:
  - `python3 -m compileall src`
  - `python3 -m pytest tests/frontend/test_resort_hourly_context.py tests/frontend/test_static_site_pipeline.py tests/frontend/test_assets.py tests/integration/test_web_server.py -q`
  - `python3 -m src.cli static --output-dir /tmp/closesnow-resort-history --max-workers 2`
  - `rg -n "Past 14 days|past14dDaily|resort-history-section" /tmp/closesnow-resort-history/resort -S`
- Results:
  - compile check: passed
  - targeted frontend/static/integration suites: `19 passed`
  - static preview rebuild: succeeded (`Done: /tmp/closesnow-resort-history/data.json`, `Done: /tmp/closesnow-resort-history/index.html`, `Done: 28 resort hourly page(s)`)
  - artifact grep: confirmed generated resort pages include the new 14-day history section and bootstrapped `past14dDaily` data

### Risks / Notes
- The history section still uses the same compact-card layout as the forward-looking daily strip, so the added width on smaller screens is handled by the existing horizontal scroll container.

### Next Slice
- Consider whether the resort page should visually distinguish past-history cards from forward-forecast cards beyond the section heading alone.

## 2026-03-13 21:46 (local)

### Scope
- Add a `Past 7 days` weather strip to each resort forecast page by reusing the existing compact day-card renderer and feeding it recent history from the main payload.

### Changes
- Files:
  - `src/web/resort_hourly_context.py`
  - `src/web/pipelines/static_site.py`
  - `src/web/weather_page_server.py`
  - `src/web/templates/resort_hourly_page.html`
  - `assets/js/compact_daily_summary.js`
  - `assets/js/resort_hourly.js`
  - `assets/css/resort_hourly.css`
  - `tests/frontend/test_resort_hourly_context.py`
  - `tests/frontend/test_static_site_pipeline.py`
  - `tests/frontend/test_assets.py`
  - `tests/integration/test_web_server.py`
- Behavior impact:
  - Resort forecast pages now bootstrap the most recent 7 history rows from `past_14d_daily` alongside the existing forward-looking daily summary.
  - The resort page renders a new `Past 7 days` compact strip above hourly content when history data is available.
  - Static and dynamic resort pages now share one helper for building resort-page summary bootstrap context, keeping history slicing consistent across both paths.

### Validation
- Commands:
  - `python3 -m compileall src`
  - `python3 -m pytest tests/frontend/test_resort_hourly_context.py tests/frontend/test_static_site_pipeline.py tests/frontend/test_assets.py tests/integration/test_web_server.py -q`
  - `python3 -m src.cli static --output-dir /tmp/closesnow-resort-history --max-workers 2`
  - `rg -n "Past 7 days|past7dDaily|resort-history-section" /tmp/closesnow-resort-history/resort -S`
- Results:
  - compile check: passed
  - targeted frontend/static/integration suites: `19 passed`
  - static preview rebuild: succeeded (`Done: /tmp/closesnow-resort-history/data.json`, `Done: /tmp/closesnow-resort-history/index.html`, `Done: 28 resort hourly page(s)`)
  - artifact grep: confirmed generated resort pages include the new history section and bootstrapped `past7dDaily` data

### Risks / Notes
- The skill's referenced docs `docs/FEATURE_DESIGN_SKI_WEATHER_FULL_INFO.md`, `docs/FRONTEND_COMM_BACKEND_REFACTOR_GUIDE.md`, and `docs/FRONTEND_BACKEND_FLOW_ARCHITECTURE.md` are not present in the current repo; this slice used the existing docs/code paths instead.
- The new history strip uses the same metric-only compact-card presentation as the resort page's existing `Daily forecast` strip.

### Next Slice
- Consider adding the resort-page compact-summary unit toggle to both the forward-looking and historical strips for consistency with the main page summary controls.

## 2026-03-13 21:39 (local)

### Scope
- Slightly widen the main-page `Daily Summary` unit toggle without changing other toggle groups.

### Changes
- Files:
  - `assets/css/weather_page.css`
  - `docs/REFACTOR_PROGRESS_LEDGER.md`
- Behavior impact:
  - The `Metric / Imperial` toggle in the `Daily Summary` section is a little wider for easier scanning and tapping.
  - Snowfall, Rainfall, Temperature, and Sunrise / Sunset toggle widths remain unchanged.

### Validation
- Commands:
  - `python3 -m pytest tests/frontend -q`
  - `python3 -m src.cli static --output-dir /tmp/closesnow-daily-toggle-width --max-workers 2`
  - `rg -n 'data-compact-summary-toggle="1"|width: 58px;' /tmp/closesnow-daily-toggle-width/index.html /tmp/closesnow-daily-toggle-width/assets/css/weather_page.css`
- Results:
  - frontend tests: `23 passed`
  - static build: succeeded (`Done: /tmp/closesnow-daily-toggle-width/data.json`, `Done: /tmp/closesnow-daily-toggle-width/index.html`, `Done: 28 resort hourly page(s)`)
  - artifact grep: confirmed the Daily Summary-specific width override is present in the generated CSS

### Risks / Notes
- This is a presentation-only tweak; there are no data-flow or toggle-behavior changes.

### Next Slice
- Consider whether the other unit toggles should get similar touch-target tuning, or whether the current wider treatment should remain specific to `Daily Summary`.

## 2026-03-13 21:08 (local)

### Scope
- Start moving main-page resort favorites away from unconditional full-page rerenders by adding a local DOM-sync path for safe cases.

### Changes
- Files:
  - `docs/FEATURE_DESIGN_MAIN_PAGE_FAVORITES_LOCAL_UPDATE.md`
  - `assets/js/weather_page.js`
  - `tests/frontend/test_assets.py`
  - `docs/REFACTOR_PROGRESS_LEDGER.md`
- Behavior impact:
  - Favorite interactions now distinguish between cases that need a full `renderPage()` and cases that can update the existing DOM in place.
  - Single-heart toggles and `favorite all` now stay on the local-sync path when `favoritesOnly` is off and sort mode is not `Favorites First`.
  - Filter-sensitive cases still fall back to the existing rerender path, so `favoritesOnly` and favorite-based sorting keep their current behavior.

### Validation
- Commands:
  - `python3 -m pytest tests/frontend/test_assets.py -q`
  - `python3 -m src.cli static --output-dir /tmp/closesnow-favorite-local-update --max-workers 4`
- Results:
  - targeted frontend asset tests: `2 passed`
  - static build: succeeded (`Done: /tmp/closesnow-favorite-local-update/data.json`, `Done: /tmp/closesnow-favorite-local-update/index.html`, `Done: 24 resort hourly page(s)`)

### Risks / Notes
- This slice intentionally keeps the rerender fallback for `favoritesOnly` and `Favorites First`; it does not yet convert every favorite-related path to pure local DOM updates.

### Next Slice
- Extend the local-update path to cover more favorite-driven UI state, or add browser-level regression coverage once a browser automation tool is available in the environment.

## 2026-03-13 20:35 (local)

### Scope
- Add a unit-system toggle for the main-page `Daily Summary` compact cards.

### Changes
- Files:
  - `assets/js/compact_daily_summary.js`
  - `assets/js/weather_page.js`
  - `assets/css/weather_page.css`
  - `tests/frontend/test_assets.py`
  - `docs/REFACTOR_PROGRESS_LEDGER.md`
- Behavior impact:
  - Main-page `Daily Summary` now renders a `Metric / Imperial` toggle in its section header.
  - Compact daily cards now convert snowfall, rainfall, and high/low temperature values when the summary toggle changes.
  - The `Daily Summary` unit preference now persists independently from the larger table-specific unit toggles.

### Validation
- Commands:
  - `python3 -m pytest tests/frontend/test_assets.py tests/frontend/test_renderers.py tests/frontend/test_static_site_pipeline.py tests/integration/test_web_server.py -q`
  - `python3 -m src.cli static --output-dir /tmp/closesnow-daily-summary-toggle --max-workers 2`
  - `rg -n "Daily Summary unit system|data-compact-summary-toggle|Metric|Imperial" /tmp/closesnow-daily-summary-toggle/assets/js/weather_page.js /tmp/closesnow-daily-summary-toggle/index.html`
- Results:
  - targeted frontend/static/integration tests: `26 passed`
  - static preview rebuild: succeeded (`Done: /tmp/closesnow-daily-summary-toggle/data.json`, `Done: /tmp/closesnow-daily-summary-toggle/index.html`, `Done: 24 resort hourly page(s)`)
  - artifact grep: confirmed the summary toggle markup and button labels are present in generated assets

### Risks / Notes
- The new toggle is intentionally scoped to the compact `Daily Summary`; it does not auto-sync the larger Snowfall/Rainfall/Temperature table toggles.

### Next Slice
- Consider whether the resort hourly page's reused compact `Daily Summary` should expose the same unit toggle for consistency.

## 2026-03-13 20:11 (local)

### Scope
- Move resort local time under the hourly page title and increase precision to seconds.

### Changes
- Files:
  - `src/web/templates/resort_hourly_page.html`
  - `assets/css/resort_hourly.css`
  - `assets/js/resort_hourly.js`
  - `tests/frontend/test_assets.py`
  - `tests/frontend/test_static_site_pipeline.py`
  - `docs/REFACTOR_PROGRESS_LEDGER.md`
- Behavior impact:
  - Resort hourly pages now render a dedicated local-time line directly below the title.
  - Resort local time now includes seconds and refreshes every second.
  - Hourly meta returns to summarizing forecast hours, timezone, model, and coordinates only.

### Validation
- Commands:
  - `python3 -m compileall src`
  - `python3 -m pytest tests/frontend/test_assets.py tests/frontend/test_static_site_pipeline.py tests/integration/test_web_server.py -q`
  - `python3 -m src.cli static --output-dir /tmp/closesnow-preview --max-workers 2`
- Results:
  - compile check: passed
  - targeted frontend/static/integration tests: `17 passed`
  - static preview rebuild: succeeded (`Done: /tmp/closesnow-preview/data.json`, `Done: /tmp/closesnow-preview/index.html`, `Done: 18 resort hourly page(s)`)

### Risks / Notes
- The local-time string still uses the viewer browser's locale for punctuation/order while pinning the resort timezone and second-level precision.

### Next Slice
- Consider whether the local-time line should use a friendlier label such as `Snowbird local time` once the title has the resolved resort display name.

## 2026-03-13 20:08 (local)

### Scope
- Add resort-local current time to the hourly resort page meta line using the hourly forecast timezone.

### Changes
- Files:
  - `assets/js/resort_hourly.js`
  - `tests/frontend/test_assets.py`
  - `docs/REFACTOR_PROGRESS_LEDGER.md`
- Behavior impact:
  - Resort hourly pages now show the resort's local current time in `hourly-meta` when the hourly payload provides a timezone.
  - The local-time label refreshes once per minute without requiring a full hourly data reload.

### Validation
- Commands:
  - `python3 -m compileall src`
  - `python3 -m pytest tests/frontend/test_assets.py tests/frontend/test_static_site_pipeline.py tests/integration/test_web_server.py -q`
  - `python3 -m src.cli static --output-dir /tmp/closesnow-localtime-check --max-workers 2`
- Results:
  - compile check: passed
  - targeted frontend/static/integration tests: `17 passed`
  - static output build: succeeded (`Done: /tmp/closesnow-localtime-check/data.json`, `Done: /tmp/closesnow-localtime-check/index.html`, `Done: 18 resort hourly page(s)`)

### Risks / Notes
- Local time formatting still follows the viewer's browser locale while pinning the resort timezone, so separators/order may vary slightly by browser language settings.

### Next Slice
- Consider whether the resort page should expose a clearer label for the resort timezone abbreviation near the title instead of only inside the meta line.

## 2026-03-13 20:35 (output-dir static artifact unification slice)

### Scope
- Replace `output-html` with `output-dir` for static artifact flows and move asset copying into the static/render pipelines themselves.

### Changes
- Files:
  - `src/cli.py`
  - `README.md`
  - `docs/CODEBASE_VALIDATION_PLAYBOOK.md`
  - `docs/FEATURE_DESIGN_SERVE_STATIC.md`
  - `docs/REFACTOR_PROGRESS_LEDGER.md`
  - `tests/integration/test_cli.py`
  - `tests/smoke/test_static_pipeline_smoke.py`
- Behavior impact:
  - `render` now writes `index.html`, `resort/...`, and copied assets under `--output-dir`.
  - `static` now defaults to output-directory semantics and writes `data.json`, `index.html`, `resort/...`, and copied assets under one root.
  - `serve-static` now stays a thin wrapper around the unified static output-directory flow.

### Validation
- Commands:
  - `python3 -m pytest tests/integration/test_cli.py tests/integration/test_static_server.py tests/smoke/test_static_pipeline_smoke.py -q`
  - `python3 -m src.cli static --output-dir /tmp/closesnow-output-dir-test --max-workers 2`
  - `python3 -m src.cli render --input-json site/data.json --output-dir /tmp/closesnow-render-dir-test-2`
- Results:
  - targeted CLI/static/smoke tests: `28 passed`
  - static output-dir build: succeeded (`Done: /tmp/closesnow-output-dir-test/data.json`, `Done: /tmp/closesnow-output-dir-test/index.html`)
  - render output-dir build: succeeded and copied assets under `/private/tmp/closesnow-render-dir-test-2/assets/{css,js}`

### Risks / Notes
- This changes the preferred CLI contract from file-oriented `--output-html` to directory-oriented `--output-dir`; scripts using the old flag will need to be updated.

### Next Slice
- Consider whether to keep a deprecated hidden `--output-html` compatibility alias temporarily if external automation still depends on it.

## 2026-03-13 20:10 (serve-static local preview slice)

### Scope
- Add a dedicated CLI command to serve generated static site artifacts from a local directory over HTTP.

### Changes
- Files:
  - `docs/FEATURE_DESIGN_SERVE_STATIC.md`
  - `src/cli.py`
  - `README.md`
  - `tests/integration/test_cli.py`
  - `tests/integration/test_static_server.py`
- Behavior impact:
  - CLI now supports `serve-static`, which explicitly reuses the `static` build flow before serving the output directory.
  - Static artifacts now use output-directory semantics: `static` writes `index.html`, `data.json`, `resort/...`, and copied assets under one output root.
  - Local preview of generated `site/` artifacts can use directory-index routing for resort pages.

### Validation
- Commands:
  - `python3 -m pytest tests/integration/test_cli.py tests/integration/test_static_server.py -q`
  - `python3 -m src.cli static --output-dir site`
- Results:
  - integration CLI + static-server tests: `23 passed`
  - static render: succeeded (`Done: site/data.json`, `Done: site/index.html`, `Done: 18 resort hourly page(s)`)

### Risks / Notes
- `serve-static` intentionally serves files only; it will not emulate `/api/data` or other dynamic endpoints outside the generated directory contents.

### Next Slice
- Consider whether `serve-static` should optionally verify `assets/` exists under the served directory and emit a friendlier warning if missing.

## 2026-03-13 19:25 (resort-page daily summary reuse slice)

### Scope
- Reuse the main-page compact daily summary cell design on each resort hourly page using resort-scoped daily bootstrap data.

### Changes
- Files:
  - `docs/FEATURE_DESIGN_RESORT_PAGE_DAILY_SUMMARY_REUSE.md`
  - `assets/js/compact_daily_summary.js`
  - `assets/js/weather_page.js`
  - `assets/js/resort_hourly.js`
  - `assets/css/resort_hourly.css`
  - `src/web/weather_page_assets.py`
  - `src/web/templates/weather_page.html`
  - `src/web/templates/resort_hourly_page.html`
  - `src/web/weather_page_server.py`
  - `src/web/pipelines/static_site.py`
  - `tests/frontend/test_assets.py`
  - `tests/frontend/test_static_site_pipeline.py`
  - `tests/integration/test_web_server.py`
- Behavior impact:
  - Main page and resort hourly page now share the same compact daily-cell browser renderer.
  - Resort hourly pages render a single-resort `Daily Summary` strip above hourly charts when daily data is available.
  - Static and dynamic resort pages both bootstrap `dailySummary` alongside hourly data.

### Validation
- Commands:
  - `python3 -m pytest tests/frontend/test_assets.py tests/frontend/test_static_site_pipeline.py tests/integration/test_web_server.py -q`
  - `python3 -m src.cli static --output-html index.html`
- Results:
  - frontend assets + static-site + integration tests: `17 passed`
  - static render: succeeded (`Done: .cache/static_payload.json`, `Done: index.html`, `Done: 18 resort hourly page(s)`)

### Risks / Notes
- Resort-page compact summary CSS is intentionally duplicated in `resort_hourly.css` so the hourly page does not need to load the full main-page stylesheet.

### Next Slice
- Revisit whether the compact daily-summary helpers should also be reused by future single-resort summary views beyond the hourly page.

## 2026-03-13 16:02 (compact daily summary grid slice)

### Scope
- Add a high-density `Daily Summary` table to the main page with combined weather, temperature, snowfall, and rainfall per day while keeping static hourly pages defaulted to local `hourly.json`.

### Changes
- Files:
  - `docs/FEATURE_DESIGN_COMPACT_DAILY_GRID_TABLE.md`
  - `assets/js/weather_page.js`
  - `assets/css/weather_page.css`
  - `src/web/weather_html_renderer.py`
  - `src/web/pipelines/static_site.py`
  - `tests/frontend/test_assets.py`
  - `tests/frontend/test_renderers.py`
  - `tests/frontend/test_static_site_pipeline.py`
  - `docs/REFACTOR_PROGRESS_LEDGER.md`
- Behavior impact:
  - Main page now renders a `Daily Summary` table before the existing sections.
  - Each compact day cell combines weather emoji, stacked high/low temperature, snowfall, and rainfall in a fixed layout.
  - Compact day cells use snowfall color when snowfall is present, otherwise temperature color.
  - Static hourly resort pages now default to using sibling `hourly.json` data.

### Validation
- Commands:
  - `python3 -m pytest tests/frontend/test_assets.py tests/frontend/test_renderers.py tests/frontend/test_static_site_pipeline.py -q`
  - `python3 -m src.cli static --output-html index.html`
- Results:
  - frontend asset + renderer + static-site tests: `15 passed`
  - static render: succeeded (`Done: .cache/static_payload.json`, `Done: index.html`, `Done: 18 resort hourly page(s)`)

### Risks / Notes
- The compact summary table is browser-rendered; shell HTML only contains its loading placeholder until JS loads the payload.

### Next Slice
- Continue polish on compact-grid spacing and mobile column alignment as follow-up UI tuning.

## 2026-03-13 15:02 (favorites-only toggle sync fix)

### Scope
- Fix main-page dynamic favorites-only toggle so it can be turned off reliably when both header and modal controls are present.

### Changes
- Files:
  - `assets/js/weather_page.js`
  - `tests/frontend/test_assets.py`
  - `docs/REFACTOR_PROGRESS_LEDGER.md`
- Behavior impact:
  - Header and modal `Favorites only` checkboxes now stay synchronized.
  - Favorites-only state now reads from one canonical synchronized value instead of `A || B`, so turning it off works correctly.

### Validation
- Commands:
  - `python3 -m pytest tests/frontend/test_assets.py tests/frontend/test_renderers.py tests/frontend/test_styles_and_transform.py -q`
  - `python3 -m src.cli static --output-html index.html`
  - `curl -sS http://127.0.0.1:8010/assets/js/weather_page.js | rg -n "setFavoritesOnlyControls|favoritesOnlyToggle.checked|filterFavoritesOnlyInput.checked" -n -S`
- Results:
  - frontend tests: `16 passed`
  - static render: succeeded (`Done: .cache/static_payload.json`, `Done: index.html`, `Done: 18 resort hourly page(s)`)
  - dynamic served JS confirmed synchronized favorites-only helper and handlers are present

### Risks / Notes
- This fix depends on the dynamic server being restarted so the updated JS asset is served.

### Next Slice
- Add a browser-level interaction test for dual-control filter synchronization if UI automation is introduced later.

## 2026-03-13 14:49 (resort favorites / heart refactor slice)

### Scope
- Add main-page resort favorites with browser-local persistence while separating site default-resort semantics from user favorites.

### Changes
- Files:
  - `docs/FEATURE_DESIGN_RESORT_FAVORITES_REFACTOR.md`
  - `src/backend/pipeline.py`
  - `src/web/weather_report_transform.py`
  - `src/web/resort_cell_renderer.py`
  - `src/web/split_metric_renderer.py`
  - `src/web/desktop/temperature_renderer.py`
  - `src/web/desktop/sun_renderer.py`
  - `src/web/weather_table_renderer.py`
  - `src/web/templates/weather_page.html`
  - `assets/js/weather_page.js`
  - `assets/css/weather_page.css`
  - `README.md`
  - `tests/frontend/test_renderers.py`
  - `tests/frontend/test_styles_and_transform.py`
  - `tests/frontend/test_assets.py`
- Behavior impact:
  - Backend now exposes canonical `default_resort` alongside compatibility alias `ljcc_favorite`.
  - Main page renders heart buttons for resorts with `resort_id` and stores favorites in `localStorage`.
  - Main page now supports `Favorites only` and `Favorites First` without changing backend APIs.
  - Default-resort filtering remains separate from user favorites.

### Validation
- Commands:
  - `python3 -m pytest tests/frontend/test_renderers.py tests/frontend/test_styles_and_transform.py tests/frontend/test_assets.py -q`
  - `python3 -m pytest tests/backend/test_pipeline.py tests/frontend/test_static_site_pipeline.py -q`
  - `python3 -m src.cli static --output-html index.html`
  - `rg -n "Favorites only|Favorites First|favorite-btn|default-resort|closesnow_favorite_resorts_v1" index.html assets/js/weather_page.js src/web/templates/weather_page.html -S`
- Results:
  - frontend renderer/style/assets tests: `16 passed`
  - backend pipeline + static site pipeline tests: `12 passed`
  - static render: succeeded (`Done: .cache/static_payload.json`, `Done: index.html`, `Done: 18 resort hourly page(s)`)
  - grep validation confirmed favorites controls, browser favorites storage key, heart button markup, and `data-default-resort` markers

### Risks / Notes
- Favorites are intentionally browser-local only in v1 and do not sync across devices.
- Python renderer helpers now emit heart-button scaffold for consistency with browser rerender shape, though the main page still renders from client-side JS at runtime.

### Next Slice
- Optionally add a small integration test for favorite button markup/state in the generated main-page browser render path.

## 2026-03-05 17:54 (README sync to current code behavior)

### Scope
- Refresh `README.md` so commands, endpoints, filter semantics, workflow config, and script usage match current implementation.

### Changes
- Files:
  - `README.md`
- Behavior impact:
  - Documentation now reflects current frontend filter model (browser-side filtering + URL state sync).
  - `/api/data` query parameter docs now include `search_all` and `include_default`.
  - GitHub Pages build command now matches workflow (`--include-all-resorts`).
  - CLI option docs now include `--include-all-resorts` for `fetch` and `static`.
  - Resort sync section now documents Ikon destination coverage check and skip flag.

### Validation
- Commands:
  - `python3 -m src.cli static --output-html index.html`
  - `python3 -m pytest tests/frontend/test_assets.py -q`
- Results:
  - static command: succeeded (`Done: .cache/static_payload.json`, `Done: index.html`, `Done: 18 resort hourly page(s)`)
  - frontend assets tests: `2 passed`

### Risks / Notes
- README intentionally documents current behavior where frontend page route `/` ignores server-side filter query keys; API clients should use `/api/data` for backend filtering.

### Next Slice
- Keep README and workflow command examples synchronized whenever CLI flags or deployment defaults change.

## 2026-03-05 16:25 (hourly page alias flicker fix)

### Scope
- Remove transient `resort_id` alias flash on per-resort hourly pages during initial load.

### Changes
- Files:
  - `src/web/templates/resort_hourly_page.html`
  - `assets/js/resort_hourly.js`
  - `tests/frontend/test_static_site_pipeline.py`
  - `tests/integration/test_web_server.py`
- Behavior impact:
  - Hourly page title no longer renders `resort_id` in initial HTML.
  - Frontend title now only appends resort name when `payload.query` is available, otherwise keeps generic title.
  - Added regression assertions to ensure slug-style alias is not rendered in hourly page title.

### Validation
- Commands:
  - `pytest tests/frontend/test_static_site_pipeline.py -q`
  - `pytest tests/integration/test_web_server.py::test_server_hourly_api_and_hourly_page_route -q`
  - `pytest tests/integration/test_web_server.py -q`
  - `python3 -m src.cli static --output-html index.html`
  - `rg -n "hourly-title|Hourly Forecast: snowbird-ut|Hourly Forecast</h1>" resort/snowbird-ut/index.html`
- Results:
  - frontend static-site tests: `4 passed`
  - hourly route integration test: `1 passed`
  - full web server integration tests: `10 passed`
  - static render: succeeded (`Done: index.html`, `Done: 18 resort hourly page(s)`)
  - generated hourly page contains `<h1 id="hourly-title">Hourly Forecast</h1>` and no slug title

### Risks / Notes
- If hourly payload lacks `query`, page title remains generic (`Hourly Forecast`) by design to avoid alias flash.

### Next Slice
- Optionally pass canonical resort display name into hourly context JSON so title can be stable without waiting for payload fetch.

## 2026-03-04 00:55 (v4 classification + merge pass)

### Scope
- Tighten file classification and merge redundant frontend/backend wrapper layers while preserving runtime behavior.

### Changes
- Files:
  - `src/web/desktop/precipitation_renderer.py` (new)
  - `src/web/mobile/precipitation_renderer.py` (new)
  - `src/web/weather_table_renderer.py`
  - `src/web/weather_page_server.py`
  - `src/web/data_sources/clients.py`
  - `src/web/data_sources/gateway.py`
  - `src/web/data_sources/local_source.py` (new)
  - `src/web/data_sources/__init__.py`
  - removed:
    - `src/web/desktop/snowfall_renderer.py`
    - `src/web/desktop/rainfall_renderer.py`
    - `src/web/mobile/snowfall_renderer.py`
    - `src/web/mobile/rainfall_renderer.py`
  - `src/backend/services/weather_service.py`
  - `src/backend/services/__init__.py`
  - removed:
    - `src/backend/services/request_options.py`
  - `src/cli.py`
  - `src/backend/pipelines/live_pipeline.py`
  - `src/backend/pipelines/static_pipeline.py`
  - tests:
    - `tests/frontend/test_renderers.py`
    - `tests/integration/test_web_server.py`
    - `tests/integration/test_data_sources.py`
    - `tests/smoke/test_dynamic_server_smoke.py`
  - docs:
    - `README.md`
    - `docs/FRONTEND_COMM_BACKEND_REFACTOR_GUIDE.md`
    - `docs/FRONTEND_BACKEND_FLOW_ARCHITECTURE.md`
    - `docs/CODEBASE_VALIDATION_PLAYBOOK.md`
- Behavior impact:
  - Snow/rain desktop+mobile renderer wrappers were merged by platform into precipitation modules.
  - Dynamic server now resolves all `local/api/file` data modes through communication layer adapters.
  - Backend weather service removed pass-through request-option wrapper layer and keeps one normalized entry.
  - Static pipeline compatibility alias remains, while duplicated logic was reduced.

### Validation
- Commands:
  - `python3 -m compileall src`
  - `python3 -m pytest tests/backend -q`
  - `python3 -m pytest tests/frontend -q`
  - `python3 -m pytest tests/integration -q`
  - `python3 -m pytest tests/smoke -q`
  - `python3 -m pytest -q`
  - `rg -n "from src\\.web|import src\\.web" src/backend -S`
  - `rg -n "from src\\.backend\\.open_meteo|from src\\.backend\\.pipeline\\b|from src\\.backend\\.cache" src/web -S`
  - `rg -n "from src\\.backend\\.pipelines\\.live_pipeline" src/web -S`
- Results:
  - compileall: pass
  - backend tests: `39 passed`
  - frontend tests: `14 passed`
  - integration tests: `55 passed`
  - smoke tests: `3 passed`
  - full suite: `111 passed`
  - boundary checks:
    - backend -> web import: no matches
    - web direct backend low-level import check: no matches
    - backend live pipeline import in web: one expected match in `src/web/data_sources/local_source.py`

### Risks / Notes
- `src/web/weather_page_static_render.py` still imports backend pipeline for compatibility static entrypoint (intentional compatibility path).

### Next Slice
- Optional: extract reusable JS table sync/toggle controller to reduce duplication in `assets/js/weather_page.js`.

## 2026-03-04 (v3 implementation: frontend/backend simplification + dynamic decoupling)

### Scope
- Implement the planned v3 refactor end-to-end.
- Keep backward compatibility for existing CLI flows.

### Changes
- Frontend modularization:
  - `src/web/weather_table_renderer.py` now uses metric config + reusable section composition.
  - Reduced duplicated section shell/toggle rendering across snow/rain/temp.
- Frontend static template extraction:
  - added `src/web/templates/weather_page.html`
  - `src/web/weather_html_renderer.py` now injects dynamic fragments into template.
- Communication layer modularization:
  - added `src/web/data_sources/clients.py`
  - `src/web/data_sources/gateway.py` now builds and uses payload client adapters.
- Dynamic decoupled runtime:
  - added backend API server: `src/backend/weather_data_server.py`
  - `src/web/weather_page_server.py` supports `data_mode=local|api|file` and `/api/health`
  - CLI supports:
    - `serve` (compatibility local mode)
    - `serve-data` (backend only)
    - `serve-web` (frontend only, remote/file/local data source)
- Backend compute modularization:
  - added `src/backend/compute/resort_selection.py`
  - added `src/backend/compute/payload_metadata.py`
  - added `src/backend/io/cache_seed.py`
  - added `src/backend/services/request_options.py`
  - `src/backend/pipeline.py` delegates resort selection + payload metadata build to compute modules.
- Frontend split-layout dedup:
  - added `src/web/split_metric_renderer.py`
  - snowfall/rainfall desktop+mobile modules now use shared split primitives.
- Tests:
  - added backend compute tests
  - added backend data server integration tests
  - expanded CLI/web/gateway integration tests for new modes/commands
  - added backend io cache-seed tests

### Validation
- `python3 -m compileall src`
- `python3 -m pytest tests/backend -q` (`39 passed`)
- `python3 -m pytest tests/frontend -q` (`14 passed`)
- `python3 -m pytest tests/integration -q` (`53 passed`)
- `python3 -m pytest tests/smoke -q` (`3 passed`)
- `python3 -m pytest -q` (`109 passed`)

### Outcome
- v3 Definition of Done met for current scope:
  1. Frontend rendering is configuration-driven and less duplicated.
  2. HTML shell is template-based instead of Python full-document literal.
  3. Backend has dedicated compute/io/request-option submodules for reusable orchestration pieces.
  4. Dynamic pipeline supports independent FE/BE startup and cross-server communication.
  5. Compatibility mode (`serve`) remains available.

## 2026-03-03/04 (v3 planning reset + test suite restructuring)

### Scope
- Rewrite next refactor target around frontend/backend simplification and full dynamic decoupling.
- Restructure tests by responsibility and add explicit smoke/integration coverage.

### Changes
- Rewrote planning doc:
  - `docs/FRONTEND_COMM_BACKEND_REFACTOR_GUIDE.md` now tracks v3 objective:
    - frontend modularization and HTML/static extraction plan
    - backend simplification boundaries
    - decoupled dynamic communication layer design
- Restructured tests:
  - added folders:
    - `tests/backend/`
    - `tests/frontend/`
    - `tests/integration/`
    - `tests/smoke/`
  - split mixed test responsibilities (backend vs frontend static-site tests)
  - added smoke tests:
    - static split pipeline smoke
    - dynamic server smoke
  - added integration test:
    - gateway -> renderer path (`file` and `api`)
  - added marker config:
    - `pytest.ini` with `smoke` and `integration`
- Updated docs:
  - `README.md` testing layout/commands
  - `docs/CODEBASE_VALIDATION_PLAYBOOK.md` layered test commands and marker checks

### Validation
- `python3 -m compileall src`
- `python3 -m pytest -q` (`91 passed`)
- `python3 -m pytest tests/backend -q` (`34 passed`)
- `python3 -m pytest tests/frontend -q` (`14 passed`)
- `python3 -m pytest tests/integration -q` (`41 passed`)
- `python3 -m pytest tests/smoke -q` (`2 passed`)
- `python3 -m pytest -m smoke -q` (`2 passed, 89 deselected`)
- `python3 -m pytest -m integration -q` (`2 passed, 89 deselected`)

### Outcome
- Codebase now has test structure aligned with v3 refactor execution needs.
- At that time, v3 architecture execution was the next implementation slice (completed in the 2026-03-04 implementation milestone above).

## 2026-03-03/04 (v2 boundary hardening)

### Scope
- Finish remaining architecture-boundary refactor items from v2 guide.

### Changes
- Shared config extraction:
  - added `src/shared/config.py`
  - moved cross-layer `DEFAULT_RESORTS_FILE` usage to shared config
  - updated `src/cli.py`, `src/web/weather_page_server.py`, `src/web/weather_page_static_render.py`
- Communication gateway unification:
  - added `src/web/data_sources/gateway.py` as canonical runtime loader
  - migrated CLI render/static loading paths to `load_payload(...)`
  - removed legacy `src/web/data_sources/source_selector.py`
- Backend compute/export separation:
  - added `src/backend/export/payload_exporter.py`
  - `src/backend/pipeline.py` now uses compute function + export orchestrator split
  - service path switched to compute-only function (`build_weather_payload` no file outputs)
- Updated docs to reflect final v2 architecture:
  - `README.md`
  - `docs/FRONTEND_COMM_BACKEND_REFACTOR_GUIDE.md`
  - `docs/CODEBASE_VALIDATION_PLAYBOOK.md`

### Validation
- `python3 -m compileall src`
- `python3 -m pytest -q` (`87 passed`)
- `python3 -m src.cli fetch --output-json /tmp/final_refactor_data.json --max-workers 8`
- `python3 -m src.cli render --input-json /tmp/final_refactor_data.json --output-html /tmp/final_refactor_index.html`
- `python3 -m src.cli static --output-html /tmp/final_refactor_static.html --max-workers 8`
- `python3 -m src.cli serve --host 127.0.0.1 --port 8010 --max-workers 8` + smoke `GET /api/data`, `GET /`
- boundary checks:
  - `rg -n "from src\\.web|import src\\.web" src/backend -S` -> no matches
  - `rg -n "from src\\.backend\\.constants" src/web src/cli.py -S` -> no matches

### Outcome
- v2 Definition of Done met:
  1. Web/CLI no longer depend on backend constants for shared config.
  2. Communication gateway is the single runtime payload-loading entry.
  3. Backend compute and export are separated internally.
  4. Backend imports do not reference web modules.
  5. Docs/tests/workflow align with architecture.

## 2026-03-03 (automated pytest coverage expansion)

### Scope
- Add broad regression suite for refactored architecture and runtime entrypoints.

### Changes
- Added `tests/` suite covering:
  - contract validators
  - file/api data sources
  - CLI command branches
  - backend cache/open-meteo/pipeline/service/writer modules
  - web table/style/renderer/html/assets/server paths
  - compatibility entrypoints
- Updated docs to include automated test workflow:
  - `README.md`
  - `docs/CODEBASE_VALIDATION_PLAYBOOK.md`
  - `docs/FRONTEND_COMM_BACKEND_REFACTOR_GUIDE.md`
  - `docs/REFACTOR_PROGRESS_LEDGER.md`

### Validation
- `python3 -m pytest -q`

### Outcome
- Automated regression baseline established (`86 passed` in local run).

## 2026-03-03 (contract + communication + split static pipeline)

### Scope
- Complete the contract-driven refactor without breaking existing entrypoints.

### Changes
- Added contract layer:
  - `src/contract/weather_payload_v1.py`
  - `src/contract/validators.py`
- Updated backend pipeline output:
  - `src/backend/pipeline.py` now emits `schema_version` and `generated_at_utc` and validates payload.
- Added backend service/pipeline abstraction:
  - `src/backend/services/weather_service.py`
  - `src/backend/pipelines/live_pipeline.py`
  - `src/backend/pipelines/static_pipeline.py`
- Added communication/data-source layer:
  - `src/web/data_sources/static_json_source.py`
  - `src/web/data_sources/api_source.py`
  - `src/web/data_sources/source_selector.py`
- Reworked CLI into split + wrapper commands:
  - `src/cli.py` supports `fetch`, `render`, `static`, `serve`.
- Migrated legacy web entrypoints to new pipeline abstraction:
  - `src/web/weather_page_server.py`
  - `src/web/weather_page_static_render.py`
- Synced docs/workflow with current behavior:
  - `README.md`
  - `.github/workflows/deploy-pages.yml`
  - `docs/CODEBASE_VALIDATION_PLAYBOOK.md`

### Validation
- `python3 -m compileall src`
- `python3 -m src.cli fetch --output-json site/data.json --max-workers 8`
- `python3 -m src.cli render --input-json site/data.json --output-html site/index.html`
- `python3 -m src.cli static --output-html index.html --max-workers 8`
- `python3 -m src.cli static --skip-fetch --output-json .cache/static_payload.json --output-html /tmp/static_from_cached_payload.html`
- `python3 -m src.cli static --skip-render --output-json /tmp/static_payload_only.json --max-workers 8`
- `python3 -m src.cli serve --host 127.0.0.1 --port 8010 --max-workers 8` + smoke `GET /api/data`, `GET /`
- `python3 -m src.web.weather_page_static_render --output-html /tmp/legacy_static_render.html --max-workers 8`
- workflow-equivalent local build:
  - `python3 -m src.cli fetch --output-json <tmp>/data.json --max-workers 8`
  - `python3 -m src.cli render --input-json <tmp>/data.json --output-html <tmp>/index.html`
  - copy assets to `<tmp>/assets/...`

### Outcome
- Refactor objective reached:
  1. Backend produces explicit validated contract payload.
  2. Communication layer supports file/API payload loading with schema validation.
  3. Frontend render path is shared and contract-driven for static and dynamic flows.
  4. Static pipeline supports split stages and wrapper command.
  5. Deploy workflow now uses split static pipeline (`fetch + render`).

## 2026-03-03 (recent merged work)

### Scope
- Stabilize UI unit toggles and backend concurrent fetch controls.

### Key commits
- `8a6b0d7` concurrent backend fetch + `--max-workers` + docs/workflow sync
- `578d6bd` per-table unit toggle UX + docs alignment
- `87112af` one-shot initial render to avoid unit flicker
- `0178896` sliding toggle + table refresh animation
- `ad92eee` per-table metric/imperial toggles
- `2c7d3c2` desktop/mobile renderer folders + fallback behavior

### Validation
- `python3 -m compileall src`
- `python3 -m src.cli static --output-html index.html --max-workers 8`
- `python3 -m src.cli serve --max-workers 8` (smoke paths `/` and `/api/data`)

### Outcome
- Codebase is runnable and deploy workflow is aligned with unified CLI static rendering.

---

## In-Progress Refactor Theme

Move from backend-driven HTML composition toward a strict contract-driven interface:

1. Backend produces one explicit payload contract object.
2. Communication layer validates/adapts payload.
3. Frontend rendering depends only on contract and data source.

No functional rewrite in one shot. Use small, reversible slices.

Current status: this theme has been implemented for the existing HTML rendering model.

---

## Next Slices (Post-Refactor, Optional)

1. Add `pytest-cov` and establish a minimum coverage gate in CI.
2. Add typed adapters for report row shape if frontend contract granularity increases.
3. Consider client-side online mode (`index.html` loads `/api/data`) as a separate evolution, not part of this completed slice.

---

## Open Risks

1. Contract drift between static output and online API if schema is not centralized.
2. Refactor scope creep if frontend and backend changes are mixed in a single PR.
3. Behavior regressions if migration removes compatibility paths too early.

---

## Resume Checklist (Use Every Session)

1. `git status --short`
2. Read the three docs listed at top.
3. Pick exactly one slice from "Next Slices".
4. Implement only that slice.
5. Run validation from `CODEBASE_VALIDATION_PLAYBOOK.md`.
6. Append a new ledger entry before ending session.

---

## Session Entry Template

Copy this template for each new work session:

```markdown
## YYYY-MM-DD HH:MM (local)

### Scope
- [single slice summary]

### Changes
- Files:
  - path/a
  - path/b
- Behavior impact:
  - [what changed]

### Validation
- Commands:
  - `...`
  - `...`
- Results:
  - [pass/fail + key output]

### Risks / Notes
- [risk or none]

### Next Slice
- [single next action]
```

## 2026-03-04 01:44 (local)

### Scope
- Implement F7: replace generic day headers with concrete date labels across snowfall/rainfall/temperature tables.

### Changes
- Files:
  - src/web/weather_report_transform.py
  - src/web/split_metric_renderer.py
  - src/web/desktop/temperature_renderer.py
  - tests/frontend/test_renderers.py
  - tests/frontend/test_styles_and_transform.py
- Behavior impact:
  - Transform layer now derives `label_day_N` from `daily[].date` in format `MM-DD Ddd`.
  - Snowfall/rainfall desktop+mobile headers now show concrete dates when available, with fallback to `today/day N`.
  - Temperature desktop headers now show concrete dates when available, with fallback to `today/day N`.

### Validation
- Commands:
  - `pytest -q tests/frontend/test_renderers.py tests/frontend/test_styles_and_transform.py`
  - `pytest -q tests/frontend`
  - `python3 -m src.cli static --output-html index.html`
  - `rg -n "03-" index.html | head -n 20`
- Results:
  - All targeted frontend tests passed (`12 passed`).
  - Full frontend test suite passed (`16 passed`).
  - Static render succeeded and output includes concrete date headers such as `03-04 Wed`.

### Risks / Notes
- `label_day_N` keys are currently generated per-row; renderer uses first-row labels for headers by design.

### Next Slice
- Implement F1: add `weather_code` backend field and emoji rendering section with tests and static verification.

## 2026-03-04 03:48 (local)

### Scope
- Implement F1 weather_code end-to-end: backend payload inclusion plus frontend emoji weather section.

### Changes
- Files:
  - `src/backend/open_meteo.py`
  - `src/backend/report_builder.py`
  - `src/web/weather_code_emoji.py`
  - `src/web/weather_report_transform.py`
  - `src/web/weather_table_renderer.py`
  - `src/web/weather_html_renderer.py`
  - `src/web/weather_page_render_core.py`
  - `src/web/templates/weather_page.html`
  - `tests/frontend/test_renderers.py`
- Behavior impact:
  - Forecast/history daily requests now include `weather_code`.
  - Each `daily` item in report includes `weather_code` (`int | null`).
  - Main page now renders a dedicated `Weather` section with emoji per day and WMO-code tooltip.

### Validation
- Commands:
- `pytest -q tests/backend tests/frontend`
  - `pytest -q`
  - `python3 -m src.cli fetch --output-json /tmp/closesnow_f1_data.json`
  - `jq '.reports[0].daily[0] | {date, weather_code}' /tmp/closesnow_f1_data.json`
  - `python3 -m src.cli static --output-html index.html`
  - `rg -n "<h2>Weather</h2>|☀️|🌧️|❄️|⛈️|❓|WMO code" index.html`
- Results:
  - Targeted suites and full suite passed (`113 passed`).
  - API payload sample contains `weather_code` with numeric value.
  - Static HTML includes Weather section, emoji rendering, and WMO tooltip text.

### Risks / Notes
- Weather emoji mapping is intentionally coarse-grained by WMO category; unknown codes fallback to `❓`.

### Next Slice
- Implement F2 sunrise/sunset daily fields and a dedicated sunrise/sunset section in frontend.

## 2026-03-04 04:52 (local)

### Scope
- Implement F2 sunrise/sunset end-to-end with backend daily fields and frontend Sunrise/Sunset section.

### Changes
- Files:
  - `src/backend/open_meteo.py`
  - `src/backend/report_builder.py`
  - `src/web/weather_report_transform.py`
  - `src/web/desktop/sun_renderer.py` (new)
  - `src/web/weather_table_renderer.py`
  - `src/web/weather_html_renderer.py`
  - `src/web/weather_page_render_core.py`
  - `src/web/templates/weather_page.html`
  - `assets/css/weather_page.css`
  - `assets/js/weather_page.js`
  - `tests/backend/test_report_builder.py`
  - `tests/backend/test_open_meteo.py`
  - `tests/frontend/test_styles_and_transform.py`
  - `tests/frontend/test_renderers.py`
- Behavior impact:
  - Forecast/history daily requests now include `sunrise,sunset`.
  - Daily payload now carries `sunrise_iso`, `sunset_iso`, and formatted `sunrise_local_hhmm` / `sunset_local_hhmm`.
  - Main page now includes a dedicated `Sunrise / Sunset` split table (temperature-like layout) with concrete date headers.

### Validation
- Commands:
  - `pytest -q tests/backend/test_report_builder.py tests/backend/test_open_meteo.py tests/frontend/test_renderers.py tests/frontend/test_styles_and_transform.py`
  - `pytest -q`
  - `python3 -m src.cli fetch --output-json /tmp/closesnow_f2_data.json`
  - `jq '.reports[0].daily[0] | {date, sunrise_local_hhmm, sunset_local_hhmm}' /tmp/closesnow_f2_data.json`
  - `python3 -m src.cli static --output-html index.html`
  - `rg -n "Sunrise / Sunset|sunrise|sunset|[0-2][0-9]:[0-5][0-9]" index.html | head -n 40`
- Results:
  - Targeted suite passed (`27 passed`).
  - Full suite passed (`116 passed`).
  - Payload sample contains `sunrise_local_hhmm` and `sunset_local_hhmm`.
  - Static HTML contains `Sunrise / Sunset` section and rendered HH:MM values.

### Risks / Notes
- Sunrise/sunset HH:MM extraction currently assumes Open-Meteo ISO-like time format and truncates to minute precision.

### Next Slice
- Start F5: migrate resort source to YAML metadata and add searchable/structured resort attributes.

## 2026-03-04 04:57 (local)

### Scope
- Implement F5 resort catalog migration to YAML metadata, add searchable catalog API, and add frontend resort search UI.

### Changes
- Files:
  - `resorts.yml` (new)
  - `src/shared/config.py`
  - `src/backend/resort_catalog.py` (new)
  - `src/backend/pipeline.py`
  - `src/backend/weather_data_server.py`
  - `src/web/templates/weather_page.html`
  - `assets/css/weather_page.css`
  - `assets/js/weather_page.js`
  - `tests/backend/test_resort_catalog.py` (new)
  - `tests/backend/test_pipeline.py`
  - `tests/integration/test_backend_data_server.py`
  - `tests/frontend/test_renderers.py`
- Behavior impact:
  - Default resort source is now `resorts.yml` (JSON-compatible YAML list with structured attributes).
  - Resort loading supports both `.yml/.yaml` catalog and legacy `.txt` list.
  - Backend adds `/api/resorts?search=...` for catalog search across name/query/state/region/pass type.
  - Frontend adds a `Search Resorts` box that filters visible rows across snow/rain/weather/sun/temp sections.

### Validation
- Commands:
  - `pytest -q tests/backend/test_resort_catalog.py tests/backend/test_pipeline.py tests/integration/test_backend_data_server.py tests/frontend/test_renderers.py`
  - `pytest -q`
  - `python3 -m src.cli fetch --output-json /tmp/closesnow_f5_data.json`
  - `jq '{resorts_count, sample_query:.reports[0].query}' /tmp/closesnow_f5_data.json`
  - `python3 - <<'PY'\nfrom src.backend.resort_catalog import load_resort_catalog, search_resort_catalog\nitems = load_resort_catalog('resorts.yml')\nprint('count', len(items))\nprint('epic', [x['query'] for x in search_resort_catalog(items, 'epic')])\nPY`
  - `python3 -m src.cli static --output-html index.html`
  - `rg -n "resort-search-input|Search Resorts" index.html`
- Results:
  - Targeted tests passed (`20 passed`).
  - Full suite passed (`120 passed`).
  - Default fetch uses YAML catalog with `resorts_count: 18`.
  - Catalog search returns expected match for `epic`.
  - Static HTML includes resort search controls.

### Risks / Notes
- `resorts.yml` is currently stored as JSON-compatible YAML for zero-dependency parsing.

### Next Slice
- Implement F4: filter modal with pass type / east-west / country backed by catalog metadata.

## 2026-03-04 05:05 (local)

### Scope
- Implement F4 resort filter capability with backend filter query support and frontend filter modal.

### Changes
- Files:
  - `src/backend/weather_data_server.py`
  - `src/backend/pipeline.py`
  - `src/web/weather_report_transform.py`
  - `src/web/split_metric_renderer.py`
  - `src/web/desktop/temperature_renderer.py`
  - `src/web/desktop/sun_renderer.py`
  - `src/web/weather_table_renderer.py`
  - `src/web/templates/weather_page.html`
  - `assets/js/weather_page.js`
  - `assets/css/weather_page.css`
  - `tests/integration/test_backend_data_server.py`
  - `tests/backend/test_pipeline.py`
  - `tests/frontend/test_styles_and_transform.py`
  - `tests/frontend/test_renderers.py`
  - `docs/FEATURE_DESIGN_SKI_WEATHER_FULL_INFO.md`
- Behavior impact:
  - `/api/data` supports filters: `pass_type`, `region`, `country`, `search`.
  - `/api/data` response now includes `available_filters` and `applied_filters` metadata.
  - Reports are enriched with catalog metadata (`resort_id`, `pass_types`, `region`, `country_code`).
  - Frontend rows carry filter data attributes and a filter modal can filter by pass type / east-west / country.

### Validation
- Commands:
  - `pytest -q tests/backend/test_pipeline.py tests/integration/test_backend_data_server.py tests/frontend/test_renderers.py tests/frontend/test_styles_and_transform.py`
  - `pytest -q`
  - `python3 -m src.cli static --output-html index.html`
  - `rg -n "filter-open-btn|filter-modal|data-pass-types|data-region|data-country='US'" index.html`
- Results:
  - Targeted suites passed (`23 passed`).
  - Full suite passed (`121 passed`).
  - Static HTML includes filter modal controls and row metadata attributes used by client filtering.

### Risks / Notes
- Frontend filter modal currently applies client-side row filtering (static-friendly); URL sync for filters is not added yet.

### Next Slice
- Implement F6 by extending resort catalog coverage toward full Ikon/Epic/Indy set.

## 2026-03-04 05:14 (local)

### Scope
- Implement F3 per-resort hourly standalone flow: backend hourly endpoint, frontend hourly page route/assets, and main-table resort links.

### Changes
- Files:
  - `src/backend/open_meteo.py`
  - `src/backend/weather_data_server.py`
  - `src/web/weather_page_server.py`
  - `src/web/weather_page_assets.py`
  - `src/web/templates/resort_hourly_page.html` (new)
  - `assets/css/resort_hourly.css` (new)
  - `assets/js/resort_hourly.js` (new)
  - `src/web/weather_report_transform.py`
  - `src/web/split_metric_renderer.py`
  - `src/web/desktop/temperature_renderer.py`
  - `src/web/desktop/sun_renderer.py`
  - `src/web/weather_table_renderer.py`
  - `assets/css/weather_page.css`
  - tests:
    - `tests/backend/test_open_meteo.py`
    - `tests/integration/test_backend_data_server.py`
    - `tests/integration/test_web_server.py`
    - `tests/frontend/test_assets.py`
    - `tests/frontend/test_renderers.py`
    - `tests/frontend/test_styles_and_transform.py`
  - docs:
    - `docs/FEATURE_DESIGN_SKI_WEATHER_FULL_INFO.md`
- Behavior impact:
  - Backend adds `GET /api/resort-hourly?resort_id=<id>&hours=<n>` with hourly metrics:
    - `snowfall`, `rain`, `precipitation_probability`, `snow_depth`, `wind_speed_10m`, `wind_direction_10m`, `visibility`.
  - Web server adds:
    - `/resort/<resort_id>` hourly page route
    - `/api/resort-hourly` proxy/local endpoint for page data fetch
  - Main weather tables now link resort names to `/resort/<resort_id>`.

### Validation
- Commands:
  - `pytest -q tests/backend/test_open_meteo.py tests/integration/test_backend_data_server.py tests/integration/test_web_server.py tests/frontend/test_assets.py tests/frontend/test_renderers.py`
  - `pytest -q`
  - `python3 -m src.cli static --output-html index.html`
  - `rg -n "/resort/|filter-open-btn" index.html | head -n 40`
  - `python3 -m src.cli serve-data --host 127.0.0.1 --port 8031` + `curl /api/resort-hourly?...` smoke
  - `python3 -m src.cli serve-web --host 127.0.0.1 --port 8032 --data-mode local` + `curl /resort/snowbird-ut` and `curl /api/resort-hourly?...` smoke
- Results:
  - Targeted suites passed (`32 passed`).
  - Full suite passed (`124 passed`).
  - Static HTML contains `/resort/<id>` links in resort columns.
  - Backend/web smoke checks return hourly payload with required keys and valid route rendering.

### Risks / Notes
- `hours` is capped to `240` for endpoint stability.

### Next Slice
- F6 remaining: extend `resorts.yml` coverage to full Ikon/Epic/Indy catalog.

## 2026-03-04 05:34 (local)

### Scope
- Implement F6 full-pass catalog coverage for Ikon/Epic/Indy with automated catalog sync/validation, include-all filtering path, and large-catalog-ready filter UX metadata.

### Changes
- Files:
  - `resorts.yml`
  - `scripts/sync_resorts_catalog.py` (new)
  - `scripts/sync_pass_resorts.py`
  - `src/backend/resort_catalog.py`
  - `src/backend/weather_data_server.py`
  - `src/web/weather_page_server.py`
  - `src/web/weather_html_renderer.py`
  - `src/web/weather_page_render_core.py`
  - `src/web/templates/weather_page.html`
  - `assets/css/weather_page.css`
  - `assets/js/weather_page.js`
  - `tests/backend/test_resort_catalog.py`
  - `tests/integration/test_backend_data_server.py`
  - `tests/integration/test_web_server.py`
  - `tests/frontend/test_renderers.py`
  - `docs/FEATURE_DESIGN_SKI_WEATHER_FULL_INFO.md`
- Behavior impact:
  - Added `scripts/sync_resorts_catalog.py` with network sync + `--validate-only` integrity checks (required fields, duplicate ids/queries, pass coverage).
  - Expanded `resorts.yml` to full synced catalog coverage for Ikon/Epic/Indy while keeping default page scope manageable via `default_enabled` entries.
  - Backend `/api/data` now supports `include_all=1` in applied filters and selection logic.
  - Web server query passthrough now forwards `pass_type/region/country/search/include_all` to API mode and executes backend-equivalent filtered selection in local mode.
  - Frontend filter modal now includes `Include full catalog (slower)`, dynamic pass/country/region counts, URL-sync/reload behavior for server-side filtering, and visible resort count summary.
  - HTML render core now injects filter metadata (`window.CLOSESNOW_FILTER_META`) into page output.

### Validation
- Commands:
  - `pytest -q tests/backend/test_resort_catalog.py tests/integration/test_backend_data_server.py tests/integration/test_web_server.py tests/frontend/test_renderers.py`
  - `pytest -q`
  - `python3 scripts/sync_resorts_catalog.py --validate-only`
  - `python3 -m src.cli static --output-html index.html`
  - `rg -n "filter-include-all|CLOSESNOW_FILTER_META|data-pass-count|include_all" index.html`
  - `python3 -m src.cli serve-data --host 127.0.0.1 --port 8041` + `curl "http://127.0.0.1:8041/api/data?search=snowbird&include_all=1" | jq ...`
  - `python3 -m src.cli serve-web --host 127.0.0.1 --port 8042 --data-mode local` + `curl "http://127.0.0.1:8042/?search=snowbird&include_all=1"`
- Results:
  - Targeted suites passed (`26 passed`).
  - Full suite passed (`128 passed`).
  - Catalog validation passed for expanded `resorts.yml` (`total 362`, pass counts include `ikon/epic/indy`).
  - Static render succeeded and includes new full-catalog controls and filter metadata script.
  - Runtime smoke checks confirmed include-all query path and server-side filtered render behavior.

### Risks / Notes
- `include_all=1` without additional narrowing can trigger very large fetches; UI labels this mode as slower.

### Next Slice
- Feature backlog in current design doc is fully implemented; next work should be user-prioritized polish/performance iteration on full-catalog workflows.

## 2026-03-04 05:38 (local)

### Scope
- Fix incorrect resort hourly links under sub-path deployments by converting hard-coded absolute hourly routes/assets/API paths to prefix-safe relative addressing.

### Changes
- Files:
  - `src/web/weather_table_renderer.py`
  - `src/web/split_metric_renderer.py`
  - `src/web/desktop/temperature_renderer.py`
  - `src/web/desktop/sun_renderer.py`
  - `src/web/templates/resort_hourly_page.html`
  - `assets/js/resort_hourly.js`
  - `src/web/weather_page_server.py`
  - `tests/frontend/test_renderers.py`
  - `tests/integration/test_web_server.py`
- Behavior impact:
  - Resort links now use relative `resort/<id>` instead of absolute `/resort/<id>`.
  - Hourly page assets use relative `../assets/...` and hourly API calls derive prefix from current pathname.
  - Web server now normalizes prefixed paths (e.g. `/CloseSnow/resort/...`, `/CloseSnow/api/resort-hourly`, `/CloseSnow/assets/...`).

### Validation
- Commands:
  - `pytest -q tests/frontend/test_renderers.py tests/integration/test_web_server.py`
  - `pytest -q`
  - `python3 -m src.cli static --output-html index.html`
  - `rg -n "href='resort/|../assets/js/resort_hourly.js|../assets/css/resort_hourly.css" index.html src/web/templates/resort_hourly_page.html`
- Results:
  - Targeted tests passed (`16 passed`).
  - Full suite passed (`128 passed`).
  - Static render succeeded and now contains relative hourly links/resources.

### Risks / Notes
- Static GitHub Pages build still has no backend API route; this fix corrects path resolution and sub-path compatibility for dynamic serving and prefixed deployments.

### Next Slice
- If needed, add static-friendly hourly artifact generation for GitHub Pages-only hosting.

## 2026-03-04 05:40 (local)

### Scope
- Fix Weather section single-table header/left column usability by making the Resort column sticky in the Weather table.

### Changes
- Files:
  - `assets/css/weather_page.css`
  - `tests/frontend/test_assets.py`
- Behavior impact:
  - Weather table now keeps the Resort column fixed (`position: sticky; left: 0`) while horizontal scrolling.
  - Header/query intersection cell has elevated z-index for stable sticky layering.

### Validation
- Commands:
  - `pytest -q tests/frontend/test_assets.py tests/frontend/test_renderers.py`
  - `pytest -q`
  - `python3 -m src.cli static --output-html index.html`
- Results:
  - Targeted tests passed (`10 passed`).
  - Full suite passed (`128 passed`).
  - Static render succeeded with updated weather table styles.

### Risks / Notes
- None.

### Next Slice
- Continue user-reported UI polish iterations on cross-table scrolling behavior.

## 2026-03-04 05:58 (local)

### Scope
- Add sorting controls in Filters so resorts can be ordered by state or resort name, while keeping all metric tables in sync.

### Changes
- Files:
  - `src/web/templates/weather_page.html`
  - `assets/js/weather_page.js`
  - `src/web/weather_report_transform.py`
  - `src/web/split_metric_renderer.py`
  - `src/web/desktop/temperature_renderer.py`
  - `src/web/desktop/sun_renderer.py`
  - `src/web/weather_table_renderer.py`
  - `tests/frontend/test_renderers.py`
  - `tests/frontend/test_styles_and_transform.py`
- Behavior impact:
  - Filter modal now has `Sort By` options: default, state (A-Z), resort name (A-Z).
  - Sorting is applied client-side to all paired tables (desktop/mobile where applicable) with row order kept consistent across sections.
  - `sort_by` is persisted in URL query params and restored on load.
  - Resort row metadata now includes `data-state` from `admin1` for stable state-based sorting.

### Validation
- Commands:
  - `pytest -q tests/frontend/test_styles_and_transform.py tests/frontend/test_renderers.py tests/frontend/test_assets.py`
  - `pytest -q tests/integration/test_web_server.py tests/integration/test_gateway_render_integration.py tests/integration/test_cli.py tests/integration/test_entrypoints.py tests/frontend/test_static_site_pipeline.py`
  - `python3 -m src.cli static --skip-fetch --output-json .cache/static_payload.json --output-html index.html`
- Results:
  - Frontend targeted tests passed (`15 passed`).
  - Integration/entry/static-related suites passed (`32 passed`).
  - Static render succeeded and includes `filter-sort-select` plus `data-state` row attributes.

### Risks / Notes
- Sorting is client-side only; backend payload order remains unchanged.

### Next Slice
- If needed, add descending or multi-key sort options and explicit locale-aware collation controls.

## 2026-03-04 06:12 (local)

### Scope
- Fix static resort hourly pages showing `fetch failed` by making static builds emit local hourly data artifacts and making hourly page JS read local JSON first.

### Changes
- Files:
  - `src/web/pipelines/static_site.py`
  - `src/web/templates/resort_hourly_page.html`
  - `assets/js/resort_hourly.js`
  - `src/web/weather_page_server.py`
  - `src/cli.py`
  - `src/web/weather_page_static_render.py`
  - `tests/frontend/test_static_site_pipeline.py`
  - `tests/integration/test_cli.py`
  - `tests/integration/test_entrypoints.py`
- Behavior impact:
  - `static` and `weather_page_static_render` now generate `resort/<resort_id>/hourly.json` (120h) alongside `resort/<resort_id>/index.html`.
  - Hourly page context now supports `hourlyDataUrl`; static pages inject `./hourly.json`.
  - `resort_hourly.js` now prefers local `hourlyDataUrl` and slices rows for selected hour window (24/48/72/120), with API fallback kept for dynamic mode.

### Validation
- Commands:
  - `pytest -q tests/frontend/test_static_site_pipeline.py tests/integration/test_cli.py tests/integration/test_entrypoints.py tests/integration/test_web_server.py`
  - `pytest -q tests/frontend/test_renderers.py tests/frontend/test_assets.py tests/frontend/test_styles_and_transform.py`
  - `python3 -m src.cli static --skip-fetch --output-json .cache/static_payload.json --output-html index.html`
  - `find resort -maxdepth 3 -name hourly.json`
- Results:
  - Targeted static/cli/web tests passed (`31 passed`).
  - Frontend regression suites passed (`15 passed`).
  - Static compile succeeded and generated `hourly.json` for all rendered resorts.

### Risks / Notes
- `render` command (file->html only) still does not proactively fetch hourly data; it only renders pages. Full static hourly artifacts are produced by `static` and static-render entrypoint.

### Next Slice
- If desired, add optional `--with-hourly-data` for `render` to fetch and emit hourly artifacts from file mode too.

## 2026-03-04 06:20 (local)

### Scope
- Fix GitHub Pages workflow so Actions artifacts include newly added resort subpages and hourly static assets/data.

### Changes
- Files:
  - `.github/workflows/deploy-pages.yml`
- Behavior impact:
  - Build step now uses unified `python -m src.cli static --output-json site/data.json --output-html site/index.html --max-workers 8`.
  - Workflow now copies full `assets/css` and `assets/js` directories into `site/assets`, not only `weather_page.css/js`.
  - Pages artifact now includes static hourly subpages + required hourly JS/CSS and locally generated hourly JSON files.

### Validation
- Commands:
  - `sed -n '1,260p' .github/workflows/deploy-pages.yml`
- Results:
  - Workflow confirmed updated to static pipeline command and full asset copy strategy.

### Risks / Notes
- This change only affects future GitHub Actions runs (after push/merge to `main`).

### Next Slice
- Optionally add a lightweight workflow smoke check (assert `site/resort/*/index.html` and `site/resort/*/hourly.json` exist) before upload.

## 2026-03-04 06:28 (local)

### Scope
- Update filter sorting UX to default to state order and remove the redundant `Default` sort option.

### Changes
- Files:
  - `src/web/templates/weather_page.html`
  - `assets/js/weather_page.js`
  - `tests/frontend/test_renderers.py`
- Behavior impact:
  - Filter sort dropdown now has only `State (A-Z)` and `Resort Name (A-Z)`.
  - Default sort mode is now `state` (when no `sort_by` query parameter is provided).
  - URL query only includes `sort_by` when user chooses `name`; state sort remains implicit default.
  - Filter summary only shows `sort: ...` when non-default (`name`) is selected.

### Validation
- Commands:
  - `pytest -q tests/frontend/test_renderers.py tests/frontend/test_assets.py tests/frontend/test_styles_and_transform.py tests/integration/test_gateway_render_integration.py`
  - `python3 -m src.cli static --skip-fetch --output-json .cache/static_payload.json --output-html index.html`
  - `rg -n "filter-sort-select|option value=\"state\"|option value=\"default\"" index.html`
- Results:
  - Targeted suites passed (`17 passed`).
  - Static compile succeeded and rendered only state/name options; `default` option no longer present.

### Risks / Notes
- Existing links containing `sort_by=default` will be normalized to state sort.

### Next Slice
- If desired, add secondary state-region grouping labels (e.g., by country + state) for international expansion.

## 2026-03-04 06:36 (local)

### Scope
- Add keyboard accessibility for filter modal close action via `Esc`.

### Changes
- Files:
  - `assets/js/weather_page.js`
- Behavior impact:
  - When filter modal is open, pressing `Escape` now closes it.
  - No effect when modal is already hidden.

### Validation
- Commands:
  - `pytest -q tests/frontend/test_renderers.py tests/frontend/test_assets.py tests/frontend/test_styles_and_transform.py`
- Results:
  - Frontend targeted suites passed (`15 passed`).

### Risks / Notes
- None.

### Next Slice
- If needed, add focus trapping and focus-return behavior for fully keyboard-friendly modal navigation.

## 2026-03-04 06:44 (local)

### Scope
- Center-align sunrise/sunset time values in the Sun table for better readability.

### Changes
- Files:
  - `assets/css/weather_page.css`
- Behavior impact:
  - Time cells under sunrise/sunset now render centered (`.sun-right-table td { text-align: center; }`).

### Validation
- Commands:
  - `pytest -q tests/frontend/test_renderers.py tests/frontend/test_assets.py tests/frontend/test_styles_and_transform.py`
- Results:
  - Frontend targeted suites passed (`15 passed`).

### Risks / Notes
- None.

### Next Slice
- Optional visual polish: apply explicit tabular-nums styling for time columns.

## 2026-03-04 06:53 (local)

### Scope
- Align `Search Resorts` behavior with placeholder text by adding pass-type keyword matching.

### Changes
- Files:
  - `assets/js/weather_page.js`
- Behavior impact:
  - Search now matches across resort name text, state text, and pass types (`ikon/epic/indy`) from row metadata.
  - Existing filter conditions (pass/region/country/sort/include_all) remain unchanged.

### Validation
- Commands:
  - `pytest -q tests/frontend/test_renderers.py tests/frontend/test_assets.py tests/frontend/test_styles_and_transform.py`
- Results:
  - Frontend targeted suites passed (`15 passed`).

### Risks / Notes
- Search remains substring-based; short keywords (e.g., `i`) may match broadly as designed.

### Next Slice
- Optionally support multi-keyword AND search tokenization for stricter matching.

## 2026-03-04 07:00 (local)

### Scope
- Center-align snowfall table date header row text for better visual consistency.

### Changes
- Files:
  - `assets/css/weather_page.css`
- Behavior impact:
  - Snowfall second header row (`label_day_*` date row) now renders with centered text.
  - Weekly/group header behavior unchanged.

### Validation
- Commands:
  - `pytest -q tests/frontend/test_renderers.py tests/frontend/test_assets.py tests/frontend/test_styles_and_transform.py`
- Results:
  - Frontend targeted suites passed (`15 passed`).

### Risks / Notes
- None.

### Next Slice
- Optional: apply same explicit date-row alignment rule to rain/weather/sun for full cross-table consistency.

## 2026-03-04 07:12 (local)

### Scope
- Add detailed feature design doc for resort hourly page line-chart visualization.

### Changes
- Files:
  - `docs/FEATURE_DESIGN_RESORT_HOURLY_LINE_CHARTS.md`
- Behavior impact:
  - No runtime code change.
  - Defines product/UX/technical requirements and acceptance criteria for rendering one line chart per hourly metric.

### Validation
- Commands:
  - `sed -n '1,240p' docs/FEATURE_DESIGN_RESORT_HOURLY_LINE_CHARTS.md`
- Results:
  - New feature doc is present and complete with scope, requirements, compatibility rules, and test plan.

### Risks / Notes
- This is a specification-only change; implementation still pending.

### Next Slice
- Implement chart renderer and integrate with existing static/dynamic hourly data flow.

## 2026-03-04 07:30 (local)

### Scope
- Implement resort hourly page line-chart visualization (one line chart per hourly metric), while retaining tabular detail view.

### Changes
- Files:
  - `src/web/templates/resort_hourly_page.html`
  - `assets/css/resort_hourly.css`
  - `assets/js/resort_hourly.js`
  - `tests/frontend/test_assets.py`
  - `tests/frontend/test_static_site_pipeline.py`
  - `tests/integration/test_web_server.py`
- Behavior impact:
  - Added chart section to hourly page with 7 metric cards:
    - snowfall, rain, precipitation_probability, snow_depth, wind_speed_10m, wind_direction_10m, visibility.
  - Added SVG line-chart renderer with:
    - dynamic/static data-source compatibility
    - tooltip per point (`time + value + unit`)
    - null-safe gaps and empty-state fallback
    - metric-specific Y rules (`precipitation_probability: 0~100`, `wind_direction_10m: 0~360`)
  - Existing hourly table remains unchanged and still renders alongside charts.

### Validation
- Commands:
  - `pytest -q tests/frontend/test_assets.py tests/frontend/test_static_site_pipeline.py tests/integration/test_web_server.py tests/integration/test_cli.py tests/integration/test_entrypoints.py`
  - `pytest -q tests/frontend/test_renderers.py tests/frontend/test_styles_and_transform.py`
  - `python3 -m src.cli static --skip-fetch --output-json .cache/static_payload.json --output-html index.html`
  - `rg -n "id=\"hourly-charts\"|chart-card|renderHourlyCharts|hourly-chart-error" resort/snowbird-ut/index.html assets/js/resort_hourly.js assets/css/resort_hourly.css`
- Results:
  - Targeted hourly/frontend/integration suites passed (`33 passed` + `13 passed`).
  - Static build succeeded and generated hourly pages containing chart container and chart logic assets.

### Risks / Notes
- SVG-based charts are intentionally lightweight; very long future horizons may require virtualized/decimated rendering if scope expands beyond current 120h window.

### Next Slice
- Optional: add chart legend toggle and synchronized crosshair across all metric cards.

## 2026-03-05 04:49 (local)

### Scope
- Make GitHub Actions static build support full `resorts.yml` catalog instead of only default-enabled resorts.

### Changes
- Files:
  - `.github/workflows/deploy-pages.yml`
  - `src/cli.py`
  - `src/backend/pipeline.py`
  - `src/backend/pipelines/live_pipeline.py`
  - `src/backend/services/weather_service.py`
  - `tests/integration/test_cli.py`
  - `tests/backend/test_pipeline.py`
  - `tests/backend/test_service_pipelines.py`
  - `tests/smoke/test_static_pipeline_smoke.py`
- Behavior impact:
  - Added CLI option `--include-all-resorts` for `fetch/static`.
  - Propagated `include_all_resorts` through live/service/pipeline path.
  - `deploy-pages` workflow now builds with `--include-all-resorts`, producing all resorts from `resorts.yml`.
  - Default behavior remains unchanged when the new flag is not provided.

### Validation
- Commands:
  - `python3 -m pytest -q tests/integration/test_cli.py tests/backend/test_service_pipelines.py tests/backend/test_pipeline.py tests/smoke/test_static_pipeline_smoke.py`
  - `python3 -m src.cli fetch --output-json /tmp/closesnow-data-default.json --max-workers 8`
  - `python3 -m src.cli fetch --output-json /tmp/closesnow-data-all.json --max-workers 8 --include-all-resorts`
  - `python3 -m src.cli static --output-json /tmp/static-all.json --output-html /tmp/static-all.html --max-workers 8 --include-all-resorts`
  - `python3 -m pytest -q`
- Results:
  - Targeted suites: `29 passed`.
  - Default fetch: `18` reports.
  - Include-all fetch: `111` reports.
  - Static include-all: `Done: 111 resort hourly page(s)`.
  - Full suite: `139 passed`.

### Risks / Notes
- Full catalog build takes longer in Actions due to higher API request volume.

### Next Slice
- Optional: expose `include_all_resorts` as a repo-level workflow input so manual runs can choose default-only vs full catalog.

## 2026-03-05 04:58 (local)

### Scope
- Add Ikon destinations page coverage check to resort catalog sync/validation flow.

### Changes
- Files:
  - `scripts/sync_resorts_catalog.py`
  - `tests/backend/test_sync_resorts_catalog.py` (new)
- Behavior impact:
  - Added Ikon destinations source check using Ikon destinations page data backend (`destinations` list query).
  - `sync_resorts_catalog.py` now validates that Ikon-tagged catalog entries cover destinations-page resorts.
  - Added `--skip-ikon-destinations-check` flag to bypass this network check when needed.
  - Added normalization + alias handling (`Arai Mountain Resort` vs `Arai Snow`) to reduce false mismatches.

### Validation
- Commands:
  - `python3 -m pytest -q tests/backend/test_sync_resorts_catalog.py`
  - `python3 -m pytest -q tests/backend/test_resort_catalog.py tests/backend/test_sync_resorts_catalog.py`
  - `python3 scripts/sync_resorts_catalog.py --validate-only`
  - `python3 -m src.cli static --output-html index.html`
- Results:
  - New sync-catalog tests passed (`3 passed`).
  - Combined backend catalog suites passed (`8 passed`).
  - Validate-only passed with Ikon destinations check enabled (`Ikon destinations (from page): 64`).
  - Static render pipeline succeeded (`Done: index.html`, `Done: 18 resort hourly page(s)`).

### Risks / Notes
- Ikon destinations check depends on upstream Ikon Sanity data endpoint availability.

### Next Slice
- Optional: add explicit per-destination diff output mode (machine-readable JSON) for easier catalog update triage.

## 2026-03-05 18:50 (local)

### Scope
- Re-sync README with current frontend/backend filter semantics and static build scope behavior.

### Changes
- Files:
  - `README.md`
  - `docs/REFACTOR_PROGRESS_LEDGER.md`
- Behavior impact:
  - Documented static default-vs-all catalog behavior explicitly (`--include-all-resorts`).
  - Clarified frontend filter semantics for `Default resorts only` (`include_default`) and `search_all`.
  - Clarified runtime API/filter scope note (Epic/Ikon-supported resort subset).

### Validation
- Commands:
  - `python3 -m src.cli static --output-html index.html`
  - `python3 -m pytest tests/frontend/test_assets.py -q`
- Results:
  - Static build passed (`Done: .cache/static_payload.json`, `Done: index.html`, `Done: 18 resort hourly page(s)`).
  - Frontend asset test passed (`2 passed`).

### Risks / Notes
- README reflects current behavior; any future expansion to include Indy-only runtime filtering should be documented again.

### Next Slice
- Optional: add a short README matrix for filter behavior across `serve` / `serve-web(api)` / fully static page.

## 2026-03-05 19:20 (local)

### Scope
- Add a recoverable refactor planning document for static main-page performance work.

### Changes
- Files:
  - `docs/STATIC_PAGE_PERFORMANCE_REFACTOR_PLAN.md`
  - `docs/REFACTOR_PROGRESS_LEDGER.md`
- Behavior impact:
  - No runtime behavior change.
  - Added a concrete shell-first, client-rendered main-page refactor plan aligned with current frontend/communication/backend boundaries.
  - Documented current bottlenecks, delivery slices, risks, and validation gate for the static-page speed theme.

### Validation
- Commands:
  - `python3 -m src.cli static --output-html index.html`
- Results:
  - Static render passed (`Done: .cache/static_payload.json`, `Done: index.html`, `Done: 18 resort hourly page(s)`).

### Risks / Notes
- This is a planning/doc slice only; implementation still pending.

### Next Slice
- Implement Slice 1 from `docs/STATIC_PAGE_PERFORMANCE_REFACTOR_PLAN.md` by converting the main page to shell-first HTML backed by `site/data.json`.

## 2026-03-05 19:27 (local)

### Scope
- Start the static-page performance refactor by converting the main page to shell-first HTML with deferred section-content loading.

### Changes
- Files:
  - `src/web/weather_html_renderer.py`
  - `src/web/weather_page_render_core.py`
  - `src/web/templates/weather_page.html`
  - `src/web/pipelines/static_site.py`
  - `src/web/pipelines/__init__.py`
  - `src/web/weather_page_server.py`
  - `src/cli.py`
  - `assets/js/weather_page.js`
  - `assets/css/weather_page.css`
  - `tests/frontend/test_renderers.py`
  - `tests/frontend/test_static_site_pipeline.py`
  - `tests/integration/test_gateway_render_integration.py`
  - `tests/integration/test_web_server.py`
  - `tests/smoke/test_static_pipeline_smoke.py`
  - `README.md`
  - `docs/REFACTOR_PROGRESS_LEDGER.md`
- Behavior impact:
  - Main page now serves a lightweight shell HTML and loads heavy section markup from `page-content.html`.
  - Static render now emits `page-content.html` alongside `index.html`.
  - Dynamic web server now serves `GET /page-content.html` for the main page shell bootstrap path.
  - Existing hourly page flow and `/api/data` contract remain unchanged.

### Validation
- Commands:
  - `python3 -m pytest tests/frontend/test_renderers.py tests/frontend/test_static_site_pipeline.py tests/integration/test_gateway_render_integration.py tests/integration/test_web_server.py tests/smoke/test_static_pipeline_smoke.py -q`
  - `python3 -m src.cli static --output-json /tmp/closesnow-static.json --output-html /tmp/closesnow-index.html`
  - `python3 -m compileall src`
  - `python3 -m pytest tests/smoke/test_dynamic_server_smoke.py -q`
  - `wc -c /tmp/closesnow-index.html /tmp/page-content.html`
- Results:
  - Targeted tests passed (`29 passed`).
  - Static render passed and emitted `Done: /tmp/page-content.html`.
  - `compileall` passed.
  - Dynamic smoke passed (`1 passed`).
  - Main shell size dropped to `4810` bytes while deferred content moved to `/tmp/page-content.html` (`239414` bytes).

### Risks / Notes
- This slice defers HTML transfer and DOM creation but does not yet convert the main page to true data-driven client rendering from `data.json`; that remains the next step.

### Next Slice
- Implement client-side row-model rendering so the shell loads payload data and rebuilds visible rows without fetching pre-rendered section HTML.

## 2026-03-05 19:36 (local)

### Scope
- Complete the static-page performance refactor by switching the main page from deferred HTML fragments to full browser-side payload rendering.

### Changes
- Files:
  - `assets/js/weather_page.js`
  - `src/web/weather_html_renderer.py`
  - `src/web/weather_page_render_core.py`
  - `src/web/pipelines/static_site.py`
  - `src/web/pipelines/__init__.py`
  - `src/web/weather_page_server.py`
  - `src/cli.py`
  - `tests/frontend/test_renderers.py`
  - `tests/frontend/test_static_site_pipeline.py`
  - `tests/frontend/test_assets.py`
  - `tests/integration/test_cli.py`
  - `tests/integration/test_gateway_render_integration.py`
  - `tests/integration/test_web_server.py`
  - `tests/smoke/test_static_pipeline_smoke.py`
  - `README.md`
  - `docs/FRONTEND_COMM_BACKEND_REFACTOR_GUIDE.md`
  - `docs/FRONTEND_BACKEND_FLOW_ARCHITECTURE.md`
  - `docs/STATIC_PAGE_PERFORMANCE_REFACTOR_PLAN.md`
  - `docs/REFACTOR_PROGRESS_LEDGER.md`
- Behavior impact:
  - Main page shell now bootstraps with a payload `dataUrl` and renders all visible sections fully in-browser from `weather_payload_v1`.
  - Removed the transitional `page-content.html` fetch path from static and dynamic main-page serving.
  - Main page filters now rerender visible rows from in-memory data rather than hiding/showing a pre-expanded DOM.
  - Simplified main-page runtime layout work to eliminate the previous high-cost row-sync path.

### Validation
- Commands:
  - `python3 -m pytest tests/frontend/test_renderers.py tests/frontend/test_static_site_pipeline.py tests/frontend/test_assets.py tests/integration/test_gateway_render_integration.py tests/integration/test_web_server.py tests/smoke/test_static_pipeline_smoke.py tests/smoke/test_dynamic_server_smoke.py -q`
  - `python3 -m pytest tests/frontend -q`
  - `python3 -m pytest tests/integration -q`
  - `python3 -m pytest tests/smoke -q`
  - `python3 -m src.cli static --output-json /tmp/closesnow-static.json --output-html /tmp/closesnow-index.html`
  - `python3 -m compileall src`
  - `wc -c /tmp/closesnow-index.html /tmp/closesnow-static.json`
- Results:
  - Targeted page/refactor tests passed (`29 passed`).
  - Frontend suite passed (`22 passed`).
  - Integration suite passed (`65 passed`).
  - Smoke suite passed (`3 passed`).
  - Static render passed (`Done: /tmp/closesnow-static.json`, `Done: /tmp/closesnow-index.html`, `Done: 18 resort hourly page(s)`).
  - `compileall` passed.
  - Final shell size remained small (`4811` bytes) with payload fetched separately from `/tmp/closesnow-static.json` (`245124` bytes).

### Risks / Notes
- Main page now depends on client-side JavaScript to render section content. This is an explicit tradeoff for performance and static/dynamic consistency.

### Next Slice
- None for this refactor theme; static-page performance refactor is complete for the planned scope.

## 2026-03-05 19:51 (local)

### Scope
- Recover GitHub Pages workflow after the static-page refactor so deploys validate the full published artifact set.

### Changes
- Files:
  - `.github/workflows/deploy-pages.yml`
  - `docs/REFACTOR_PROGRESS_LEDGER.md`
- Behavior impact:
  - GitHub Actions Pages build now writes `.nojekyll` into `site/`.
  - Workflow now fails fast if required static outputs are missing after `src.cli static`, including main page assets and generated resort hourly files.

### Validation
- Commands:
  - `sed -n '1,220p' .github/workflows/deploy-pages.yml`
  - `python3 -m pytest tests/frontend/test_static_site_pipeline.py tests/smoke/test_static_pipeline_smoke.py -q`
- Results:
  - Workflow definition updated to validate `site/index.html`, `site/data.json`, copied assets, and generated `site/resort/*/{index.html,hourly.json}` before upload.
  - Targeted static pipeline tests passed.

### Risks / Notes
- This recovery hardens the deploy workflow against missing-file regressions, but it does not retroactively fix already-published broken artifacts until the workflow runs again.

### Next Slice
- Optional: add a dedicated CI script for Pages artifact validation so local/manual and workflow checks share the same assertions.
