# Atomic Feature Request

## Request ID
- `resort-airport-access-01-airport-catalog`

## Title
- Define airport catalog and nearby-airport selector

## Feature Branch
- `ljcc/feature/resort-airport-access`

## Dependencies
- None.

## Background
- Resort pages already have resort coordinates and static/dynamic data flows, but the repository does not yet have any airport dataset or shared helper for mapping a resort to nearby travel airports.
- Raw geocoder lookups are not a good v1 source because mountain areas often surface heliports, tiny local strips, or noisy place matches that are not useful for ski-trip planning.

## Goal
- Add a repository-managed airport catalog plus a backend helper that returns nearby commercial airports for a resort coordinate, sorted by increasing great-circle distance in miles and filtered to a 250-mile v1 radius.

## Constraints / Forbidden Behaviors
- Do not call external airport search or routing APIs at render time.
- Do not treat arbitrary geocoder airport results as the authoritative airport list for v1.
- Do not include heliports, private strips, or seaplane bases in the curated catalog unless product scope is explicitly broadened later.
- Do not couple the selector to browser-only code; downstream backend and static generation paths both need the same helper.

## Acceptance Criteria
- [ ] The repo includes a curated airport catalog artifact with stable ids/codes, display names, city/region labels, and coordinates for the airports needed by CloseSnow's supported resort set.
- [ ] A shared backend helper can load that catalog and return nearby airports for a resort coordinate, sorted nearest-first and filtered to airports within 250 miles.
- [ ] Each returned airport item includes enough stable data for downstream payload/UI work, including `airport_id`, `iata_code`, `display_name`, `location_label`, `latitude`, `longitude`, and numeric `distance_miles`.
- [ ] Automated coverage exercises distance calculation, sorting, radius filtering, and the no-airports-within-radius case.

## Test Plan
- Add targeted backend tests for the new airport catalog loader and proximity selector.
- Run `python3 -m pytest tests/backend/test_airport_catalog.py -q`.
- Spot-check one western resort and one eastern resort in a Python shell or targeted test fixture to confirm the selector returns plausible airport ordering.
