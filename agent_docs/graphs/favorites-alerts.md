# Favorites Alerts

## Summary
- Add a static-compatible alert system for favorited resorts that highlights meaningful forecast changes without requiring a live notification backend.
- Core behavior should work as an in-browser alert digest that compares the newest payload against the user’s last-seen favorite forecast snapshots; notification APIs are optional enhancement, not the foundation.

## Feature Branch
- `ljcc/feature/favorites-alerts`

## Global Assumptions
- Static deployment is primary, so email, SMS, and true push infrastructure are out of scope for version 1.
- Alert preferences and last-seen snapshots are per-browser state stored locally.
- The alert system should focus on actionable changes such as meaningful new snowfall, rain crossover, warming, or other trip-impacting forecast shifts.

## Atomic Requests
- `favorites-alerts-01-diff-engine`: Define alert rules, last-seen snapshot persistence, and the client-side diff engine.
- `favorites-alerts-02-alert-inbox`: Add homepage UI for unread favorite alerts, per-favorite preferences, and alert history visibility.
- `favorites-alerts-03-notification-upgrade`: Add progressive enhancement with browser notifications / service-worker assistance where supported.

## Dependency Graph
- `favorites-alerts-01-diff-engine` -> `favorites-alerts-02-alert-inbox`
- `favorites-alerts-01-diff-engine` -> `favorites-alerts-03-notification-upgrade`
- `favorites-alerts-02-alert-inbox` -> `favorites-alerts-03-notification-upgrade`

## Notes
- Treat the inbox/digest as the product core. Notification delivery should be optional because the static site cannot guarantee background push on every platform.
- Keep alerts tied to the existing favorites model instead of creating a second watchlist system.
