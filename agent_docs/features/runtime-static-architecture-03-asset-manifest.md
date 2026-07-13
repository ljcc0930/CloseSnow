# Atomic Feature Request

## Request ID
- `runtime-static-architecture-03-asset-manifest`

## Title
- Establish one executable web asset manifest

## Feature Branch
- `ljcc/feature/runtime-static-architecture`

## Dependencies
- None.

## Background
- Static copying scans asset directories from the process working directory, the dynamic server keeps a separate hard-coded MIME allowlist, and deployment checks only a subset of files. Those independent inventories can drift without a failing contract test.

## Goal
- Define one typed asset manifest, use it for source resolution, static copying, dynamic serving, and artifact validation, and make deployment validation call the same Python contract.

## Constraints / Forbidden Behaviors
- Preserve existing public asset URLs, MIME values, template load order, and copied directory layout.
- Source paths must resolve from the repository root and must not depend on the caller's current working directory.
- Do not add a frontend package manager or require Node at runtime.
- Keep compatibility imports from `weather_page_assets` if existing callers or tests use them.

## Acceptance Criteria
- [ ] A single immutable manifest lists every browser asset with its repository-relative URL/path and MIME type.
- [ ] Dynamic asset reads/allowlisting and static asset copying are derived from the manifest, with no second hand-maintained list.
- [ ] Static copying works from a non-repository current working directory and copies only manifest-owned browser assets.
- [ ] A reusable static-site validator reports missing manifest assets and required entry artifacts with actionable paths.
- [ ] The Pages workflow invokes the validator instead of maintaining a partial list of `test -f` checks.
- [ ] Tests prove every manifest item exists, can be read with the expected MIME type, is copied, and is detected when missing.

## Test Plan
- `python3 -m pytest tests/test_lint_assets.py tests/integration/test_cli.py tests/integration/test_web_server.py tests/integration/test_static_server.py -q`
- `python3 -m ruff check src tests scripts`
- `./scripts/lint.sh`
