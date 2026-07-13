# Runtime And Static Delivery Architecture Refactor

## Summary
- Replace repeated weather runtime option forwarding with stable request objects, make the web asset inventory a single executable contract, and consolidate static fetch/render orchestration so split and one-shot builds produce the same deployable artifact tree.

## Feature Branch
- `ljcc/feature/runtime-static-architecture`

## Global Assumptions
- Public CLI flags, legacy Python entry points, payload JSON shape, cache key behavior, coordinate seed order, and generated route layout remain compatible unless an acceptance criterion explicitly closes a documented artifact gap.
- New core APIs may use typed value objects, while existing call signatures remain as thin compatibility adapters during this refactor.
- Untracked `reports/` content is outside the feature scope and must not be modified.

## Atomic Requests
- `runtime-static-architecture-01-runtime-options`: Introduce typed runtime and payload request contracts.
- `runtime-static-architecture-02-static-builder`: Unify split and one-shot static artifact builds.
- `runtime-static-architecture-03-asset-manifest`: Establish one executable web asset manifest.

## Dependency Graph
- `runtime-static-architecture-01-runtime-options` -> `runtime-static-architecture-02-static-builder`
- `runtime-static-architecture-03-asset-manifest` -> `runtime-static-architecture-02-static-builder`

## Notes
- The frontend layout monolith and catalog repository are valuable later refactors, but are intentionally excluded to avoid conflict with active feature graphs and to keep this branch centered on runtime/build delivery boundaries.
