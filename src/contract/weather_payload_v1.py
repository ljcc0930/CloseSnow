from __future__ import annotations

from typing import List, Literal, Optional, Tuple, TypedDict, Union

SCHEMA_VERSION = "weather_payload_v1"
JsonNumber = Union[int, float]

DAILY_NUMBER_FIELDS: Tuple[str, ...] = (
    "snowfall_cm",
    "rain_mm",
    "precipitation_mm",
    "temperature_max_c",
    "temperature_min_c",
)
DAILY_TIME_FIELDS: Tuple[str, ...] = ("sunrise_iso", "sunset_iso", "sunrise_local_hhmm", "sunset_local_hhmm")
REPORT_STRING_FIELDS: Tuple[str, ...] = (
    "resort_id",
    "display_name",
    "matched_name",
    "country",
    "country_code",
    "admin1",
    "region",
    "subregion",
    "model",
    "forecast_timezone",
    "website",
    "state_name",
    "country_name",
    "city",
    "address",
)
REPORT_NUMBER_FIELDS: Tuple[str, ...] = (
    "input_latitude",
    "input_longitude",
    "resolved_latitude",
    "resolved_longitude",
    "week1_total_snowfall_cm",
    "week2_total_snowfall_cm",
    "week1_total_rain_mm",
    "week2_total_rain_mm",
)


class CacheInfo(TypedDict):
    file: str
    hits: int
    misses: int
    geocode_cache_hours: int
    forecast_cache_hours: int
    api_retries: int


class UnitsInfo(TypedDict):
    snowfall_cm: str
    rain_mm: str
    precipitation_mm: str
    temperature_max_c: str
    temperature_min_c: str


class FailedItem(TypedDict):
    query: str
    reason: str


class DailyForecastRow(TypedDict, total=False):
    date: Optional[str]
    snowfall_cm: Optional[JsonNumber]
    rain_mm: Optional[JsonNumber]
    precipitation_mm: Optional[JsonNumber]
    temperature_max_c: Optional[JsonNumber]
    temperature_min_c: Optional[JsonNumber]
    weather_code: Optional[int]
    sunrise_iso: Optional[str]
    sunset_iso: Optional[str]
    sunrise_local_hhmm: Optional[str]
    sunset_local_hhmm: Optional[str]
    above_0: Optional[int]


class NearbyAirport(TypedDict, total=False):
    airport_id: str
    iata_code: str
    display_name: str
    location_label: str
    latitude: JsonNumber
    longitude: JsonNumber
    distance_miles: JsonNumber


class WeatherReportRequired(TypedDict):
    query: str
    daily: List[DailyForecastRow]


class WeatherReport(WeatherReportRequired, total=False):
    resort_id: str
    display_name: str
    matched_name: str
    country: str
    country_code: str
    admin1: str
    region: str
    subregion: str
    pass_types: List[str]
    model: str
    forecast_timezone: str
    input_latitude: JsonNumber
    input_longitude: JsonNumber
    resolved_latitude: JsonNumber
    resolved_longitude: JsonNumber
    week1_total_snowfall_cm: JsonNumber
    week2_total_snowfall_cm: JsonNumber
    week1_total_rain_mm: JsonNumber
    week2_total_rain_mm: JsonNumber
    past_14d_daily: List[DailyForecastRow]
    default_resort: bool
    ljcc_favorite: bool
    website: str
    state_name: str
    country_name: str
    city: str
    address: str
    search_terms: List[str]
    nearby_airports: List[NearbyAirport]


class WeatherPayloadV1(TypedDict):
    schema_version: Literal["weather_payload_v1"]
    generated_at_utc: str
    source: str
    model: str
    forecast_days: int
    units: UnitsInfo
    cache: CacheInfo
    resorts_count: int
    failed_count: int
    failed: List[FailedItem]
    reports: List[WeatherReport]
