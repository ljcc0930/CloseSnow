from __future__ import annotations

import json
import math
import re
from pathlib import Path
from typing import Any, Dict, List

VALID_PASS_TYPES = {"ikon", "epic", "indy"}
VALID_REGIONS = {"east", "west", "intl"}

_US_STATE_NAMES = {
    "AL": "Alabama",
    "AK": "Alaska",
    "AZ": "Arizona",
    "AR": "Arkansas",
    "CA": "California",
    "CO": "Colorado",
    "CT": "Connecticut",
    "DE": "Delaware",
    "FL": "Florida",
    "GA": "Georgia",
    "HI": "Hawaii",
    "ID": "Idaho",
    "IL": "Illinois",
    "IN": "Indiana",
    "IA": "Iowa",
    "KS": "Kansas",
    "KY": "Kentucky",
    "LA": "Louisiana",
    "ME": "Maine",
    "MD": "Maryland",
    "MA": "Massachusetts",
    "MI": "Michigan",
    "MN": "Minnesota",
    "MS": "Mississippi",
    "MO": "Missouri",
    "MT": "Montana",
    "NE": "Nebraska",
    "NV": "Nevada",
    "NH": "New Hampshire",
    "NJ": "New Jersey",
    "NM": "New Mexico",
    "NY": "New York",
    "NC": "North Carolina",
    "ND": "North Dakota",
    "OH": "Ohio",
    "OK": "Oklahoma",
    "OR": "Oregon",
    "PA": "Pennsylvania",
    "RI": "Rhode Island",
    "SC": "South Carolina",
    "SD": "South Dakota",
    "TN": "Tennessee",
    "TX": "Texas",
    "UT": "Utah",
    "VT": "Vermont",
    "VA": "Virginia",
    "WA": "Washington",
    "WV": "West Virginia",
    "WI": "Wisconsin",
    "WY": "Wyoming",
    "DC": "District of Columbia",
}

_CANADA_PROVINCE_NAMES = {
    "AB": "Alberta",
    "BC": "British Columbia",
    "MB": "Manitoba",
    "NB": "New Brunswick",
    "NL": "Newfoundland and Labrador",
    "NS": "Nova Scotia",
    "NT": "Northwest Territories",
    "NU": "Nunavut",
    "ON": "Ontario",
    "PE": "Prince Edward Island",
    "QC": "Quebec",
    "SK": "Saskatchewan",
    "YT": "Yukon",
}

_COUNTRY_ALIASES = {
    "US": ["United States", "United States of America", "USA", "America"],
    "CA": ["Canada"],
    "JP": ["Japan"],
    "FR": ["France"],
    "IT": ["Italy"],
    "CH": ["Switzerland"],
    "AT": ["Austria"],
    "KR": ["South Korea", "Korea"],
    "CN": ["China"],
    "NZ": ["New Zealand"],
    "AU": ["Australia"],
    "AD": ["Andorra"],
    "CL": ["Chile"],
}


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


def _to_optional_float(raw: Any) -> float | None:
    if raw is None:
        return None
    if isinstance(raw, str) and not raw.strip():
        return None
    try:
        value = float(raw)
    except (TypeError, ValueError):
        return None
    if not math.isfinite(value):
        return None
    return value


def _dedupe_terms(values: List[str]) -> List[str]:
    seen = set()
    out: List[str] = []
    for raw in values:
        text = str(raw).strip()
        if not text:
            continue
        key = text.lower()
        if key in seen:
            continue
        seen.add(key)
        out.append(text)
    return out


def _normalize_search_terms(raw: Any) -> List[str]:
    if isinstance(raw, list):
        values = [str(v).strip() for v in raw if str(v).strip()]
    elif isinstance(raw, str):
        values = [raw.strip()] if raw.strip() else []
    else:
        values = []
    return _dedupe_terms(values)


def _state_full_name(country: str, state: str) -> str:
    country_key = (country or "").strip().upper()
    state_key = (state or "").strip().upper()
    if not state_key:
        return ""
    if country_key == "US":
        return _US_STATE_NAMES.get(state_key, "")
    if country_key == "CA":
        return _CANADA_PROVINCE_NAMES.get(state_key, "")
    return ""


def _country_aliases(country: str) -> List[str]:
    return list(_COUNTRY_ALIASES.get((country or "").strip().upper(), []))


def _normalize_catalog_entry(raw: Dict[str, Any]) -> Dict[str, Any] | None:
    query = str(raw.get("query") or raw.get("name") or "").strip()
    if not query:
        return None
    name = str(raw.get("name") or query).strip()
    resort_id = str(raw.get("resort_id") or raw.get("id") or _slugify(query)).strip()
    if not resort_id:
        resort_id = _slugify(query)
    state = str(raw.get("state") or raw.get("admin1") or "").strip()
    country = str(raw.get("country") or "").strip().upper()
    city = str(raw.get("city") or "").strip()
    address = str(raw.get("address") or "").strip()
    state_name = _state_full_name(country, state)
    country_aliases = _country_aliases(country)
    country_name = country_aliases[0] if country_aliases else ""
    search_terms = _dedupe_terms(
        _normalize_search_terms(raw.get("search_terms"))
        + [state_name]
        + country_aliases
        + [city, address]
    )
    return {
        "resort_id": resort_id,
        "query": query,
        "name": name,
        "display_name": str(raw.get("display_name") or query).strip(),
        "website": str(raw.get("website") or "").strip(),
        "state": state,
        "state_name": state_name,
        "country": country,
        "country_name": country_name,
        "city": city,
        "address": address,
        "search_terms": search_terms,
        "region": str(raw.get("region") or "").strip().lower(),
        "pass_types": _normalize_pass_types(raw.get("pass_types")),
        "default_enabled": _to_bool(raw.get("default_enabled", True), default=True),
        "latitude": _to_optional_float(raw.get("latitude")),
        "longitude": _to_optional_float(raw.get("longitude")),
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
        latitude = entry.get("latitude")
        longitude = entry.get("longitude")
        has_latitude = latitude is not None
        has_longitude = longitude is not None

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
        if has_latitude != has_longitude:
            errors.append(f"{context}: latitude and longitude must be provided together")
        elif has_latitude and has_longitude:
            if _to_optional_float(latitude) is None:
                errors.append(f"{context}: invalid latitude '{latitude}'")
            if _to_optional_float(longitude) is None:
                errors.append(f"{context}: invalid longitude '{longitude}'")

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
        state = str(entry.get("state", "")).strip()
        country = str(entry.get("country", "")).strip().upper()
        state_name = str(entry.get("state_name", "")).strip() or _state_full_name(country, state)
        country_name = str(entry.get("country_name", "")).strip()
        country_aliases = _country_aliases(country)
        if not country_name and country_aliases:
            country_name = country_aliases[0]
        parts = [
            str(entry.get("resort_id", "")),
            str(entry.get("query", "")),
            str(entry.get("name", "")),
            str(entry.get("display_name", "")),
            str(entry.get("website", "")),
            state,
            state_name,
            country,
            country_name,
            str(entry.get("city", "")),
            str(entry.get("address", "")),
            str(entry.get("region", "")),
            " ".join(str(v) for v in entry.get("pass_types", [])),
            " ".join(country_aliases),
            " ".join(str(v) for v in entry.get("search_terms", [])),
        ]
        return " ".join(parts).lower()

    out: List[Dict[str, Any]] = []
    for entry in entries:
        hay = searchable_text(entry)
        if all(term in hay for term in terms):
            out.append(entry)
    return out
