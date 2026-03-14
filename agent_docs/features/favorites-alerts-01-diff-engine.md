# Atomic Feature Request

## Request ID
- `favorites-alerts-01-diff-engine`

## Title
- Build static favorites alert diff engine

## Feature Branch
- `ljcc/feature/favorites-alerts`

## Dependencies
- None.

## Background
- The site already has local favorites, but nothing tells a returning user that one of those resorts materially changed since the last forecast they saw.
- Because deployment is primarily static, the alert core must work from browser state plus the latest generated payload, not from a server-side scheduler.

## Goal
- Define a client-side alert engine that:
- stores the last-seen forecast snapshot for each favorite resort
- evaluates current favorite forecasts against user-facing rule thresholds
- produces normalized alert items with severity, type, and timestamp fields
- can run on each payload refresh without needing backend persistence

## Constraints / Forbidden Behaviors
- Do not require server-side alert storage or cron jobs.
- Do not create noisy alerts for tiny forecast fluctuations that are not trip-relevant.
- Do not fork favorites into a second data model.
- Do not assume the user has notification permission.

## Acceptance Criteria
- [ ] Favorite resorts can be diffed against last-seen forecast snapshots entirely in the browser.
- [ ] Alert items have a stable client-side structure with severity and rule type, suitable for inbox UI and optional notifications.
- [ ] The diff engine is resilient to missing prior snapshots, removed favorites, and payload changes.
- [ ] Alerts are triggered by meaningful rule thresholds rather than every forecast delta.

## Test Plan
- `python3 -m pytest -q tests/frontend/test_assets.py tests/integration/test_web_server.py tests/integration/test_data_sources.py`
- `python3 -m src.cli static --output-dir /tmp/closesnow-favorites-alert-engine --max-workers 8`
