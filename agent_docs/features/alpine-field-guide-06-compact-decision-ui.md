# Atomic Feature Request

## Request ID
- `alpine-field-guide-06-compact-decision-ui`

## Title
- Build the compact decision interface

## Feature Branch
- `ljcc/feature/alpine-field-guide`

## Dependencies
- `alpine-field-guide-05-visual-hierarchy`: the complete Alpine Field Guide visual system and data-driven primary signals must already exist before this information-architecture refinement removes duplication.

## Background
- CloseSnow is a mountain-weather decision tool, not a forecast data gallery. Its homepage should answer “which mountain deserves attention?”, a resort page should answer “which day or weather window is useful?”, and raw daily/hourly data should remain available for verification.
- The current Preview presents all three information tiers at once. At 390×844 the first ordinary resort begins around 1826px, each resort card is roughly 715px tall, and the resort-detail masthead consumes roughly 777px before the daily forecast. The homepage also pre-renders every hidden daily detail for every result, duplicating information already available on resort pages.

## Goal
- Replace the stacked editorial presentation with a compact, summary-first decision interface that lets desktop and mobile users compare resorts immediately, then progressively reveal daily, hourly, travel, and raw-data detail only when they ask for it.

## Constraints / Forbidden Behaviors
- Preserve payload contracts, static/dynamic data loading, routes, search, clear, directory scope, favorites, pass/region filters, sorting, unit conversion, range refresh, hourly tabs, website/map/airport links, coordinate feedback, and all daily/hourly measurements.
- Homepage duplicate detail may move to the resort page, but weather condition, high/low, snow, rain, sunrise, sunset, history, 14-day forecast, and raw hourly metrics must remain reachable somewhere in the experience.
- Do not add a runtime framework, external UI kit, remote image, or new production service.
- Do not solve density by shrinking interactive targets below 44×44px, by clipping meaningful copy, by making essential mobile data horizontally scroll, or by hiding information with color alone.
- Do not wrap a whole resort card in a link because it contains independent favorite and navigation controls.
- Do not reintroduce a large hero, a separate oversized ranking section, nested card-on-card elevation, or pre-rendered hidden daily cards for every homepage result.
- Keep the Netlify configuration preview-only; do not trigger or enable a production deploy.

## Acceptance Criteria
- [ ] The interface consistently implements three information tiers: homepage comparison, resort decision planning, and deep verification data.
- [ ] The homepage replaces the large masthead and separate Morning Picks board with a compact report/search context followed immediately by the resort results.
- [ ] Desktop results are aligned, scannable rows; 390px results reflow into readable compact cards using the same semantic order. Each result includes favorite, resort/location/pass, today condition and high/low, the relevant seven-day precipitation signal, peak window or useful secondary value, and a clear resort-detail link.
- [ ] The first resort begins no lower than 340px at 1280×720 and no lower than 360px at 390×844; at least four complete desktop results and two complete mobile results are visible within their first viewport in representative static data.
- [ ] Homepage result cards are at most 120px tall on desktop and 210px tall at 390px, excluding intentionally opened controls.
- [ ] The homepage initially renders at most 12 resort results, provides an accessible “Show more” control when additional results exist, and resets the visible limit when search, filters, favorites-only, or sorting changes.
- [ ] The homepage no longer creates `.daily-detail-card` or full 14-day disclosure DOM for each result. Complete daily information is available on the corresponding resort page.
- [ ] Search, filters, sorting, favorites, unit switching, result count, loading, empty, missing-data, and error states remain functional with the compact results and pagination.
- [ ] The resort header becomes one compact decision summary. On mobile, the daily forecast begins no lower than 460px and the header still exposes resort identity, bottom-line guidance, today high/low, seven-day snow, seven-day rain, local time, website, and map.
- [ ] Daily planning defaults to Today plus the next six days in compact rows/cards. Days 8–14 and past days remain accessible through labeled progressive disclosures. Conditions, high/low, snow, rain, sunrise, and sunset remain available without relying on color.
- [ ] At 390px, daily planning uses vertical rows rather than a tall 28-card horizontal rail. At desktop widths it remains aligned and scan-friendly without requiring horizontal scrolling for essential values.
- [ ] Hourly controls and narrative are compact. Tabs read “Precipitation”, “Wind”, and “Visibility & depth”; keyboard tab behavior remains intact; the tabpanel is not an `aria-live` region.
- [ ] Desktop hourly charts use available width efficiently. At 390px one chart occupies the primary vertical slot and additional charts are reachable through an explicit, accessible horizontal snap region without stacking the whole group vertically.
- [ ] Airport/travel information and the complete hourly table remain available as clearly labeled, closed-by-default disclosures. The raw table keeps all metrics and supports horizontal inspection without expanding the default page height.
- [ ] All interactive controls have a minimum 44px touch target; visible focus, reduced motion, forced colors, missing values, long resort names, and honest snow/rain/quiet/unavailable labels remain supported.
- [ ] At 390px, 768px, and desktop widths there is no page-level horizontal overflow, no layout shift caused by hover transforms, and no browser console error or warning.

## Test Plan
- Update renderer/style tests to assert compact templates, absence of homepage daily-detail DOM, 12-result pagination, honest signal summaries, progressive daily/travel/raw disclosures, hourly tab labels, and accessibility semantics.
- Exercise search, clear, filters, sort, favorites-only, favorite persistence/focus, Show more, unit switching, daily disclosures, hourly range refresh, tabs by click and keyboard, chart navigation, and raw-data disclosure.
- Run `python3 scripts/lint_assets.py`, `python3 -m ruff check .`, and the full test suite.
- Run `python3 -m src.cli static --output-dir <output-dir> --max-workers 8 --include-all-resorts` and inspect representative snow-led, rain-led, quiet, and missing-data resorts.
- Browser-check homepage and resort detail at 390×844, 768px, and desktop widths against the geometry targets, overflow, touch target, console, and responsive acceptance criteria.
