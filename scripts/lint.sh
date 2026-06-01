#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

PYTHON_BIN="${PYTHON:-python3}"
TARGETS=(src tests scripts)

if ! "$PYTHON_BIN" -m ruff --version >/dev/null 2>&1; then
  echo "Missing dev dependency: ruff" >&2
  echo "Install with: $PYTHON_BIN -m pip install -r requirements-dev.txt" >&2
  exit 1
fi

"$PYTHON_BIN" -m ruff format --check "${TARGETS[@]}"
"$PYTHON_BIN" -m ruff check "${TARGETS[@]}"
