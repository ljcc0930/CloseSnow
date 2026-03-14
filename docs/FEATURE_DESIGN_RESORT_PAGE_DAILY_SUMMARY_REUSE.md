# Resort Page Daily Summary Reuse Design

Date: 2026-03-13
Status: proposed
Scope: reuse the main-page `Daily Summary` compact cell design on each per-resort hourly page, but only for the current resort.

## 1. Goal

Add a compact daily summary strip to each resort page so the user can see:

1. weather emoji
2. max / min temperature
3. snowfall
4. rainfall

for the current resort across forecast days, using the same visual language as the main-page `Daily Summary`.

This should avoid duplicating layout logic and should work for both:

1. dynamic resort pages
2. static `site/resort/<resort_id>/index.html` pages

## 2. Current State

Main page:

1. The compact day-cell renderer already exists in [`assets/js/weather_page.js`](/Users/ljcc/workspace/CloseSnow/assets/js/weather_page.js).
2. The key pieces are:
   - `_formatCompactValue(...)`
   - `_formatCompactTempValue(...)`
   - `_compactDailyCellHtml(day)`
   - compact day-cell background color selection
   - `_renderCompactGridSection(reports)`

Resort page:

1. The resort hourly page currently renders only hourly charts and an hourly table.
2. The page entrypoint is [`assets/js/resort_hourly.js`](/Users/ljcc/workspace/CloseSnow/assets/js/resort_hourly.js).
3. The shell template is [`src/web/templates/resort_hourly_page.html`](/Users/ljcc/workspace/CloseSnow/src/web/templates/resort_hourly_page.html).
4. The current resort-page payload context only contains hourly-oriented bootstrap data.

Important mismatch:

1. The main page renders from `report.daily[]`.
2. The resort hourly page renders from hourly payload and currently does not receive the same daily report shape.

Conclusion:

1. UI structure is reusable.
2. Data shape is not yet directly reusable.

## 3. Product Decision

Do not port the full split-table structure from the main page into the resort page.

Instead, add a single-resort compact daily summary strip:

1. no `Resort` left column
2. one row of forecast days
3. same compact cell layout as the main page
4. same day labels
5. same snowfall-vs-temperature background logic

This gives the resort page the same information density without dragging along unnecessary multi-resort table structure.

## 4. Reuse Strategy

## 4.1 What should be shared

Extract the compact daily cell renderer into a shared browser-side module.

Recommended shared responsibilities:

1. `formatCompactValue(value)`
2. `formatCompactTempValue(value)`
3. `compactDailyCellHtml(day)`
4. `compactDailyCellStyle(day)` or equivalent color-selection helper
5. optional `dayLabelForDailyItem(day, index)` if label logic should also be shared

Recommended file:

1. [`assets/js/compact_daily_summary.js`](/Users/ljcc/workspace/CloseSnow/assets/js/compact_daily_summary.js)

## 4.2 What should remain page-specific

Main page keeps:

1. resort-row assembly
2. split-table layout
3. favorite column
4. table scrolling / row-height sync logic

Resort page keeps:

1. hourly charts
2. hourly table
3. resort-page fetch/bootstrap logic
4. single-resort summary container render

This separation keeps the shared module small and avoids coupling the resort page to the main page layout engine.

## 5. Data Strategy

## 5.1 Preferred approach

Pass daily summary data into the resort page directly at page bootstrap time.

Recommended bootstrap addition:

1. `dailySummary`

Proposed shape:

```json
{
  "resortId": "snowbird-ut",
  "hourlyDataUrl": "./hourly.json",
  "dailySummary": {
    "query": "Snowbird, UT",
    "daily": [
      {
        "date": "2026-03-13",
        "weather_code": 3,
        "temperature_max_c": 6,
        "temperature_min_c": -4,
        "snowfall_cm": 0.0,
        "rain_mm": 0.0
      }
    ]
  }
}
```

Why this is preferred:

1. static resort pages remain self-contained
2. no extra fetch to main `data.json`
3. no need to scan all resorts to find one row
4. avoids mismatched caching between hourly and daily payloads

## 5.2 Fallback approach

If bootstrap payload growth becomes a concern, the resort page can fetch the main data payload and locate the matching report by `resort_id`.

This is less preferred because:

1. the resort page downloads more data than it needs
2. static page dependency graph becomes more complex
3. it adds another failure mode if `data.json` is missing or misrouted

## 6. Rendering Design

Add a new section near the top of the resort page:

1. title: `Daily Summary`
2. horizontally scrollable day columns
3. one compact day cell per forecast day

Recommended order on resort page:

1. back link
2. page title
3. daily summary strip
4. hourly controls
5. hourly charts
6. hourly table

This lets users scan the trip-level outlook before diving into hourly detail.

## 7. CSS Strategy

Reuse the existing compact daily cell CSS tokens and classes wherever possible.

Recommended options:

1. move shared compact-cell CSS into a shared block still housed in [`assets/css/weather_page.css`](/Users/ljcc/workspace/CloseSnow/assets/css/weather_page.css) only if the resort page also loads it
2. or copy only the compact-cell rules into [`assets/css/resort_hourly.css`](/Users/ljcc/workspace/CloseSnow/assets/css/resort_hourly.css) after extracting a clearly bounded block

Preferred approach:

1. copy a tightly scoped compact-cell block into `resort_hourly.css`
2. keep page-layout-specific CSS separate

Reason:

1. avoids forcing the resort page to load the full main-page stylesheet
2. preserves independence between main page and resort page shells

## 8. Files Likely To Change

Frontend shared render logic:

1. [`assets/js/compact_daily_summary.js`](/Users/ljcc/workspace/CloseSnow/assets/js/compact_daily_summary.js) (new)
2. [`assets/js/weather_page.js`](/Users/ljcc/workspace/CloseSnow/assets/js/weather_page.js)
3. [`assets/js/resort_hourly.js`](/Users/ljcc/workspace/CloseSnow/assets/js/resort_hourly.js)

Frontend styles:

1. [`assets/css/resort_hourly.css`](/Users/ljcc/workspace/CloseSnow/assets/css/resort_hourly.css)
2. optional cleanup in [`assets/css/weather_page.css`](/Users/ljcc/workspace/CloseSnow/assets/css/weather_page.css)

HTML/template/bootstrap:

1. [`src/web/templates/resort_hourly_page.html`](/Users/ljcc/workspace/CloseSnow/src/web/templates/resort_hourly_page.html)
2. [`src/web/pipelines/static_site.py`](/Users/ljcc/workspace/CloseSnow/src/web/pipelines/static_site.py)
3. [`src/web/weather_page_server.py`](/Users/ljcc/workspace/CloseSnow/src/web/weather_page_server.py)

Tests:

1. [`tests/frontend/test_assets.py`](/Users/ljcc/workspace/CloseSnow/tests/frontend/test_assets.py)
2. [`tests/frontend/test_static_site_pipeline.py`](/Users/ljcc/workspace/CloseSnow/tests/frontend/test_static_site_pipeline.py)
3. [`tests/integration/test_web_server.py`](/Users/ljcc/workspace/CloseSnow/tests/integration/test_web_server.py)

## 9. Validation Plan

Automated:

1. assert resort hourly page shell includes daily summary container
2. assert bootstrap context contains `dailySummary`
3. assert static resort page HTML references the new summary section
4. assert shared JS asset exports/contains compact summary helpers

Commands:

```bash
python3 -m pytest tests/frontend/test_assets.py tests/frontend/test_static_site_pipeline.py tests/integration/test_web_server.py -q
python3 -m src.cli static --output-html index.html
```

Manual:

1. open one dynamic resort page
2. open one static resort page
3. confirm the daily summary strip renders before hourly charts
4. confirm day-cell colors match main-page logic
5. confirm long resort pages still scroll well on mobile

## 10. Recommended Delivery Order

1. Extract shared compact day-cell JS helpers.
2. Add `dailySummary` bootstrap data to resort page generation.
3. Render a single-resort daily summary strip on the hourly page.
4. Add scoped CSS to `resort_hourly.css`.
5. Validate static and dynamic resort pages.

## 11. Decision Summary

Yes, the daily summary is worth reusing.

Best implementation path:

1. share the compact day-cell renderer
2. do not reuse the full multi-resort split-table wrapper
3. feed the resort page its own daily summary payload directly
4. render a single-resort horizontal daily summary strip above hourly content
