from __future__ import annotations

import shutil
from pathlib import Path
from typing import List

STATIC_ASSET_DIRS = ("css", "js")


def copy_static_assets(directory: str) -> List[Path]:
    root = Path(directory).resolve()
    assets_root = root / "assets"
    copied: List[Path] = []
    for name in STATIC_ASSET_DIRS:
        source = Path("assets") / name
        target = assets_root / name
        shutil.copytree(source, target, dirs_exist_ok=True)
        copied.append(target)
    return copied
