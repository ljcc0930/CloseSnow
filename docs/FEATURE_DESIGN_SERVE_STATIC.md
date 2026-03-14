# CloseSnow Feature Design: `serve-static`

## Goal

Add a lightweight CLI command that serves already-generated static site artifacts from a local directory so the static output can be previewed without using the dynamic backend/frontend servers.

## Problem

The repository already supports:

- `static` to generate HTML + JSON artifacts
- `serve` for coupled dynamic serving
- `serve-data` and `serve-web` for decoupled runtime serving

But there is no first-class command for the common local workflow:

1. generate `site/`
2. open it over localhost as plain files

Opening `site/index.html` directly works for some flows, but a local HTTP server is the more reliable static preview path, especially for generated nested resort pages and JSON fetches.

## Proposed Behavior

Add:

```bash
python3 -m src.cli serve-static --directory site --host 127.0.0.1 --port 8011
```

Behavior:

- serves files from a user-provided directory, default `site`
- uses Python standard library only
- supports directory index routing so `/resort/<resort_id>/` resolves to `index.html`
- does not expose dynamic API endpoints
- fails clearly if the target directory does not exist or is not a directory

## Scope

In scope:

- CLI parser support
- local static HTTP serving
- tests for parser, dispatch, startup, and static file access
- README update

Out of scope:

- auto-building static files before serving
- SPA rewrite/fallback routing
- any backend/API behavior changes

## Validation

- `python3 -m pytest tests/integration/test_cli.py tests/integration/test_static_server.py -q`
- `python3 -m src.cli static --output-json site/data.json --output-html site/index.html`
