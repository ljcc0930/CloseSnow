# Netlify PR Previews

## Summary
- Add repository-owned Netlify build configuration so a connected Netlify GitHub App can build every pull request as a shareable Deploy Preview without changing the existing GitHub Pages production workflow.

## Feature Branch
- `ljcc/feature/netlify-pr-previews`

## Global Assumptions
- Netlify remains an auxiliary preview host; GitHub Pages stays the canonical production deployment.
- A repository administrator will authorize the Netlify GitHub App and connect this repository after the configuration PR is available.

## Atomic Requests
- `netlify-pr-previews-01-deploy-config`: Add Netlify preview build configuration and setup documentation.

## Dependency Graph
- None; the single atomic request is independently executable.

## Notes
- No Netlify token or project identifier belongs in the repository.
