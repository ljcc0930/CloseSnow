from __future__ import annotations

import argparse
import json
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Final, Optional, Sequence

from src.web.asset_manifest import WEB_ASSET_MANIFEST
from src.web.pipelines.static_site import resort_artifact_path

REQUIRED_ENTRY_ARTIFACTS: Final[tuple[str, ...]] = ("index.html", "data.json")
PAGES_ENTRY_ARTIFACTS: Final[tuple[str, ...]] = (".nojekyll",)
PAGES_REQUIRED_PATTERNS: Final[tuple[str, ...]] = (
    "resort/*/index.html",
    "resort/*/hourly.json",
)


@dataclass(frozen=True)
class StaticSiteValidationIssue:
    path: Path
    message: str

    def render(self) -> str:
        return f"{self.path}: {self.message}"


def _pages_resort_ids(root: Path, issues: list[StaticSiteValidationIssue]) -> tuple[str, ...]:
    data_path = root / "data.json"
    if not data_path.is_file():
        return ()
    try:
        payload = json.loads(data_path.read_text(encoding="utf-8"))
    except (OSError, UnicodeDecodeError, ValueError, TypeError) as exc:
        issues.append(StaticSiteValidationIssue(data_path, f"invalid Pages payload JSON: {exc}"))
        return ()
    reports = payload.get("reports") if isinstance(payload, dict) else None
    if not isinstance(reports, list):
        issues.append(StaticSiteValidationIssue(data_path, "Pages payload must contain a reports list"))
        return ()
    resort_ids: list[str] = []
    seen: set[str] = set()
    for index, report in enumerate(reports):
        resort_id = report.get("resort_id") if isinstance(report, dict) else None
        if not isinstance(resort_id, str) or not resort_id:
            issues.append(
                StaticSiteValidationIssue(
                    data_path,
                    f"reports[{index}] must contain a non-empty resort_id for Pages artifacts",
                )
            )
            continue
        try:
            resort_artifact_path(root, resort_id, "index.html")
        except ValueError as exc:
            issues.append(StaticSiteValidationIssue(data_path, f"reports[{index}] has unsafe resort_id: {exc}"))
            continue
        if resort_id not in seen:
            seen.add(resort_id)
            resort_ids.append(resort_id)
    return tuple(resort_ids)


def _validate_pages_resort_artifacts(root: Path, issues: list[StaticSiteValidationIssue]) -> None:
    for resort_id in _pages_resort_ids(root, issues):
        for filename in ("index.html", "hourly.json"):
            try:
                path = resort_artifact_path(root, resort_id, filename)
            except ValueError as exc:
                issues.append(
                    StaticSiteValidationIssue(
                        root / "resort" / resort_id / filename,
                        f"unsafe Pages artifact path: {exc}",
                    )
                )
                continue
            if not path.is_file():
                issues.append(
                    StaticSiteValidationIssue(
                        path,
                        f"missing Pages artifact for resort_id {resort_id}",
                    )
                )


def validate_static_site(
    directory: str | Path,
    *,
    require_pages_artifacts: bool = False,
) -> tuple[StaticSiteValidationIssue, ...]:
    root = Path(directory).resolve()
    if not root.is_dir():
        return (StaticSiteValidationIssue(root, "static-site root is missing or is not a directory"),)

    issues: list[StaticSiteValidationIssue] = []
    required_entries = REQUIRED_ENTRY_ARTIFACTS + (PAGES_ENTRY_ARTIFACTS if require_pages_artifacts else ())
    for relative_path in required_entries:
        path = root / relative_path
        if not path.is_file():
            issues.append(StaticSiteValidationIssue(path, "missing required static-site entry artifact"))

    for asset in WEB_ASSET_MANIFEST:
        path = root / asset.repository_path
        if not path.is_file():
            issues.append(
                StaticSiteValidationIssue(
                    path,
                    f"missing manifest asset ({asset.mime_type})",
                )
            )

    if require_pages_artifacts:
        for pattern in PAGES_REQUIRED_PATTERNS:
            if not any(path.is_file() for path in root.glob(pattern)):
                issues.append(
                    StaticSiteValidationIssue(
                        root / pattern,
                        "no generated artifact matches required Pages pattern",
                    )
                )
        _validate_pages_resort_artifacts(root, issues)

    return tuple(issues)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Validate a generated CloseSnow static-site artifact.")
    parser.add_argument("--site-dir", default="site")
    parser.add_argument(
        "--require-pages-artifacts",
        action="store_true",
        help="Also require .nojekyll and generated resort index/hourly artifacts.",
    )
    return parser


def main(argv: Optional[Sequence[str]] = None) -> int:
    args = build_parser().parse_args(argv)
    site_root = Path(args.site_dir).resolve()
    issues = validate_static_site(site_root, require_pages_artifacts=args.require_pages_artifacts)
    if issues:
        for issue in issues:
            print(issue.render(), file=sys.stderr)
        return 1
    print(f"Static site validation passed: {site_root}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
