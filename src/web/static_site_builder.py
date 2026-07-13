from __future__ import annotations

import json
import os
import tempfile
from dataclasses import dataclass
from pathlib import Path
from types import MappingProxyType
from typing import Any, Mapping, Optional

from src.backend.constants import DEFAULT_STATIC_HOURLY_HOURS
from src.backend.runtime import WeatherPayloadBuildRequest
from src.backend.services.hourly_payload_service import build_hourly_payloads_for_resorts
from src.backend.services.weather_service import build_weather_payload_for_request
from src.contract import HourlyPayload, WeatherPayloadV1
from src.web.asset_manifest import WEB_ASSET_MANIFEST
from src.web.data_sources.static_json_source import load_static_payload
from src.web.pipelines.static_site import (
    render_hourly_pages,
    render_html,
    resort_artifact_dir_name,
    resort_artifact_path,
    resort_ids_from_payload,
)
from src.web.static_assets import copy_static_assets
from src.web.static_site_validator import validate_static_site

BUNDLE_MANIFEST_FILENAME = ".closesnow-static-bundle.json"
SITE_MANIFEST_FILENAME = ".closesnow-static-site.json"
_BUNDLE_SCHEMA = "closesnow_static_bundle_v1"
_SITE_SCHEMA = "closesnow_static_site_v1"


@dataclass(frozen=True)
class StaticFetchRequest:
    payload_request: WeatherPayloadBuildRequest
    hourly_hours: int = DEFAULT_STATIC_HOURLY_HOURS

    def __post_init__(self) -> None:
        if self.hourly_hours <= 0:
            raise ValueError("Static hourly hours must be greater than zero")


@dataclass(frozen=True)
class StaticRenderRequest:
    input_json: str
    output_dir: Optional[str] = None

    @property
    def resolved_output_dir(self) -> Path:
        if self.output_dir:
            return Path(self.output_dir).resolve()
        return Path(self.input_json).resolve().parent


@dataclass(frozen=True)
class StaticBuildRequest:
    fetch: StaticFetchRequest
    render: StaticRenderRequest
    skip_fetch: bool = False
    skip_render: bool = False

    def __post_init__(self) -> None:
        fetch_output = Path(self.fetch.payload_request.output_json).resolve()
        render_input = Path(self.render.input_json).resolve()
        if fetch_output != render_input:
            raise ValueError("Static fetch output_json and render input_json must identify the same bundle")


@dataclass(frozen=True)
class StaticBundle:
    payload: WeatherPayloadV1
    input_json: Path
    manifest_path: Optional[Path]
    hourly_payloads: Mapping[str, HourlyPayload | None]
    missing_hourly_resort_ids: tuple[str, ...]


@dataclass(frozen=True)
class StaticFetchResult:
    bundle: StaticBundle
    hourly_json_paths: tuple[Path, ...]


@dataclass(frozen=True)
class StaticRenderResult:
    index_html: Path
    output_json: Path
    hourly_page_paths: tuple[Path, ...]
    hourly_json_paths: tuple[Path, ...]
    asset_directories: tuple[Path, ...]


@dataclass(frozen=True)
class StaticBuildResult:
    fetch_result: Optional[StaticFetchResult]
    render_result: Optional[StaticRenderResult]


@dataclass(frozen=True)
class _BundleManifest:
    daily_json: str
    hourly_hours: int
    hourly_paths: Mapping[str, str]


def _atomic_write_json(path: Path, payload: Mapping[str, Any]) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary_path: Optional[Path] = None
    try:
        with tempfile.NamedTemporaryFile(
            mode="w",
            encoding="utf-8",
            dir=path.parent,
            prefix=f".{path.name}.",
            suffix=".tmp",
            delete=False,
        ) as temporary:
            temporary_path = Path(temporary.name)
            json.dump(payload, temporary, ensure_ascii=False, indent=2)
            temporary.write("\n")
            temporary.flush()
            os.fsync(temporary.fileno())
        os.replace(temporary_path, path)
    finally:
        if temporary_path is not None and temporary_path.exists():
            temporary_path.unlink()
    return path


def _hourly_relative_path(resort_id: str) -> str:
    return f"resort/{resort_artifact_dir_name(resort_id)}/hourly.json"


def _hourly_path(root: Path, resort_id: str) -> Path:
    return resort_artifact_path(root, resort_id, "hourly.json")


def _bundle_manifest_path(input_json: Path) -> Path:
    return input_json.parent / BUNDLE_MANIFEST_FILENAME


def _site_manifest_path(output_dir: Path) -> Path:
    return output_dir / SITE_MANIFEST_FILENAME


def _is_hourly_payload(payload: Any) -> bool:
    return isinstance(payload, dict) and "error" not in payload and isinstance(payload.get("hourly"), dict)


def _validated_resort_ids(payload: WeatherPayloadV1) -> list[str]:
    resort_ids = resort_ids_from_payload(payload)
    for resort_id in resort_ids:
        resort_artifact_dir_name(resort_id)
    return resort_ids


def _read_bundle_manifest(path: Path, *, expected_daily_json: Optional[str] = None) -> Optional[_BundleManifest]:
    if not path.is_file():
        return None
    raw = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(raw, dict) or raw.get("schema_version") != _BUNDLE_SCHEMA:
        raise ValueError(f"Invalid static bundle manifest: {path}")
    daily_json = raw.get("daily_json")
    hourly_hours = raw.get("hourly_hours")
    hourly_paths = raw.get("hourly")
    if not isinstance(daily_json, str) or not isinstance(hourly_hours, int) or hourly_hours <= 0:
        raise ValueError(f"Invalid static bundle manifest metadata: {path}")
    if expected_daily_json is not None and daily_json != expected_daily_json:
        raise ValueError(f"Static bundle manifest {path} belongs to {daily_json}, not {expected_daily_json}")
    if not isinstance(hourly_paths, dict):
        raise ValueError(f"Invalid static bundle hourly map: {path}")
    normalized: dict[str, str] = {}
    for raw_resort_id, raw_relative_path in hourly_paths.items():
        if not isinstance(raw_resort_id, str) or not raw_resort_id.strip() or not isinstance(raw_relative_path, str):
            raise ValueError(f"Invalid static bundle hourly entry: {path}")
        resort_id = raw_resort_id.strip()
        expected_path = _hourly_relative_path(resort_id)
        if raw_relative_path != expected_path:
            raise ValueError(f"Unsafe static bundle hourly path for {resort_id}: {raw_relative_path}")
        normalized[resort_id] = raw_relative_path
    return _BundleManifest(
        daily_json=daily_json,
        hourly_hours=hourly_hours,
        hourly_paths=MappingProxyType(normalized),
    )


def _try_load_previous_payload(path: Path) -> Optional[WeatherPayloadV1]:
    if not path.is_file():
        return None
    try:
        return load_static_payload(str(path))
    except (OSError, UnicodeDecodeError, ValueError, TypeError):
        return None


def _try_read_previous_bundle_manifest(path: Path) -> Optional[_BundleManifest]:
    try:
        return _read_bundle_manifest(path)
    except (OSError, UnicodeDecodeError, ValueError, TypeError):
        return None


def _unlink_owned_file(path: Path) -> None:
    if path.is_file() or path.is_symlink():
        path.unlink()
    parent = path.parent
    if parent.is_dir():
        try:
            parent.rmdir()
        except OSError:
            pass


def fetch_static_bundle(request: StaticFetchRequest) -> StaticFetchResult:
    """Fetch daily and hourly data once and persist a self-describing static bundle."""
    output_json = Path(request.payload_request.output_json).resolve()
    bundle_root = output_json.parent
    manifest_path = _bundle_manifest_path(output_json)
    previous_payload = _try_load_previous_payload(output_json)
    previous_manifest = _try_read_previous_bundle_manifest(manifest_path)

    payload = build_weather_payload_for_request(request.payload_request)
    resort_ids = _validated_resort_ids(payload)
    runtime = request.payload_request.runtime
    fetched_hourly = build_hourly_payloads_for_resorts(
        resort_ids=resort_ids,
        hours=request.hourly_hours,
        cache_file=runtime.cache_file,
        geocode_cache_hours=runtime.geocode_cache_hours,
        forecast_cache_hours=runtime.forecast_cache_hours,
        max_workers=runtime.max_workers,
        api_retries=runtime.api_retries,
    )
    hourly_payloads: dict[str, HourlyPayload | None] = {}
    for resort_id in resort_ids:
        hourly_payload = fetched_hourly.get(resort_id)
        hourly_payloads[resort_id] = hourly_payload if _is_hourly_payload(hourly_payload) else None

    previously_owned_ids: set[str] = set()
    if previous_payload is not None:
        previously_owned_ids.update(_validated_resort_ids(previous_payload))
    if previous_manifest is not None:
        previously_owned_ids.update(previous_manifest.hourly_paths)

    successful_ids = {resort_id for resort_id, item in hourly_payloads.items() if item is not None}
    for resort_id in previously_owned_ids.union(resort_ids).difference(successful_ids):
        _unlink_owned_file(_hourly_path(bundle_root, resort_id))

    hourly_paths: list[Path] = []
    manifest_hourly: dict[str, str] = {}
    for resort_id in resort_ids:
        hourly_payload = hourly_payloads[resort_id]
        if hourly_payload is None:
            continue
        hourly_path = _hourly_path(bundle_root, resort_id)
        _atomic_write_json(hourly_path, hourly_payload)
        hourly_paths.append(hourly_path)
        manifest_hourly[resort_id] = _hourly_relative_path(resort_id)

    _atomic_write_json(output_json, payload)
    missing_ids = tuple(resort_id for resort_id in resort_ids if resort_id not in successful_ids)
    _atomic_write_json(
        manifest_path,
        {
            "schema_version": _BUNDLE_SCHEMA,
            "daily_json": output_json.name,
            "hourly_hours": request.hourly_hours,
            "hourly": manifest_hourly,
            "missing_hourly": list(missing_ids),
        },
    )
    bundle = StaticBundle(
        payload=payload,
        input_json=output_json,
        manifest_path=manifest_path,
        hourly_payloads=MappingProxyType(hourly_payloads),
        missing_hourly_resort_ids=missing_ids,
    )
    return StaticFetchResult(bundle=bundle, hourly_json_paths=tuple(hourly_paths))


def load_static_bundle(input_json: str) -> StaticBundle:
    """Load a static bundle from disk. This function performs file I/O only."""
    daily_path = Path(input_json).resolve()
    payload = load_static_payload(str(daily_path))
    resort_ids = _validated_resort_ids(payload)
    manifest_path = _bundle_manifest_path(daily_path)
    manifest = _read_bundle_manifest(manifest_path, expected_daily_json=daily_path.name)
    hourly_payloads: dict[str, HourlyPayload | None] = {}

    if manifest is None:
        candidate_ids = resort_ids
    else:
        candidate_ids = [resort_id for resort_id in resort_ids if resort_id in manifest.hourly_paths]

    for resort_id in resort_ids:
        hourly_payloads[resort_id] = None
    for resort_id in candidate_ids:
        hourly_path = _hourly_path(daily_path.parent, resort_id)
        try:
            hourly_payload = json.loads(hourly_path.read_text(encoding="utf-8"))
        except (OSError, UnicodeDecodeError, ValueError, TypeError):
            continue
        if _is_hourly_payload(hourly_payload):
            hourly_payloads[resort_id] = hourly_payload

    missing_ids = tuple(resort_id for resort_id in resort_ids if hourly_payloads[resort_id] is None)
    return StaticBundle(
        payload=payload,
        input_json=daily_path,
        manifest_path=manifest_path if manifest is not None else None,
        hourly_payloads=MappingProxyType(hourly_payloads),
        missing_hourly_resort_ids=missing_ids,
    )


def _read_owned_site_resort_ids(output_dir: Path) -> tuple[str, ...]:
    path = _site_manifest_path(output_dir)
    if not path.is_file():
        return ()
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeDecodeError, ValueError, TypeError):
        return ()
    if not isinstance(raw, dict) or raw.get("schema_version") != _SITE_SCHEMA:
        return ()
    resort_ids = raw.get("resort_ids")
    if not isinstance(resort_ids, list) or not all(isinstance(item, str) for item in resort_ids):
        return ()
    return tuple(dict.fromkeys(item.strip() for item in resort_ids if item.strip()))


def _cleanup_stale_site_routes(output_dir: Path, previous_ids: set[str], current_ids: set[str]) -> None:
    for resort_id in previous_ids.difference(current_ids):
        _unlink_owned_file(resort_artifact_path(output_dir, resort_id, "index.html"))
        _unlink_owned_file(resort_artifact_path(output_dir, resort_id, "hourly.json"))


def render_static_bundle(request: StaticRenderRequest) -> StaticRenderResult:
    """Render a complete static site from a bundle without backend or network access."""
    bundle = load_static_bundle(request.input_json)
    output_dir = request.resolved_output_dir
    output_json = output_dir / "data.json"
    previous_payload = _try_load_previous_payload(output_json)
    previous_ids = set(_read_owned_site_resort_ids(output_dir))
    if previous_payload is not None:
        previous_ids.update(_validated_resort_ids(previous_payload))
    current_resort_ids = _validated_resort_ids(bundle.payload)
    current_ids = set(current_resort_ids)

    output_dir.mkdir(parents=True, exist_ok=True)
    _cleanup_stale_site_routes(output_dir, previous_ids, current_ids)
    _atomic_write_json(output_json, bundle.payload)
    index_html = render_html(str(output_dir / "index.html"), bundle.payload, data_url="./data.json")
    hourly_pages = render_hourly_pages(
        str(index_html),
        bundle.payload,
        hourly_payloads=bundle.hourly_payloads,
    )
    asset_directories = copy_static_assets(str(output_dir))

    issues = validate_static_site(output_dir)
    if issues:
        rendered_issues = "; ".join(issue.render() for issue in issues)
        raise RuntimeError(f"Generated static site failed validation: {rendered_issues}")

    _atomic_write_json(
        _site_manifest_path(output_dir),
        {
            "schema_version": _SITE_SCHEMA,
            "resort_ids": current_resort_ids,
            "assets": [asset.repository_path for asset in WEB_ASSET_MANIFEST],
        },
    )
    hourly_json_paths = tuple(
        _hourly_path(output_dir, resort_id)
        for resort_id in current_resort_ids
        if bundle.hourly_payloads.get(resort_id) is not None
    )
    return StaticRenderResult(
        index_html=index_html,
        output_json=output_json,
        hourly_page_paths=tuple(hourly_pages),
        hourly_json_paths=hourly_json_paths,
        asset_directories=tuple(asset_directories),
    )


def build_static_site(request: StaticBuildRequest) -> StaticBuildResult:
    fetch_result = None if request.skip_fetch else fetch_static_bundle(request.fetch)
    render_result = None if request.skip_render else render_static_bundle(request.render)
    return StaticBuildResult(fetch_result=fetch_result, render_result=render_result)


__all__ = [
    "BUNDLE_MANIFEST_FILENAME",
    "SITE_MANIFEST_FILENAME",
    "StaticBuildRequest",
    "StaticBuildResult",
    "StaticBundle",
    "StaticFetchRequest",
    "StaticFetchResult",
    "StaticRenderRequest",
    "StaticRenderResult",
    "build_static_site",
    "fetch_static_bundle",
    "load_static_bundle",
    "render_static_bundle",
]
