from src.web.data_sources.api_source import load_api_payload
from src.web.data_sources.source_selector import load_payload
from src.web.data_sources.static_json_source import load_static_payload

__all__ = [
    "load_api_payload",
    "load_static_payload",
    "load_payload",
]
