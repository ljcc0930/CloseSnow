# CloseSnow Feature Design: Compact Daily Grid Table

Date: 2026-03-13  
Owner: CloseSnow main forecast page

## 1. Goal

Add a new high-density summary table at the top of the main page.

This table should present each resort's daily forecast in a single fixed-layout cell that combines:
- weather
- temperature
- snowfall
- rainfall
- sunrise
- sunset

The new table is an additive overview layer:
- it appears before the existing section tables
- it does not replace Snowfall / Rainfall / Temperature / Weather / Sunrise-Sunset sections

## 2. Product Intent

Current page structure is good for metric-by-metric comparison, but it requires users to scan multiple sections to understand one resort/day.

The new table should optimize for:
- one-cell full context
- fast resort-by-resort scanning
- consistent daily visual structure across 14 days

This is a compact "all-in-one daily card grid", rendered as a table.

## 3. In Scope

- new top-of-page compact forecast table
- one fixed-format cell per resort per day
- 14-day horizontal layout
- reuse existing payload fields
- desktop-first layout

## 4. Out of Scope

- replacing existing section tables
- adding a view toggle
- changing backend payload contract
- hourly-page redesign
- mobile-specific redesign beyond graceful overflow

## 5. Placement

Insert the new table near the top of the main page:

1. page title / controls
2. new compact daily grid table
3. existing section tables:
   - Snowfall
   - Rainfall
   - Temperature
   - Weather
   - Sunrise / Sunset

## 6. Cell Structure

Each day cell has a fixed three-row structure.

### Row 1: Weather + Temperature

Priority: highest

Layout:
- left: weather icon
- right: stacked temperatures
  - top-right: max temperature
  - bottom-right: min temperature

Reference structure:

```text
[ weather icon ]   [ high temp ]
                  [ low temp  ]
```

Rules:
- weather icon is visually dominant on the left
- max temperature uses stronger emphasis than min temperature
- temperature must remain stacked, not inline `high / low`

### Row 2: Snow + Rain

Priority: medium

Layout:
- left: snowfall icon + value
- right: rainfall icon + value

Reference structure:

```text
[ snow icon  value ] [ rain icon  value ]
```

Rules:
- left/right widths should be balanced
- both sides use icon + numeric value
- use existing units already shown on page:
  - snow: `cm` / unit-converted if needed later
  - rain: `mm`

### Row 3: Sunrise + Sunset

Priority: lowest

Layout:
- left: sunrise icon + time
- right: sunset icon + time

Reference structure:

```text
[ sunrise icon time ] [ sunset icon time ]
```

Rules:
- visual weight should be lighter than rows 1 and 2
- same fixed layout even when values are missing

## 7. Missing Data Rules

If a field is missing:
- keep the icon slot and layout
- render the value as `--`

Examples:
- missing weather code -> `?` or fallback weather icon
- missing temperature -> `--`
- missing snow/rain -> `--`
- missing sunrise/sunset -> `--`

Do not collapse any row or side when data is missing.

## 8. Layout Requirements

## 8.1 Table Shape

The table structure should be:
- left frozen resort column
- right horizontally scrollable day columns

Each day column uses:
- fixed width
- fixed height
- identical layout for all resorts and all days

## 8.2 Cell Sizing

Suggested target:
- width: `150px` to `170px`
- height: `88px` to `96px`

Requirements:
- width and height must stay fixed
- content density should be high but readable
- no cell should grow taller because one day has different content

## 8.3 Alignment

Must be visually explicit:
- left content aligns left
- right content aligns right
- top/bottom stacking in temperature block is obvious
- row spacing is tight but not crowded

## 8.4 Visual Hierarchy

Required hierarchy:

1. Row 1: Weather + Temperature
- strongest emphasis
- largest text / highest contrast

2. Row 2: Snow + Rain
- medium emphasis
- clear but secondary

3. Row 3: Sunrise + Sunset
- lowest emphasis
- smaller text / lighter color

## 9. Interaction and Behavior

The new compact table should:
- participate in existing filtering
- participate in existing resort favorites behavior
- use the same resort ordering as the rest of the page

This means:
- if visible reports change, the compact table rerenders from the same filtered report list
- favorite column behavior should match the current page pattern

## 10. Frontend Data Mapping

Use existing report payload fields:

From `report.daily[]`:
- `weather_code`
- `temperature_max_c`
- `temperature_min_c`
- `snowfall_cm`
- `rain_mm`
- `sunrise_local_hhmm`
- `sunset_local_hhmm`
- fallback:
  - `sunrise_iso`
  - `sunset_iso`

Day label:
- reuse existing day label formatting (`MM-DD + weekday`)

## 11. Rendering Strategy

## 11.1 Browser Renderer

Primary implementation should be in browser-side rendering, since the page already rerenders from payload JSON.

Recommended file:
- `assets/js/weather_page.js`

Suggested responsibilities:
- build compact table header from visible day labels
- build resort rows from visible reports
- render one structured daily cell per day

## 11.2 Python Static Render Compatibility

To keep static shell and browser rerender aligned, add a matching Python renderer.

Suggested files:
- new renderer module under `src/web/`
- wire it into page HTML builder so static shell includes the compact table section

This does not need to be a separate backend concern; it is frontend rendering.

## 11.3 CSS Layout Strategy

Recommended CSS approach:
- overall table stays split-layout like existing sections
- daily cell uses internal CSS grid

Suggested daily cell internal grid:

```text
row 1: weather | temperature stack
row 2: snow    | rain
row 3: sunrise | sunset
```

Implementation hint:
- outer cell container:
  - `display: grid`
  - `grid-template-rows: auto auto auto`
- each row:
  - `display: grid`
  - `grid-template-columns: 1fr 1fr`
or for row 1:
  - `grid-template-columns: auto 1fr`

## 12. Accessibility

Requirements:
- weather icon should have accessible text via `title` or hidden label
- temperatures remain readable even without color
- sunrise/sunset icons are not the only signal; text labels or clear semantics remain
- missing values rendered as `--` should be screen-reader-safe

## 13. Suggested Files to Change

Likely implementation files:
- `src/web/templates/weather_page.html`
- `src/web/weather_html_renderer.py`
- `src/web/weather_page_render_core.py`
- new renderer module, e.g.:
  - `src/web/compact_daily_grid_renderer.py`
- `assets/js/weather_page.js`
- `assets/css/weather_page.css`
- tests:
  - `tests/frontend/test_renderers.py`
  - `tests/frontend/test_assets.py`
  - optional additional renderer test file

## 14. Validation Plan

## 14.1 Automated Tests

Add/update tests for:
- compact table section presence
- fixed row structure inside each daily cell
- fallback `--` rendering for missing values
- weather icon + stacked temperature markup
- snow/rain icon + value markup
- sunrise/sunset icon + time markup

Suggested command:

```bash
python3 -m pytest tests/frontend/test_renderers.py tests/frontend/test_assets.py -q
```

## 14.2 Static Render Checks

```bash
python3 -m src.cli static --output-html index.html
rg -n "compact|sunrise|sunset|snow|rain|weather" index.html
```

Expected:
- top-level compact table section exists
- daily cell structure is rendered into static HTML

## 14.3 Manual Checks

Verify:
- the new table appears before existing metric sections
- each day cell keeps the same height and width
- all 14 days can be horizontally scanned
- missing values show `--`
- visual hierarchy matches requirements

## 15. Acceptance Criteria

This feature is complete when:

1. A new compact all-information table appears at the top of the page.
2. Each resort/day cell always renders the same three-row layout.
3. Row 1 shows weather + stacked max/min temperature.
4. Row 2 shows snowfall + rainfall with icon + value.
5. Row 3 shows sunrise + sunset with icon + time.
6. Missing data renders as `--` without collapsing structure.
7. Cell sizes remain fixed and visually scannable across 14 days.
8. Existing filters/favorites/orderings apply to the new table as well.

## 16. Implementation Order

Recommended slice order:

1. Build a single-cell HTML prototype in CSS/JS
2. Build one resort row across all days
3. Add full compact table section
4. Add Python static renderer parity
5. Add tests and spacing polish
