from __future__ import annotations

from src.web.resort_hourly_context import build_resort_daily_summary_context


def test_build_resort_daily_summary_context_includes_recent_history():
    payload = {
        "reports": [
            {
                "resort_id": "snowbird-ut",
                "query": "Snowbird, UT",
                "display_name": "Snowbird, Utah",
                "website": "https://example.com/snowbird",
                "nearby_airports": [
                    {
                        "airport_id": "slc-salt-lake-city",
                        "iata_code": "SLC",
                        "display_name": "Salt Lake City International Airport",
                        "location_label": "Salt Lake City, UT, US",
                        "latitude": 40.7884,
                        "longitude": -111.9778,
                        "distance_miles": 22.4,
                    }
                ],
                "daily": [{"date": "2026-03-13"}],
                "past_14d_daily": [
                    {"date": "2026-03-08", "weather_code": 3},
                    {"date": "2026-03-03", "weather_code": 3},
                    {"date": "2026-03-05", "weather_code": 3},
                    {"date": "2026-03-02", "weather_code": 3},
                    {"date": "2026-03-07", "weather_code": 3},
                    {"date": "2026-03-04", "weather_code": 3},
                    {"date": "2026-03-01", "weather_code": 3},
                    {"date": "2026-03-06", "weather_code": 3},
                    {"date": "2026-03-10", "weather_code": 3},
                    {"date": "2026-03-12", "weather_code": 3},
                    {"date": "2026-03-14", "weather_code": 3},
                    {"date": "2026-03-09", "weather_code": 3},
                    {"date": "2026-03-13", "weather_code": 3},
                    {"date": "2026-03-11", "weather_code": 3},
                ],
            }
        ]
    }

    context = build_resort_daily_summary_context(payload, "snowbird-ut")

    assert context is not None
    assert context["display_name"] == "Snowbird, Utah"
    assert context["nearbyAirports"][0]["iata_code"] == "SLC"
    assert [row["date"] for row in context["past14dDaily"]] == [
        "2026-03-01",
        "2026-03-02",
        "2026-03-03",
        "2026-03-04",
        "2026-03-05",
        "2026-03-06",
        "2026-03-07",
        "2026-03-08",
        "2026-03-09",
        "2026-03-10",
        "2026-03-11",
        "2026-03-12",
        "2026-03-13",
        "2026-03-14",
    ]


def test_build_resort_daily_summary_context_omits_history_when_missing():
    payload = {
        "reports": [
            {
                "resort_id": "snowbird-ut",
                "query": "Snowbird, UT",
                "daily": [{"date": "2026-03-13"}],
            }
        ]
    }

    context = build_resort_daily_summary_context(payload, "snowbird-ut")

    assert context is not None
    assert context["daily"] == [{"date": "2026-03-13"}]
    assert "past14dDaily" not in context
