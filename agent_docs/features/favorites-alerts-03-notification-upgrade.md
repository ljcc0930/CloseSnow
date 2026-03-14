# Atomic Feature Request

## Request ID
- `favorites-alerts-03-notification-upgrade`

## Title
- Add progressive browser notification support

## Feature Branch
- `ljcc/feature/favorites-alerts`

## Dependencies
- `favorites-alerts-01-diff-engine`: requires stable alert generation and snapshot persistence.
- `favorites-alerts-02-alert-inbox`: requires user-visible alert controls and states before adding notification prompts.

## Background
- Some users will want a stronger signal than an inbox badge, but static deployment cannot guarantee server-driven push.
- Notification support therefore needs to be a progressive enhancement layered on top of the alert inbox, not a replacement for it.

## Goal
- Add optional browser-side notification behavior that can surface newly generated favorite alerts when the platform supports it.
- Where helpful, use a service worker or installable-site support only as an enhancement to improve delivery while staying within static-hosting limits.

## Constraints / Forbidden Behaviors
- Do not frame this slice as guaranteed background push on every browser or platform.
- Do not prompt for notification permission before the user has seen clear alert value.
- Do not make the core alert experience depend on service-worker registration success.
- Do not add a server requirement for VAPID, push subscriptions, or outbound messaging in version 1.

## Acceptance Criteria
- [ ] Users can opt into browser notification support after the inbox system already exists.
- [ ] Unsupported browsers or failed service-worker / notification setup degrade cleanly to the inbox-only experience.
- [ ] Notification copy maps back to the same alert items shown in the inbox rather than inventing a separate message model.
- [ ] Static deployment remains fully functional even when notification enhancement is unavailable.

## Test Plan
- `python3 -m pytest -q tests/frontend/test_assets.py tests/frontend/test_static_site_pipeline.py tests/integration/test_web_server.py`
- `python3 -m src.cli static --output-dir /tmp/closesnow-favorites-alert-notify --max-workers 8`
