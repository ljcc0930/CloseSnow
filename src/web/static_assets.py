from __future__ import annotations

import shutil
from pathlib import Path, PurePosixPath
from typing import List

from src.web.asset_manifest import WEB_ASSET_MANIFEST

STATIC_ASSET_DIRS = tuple(dict.fromkeys(PurePosixPath(asset.repository_path).parts[1] for asset in WEB_ASSET_MANIFEST))


def copy_static_assets(directory: str) -> List[Path]:
    root = Path(directory).resolve()
    copied: List[Path] = []
    copied_set: set[Path] = set()
    for asset in WEB_ASSET_MANIFEST:
        source = asset.source_path()
        target = root.joinpath(*PurePosixPath(asset.repository_path).parts)
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, target)
        if target.parent not in copied_set:
            copied.append(target.parent)
            copied_set.add(target.parent)
    return copied
