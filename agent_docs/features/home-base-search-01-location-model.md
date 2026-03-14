# Atomic Feature Request

## Request ID
- `home-base-search-01-location-model`

## Title
- Define home-base state and lookup contract

## Feature Branch
- `ljcc/feature/home-base-search`

## Dependencies
- None.

## Background
- The homepage already exposes resort coordinates indirectly through the payload, but there is no concept of a user origin or any shareable state for “show me mountains near where I am.”
- Because the site is primarily static, the core home-base flow needs a client-side contract that works without a live app server or route API.

## Goal
- Introduce one normalized client-side `homeBase` model with these supported sources:
- browser geolocation
- bundled lookup selection for US ZIP / city-style entries
- manual latitude / longitude entry
- Define the persistence contract for that model in query params and local storage so the same home base can survive reloads and produce shareable URLs.
- Ship or derive the minimum static lookup asset needed for the supported location search flow.

## Constraints / Forbidden Behaviors
- Do not require a CloseSnow backend endpoint just to resolve the home base.
- Do not promise exact drive time in this slice.
- Do not make the homepage unusable when geolocation permission is denied or unavailable.
- Do not bake mutable user state into generated static files.

## Acceptance Criteria
- [ ] A single normalized `homeBase` object shape is documented and implemented for query-string, local-storage, and in-memory use.
- [ ] Users can set a home base from geolocation or a static lookup-backed text flow, with manual coordinate fallback.
- [ ] Reloading the page restores the last valid home base without corrupting existing search/filter behavior.
- [ ] Shared URLs can reproduce the same home base state on another browser without server-side session state.

## Test Plan
- `python3 -m pytest -q tests/frontend/test_assets.py tests/integration/test_web_server.py`
- `python3 -m src.cli static --output-dir /tmp/closesnow-home-base-model --max-workers 8`
