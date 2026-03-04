from __future__ import annotations

from typing import Callable, List


def select_resorts(
    resorts: List[str],
    resorts_file: str,
    use_default_resorts: bool,
    default_resorts: List[str],
    read_resorts_fn: Callable[[str], List[str]],
) -> List[str]:
    selected: List[str] = [r.strip() for r in resorts if r and r.strip()]
    if resorts_file:
        selected.extend(read_resorts_fn(resorts_file))
    if use_default_resorts:
        selected.extend(default_resorts)
    if not selected:
        selected = list(default_resorts)

    seen = set()
    return [r for r in selected if not (r in seen or seen.add(r))]
