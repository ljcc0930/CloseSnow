from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any, Dict, List

VALID_PASS_TYPES = {"ikon", "epic", "indy"}
VALID_REGIONS = {"east", "west", "intl"}


def _slugify(value: str) -> str:
    lowered = value.strip().lower()
    collapsed = re.sub(r"[^a-z0-9]+", "-", lowered)
    return collapsed.strip("-")


def _to_bool(raw: Any, default: bool = True) -> bool:
    if raw is None:
        return default
    if isinstance(raw, bool):
        return raw
    if isinstance(raw, str):
        value = raw.strip().lower()
        if value in {"", "default"}:
            return default
        return value not in {"0", "false", "no", "off"}
    return bool(raw)


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
        "default_enabled": _to_bool(raw.get("default_enabled", True), default=True),
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


def read_resort_queries(path: str, *, include_all: bool = False) -> List[str]:
    entries = load_resort_catalog(path)
    if include_all:
        return [item["query"] for item in entries]
    return [item["query"] for item in entries if bool(item.get("default_enabled", True))]


def validate_resort_catalog(entries: List[Dict[str, Any]]) -> List[str]:
    errors: List[str] = []
    seen_ids: Dict[str, int] = {}
    seen_queries: Dict[str, int] = {}
    for idx, entry in enumerate(entries):
        context = f"entry[{idx}]"
        resort_id = str(entry.get("resort_id", "")).strip()
        query = str(entry.get("query", "")).strip()
        country = str(entry.get("country", "")).strip().upper()
        region = str(entry.get("region", "")).strip().lower()
        pass_types = entry.get("pass_types", [])

        if not resort_id:
            errors.append(f"{context}: missing resort_id")
        if not query:
            errors.append(f"{context}: missing query")
        if not re.fullmatch(r"[A-Z]{2}", country):
            errors.append(f"{context}: invalid country '{country}'")
        if region not in VALID_REGIONS:
            errors.append(f"{context}: invalid region '{region}'")
        if not isinstance(pass_types, list) or not pass_types:
            errors.append(f"{context}: missing pass_types")
        else:
            bad_pass_types = [str(p) for p in pass_types if str(p).strip().lower() not in VALID_PASS_TYPES]
            if bad_pass_types:
                errors.append(f"{context}: invalid pass_types {bad_pass_types}")

        if resort_id:
            key = resort_id.lower()
            if key in seen_ids:
                errors.append(f"{context}: duplicate resort_id '{resort_id}' also used at entry[{seen_ids[key]}]")
            else:
                seen_ids[key] = idx
        if query:
            key = query.lower()
            if key in seen_queries:
                errors.append(f"{context}: duplicate query '{query}' also used at entry[{seen_queries[key]}]")
            else:
                seen_queries[key] = idx
    return errors


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
