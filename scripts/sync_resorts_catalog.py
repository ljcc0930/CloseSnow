#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
from dataclasses import dataclass
from html.parser import HTMLParser
from pathlib import Path
import sys
from typing import Any, Dict, Iterable, List, Optional
from urllib.parse import urlencode
from urllib.request import Request, urlopen

REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from src.backend.resort_catalog import VALID_PASS_TYPES, validate_resort_catalog

DEFAULT_RESORTS_PATH = REPO_ROOT / "resorts.yml"
USER_AGENT = "Mozilla/5.0 (compatible; CloseSnow/1.0)"
IKON_DESTINATIONS_PAGE_URL = "https://www.ikonpass.com/en/destinations"
IKON_SANITY_QUERY_URL = "https://bjsgnxuy.apicdn.sanity.io/v2022-05-12/data/query/~production"
IKON_DESTINATIONS_QUERY = (
    '*[_type == "destination" && excludeFromListings != true]|order(orderRank asc)'
    "{name,title,ignoreSubDestinations,subDestinations[]{name,title}}"
)
# Known naming differences between Ikon's destinations page and catalog/API naming.
IKON_DESTINATION_CANONICAL_ALIASES = {
    "arai mountain": {"arai snow"},
    "kitzb hel": {"kitzski"},
    "mona yongpyong": {"yong pyong"},
}
IKON_CHECK_SUFFIX_RE = re.compile(
    r"\b(resort|ski area|ski and snowboard|ski hill|ski center|ski centre)\b$",
    flags=re.IGNORECASE,
)

US_WEST = {
    "AK",
    "AZ",
    "CA",
    "CO",
    "HI",
    "ID",
    "MT",
    "NM",
    "NV",
    "OR",
    "UT",
    "WA",
    "WY",
}
CA_WEST = {"AB", "BC", "MB", "SK", "YT", "NT", "NU"}

COUNTRY_NAME_TO_CODE = {
    "US": "US",
    "USA": "US",
    "UNITED STATES": "US",
    "UNITED STATES OF AMERICA": "US",
    "CA": "CA",
    "CAN": "CA",
    "CANADA": "CA",
    "JP": "JP",
    "JAPAN": "JP",
    "AU": "AU",
    "AUSTRALIA": "AU",
    "ES": "ES",
    "SPAIN": "ES",
    "CH": "CH",
    "SWITZERLAND": "CH",
    "CL": "CL",
    "CHILE": "CL",
    "NZ": "NZ",
    "NEW ZEALAND": "NZ",
    "FR": "FR",
    "FRANCE": "FR",
    "IT": "IT",
    "ITALY": "IT",
    "AT": "AT",
    "AUSTRIA": "AT",
    "SE": "SE",
    "SWEDEN": "SE",
    "KR": "KR",
    "SOUTH KOREA": "KR",
    "KOREA": "KR",
    "CN": "CN",
    "CHINA": "CN",
    "AD": "AD",
    "ANDORRA": "AD",
    "NO": "NO",
    "NORWAY": "NO",
}

COUNTRY_CODE_TO_NAME = {
    "US": "United States",
    "CA": "Canada",
    "JP": "Japan",
    "AU": "Australia",
    "ES": "Spain",
    "CH": "Switzerland",
    "CL": "Chile",
    "NZ": "New Zealand",
    "FR": "France",
    "IT": "Italy",
    "AT": "Austria",
    "SE": "Sweden",
    "KR": "South Korea",
    "CN": "China",
    "AD": "Andorra",
    "NO": "Norway",
}

CANONICAL_SUFFIX_RE = re.compile(
    r"\b(resort|mountain resort|ski area|ski and snowboard|ski hill|ski center|ski centre|ski mountain)\b",
    flags=re.IGNORECASE,
)


@dataclass
class CatalogResort:
    query: str
    name: str
    state: str
    country: str
    region: str
    pass_type: str


def slugify(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")


def request_text(url: str) -> str:
    req = Request(url, headers={"User-Agent": USER_AGENT, "Accept": "application/json,text/html"})
    with urlopen(req, timeout=45) as resp:
        return resp.read().decode("utf-8", errors="ignore")


def request_json(url: str) -> Dict[str, Any]:
    return json.loads(request_text(url))


def normalize_country_code(raw: str) -> str:
    up = re.sub(r"\s+", " ", str(raw or "").strip().upper())
    if not up:
        return ""
    mapped = COUNTRY_NAME_TO_CODE.get(up)
    if mapped:
        return mapped
    if re.fullmatch(r"[A-Z]{2}", up):
        return up
    return ""


def normalize_state(raw: str) -> str:
    value = str(raw or "").strip().upper()
    if re.fullmatch(r"[A-Z]{2}", value):
        return value
    return ""


def infer_region(country: str, state: str) -> str:
    c = country.upper()
    s = state.upper()
    if c == "US":
        return "west" if s in US_WEST else "east"
    if c == "CA":
        if not s:
            return "west"
        return "west" if s in CA_WEST else "east"
    return "intl"


def clean_text(value: str) -> str:
    text = " ".join(str(value or "").replace("\xa0", " ").split())
    return text.strip()


def strip_name_suffix(name: str) -> str:
    text = clean_text(name)
    text = CANONICAL_SUFFIX_RE.sub("", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip(" ,-")


def canonical_name(name: str) -> str:
    base = strip_name_suffix(name).lower().replace("&", " and ")
    base = re.sub(r"[^a-z0-9]+", " ", base)
    return re.sub(r"\s+", " ", base).strip()


def canonical_ikon_check_name(raw_name: str) -> str:
    name, _, _ = split_name_state_country(clean_text(raw_name))
    base = clean_text(name or raw_name)
    base = IKON_CHECK_SUFFIX_RE.sub("", base).strip(" ,-")
    base = base.lower().replace("&", " and ")
    base = re.sub(r"[^a-z0-9]+", " ", base)
    return re.sub(r"\s+", " ", base).strip()


def dedupe_key(name: str, state: str, country: str) -> str:
    return f"{canonical_name(name)}|{state.upper()}|{country.upper()}"


def extract_country_from_tags(tags: Any) -> str:
    if not isinstance(tags, list):
        return ""
    for tag in tags:
        t = clean_text(str(tag))
        if not t:
            continue
        parts = [p.strip() for p in t.split("-") if p.strip()]
        if parts:
            code = normalize_country_code(parts[-1])
            if code:
                return code
    return ""


def split_name_state_country(
    raw_name: str,
    *,
    fallback_country: str = "",
    fallback_subregion: str = "",
    tags: Any = None,
) -> tuple[str, str, str]:
    raw = clean_text(raw_name)
    parts = [p.strip() for p in raw.split(",") if p.strip()]

    name = raw
    state = ""
    country = ""

    if len(parts) >= 2:
        last = parts[-1]
        state_candidate = normalize_state(last)
        country_candidate = normalize_country_code(last)
        if state_candidate:
            state = state_candidate
            name = ", ".join(parts[:-1]).strip()
        elif country_candidate:
            country = country_candidate
            name = ", ".join(parts[:-1]).strip()

    if not country and len(parts) >= 3:
        penultimate = parts[-2]
        state_candidate = normalize_state(penultimate)
        country_candidate = normalize_country_code(parts[-1])
        if state_candidate and country_candidate:
            state = state or state_candidate
            country = country_candidate
            name = ", ".join(parts[:-2]).strip() or parts[0]

    if not country:
        country = normalize_country_code(fallback_subregion)
    if not country:
        country = extract_country_from_tags(tags)
    if not country:
        country = normalize_country_code(fallback_country)
    if not country and state:
        country = "CA" if state in CA_WEST else "US"

    name = clean_text(name)
    if not name:
        name = raw

    return name, state, country


def build_query(name: str, state: str, country: str, raw_source_name: str = "") -> str:
    if state:
        return f"{name}, {state}"
    source = clean_text(raw_source_name)
    if source and "," in source:
        return source
    if country and country not in {"US", "CA"}:
        country_name = COUNTRY_CODE_TO_NAME.get(country, country)
        return f"{name}, {country_name}"
    return name


def ensure_catalog_resort(
    *,
    query: str,
    name: str,
    state: str,
    country: str,
    pass_type: str,
) -> CatalogResort | None:
    query_clean = clean_text(query)
    name_clean = clean_text(name)
    state_clean = normalize_state(state)
    country_clean = normalize_country_code(country)
    pass_clean = pass_type.strip().lower()

    if not query_clean or pass_clean not in VALID_PASS_TYPES:
        return None
    if not name_clean:
        name_clean = query_clean
    if not country_clean and state_clean:
        country_clean = "CA" if state_clean in CA_WEST else "US"
    if not country_clean:
        return None

    return CatalogResort(
        query=query_clean,
        name=name_clean,
        state=state_clean,
        country=country_clean,
        region=infer_region(country_clean, state_clean),
        pass_type=pass_clean,
    )


def fetch_ikon_resorts() -> List[CatalogResort]:
    catalog = request_json("https://account.ikonpass.com/api/v2/product-catalog").get("data", [])
    if not isinstance(catalog, list) or not catalog:
        return []

    def resort_count(product: Dict[str, Any]) -> int:
        counts = []
        for access in product.get("access", []):
            ids = access.get("resort_ids", [])
            if isinstance(ids, list):
                counts.append(len(ids))
        return max(counts) if counts else 0

    target = max(catalog, key=resort_count)
    details_url = f"https://account.ikonpass.com/api/v2/products/{target['id']}/access-details"
    details = request_json(details_url).get("data", [])
    if not details:
        return []

    resorts: Dict[str, CatalogResort] = {}
    for access in details[0].get("access", []):
        for resort in access.get("resorts", []):
            raw_name = clean_text(str(resort.get("name", "")))
            if not raw_name:
                continue
            name, state, country = split_name_state_country(
                raw_name,
                fallback_country=str(resort.get("region", "")),
                fallback_subregion=str(resort.get("subregion", "")),
                tags=resort.get("tags", []),
            )
            query = build_query(name, state, country, raw_source_name=raw_name)
            item = ensure_catalog_resort(
                query=query,
                name=name,
                state=state,
                country=country,
                pass_type="ikon",
            )
            if item is None:
                continue
            resorts[item.query.lower()] = item
    return list(resorts.values())


def flatten_ikon_destination_names(destinations: List[Dict[str, Any]]) -> List[str]:
    names: List[str] = []
    seen: set[str] = set()

    for destination in destinations:
        if not isinstance(destination, dict):
            continue
        sub_destinations = [x for x in (destination.get("subDestinations") or []) if isinstance(x, dict)]
        candidates = [destination] if bool(destination.get("ignoreSubDestinations")) or not sub_destinations else sub_destinations
        for candidate in candidates:
            raw_name = clean_text(candidate.get("name") or candidate.get("title") or "")
            if not raw_name:
                continue
            canonical = canonical_ikon_check_name(raw_name)
            if not canonical or canonical in seen:
                continue
            seen.add(canonical)
            names.append(raw_name)
    return names


def fetch_ikon_destination_names() -> List[str]:
    url = f"{IKON_SANITY_QUERY_URL}?{urlencode({'query': IKON_DESTINATIONS_QUERY})}"
    payload = request_json(url)
    rows = payload.get("result", [])
    if not isinstance(rows, list):
        return []
    return flatten_ikon_destination_names(rows)


def clean_epic_text(text: str) -> str:
    t = clean_text(text)
    t = re.sub(r",\s*opens in a new window$", "", t, flags=re.IGNORECASE).strip()
    t = t.replace("Liberty Mountain’s", "Liberty Mountain")
    return t


class EpicLinkParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.capture = False
        self.href = ""
        self.text = ""
        self.items: List[tuple[str, str]] = []

    def handle_starttag(self, tag: str, attrs: List[tuple[str, Optional[str]]]) -> None:
        if tag != "a":
            return
        href = dict(attrs).get("href", "") or ""
        if href.startswith("https://www.") and "/plan-your-trip/lift-access/" in href and "epicpass.com" not in href:
            self.capture = True
            self.href = href
            self.text = ""

    def handle_data(self, data: str) -> None:
        if self.capture:
            self.text += data

    def handle_endtag(self, tag: str) -> None:
        if tag == "a" and self.capture:
            self.capture = False
            text = clean_epic_text(self.text)
            if text:
                self.items.append((self.href, text))


def fetch_epic_resorts() -> List[CatalogResort]:
    html = request_text("https://www.epicpass.com/regions.aspx")
    parser = EpicLinkParser()
    parser.feed(html)

    out: Dict[str, CatalogResort] = {}
    for _, text in parser.items:
        name, state, country = split_name_state_country(text, fallback_country="US")
        query = build_query(name, state, country, raw_source_name=text)
        item = ensure_catalog_resort(
            query=query,
            name=name,
            state=state,
            country=country or "US",
            pass_type="epic",
        )
        if item is None:
            continue
        out[item.query.lower()] = item
    return list(out.values())


class IndyResortParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.capture = False
        self.depth = 0
        self.href = ""
        self.text = ""
        self.alt_name = ""
        self.is_xc_only = False
        self.items: List[tuple[str, str, str, bool]] = []

    def handle_starttag(self, tag: str, attrs: List[tuple[str, Optional[str]]]) -> None:
        data = dict(attrs)
        if tag == "a":
            klass = data.get("class", "") or ""
            href = data.get("href", "") or ""
            if "/our-resorts/" in href and "node--type-resort" in klass:
                self.capture = True
                self.depth = 1
                self.href = href
                self.text = ""
                self.alt_name = ""
                self.is_xc_only = str(data.get("data-isxconly", "false")).lower() == "true"
                return
        if self.capture:
            self.depth += 1
            if tag == "img" and not self.alt_name:
                alt = clean_text(data.get("alt", "") or "")
                if alt:
                    self.alt_name = alt

    def handle_data(self, data: str) -> None:
        if self.capture:
            self.text += data

    def handle_endtag(self, tag: str) -> None:
        if not self.capture:
            return
        self.depth -= 1
        if self.depth == 0:
            self.capture = False
            text = clean_text(self.text)
            self.items.append((self.href, self.alt_name, text, self.is_xc_only))


def parse_location_from_text(block_text: str, resort_name: str) -> tuple[str, str]:
    idx = block_text.find(resort_name)
    prefix = block_text[:idx].strip() if idx > 0 else block_text
    m = re.search(r",\s*([A-Z]{2}),\s*([A-Za-z ]+)\b", prefix)
    if m:
        return normalize_state(m.group(1)), normalize_country_code(m.group(2))
    m2 = re.search(r",\s*([A-Za-z ]+)\b", prefix)
    if m2:
        return "", normalize_country_code(m2.group(1))
    return "", ""


def fetch_indy_resorts() -> List[CatalogResort]:
    html = request_text("https://www.indyskipass.com/our-resorts/")
    parser = IndyResortParser()
    parser.feed(html)

    out: Dict[str, CatalogResort] = {}
    for _, alt_name, text, is_xc_only in parser.items:
        if is_xc_only:
            continue
        name = clean_text(alt_name)
        if not name:
            continue
        state, country = parse_location_from_text(text, name)
        if not country:
            country = "US"
        query = build_query(name, state, country, raw_source_name=f"{name}, {state}" if state else name)
        item = ensure_catalog_resort(
            query=query,
            name=name,
            state=state,
            country=country,
            pass_type="indy",
        )
        if item is None:
            continue
        out[item.query.lower()] = item
    return list(out.values())


def normalize_existing_entry(entry: Dict[str, Any]) -> Dict[str, Any] | None:
    raw_query = clean_text(entry.get("query") or entry.get("name") or "")
    raw_name = clean_text(entry.get("name") or raw_query)
    if not raw_query and not raw_name:
        return None

    state = normalize_state(entry.get("state") or "")
    country = normalize_country_code(entry.get("country") or "")
    if not country and state:
        country = "CA" if state in CA_WEST else "US"

    name, parsed_state, parsed_country = split_name_state_country(
        raw_query or raw_name,
        fallback_country=country,
    )
    state = state or parsed_state
    country = country or parsed_country
    if not country and state:
        country = "CA" if state in CA_WEST else "US"
    if not country:
        return None

    name = raw_name or name
    query = raw_query or build_query(name, state, country)

    pass_types = sorted(
        {
            str(v).strip().lower()
            for v in (entry.get("pass_types") or [])
            if str(v).strip().lower() in VALID_PASS_TYPES
        }
    )
    if not pass_types:
        return None

    default_enabled_raw = entry.get("default_enabled", True)
    if isinstance(default_enabled_raw, str):
        default_enabled = default_enabled_raw.strip().lower() not in {"false", "0", "no", "off"}
    else:
        default_enabled = bool(default_enabled_raw)

    return {
        "resort_id": clean_text(entry.get("resort_id") or slugify(query)),
        "query": query,
        "name": name,
        "state": state,
        "country": country,
        "region": infer_region(country, state),
        "pass_types": pass_types,
        "default_enabled": default_enabled,
    }


def merge_entries(existing: List[Dict[str, Any]], sources: Iterable[CatalogResort]) -> List[Dict[str, Any]]:
    merged_by_query: Dict[str, Dict[str, Any]] = {}
    merged_by_canonical: Dict[str, str] = {}

    for raw in existing:
        normalized = normalize_existing_entry(raw)
        if normalized is None:
            continue
        query_key = normalized["query"].lower()
        canonical = dedupe_key(normalized["name"], normalized["state"], normalized["country"])
        merged_by_query[query_key] = normalized
        if canonical:
            merged_by_canonical[canonical] = query_key

    for src in sources:
        canonical = dedupe_key(src.name, src.state, src.country)
        query_key = src.query.lower()
        match_key = query_key
        if canonical and canonical in merged_by_canonical:
            match_key = merged_by_canonical[canonical]

        if match_key in merged_by_query:
            row = merged_by_query[match_key]
            row["pass_types"] = sorted(set(row.get("pass_types", [])) | {src.pass_type})
            if not row.get("state") and src.state:
                row["state"] = src.state
            if not row.get("country") and src.country:
                row["country"] = src.country
            if not row.get("region") and src.region:
                row["region"] = src.region
            if not row.get("name") and src.name:
                row["name"] = src.name
            if canonical:
                merged_by_canonical[canonical] = match_key
            continue

        row = {
            "resort_id": slugify(src.query),
            "query": src.query,
            "name": src.name,
            "state": src.state,
            "country": src.country,
            "region": src.region,
            "pass_types": [src.pass_type],
            "default_enabled": False,
        }
        merged_by_query[query_key] = row
        if canonical:
            merged_by_canonical[canonical] = query_key

    rows = list(merged_by_query.values())
    rows.sort(key=lambda item: (not item.get("default_enabled", True), item.get("query", "")))
    return rows


def load_existing_catalog(path: Path) -> List[Dict[str, Any]]:
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, list):
        raise ValueError(f"{path} must contain a JSON-compatible YAML list")
    return [item for item in data if isinstance(item, dict)]


def summarize_catalog(entries: List[Dict[str, Any]]) -> Dict[str, Any]:
    pass_counts: Dict[str, int] = {}
    for item in entries:
        for pass_type in item.get("pass_types", []) if isinstance(item.get("pass_types"), list) else []:
            key = str(pass_type).strip().lower()
            if not key:
                continue
            pass_counts[key] = pass_counts.get(key, 0) + 1
    return {
        "total": len(entries),
        "default_enabled": sum(1 for item in entries if bool(item.get("default_enabled", True))),
        "pass_counts": pass_counts,
    }


def validate_coverage(entries: List[Dict[str, Any]]) -> List[str]:
    errors = []
    stats = summarize_catalog(entries)
    pass_counts = stats["pass_counts"]
    for pass_type in sorted(VALID_PASS_TYPES):
        if int(pass_counts.get(pass_type, 0)) <= 0:
            errors.append(f"missing pass coverage: {pass_type}")
    return errors


def _catalog_ikon_name_map(entries: List[Dict[str, Any]]) -> Dict[str, str]:
    out: Dict[str, str] = {}
    for entry in entries:
        pass_types = [str(v).strip().lower() for v in (entry.get("pass_types") or []) if str(v).strip()]
        if "ikon" not in pass_types:
            continue
        source_name = clean_text(entry.get("name") or "")
        if not source_name:
            source_name, _, _ = split_name_state_country(clean_text(entry.get("query") or ""))
        canonical = canonical_ikon_check_name(source_name)
        if canonical and canonical not in out:
            out[canonical] = source_name
    return out


def _ikon_name_matches_catalog(name_canonical: str, catalog_canonicals: set[str]) -> bool:
    if name_canonical in catalog_canonicals:
        return True

    aliases = IKON_DESTINATION_CANONICAL_ALIASES.get(name_canonical, set())
    if any(alias in catalog_canonicals for alias in aliases):
        return True

    for canonical, canonical_aliases in IKON_DESTINATION_CANONICAL_ALIASES.items():
        if name_canonical in canonical_aliases and canonical in catalog_canonicals:
            return True
    for catalog_canonical in catalog_canonicals:
        if len(name_canonical) >= 5 and (name_canonical in catalog_canonical or catalog_canonical in name_canonical):
            return True
    return False


def validate_ikon_destinations_coverage(entries: List[Dict[str, Any]], ikon_destination_names: List[str]) -> List[str]:
    if not ikon_destination_names:
        return [f"ikon destinations check returned 0 names from {IKON_DESTINATIONS_PAGE_URL}"]

    catalog_names = _catalog_ikon_name_map(entries)
    catalog_canonicals = set(catalog_names.keys())
    missing: List[str] = []
    for name in ikon_destination_names:
        canonical = canonical_ikon_check_name(name)
        if not canonical:
            continue
        if _ikon_name_matches_catalog(canonical, catalog_canonicals):
            continue
        missing.append(name)

    if not missing:
        return []
    sample = ", ".join(missing[:10])
    suffix = "" if len(missing) <= 10 else ", ..."
    return [f"ikon destinations missing from catalog ({len(missing)}): {sample}{suffix}"]


def run_validate_only(path: Path, *, check_ikon_destinations: bool) -> int:
    rows = load_existing_catalog(path)
    errors = validate_resort_catalog(rows)
    errors.extend(validate_coverage(rows))
    ikon_destination_names: List[str] = []
    if check_ikon_destinations:
        try:
            ikon_destination_names = fetch_ikon_destination_names()
        except Exception as exc:
            errors.append(f"ikon destinations check failed ({IKON_DESTINATIONS_PAGE_URL}): {exc}")
        else:
            errors.extend(validate_ikon_destinations_coverage(rows, ikon_destination_names))

    stats = summarize_catalog(rows)
    print(f"Catalog: {path}")
    print(f"Total resorts: {stats['total']}")
    print(f"Default enabled: {stats['default_enabled']}")
    print(f"Pass counts: {json.dumps(stats['pass_counts'], ensure_ascii=False, sort_keys=True)}")
    if check_ikon_destinations and ikon_destination_names:
        print(f"Ikon destinations (from page): {len(ikon_destination_names)}")

    if errors:
        print("Validation failed:")
        for msg in errors:
            print(f"- {msg}")
        return 1
    print("Validation passed.")
    return 0


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Sync CloseSnow resorts catalog from Ikon/Epic/Indy sources.")
    p.add_argument("--input", default=str(DEFAULT_RESORTS_PATH), help="Existing catalog file path.")
    p.add_argument("--output", default=str(DEFAULT_RESORTS_PATH), help="Output catalog file path.")
    p.add_argument("--validate-only", action="store_true", help="Validate the existing catalog and exit.")
    p.add_argument(
        "--skip-ikon-destinations-check",
        action="store_true",
        help=f"Skip Ikon destination coverage check against {IKON_DESTINATIONS_PAGE_URL}.",
    )
    return p.parse_args()


def main() -> int:
    args = parse_args()
    input_path = Path(args.input).resolve()
    output_path = Path(args.output).resolve()
    check_ikon_destinations = not args.skip_ikon_destinations_check

    if args.validate_only:
        return run_validate_only(input_path, check_ikon_destinations=check_ikon_destinations)

    existing = load_existing_catalog(input_path)
    ikon = fetch_ikon_resorts()
    epic = fetch_epic_resorts()
    indy = fetch_indy_resorts()

    merged = merge_entries(existing, [*ikon, *epic, *indy])
    errors = validate_resort_catalog(merged)
    errors.extend(validate_coverage(merged))
    ikon_destination_names: List[str] = []
    if check_ikon_destinations:
        try:
            ikon_destination_names = fetch_ikon_destination_names()
        except Exception as exc:
            errors.append(f"ikon destinations check failed ({IKON_DESTINATIONS_PAGE_URL}): {exc}")
        else:
            errors.extend(validate_ikon_destinations_coverage(merged, ikon_destination_names))
    if errors:
        print("Sync failed validation:")
        for msg in errors:
            print(f"- {msg}")
        return 1

    output_path.write_text(json.dumps(merged, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    stats = summarize_catalog(merged)
    print(
        f"Updated {output_path} with {len(ikon)} ikon, {len(epic)} epic, {len(indy)} indy source resorts; "
        f"total {stats['total']} entries."
    )
    print(f"Default enabled: {stats['default_enabled']}")
    print(f"Pass counts: {json.dumps(stats['pass_counts'], ensure_ascii=False, sort_keys=True)}")
    if check_ikon_destinations and ikon_destination_names:
        print(f"Ikon destinations (from page): {len(ikon_destination_names)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
