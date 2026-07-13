from __future__ import annotations

from dataclasses import FrozenInstanceError
from pathlib import Path

import pytest
from scripts.lint_assets import REPO_ROOT, LintResult
from src.web.asset_manifest import ASSET_MIME_TYPES, WEB_ASSET_MANIFEST, read_asset_bytes


def test_lint_result_renders_relative_path() -> None:
    result = LintResult(Path("assets/js"), "node is required")

    assert result.render() == "assets/js: node is required"


def test_lint_result_renders_repo_relative_absolute_path() -> None:
    result = LintResult(REPO_ROOT / "assets" / "js" / "weather_page.js", "syntax error")

    assert result.render() == "assets/js/weather_page.js: syntax error"


def test_web_asset_manifest_covers_repository_browser_assets() -> None:
    expected_mime_types = {
        ".css": "text/css; charset=utf-8",
        ".js": "application/javascript; charset=utf-8",
    }
    repository_assets = {
        path.relative_to(REPO_ROOT).as_posix() for path in (REPO_ROOT / "assets").rglob("*") if path.is_file()
    }
    manifest_paths = {asset.repository_path for asset in WEB_ASSET_MANIFEST}

    assert manifest_paths == repository_assets
    assert len(manifest_paths) == len(WEB_ASSET_MANIFEST)
    assert set(ASSET_MIME_TYPES) == manifest_paths

    for asset in WEB_ASSET_MANIFEST:
        source = asset.source_path()
        assert source.is_file()
        assert asset.public_url == f"/{asset.repository_path}"
        assert asset.mime_type == expected_mime_types[source.suffix]
        assert ASSET_MIME_TYPES[asset.repository_path] == asset.mime_type
        assert read_asset_bytes(asset.repository_path) == source.read_bytes()


def test_web_asset_manifest_and_compatibility_index_are_immutable() -> None:
    with pytest.raises(FrozenInstanceError):
        WEB_ASSET_MANIFEST[0].mime_type = "text/plain"  # type: ignore[misc]

    with pytest.raises(TypeError):
        ASSET_MIME_TYPES["assets/new.js"] = "application/javascript"  # type: ignore[index]
