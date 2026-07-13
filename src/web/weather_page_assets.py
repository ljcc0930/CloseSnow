"""Compatibility exports for callers using the historical asset module."""

from src.web.asset_manifest import ASSET_MIME_TYPES, REPO_ROOT, asset_path, read_asset_bytes

__all__ = [
    "ASSET_MIME_TYPES",
    "REPO_ROOT",
    "asset_path",
    "read_asset_bytes",
]
