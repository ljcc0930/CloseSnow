from __future__ import annotations

import json
import os
import threading
import time
import urllib.parse
from datetime import date
from typing import Any, Dict, List, Optional, Tuple


class JsonCache:
    def __init__(self, path: str) -> None:
        self.path = path
        self.data: Dict[str, Any] = {"version": 1, "entries": {}}
        self.hits = 0
        self.misses = 0
        self._lock = threading.RLock()
        self._load()

    def _load(self) -> None:
        if not os.path.exists(self.path):
            return
        try:
            with open(self.path, "r", encoding="utf-8") as f:
                parsed = json.load(f)
            if isinstance(parsed, dict) and isinstance(parsed.get("entries"), dict):
                self.data = parsed
        except Exception:
            self.data = {"version": 1, "entries": {}}

    def get(self, key: str, max_age_seconds: int) -> Optional[Any]:
        with self._lock:
            item = self.data["entries"].get(key)
            if not item:
                self.misses += 1
                return None
            ts = item.get("ts")
            if not isinstance(ts, (int, float)):
                self.misses += 1
                return None
            if time.time() - ts > max_age_seconds:
                self.misses += 1
                return None
            self.hits += 1
            return item.get("value")

    def set(self, key: str, value: Any) -> None:
        with self._lock:
            self.data["entries"][key] = {"ts": time.time(), "value": value}

    def save(self) -> None:
        parent = os.path.dirname(self.path)
        if parent:
            os.makedirs(parent, exist_ok=True)
        with self._lock:
            with open(self.path, "w", encoding="utf-8") as f:
                json.dump(self.data, f, ensure_ascii=False)


class ResortCoordinateCache:
    def __init__(self, path: str) -> None:
        self.path = path
        self.data: Dict[str, Any] = {"version": 1, "entries": {}}
        self._dirty = False
        self._lock = threading.RLock()
        self._load()

    @staticmethod
    def _normalize_query(query: str) -> str:
        return (query or "").strip().lower()

    def _load(self) -> None:
        if not os.path.exists(self.path):
            return
        try:
            with open(self.path, "r", encoding="utf-8") as f:
                parsed = json.load(f)
            if isinstance(parsed, dict) and isinstance(parsed.get("entries"), dict):
                self.data = parsed
        except Exception:
            self.data = {"version": 1, "entries": {}}

    def get(self, query: str) -> Optional[Dict[str, Any]]:
        key = self._normalize_query(query)
        with self._lock:
            value = self.data["entries"].get(key)
            if isinstance(value, dict):
                return value
            return None

    def set(self, query: str, value: Dict[str, Any]) -> None:
        key = self._normalize_query(query)
        with self._lock:
            self.data["entries"][key] = value
            self._dirty = True

    def save(self) -> None:
        with self._lock:
            if not self._dirty:
                return
        parent = os.path.dirname(self.path)
        if parent:
            os.makedirs(parent, exist_ok=True)
        with self._lock:
            with open(self.path, "w", encoding="utf-8") as f:
                json.dump(self.data, f, ensure_ascii=False)
            self._dirty = False


def dated_cache_path(path: str, d: Optional[date] = None) -> str:
    if d is None:
        d = date.today()
    base, ext = os.path.splitext(path)
    suffix = d.isoformat()
    if ext:
        return f"{base}_{suffix}{ext}"
    return f"{path}_{suffix}"


def canonical_query(params: Dict[str, Any]) -> str:
    pairs: List[Tuple[str, str]] = []
    for key in sorted(params.keys()):
        value = params[key]
        if isinstance(value, list):
            for item in value:
                pairs.append((key, str(item)))
        else:
            pairs.append((key, str(value)))
    return urllib.parse.urlencode(pairs, doseq=True)
