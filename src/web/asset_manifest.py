from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path, PurePosixPath
from types import MappingProxyType
from typing import Final, Mapping, Optional

REPO_ROOT: Final[Path] = Path(__file__).resolve().parents[2]


@dataclass(frozen=True)
class WebAsset:
    repository_path: str
    mime_type: str

    def __post_init__(self) -> None:
        parsed = PurePosixPath(self.repository_path)
        if (
            parsed.is_absolute()
            or not parsed.parts
            or parsed.parts[0] != "assets"
            or ".." in parsed.parts
            or str(parsed) != self.repository_path
        ):
            raise ValueError(
                f"Web asset path must be a normalized repository-relative assets path: {self.repository_path}"
            )

    @property
    def public_url(self) -> str:
        return f"/{self.repository_path}"

    def source_path(self, repository_root: Path = REPO_ROOT) -> Path:
        return repository_root.joinpath(*PurePosixPath(self.repository_path).parts)


WEB_ASSET_MANIFEST: Final[tuple[WebAsset, ...]] = (
    WebAsset("assets/css/weather_page.css", "text/css; charset=utf-8"),
    WebAsset("assets/css/field_guide_foundation.css", "text/css; charset=utf-8"),
    WebAsset("assets/js/field_guide_foundation.js", "application/javascript; charset=utf-8"),
    WebAsset("assets/js/compact_daily_summary.js", "application/javascript; charset=utf-8"),
    WebAsset("assets/js/weather_code_emoji.js", "application/javascript; charset=utf-8"),
    WebAsset("assets/js/weather_filter_state.js", "application/javascript; charset=utf-8"),
    WebAsset("assets/js/sticky_single_table_layout.js", "application/javascript; charset=utf-8"),
    WebAsset("assets/js/weather_page_formatters.js", "application/javascript; charset=utf-8"),
    WebAsset("assets/js/field_guide_homepage.js", "application/javascript; charset=utf-8"),
    WebAsset("assets/js/weather_page.js", "application/javascript; charset=utf-8"),
    WebAsset("assets/css/resort_hourly.css", "text/css; charset=utf-8"),
    WebAsset("assets/js/resort_hourly_metrics.js", "application/javascript; charset=utf-8"),
    WebAsset("assets/js/resort_hourly.js", "application/javascript; charset=utf-8"),
)


def _build_asset_index(manifest: tuple[WebAsset, ...]) -> Mapping[str, WebAsset]:
    index: dict[str, WebAsset] = {}
    for asset in manifest:
        if asset.repository_path in index:
            raise ValueError(f"Duplicate web asset path: {asset.repository_path}")
        index[asset.repository_path] = asset
    return MappingProxyType(index)


WEB_ASSETS_BY_PATH: Final[Mapping[str, WebAsset]] = _build_asset_index(WEB_ASSET_MANIFEST)
ASSET_MIME_TYPES: Final[Mapping[str, str]] = MappingProxyType(
    {path: asset.mime_type for path, asset in WEB_ASSETS_BY_PATH.items()}
)


def asset_for_path(name: str) -> Optional[WebAsset]:
    return WEB_ASSETS_BY_PATH.get(name)


def asset_path(name: str) -> Path:
    asset = asset_for_path(name)
    if asset is None:
        raise KeyError(f"Unknown web asset: {name}")
    return asset.source_path()


def read_asset_bytes(name: str) -> bytes:
    return asset_path(name).read_bytes()


__all__ = [
    "ASSET_MIME_TYPES",
    "REPO_ROOT",
    "WEB_ASSET_MANIFEST",
    "WEB_ASSETS_BY_PATH",
    "WebAsset",
    "asset_for_path",
    "asset_path",
    "read_asset_bytes",
]
