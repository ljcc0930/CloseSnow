from __future__ import annotations

from typing import Dict, List

from src.backend.compute.payload_metadata import build_payload_metadata
from src.backend.resort_catalog import load_resort_catalog, search_resort_catalog
from src.shared.config import DEFAULT_RESORTS_FILE

# Dynamic API/search keeps manually curated independent resorts reachable
# even though the main filter UI still only exposes Ikon/Epic toggles.
_SUPPORTED_PASS_TYPES = {"epic", "ikon", "independent"}


def split_query_values(values: List[str], *, to_upper: bool = False) -> List[str]:
    out: List[str] = []
    for raw in values:
        for part in raw.split(","):
            val = part.strip().upper() if to_upper else part.strip().lower()
            if val:
                out.append(val)
    seen = set()
    return [x for x in out if not (x in seen or seen.add(x))]


def to_bool_flag(raw: str) -> bool:
    return (raw or "").strip().lower() in {"1", "true", "yes", "on"}


def supported_catalog(catalog: List[Dict[str, object]]) -> List[Dict[str, object]]:
    out: List[Dict[str, object]] = []
    for item in catalog:
        raw_pass_types = item.get("pass_types")
        if not isinstance(raw_pass_types, list):
            continue
        pass_types = {str(v).strip().lower() for v in raw_pass_types if str(v).strip()}
        if pass_types.intersection(_SUPPORTED_PASS_TYPES):
            out.append(item)
    return out


def load_supported_resort_catalog(resorts_file: str = DEFAULT_RESORTS_FILE) -> List[Dict[str, object]]:
    return supported_catalog(load_resort_catalog(resorts_file))


def catalog_item_with_display_name(item: Dict[str, object]) -> Dict[str, object]:
    out = dict(item)
    out["display_name"] = str(item.get("display_name") or item.get("query") or "").strip()
    out["website"] = str(item.get("website") or "").strip()
    return out


def available_filters(catalog: List[Dict[str, object]]) -> Dict[str, Dict[str, int]]:
    pass_type_counts: Dict[str, int] = {}
    region_counts: Dict[str, int] = {}
    subregion_counts: Dict[str, int] = {}
    country_counts: Dict[str, int] = {}
    for item in catalog:
        region = str(item.get("region", "")).strip().lower()
        if region:
            region_counts[region] = region_counts.get(region, 0) + 1
        subregion = str(item.get("subregion", "")).strip().lower()
        if subregion:
            subregion_counts[subregion] = subregion_counts.get(subregion, 0) + 1
        country = str(item.get("country", "")).strip().upper()
        if country:
            country_counts[country] = country_counts.get(country, 0) + 1
        for pass_type in item.get("pass_types", []) if isinstance(item.get("pass_types"), list) else []:
            pt = str(pass_type).strip().lower()
            if pt:
                pass_type_counts[pt] = pass_type_counts.get(pt, 0) + 1
    return {
        "pass_type": pass_type_counts,
        "region": region_counts,
        "subregion": subregion_counts,
        "country": country_counts,
    }


def apply_catalog_filters(
    catalog: List[Dict[str, object]],
    *,
    pass_types: List[str],
    region: str,
    subregions: List[str],
    countries: List[str],
    search: str,
) -> List[Dict[str, object]]:
    items = search_resort_catalog(catalog, search)
    if pass_types:
        allowed = set(pass_types)
        items = [
            item
            for item in items
            if allowed.intersection(
                {str(v).strip().lower() for v in (item.get("pass_types") or []) if str(v).strip()}
            )
        ]
    if region:
        want = region.lower()
        items = [item for item in items if str(item.get("region", "")).strip().lower() == want]
    if subregions:
        allowed_subregions = set(subregions)
        items = [item for item in items if str(item.get("subregion", "")).strip().lower() in allowed_subregions]
    if countries:
        allowed_countries = set(countries)
        items = [item for item in items if str(item.get("country", "")).strip().upper() in allowed_countries]
    return items


def build_empty_payload(cache_file: str, geocode_cache_hours: int, forecast_cache_hours: int) -> Dict[str, object]:
    return build_payload_metadata(
        cache_path=cache_file,
        cache_hits=0,
        cache_misses=0,
        geocode_cache_hours=geocode_cache_hours,
        forecast_cache_hours=forecast_cache_hours,
        reports=[],
        failed=[],
    )


def default_applied_filters() -> Dict[str, object]:
    return {
        "pass_type": [],
        "region": "",
        "subregion": [],
        "country": [],
        "search": "",
        "search_all": True,
        "include_default": True,
        "include_all": False,
    }


def select_resorts_from_query(qs: dict) -> tuple[List[str], str, dict, dict, bool]:
    resorts = [x.strip() for x in qs.get("resort", []) if x.strip()]
    pass_types = split_query_values(qs.get("pass_type", []))
    region = (qs.get("region", [""])[0] or "").strip().lower()
    subregions = split_query_values(qs.get("subregion", []))
    countries = split_query_values(qs.get("country", []), to_upper=True)
    search_text = (qs.get("search", [""])[0] or "").strip()
    has_search_all = "search_all" in qs
    search_all = to_bool_flag((qs.get("search_all", [""])[0] or "")) if has_search_all else True
    has_include_default = "include_default" in qs
    include_default = to_bool_flag((qs.get("include_default", [""])[0] or "")) if has_include_default else False
    include_all = to_bool_flag((qs.get("include_all", [""])[0] or ""))
    applied = {
        "pass_type": pass_types,
        "region": region,
        "subregion": subregions,
        "country": countries,
        "search": search_text,
        "search_all": search_all,
        "include_default": include_default,
        "include_all": include_all,
    }

    catalog = load_supported_resort_catalog(DEFAULT_RESORTS_FILE)
    available = available_filters(catalog)
    has_filters = bool(
        pass_types or region or subregions or countries or search_text or include_all or has_include_default or has_search_all
    )
    if not has_filters:
        applied["search_all"] = True
        applied["include_default"] = not bool(resorts)
        applied["include_all"] = False
        resorts_file = "" if resorts else DEFAULT_RESORTS_FILE
        return resorts, resorts_file, applied, available, False

    if search_text and search_all:
        # Search-all mode ignores pass/region/country/default scope and searches full supported catalog.
        filtered_catalog = search_resort_catalog(catalog, search_text)
    elif include_default:
        default_catalog = [item for item in catalog if bool(item.get("default_enabled", False))]
        filtered_catalog = apply_catalog_filters(
            default_catalog,
            pass_types=pass_types,
            region=region,
            subregions=subregions,
            countries=countries,
            search=search_text,
        )
    elif include_all and not (pass_types or region or subregions or countries or search_text):
        filtered_catalog = list(catalog)
    else:
        filtered_catalog = apply_catalog_filters(
            catalog,
            pass_types=pass_types,
            region=region,
            subregions=subregions,
            countries=countries,
            search=search_text,
        )

    allowed_queries = {
        str(item.get("query", "")).strip()
        for item in filtered_catalog
        if str(item.get("query", "")).strip()
    }
    if resorts:
        selected = [r for r in resorts if r in allowed_queries]
    else:
        selected = [
            str(item["query"]).strip()
            for item in filtered_catalog
            if str(item.get("query", "")).strip()
        ]
    no_match = len(selected) == 0
    return selected, "", applied, available, no_match
