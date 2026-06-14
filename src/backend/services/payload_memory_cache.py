from __future__ import annotations

import copy
import threading
import time
from dataclasses import dataclass
from typing import Callable, Dict, Hashable, List, Tuple

from src.contract import WeatherPayloadV1


@dataclass
class _PayloadCacheEntry:
    expires_at: float
    payload: WeatherPayloadV1


class PayloadMemoryCache:
    def __init__(self, ttl_seconds: float) -> None:
        self.ttl_seconds = max(0.0, float(ttl_seconds))
        self._entries: Dict[Hashable, _PayloadCacheEntry] = {}
        self._lock = threading.RLock()

    def get_or_load(self, key: Hashable, loader: Callable[[], WeatherPayloadV1]) -> WeatherPayloadV1:
        if self.ttl_seconds <= 0:
            return copy.deepcopy(loader())

        now = time.monotonic()
        with self._lock:
            entry = self._entries.get(key)
            if entry is not None and entry.expires_at > now:
                return copy.deepcopy(entry.payload)

        payload = loader()
        cached_payload = copy.deepcopy(payload)
        expires_at = time.monotonic() + self.ttl_seconds
        with self._lock:
            self._entries[key] = _PayloadCacheEntry(expires_at=expires_at, payload=cached_payload)
        return copy.deepcopy(payload)


def frozen_query_params(qs: Dict[str, List[str]]) -> Tuple[Tuple[str, Tuple[str, ...]], ...]:
    return tuple(sorted((str(key), tuple(str(value) for value in values)) for key, values in qs.items()))
