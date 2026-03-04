# CloseSnow Feature Design (Full-Info Personal Use)

Date: 2026-03-04  
Scope: Based on current CloseSnow architecture and existing Open-Meteo integration.

## 1. Goal

Build a "full-information" ski weather product (not decision simplification).  
Principle: expose more data dimensions while keeping current static + dynamic flows compatible.

## 2. Current Baseline (from existing code)

Current weather API usage (`src/backend/open_meteo.py`):
- Endpoint: `https://api.open-meteo.com/v1/forecast`
- Model: `ecmwf_ifs025`
- Daily fields already requested:
  - `snowfall_sum`
  - `rain_sum`
  - `precipitation_sum`
  - `temperature_2m_max`
  - `temperature_2m_min`

Current payload and page:
- Contract: `weather_payload_v1`
- Main page renders 3 sections only: snowfall, rainfall, temperature.
- Daily column labels are generic (`today`, `day 2`, ...), not concrete dates.

## 3. Cross-Feature Architecture Decisions

Before implementing all 7 features, use these shared rules:

1. Contract strategy:
- Keep backward compatibility for `/api/data`.
- Add optional fields first (compatible with current validator).
- If top-level shape changes significantly (hourly page payload split), add `weather_payload_v2` and dual-read support.

2. Resort identity:
- Introduce stable `resort_id` (slug) for filtering, routing, hourly pages.
- Keep `query` for backward compatibility and display.

3. Data source expansion:
- Migrate resort source from `resorts.txt` to `resorts.yml` (with metadata).
- Keep `.txt` compatibility during migration window.

4. Routing:
- Keep current routes:
  - `/`
  - `/api/data`
  - `/api/health`
- Add hourly route pair:
  - `/api/resort-hourly?resort_id=<id>&hours=72`
  - `/resort/<id>`

## 4. Feature-Level Design

---

## F1. `weather_code` (emoji display instead of code)

### Backend implementation

Files:
- `src/backend/open_meteo.py`
- `src/backend/report_builder.py`

Changes:
1. Add `weather_code` to `daily` request in both `fetch_forecast()` and `fetch_history()`.
2. Extend `build_daily_rows()` to include `weather_code` per day.
3. Keep raw numeric code in payload (frontend maps code -> emoji).

Payload additions (per daily item):
- `weather_code: int | null`

### Frontend implementation

Files:
- `src/web/weather_report_transform.py`
- `src/web/weather_table_renderer.py`
- `src/web/templates/weather_page.html`
- New: `src/web/weather_code_emoji.py` (or equivalent mapping module)

Changes:
1. Add weather section/table (one emoji cell per day per resort), or add weather row into temperature block.
2. Map WMO code to emoji in frontend render layer:
   - `0 -> ☀️`
   - `1/2 -> 🌤️/⛅`
   - `3 -> ☁️`
   - `45/48 -> 🌫️`
   - `51/53/55/56/57 -> 🌦️`
   - `61/63/65/80/81/82 -> 🌧️`
   - `71/73/75/77/85/86 -> ❄️`
   - `95/96/99 -> ⛈️`
   - unknown -> `❓`
3. Add tooltip/title with original code for debugging.

### Validation (Executable)

Automated checks:
1. Add/update tests:
- `tests/backend/test_report_builder.py` (weather_code parse + null handling)
- `tests/frontend/test_renderers.py` (emoji mapping + fallback `❓`)
2. Run:

```bash
pytest -q tests/backend/test_report_builder.py tests/frontend/test_renderers.py
```

API and contract checks:

```bash
python3 -m src.cli fetch --output-json site/data.json
jq '.reports[0].daily[0] | {date, weather_code}' site/data.json
```

Expected:
- each `daily` item contains `weather_code`
- value type is number or `null`

Static render checks:

```bash
python3 -m src.cli static --output-html index.html
rg -n "☀️|⛅|☁️|🌧️|❄️|⛈️|❓" index.html
```

Expected:
- emoji appears in rendered weather cells
- unknown/unsupported code renders as `❓`

Pass criteria:
- automated tests pass
- payload includes `weather_code`
- static HTML includes emoji rendering

---

## F2. `sunrise/sunset` (temperature-like presentation)

### Backend implementation

Files:
- `src/backend/open_meteo.py`
- `src/backend/report_builder.py`

Changes:
1. Add `sunrise,sunset` to daily request.
2. In report builder, store both raw ISO and display-friendly `HH:MM`:
   - `sunrise_iso`
   - `sunset_iso`
   - `sunrise_local_hhmm`
   - `sunset_local_hhmm`

Payload additions (per daily item):
- `sunrise_local_hhmm: str | null`
- `sunset_local_hhmm: str | null`

### Frontend implementation

Files:
- `src/web/weather_report_transform.py`
- `src/web/weather_table_renderer.py`
- New: `src/web/desktop/sun_renderer.py` (optional, same pattern as temperature)

Changes:
1. Add a new "Sunrise/Sunset" section.
2. Layout follows temperature pattern:
   - left: resort
   - right: each day has 2 sub-columns (`sunrise`, `sunset`)
3. Unit toggle not required for this section.

### Validation (Executable)

Automated checks:
1. Add/update tests:
- `tests/backend/test_report_builder.py` (sunrise/sunset parse and `HH:MM` formatting)
- `tests/frontend/test_renderers.py` (sunrise/sunset table shape, 2 columns per day)
2. Run:

```bash
pytest -q tests/backend/test_report_builder.py tests/frontend/test_renderers.py
```

API and contract checks:

```bash
python3 -m src.cli fetch --output-json site/data.json
jq '.reports[0].daily[0] | {date, sunrise_local_hhmm, sunset_local_hhmm}' site/data.json
```

Expected:
- `sunrise_local_hhmm` and `sunset_local_hhmm` exist
- values are `HH:MM` string or `null`

Static render checks:

```bash
python3 -m src.cli static --output-html index.html
rg -n "Sunrise|Sunset|sunrise|sunset" index.html
```

Expected:
- sunrise/sunset section exists
- each day shows two sub-columns (`sunrise`, `sunset`)

Pass criteria:
- automated tests pass
- payload includes sunrise/sunset fields
- static HTML shows sunrise/sunset table

---

## F3. Per-resort hourly standalone page

Required metrics:
- `snowfall`
- `rain`
- `precipitation_probability`
- `snow_depth`
- `wind_speed_10m`
- `wind_direction_10m`
- `visibility`

### Backend implementation

Files:
- `src/backend/open_meteo.py`
- `src/backend/weather_data_server.py`
- New: `src/backend/hourly_payload_builder.py`
- New/updated contract file(s)

Changes:
1. Add hourly fetch path for one resort:
   - reuse Open-Meteo forecast endpoint with `hourly=` fields above.
2. Add new endpoint:
   - `GET /api/resort-hourly?resort_id=<id>&hours=72`
3. Response includes:
   - `resort_id`
   - `query`
   - `timezone`
   - `model`
   - `hourly.time[]`
   - hourly arrays for required metrics
4. Visibility note:
   - with `models=ecmwf_ifs025`, `visibility` may be null.
   - design choice: keep ECMWF + null-safe UI, or use `best_match` for hourly endpoint (recommended if visibility is mandatory).

### Frontend implementation

Files:
- `src/web/weather_page_server.py`
- New: `src/web/hourly_page_render_core.py`
- New: `src/web/templates/resort_hourly_page.html`
- New assets:
  - `assets/css/resort_hourly.css`
  - `assets/js/resort_hourly.js`

Changes:
1. Add route rendering:
   - `GET /resort/<resort_id>` -> hourly page template.
2. Hourly page pulls `/api/resort-hourly`.
3. UI structure:
   - metric selector (chips/tabs)
   - hourly table + mini line chart (optional first version)
   - date and local timezone clearly shown
4. Main list page links each resort row to its hourly page.

### Validation (Executable)

Automated checks:
1. Add/update tests:
- `tests/integration/test_backend_data_server.py` (`/api/resort-hourly` contract + invalid `resort_id`)
- `tests/integration/test_web_server.py` (`/resort/<id>` route rendering)
- `tests/frontend/test_renderers.py` or dedicated hourly renderer tests
2. Run:

```bash
pytest -q tests/integration/test_backend_data_server.py tests/integration/test_web_server.py tests/frontend/test_renderers.py
```

API checks:
1. Start backend API:

```bash
python3 -m src.cli serve-data --host 127.0.0.1 --port 8020
```

2. In another terminal:

```bash
curl -s "http://127.0.0.1:8020/api/resort-hourly?resort_id=steamboat-co&hours=72" | jq '{resort_id, timezone, model, hourly_keys:(.hourly|keys)}'
curl -s "http://127.0.0.1:8020/api/resort-hourly?resort_id=invalid-id&hours=72" | jq '.'
```

Expected:
- valid request contains all required keys:
  - `snowfall`, `rain`, `precipitation_probability`, `snow_depth`, `wind_speed_10m`, `wind_direction_10m`, `visibility`
- invalid resort id returns clear 4xx error payload

Static and route checks:

```bash
python3 -m src.cli static --output-html index.html
rg -n "/resort/" index.html
```

Expected:
- main list has links to `/resort/<id>`
- static build remains successful

Pass criteria:
- automated tests pass
- hourly endpoint contract is stable
- UI route and metric rendering are correct
- null-safe behavior verified by automated tests and API checks

---

## F4. Resort filter modal (pass type / East-West / country)

### Backend implementation

Files:
- `src/backend/weather_data_server.py`
- `src/backend/pipeline.py`
- New: `src/backend/resort_catalog.py`

Changes:
1. Extend `/api/data` query support:
   - `pass_type=ikon|epic|indy` (multi-value allowed)
   - `region=east|west`
   - `country=US|CA|...`
2. Server filters resort candidates before weather fetch.
3. Add payload filter metadata for UI:
   - `available_filters` (counts by pass/region/country)
   - `applied_filters`

### Frontend implementation

Files:
- `src/web/templates/weather_page.html`
- `assets/js/weather_page.js`
- `assets/css/weather_page.css`

Changes:
1. Add "Filters" button near header.
2. Modal contents:
   - pass type checkboxes
   - region selector
   - country selector
3. On apply:
   - sync to URL query params
   - reload `/api/data` with filters (dynamic mode)
   - static mode fallback: client-side filtering from already loaded payload
4. Show active filter chips and clear-all action.

### Validation (Executable)

Automated checks:
1. Add/update tests:
- `tests/integration/test_backend_data_server.py` (multi-value filter query parsing)
- `tests/integration/test_web_server.py` (query passthrough and payload filtering)
- `tests/frontend/test_renderers.py` (filter modal presence/state markers)
2. Run:

```bash
pytest -q tests/integration/test_backend_data_server.py tests/integration/test_web_server.py tests/frontend/test_renderers.py
```

API checks:
1. Start dynamic server:

```bash
python3 -m src.cli serve --host 127.0.0.1 --port 8010 --max-workers 8
```

2. In another terminal:

```bash
curl -s "http://127.0.0.1:8010/api/data?pass_type=ikon&region=west&country=US" | jq '{resorts_count, applied_filters, available_filters}'
```

Expected:
- `applied_filters` matches request
- result set is filtered (resort count decreases or changes accordingly)
- `available_filters` is present for UI population

Static render checks:

```bash
python3 -m src.cli static --output-html index.html
rg -n "Filters|filter-modal|pass_type|region|country" index.html
```

Expected:
- filter entry point and modal markup are present in static HTML

Pass criteria:
- automated tests pass
- API filter behavior is correct
- static HTML includes filter UI

---

## F5. Resort attributes + migrate list to YAML + search

### Backend implementation

Files:
- New data file: `data/resorts.yml`
- `src/backend/pipeline.py`
- `src/backend/compute/resort_selection.py`
- New: `src/backend/resort_catalog.py`
- `src/shared/config.py`

Changes:
1. Introduce YAML catalog schema (example):
   - `id`
   - `name`
   - `aliases[]`
   - `country`
   - `state`
   - `region` (`east`/`west`)
   - `pass_types[]` (`ikon`/`epic`/`indy`)
   - `latitude` / `longitude` (optional override)
2. Loader reads YAML and returns normalized catalog entities.
3. Keep `.txt` backward compatibility:
   - if file extension is `.txt`, use old reader.
4. Add backend search helper:
   - search by `name`, `alias`, `id` (case-insensitive contains / token match).

Dependency:
- Add `PyYAML` dependency if YAML parser is used.

### Frontend implementation

Files:
- `src/web/templates/weather_page.html`
- `assets/js/weather_page.js`
- `assets/css/weather_page.css`

Changes:
1. Add search input for resorts:
   - supports fuzzy matching by name/alias/id.
2. Optional suggestion dropdown.
3. Add resort badges in list:
   - pass tags, region, country.

### Validation (Executable)

Automated checks:
1. Add/update tests:
- `tests/backend/test_pipeline.py` and/or new `tests/backend/test_resort_catalog.py` (YAML parse + schema validation)
- search matching tests (name/alias/id)
- frontend search behavior tests in `tests/frontend/test_renderers.py` (or new UI test file)
2. Run:

```bash
pytest -q tests/backend/test_pipeline.py tests/backend/test_compute_modules.py tests/frontend/test_renderers.py
```

Data source checks:

```bash
python3 -m src.cli fetch --resorts-file data/resorts.yml --output-json site/data.json
jq '{resorts_count, failed_count}' site/data.json
```

Expected:
- YAML file loads successfully via pipeline
- fetch succeeds with stable `resorts_count` and low/expected `failed_count`

Search checks:
1. If backend search endpoint/query is added:

```bash
curl -s "http://127.0.0.1:8010/api/data?search=snowbird" | jq '{resorts_count}'
```

2. If search is frontend-only:
- verify client-side filtering against loaded payload (same search term gives matching rows)

Static render checks:

```bash
python3 -m src.cli static --output-html index.html
rg -n "search|resort-search|pass|region|country" index.html
```

Expected:
- search input and metadata badges exist in static HTML

Pass criteria:
- automated tests pass
- YAML pipeline works
- search works for name/alias/id

---

## F6. Include all Ikon + Epic + Indy resorts

### Backend implementation

Files:
- `data/resorts.yml`
- New: `scripts/sync_resorts_catalog.py` (recommended)

Changes:
1. Expand catalog to full pass coverage:
   - Ikon / Epic / Indy all resorts.
2. Deduplicate by:
   - canonical name + coordinates.
3. Guarantee each entry has:
   - `id`, `country`, `region`, `pass_types`.
4. Add validation script:
   - duplicate IDs
   - missing required fields
   - geocode failures

### Frontend implementation

Files:
- `assets/js/weather_page.js`
- `assets/css/weather_page.css`

Changes:
1. Handle larger list performance:
   - pagination or virtualized table rendering.
2. Add pass count summary in filter UI.
3. Keep default initial view manageable:
   - e.g. show favorite resorts first, then expand.

### Validation (Executable)

Automated checks:
1. Add/update tests:
- catalog integrity tests (`duplicate ids`, `missing required fields`, `invalid pass_types`)
- large-catalog loading tests in backend pipeline
2. Run:

```bash
pytest -q tests/backend/test_pipeline.py tests/backend/test_compute_modules.py tests/backend/test_service_pipelines.py
```

Catalog validation checks:

```bash
python3 scripts/sync_resorts_catalog.py --validate-only
python3 -m src.cli fetch --resorts-file data/resorts.yml --output-json site/data.json
jq '{resorts_count, failed_count}' site/data.json
```

Expected:
- validation script returns success
- `resorts_count` includes full Ikon + Epic + Indy coverage
- `failed_count` is within expected threshold

Pass coverage audit:

```bash
python3 - <<'PY'
import yaml, collections
from pathlib import Path
catalog = yaml.safe_load(Path("data/resorts.yml").read_text(encoding="utf-8"))
counter = collections.Counter()
for r in catalog.get("resorts", []):
    for p in r.get("pass_types", []):
        counter[p] += 1
print(counter)
assert counter["ikon"] > 0 and counter["epic"] > 0 and counter["indy"] > 0
PY
```

Static render checks:

```bash
python3 -m src.cli static --output-html index.html
rg -n "ikon|epic|indy" index.html
```

Expected:
- pass-related UI/filter labels remain visible after scale-up

Performance smoke checks:

```bash
pytest -q tests/smoke/test_dynamic_server_smoke.py tests/smoke/test_static_pipeline_smoke.py
```

Expected:
- smoke tests pass on expanded catalog
- interaction-related rendering paths stay stable under larger payloads

Pass criteria:
- catalog integrity tests pass
- full pass coverage verified
- static render succeeds
- smoke tests pass under larger dataset

---

## F7. Show concrete dates in list columns

### Backend implementation

Files:
- `src/backend/compute/payload_metadata.py` (optional enhancement)
- `src/backend/report_builder.py` (already has per-day date)

Changes:
1. Reuse existing `daily[].date` (already present).
2. Add optional top-level `display_dates[]` for stable header generation.

### Frontend implementation

Files:
- `src/web/split_metric_renderer.py`
- `src/web/desktop/temperature_renderer.py`
- `src/web/weather_report_transform.py`

Changes:
1. Replace `today/day N` labels with real dates:
   - e.g. `03-04 Wed`, `03-05 Thu`.
2. Keep fallback:
   - if date unavailable, keep old labels.
3. Apply to snowfall/rainfall/temperature (and sunrise/weather_code sections after they are added).

### Validation (Executable)

Automated checks:
1. Add/update tests:
- `tests/frontend/test_renderers.py` (date header format `MM-DD Ddd`)
- fallback test when date missing (`today/day N` fallback)
2. Run:

```bash
pytest -q tests/frontend/test_renderers.py tests/frontend/test_styles_and_transform.py
```

Data checks:

```bash
python3 -m src.cli fetch --output-json site/data.json
jq '.reports[0].daily[0:3] | map(.date)' site/data.json
```

Expected:
- daily dates exist and are valid source for header labels

Static render checks:

```bash
python3 -m src.cli static --output-html index.html
rg -n "[0-9]{2}-[0-9]{2} (Mon|Tue|Wed|Thu|Fri|Sat|Sun)" index.html
```

Expected:
- concrete date labels appear in rendered table headers
- generic-only labels (`today`, `day 2`, ...) are not the primary header mode when date is available

Pass criteria:
- frontend tests pass
- static HTML contains concrete dates
- fallback behavior verified by tests

---

## 5. Simple -> Hard Ranking (recommended implementation order)

Order below considers both complexity and dependency:

1. **F7 列表显示具体日期**  
   - Lowest risk, mostly presentation layer.
2. **F1 weather_code + emoji**  
   - Small API field addition + straightforward frontend mapping.
3. **F2 sunrise/sunset**  
   - Similar to temperature table pattern, moderate UI work.
4. **F5 resorts.yml + 属性 + 搜索基础**  
   - Foundation for filter and large catalog.
5. **F4 过滤弹框（pass/东西部/国家）**  
   - Depends on F5 metadata foundation.
6. **F6 全量接入 Ikon/Epic/Indy 雪场**  
   - Data engineering and scalability concerns.
7. **F3 每个雪场 hourly 独立页面**  
   - New endpoint, new page route/template/assets, most integration effort.

## 6. Suggested Delivery Milestones

Milestone A (quick wins):
- F7 -> F1 -> F2

Milestone B (catalog foundation + filter):
- F5 -> F4

Milestone C (scale + deep drilldown):
- F6 -> F3

## 7. Acceptance Criteria Snapshot

1. `/api/data` remains backward compatible for existing static/dynamic rendering.
2. Page shows concrete dates for all day columns.
3. Weather section displays emoji, not numeric weather code.
4. Sunrise/sunset section renders per-resort daily pairs.
5. Filter modal can filter by pass type, East/West, country.
6. Resort catalog is YAML-based with searchable metadata.
7. Ikon/Epic/Indy catalog coverage is complete and validated.
8. `/resort/<id>` hourly page works with required hourly metrics.

## 8. Per-Feature Completion Gate (Mandatory)

For each feature (F1-F7), mark as complete only when all checks pass:

1. Code implemented (backend + frontend as scoped).
2. Feature-specific automated tests pass.
3. API/contract command checks pass.
4. Static render regenerated (`python3 -m src.cli static --output-html index.html`).
5. Static HTML contains expected feature output.
6. Progress entry appended to `docs/REFACTOR_PROGRESS_LEDGER.md` (scope/files/validation/results/next slice).
7. Changes committed locally with a clear message.
8. Do not push in this pipeline unless explicitly requested in a separate step.
