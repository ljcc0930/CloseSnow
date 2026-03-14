# Atomic Feature Request

## Request ID
- `favorites-alerts-02-alert-inbox`

## Title
- Add favorites alert inbox and controls

## Feature Branch
- `ljcc/feature/favorites-alerts`

## Dependencies
- `favorites-alerts-01-diff-engine`: requires normalized alert items and stored snapshot state before UI can render unread or historical alerts.

## Background
- A static-compatible alert system needs a visible home in the product. Otherwise alerts only exist as hidden local state.
- The homepage already owns favorites and forecast browsing, so the first inbox surface should live there.

## Goal
- Add an alert inbox / digest surface tied to favorites that supports:
- unread and read states
- per-favorite alert visibility
- lightweight rule or threshold controls where needed
- clear “what changed” messaging linked back to the affected resort

## Constraints / Forbidden Behaviors
- Do not make alerts dependent on browser notification permission.
- Do not bury the only alert surface behind hard-to-discover controls.
- Do not let alert UI overwhelm the existing homepage controls.
- Do not mark alerts read implicitly in ways the user cannot understand.

## Acceptance Criteria
- [ ] Returning users can see unread favorite alerts directly from the homepage.
- [ ] Each alert clearly identifies the resort, the change, and the relevant forecast window.
- [ ] Users can review or dismiss alerts without breaking the underlying favorites model.
- [ ] The inbox experience works in static builds with no live backend.

## Test Plan
- `python3 -m pytest -q tests/frontend/test_assets.py tests/frontend/test_static_site_pipeline.py tests/integration/test_web_server.py`
- `python3 -m src.cli static --output-dir /tmp/closesnow-favorites-alert-inbox --max-workers 8`
