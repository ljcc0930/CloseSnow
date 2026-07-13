# Atomic Feature Request

## Request ID
- `netlify-pr-previews-01-deploy-config`

## Title
- Add Netlify PR preview configuration

## Feature Branch
- `ljcc/feature/netlify-pr-previews`

## Dependencies
- None.

## Background
- Reviewers currently receive test results for pull requests but no hosted interface for visually checking generated static pages. Netlify can create a unique Deploy Preview and GitHub comment for each pull request once its GitHub App is connected.

## Goal
- Add deterministic, repository-owned Netlify build settings and concise administrator setup documentation so connected pull requests build the complete CloseSnow static site into a Netlify Deploy Preview.

## Constraints / Forbidden Behaviors
- Do not replace or modify the existing GitHub Pages production deployment workflow.
- Do not commit Netlify credentials, access tokens, account identifiers, or site identifiers.
- Use Python 3.11 and the repository convention of eight static-build workers.
- Generate the complete resort catalog and publish only the generated `site/` directory.
- Keep configuration usable for production and deploy-preview Netlify contexts without branch-specific secrets.

## Acceptance Criteria
- [ ] A root `netlify.toml` declares the complete static build command, `site` publish directory, and Python 3.11 runtime.
- [ ] README documents the one-time Netlify GitHub App connection, expected Deploy Preview comment/URL, and that GitHub Pages remains production.
- [ ] The configured command succeeds locally and produces a Pages-valid complete static site.
- [ ] Configuration contains no repository or account secrets.
- [ ] A dedicated PR targets `ljcc/feature/netlify-pr-previews` before the final feature PR targets `main`.

## Test Plan
- Parse `netlify.toml` with Python 3.11 `tomllib` and assert the build command, publish directory, and runtime value.
- Run `python3 -m src.cli static --output-dir <temporary-output> --max-workers 8 --include-all-resorts`.
- Run `python3 -m src.web.static_site_validator --site-dir <temporary-output>` when available on the feature base; otherwise verify the generated index, data, assets, resort pages, and hourly JSON artifacts directly.
- Run the repository lint suite and full pytest suite.
