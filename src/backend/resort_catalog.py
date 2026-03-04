from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any, Dict, List


def _slugify(value: str) -> str:
    lowered = value.strip().lower()
    collapsed = re.sub(r"[^a-z0-9]+", "-", lowered)
    return collapsed.strip("-")


def _normalize_pass_types(raw: Any) -> List[str]:
    if isinstance(raw, list):
        values = [str(v).strip().lower() for v in raw if str(v).strip()]
    elif isinstance(raw, str):
        values = [v.strip().lower() for v in raw.split(",") if v.strip()]
    else:
        values = []
    seen = set()
    return [v for v in values if not (v in seen or seen.add(v))]


def _normalize_catalog_entry(raw: Dict[str, Any]) -> Dict[str, Any] | None:
    query = str(raw.get("query") or raw.get("name") or "").strip()
    if not query:
        return None
    name = str(raw.get("name") or query).strip()
    resort_id = str(raw.get("resort_id") or raw.get("id") or _slugify(query)).strip()
    if not resort_id:
        resort_id = _slugify(query)
    return {
        "resort_id": resort_id,
        "query": query,
        "name": name,
        "state": str(raw.get("state") or raw.get("admin1") or "").strip(),
        "country": str(raw.get("country") or "").strip(),
        "region": str(raw.get("region") or "").strip().lower(),
        "pass_types": _normalize_pass_types(raw.get("pass_types")),
    }


def _load_catalog_from_txt(path: Path) -> List[Dict[str, Any]]:
    entries: List[Dict[str, Any]] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        text = line.strip()
        if not text or text.startswith("#"):
            continue
        entry = _normalize_catalog_entry({"query": text})
        if entry is not None:
            entries.append(entry)
    return entries


def _load_catalog_from_yaml_json(path: Path) -> List[Dict[str, Any]]:
    raw = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(raw, list):
        raise ValueError(f"Invalid resort catalog format in {path}: expected list")
    entries: List[Dict[str, Any]] = []
    for item in raw:
        if not isinstance(item, dict):
            continue
        entry = _normalize_catalog_entry(item)
        if entry is not None:
            entries.append(entry)
    return entries


def load_resort_catalog(path: str) -> List[Dict[str, Any]]:
    p = Path(path)
    if p.suffix.lower() == ".txt":
        entries = _load_catalog_from_txt(p)
    else:
        entries = _load_catalog_from_yaml_json(p)
    seen = set()
    return [item for item in entries if not (item["query"] in seen or seen.add(item["query"]))]


def read_resort_queries(path: str) -> List[str]:
    return [item["query"] for item in load_resort_catalog(path)]


def search_resort_catalog(entries: List[Dict[str, Any]], search: str) -> List[Dict[str, Any]]:
    query = (search or "").strip().lower()
    if not query:
        return list(entries)
    terms = [term for term in query.split() if term]
    if not terms:
        return list(entries)

    def searchable_text(entry: Dict[str, Any]) -> str:
        parts = [
            str(entry.get("resort_id", "")),
            str(entry.get("query", "")),
            str(entry.get("name", "")),
            str(entry.get("state", "")),
            str(entry.get("country", "")),
            str(entry.get("region", "")),
            " ".join(str(v) for v in entry.get("pass_types", [])),
        ]
        return " ".join(parts).lower()

    out: List[Dict[str, Any]] = []
    for entry in entries:
        hay = searchable_text(entry)
        if all(term in hay for term in terms):
            out.append(entry)
    return out
