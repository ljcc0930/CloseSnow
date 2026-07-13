from __future__ import annotations

import argparse
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Final, Optional, Sequence

from src.web.asset_manifest import WEB_ASSET_MANIFEST

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
