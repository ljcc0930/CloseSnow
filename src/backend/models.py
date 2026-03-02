from __future__ import annotations

from dataclasses import dataclass
from typing import Optional


@dataclass
class ResortLocation:
    query: str
    name: str
    latitude: float
    longitude: float
    country: Optional[str]
    admin1: Optional[str]
