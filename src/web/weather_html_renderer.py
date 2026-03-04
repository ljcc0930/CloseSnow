#!/usr/bin/env python3
from __future__ import annotations

from datetime import datetime, timezone
from typing import Dict, List

from src.web.weather_table_renderer import (
    render_rain_table,
    render_snowfall_table,
    render_temperature_table,
)


def build_html(snowfall: List[Dict[str, str]], rain: List[Dict[str, str]], temp: List[Dict[str, str]]) -> str:
    snow_table = render_snowfall_table(snowfall)
    rain_table = render_rain_table(rain)
    temp_table = render_temperature_table(temp)
    now_utc = datetime.now(timezone.utc)
    generated_utc_iso = now_utc.replace(microsecond=0).isoformat().replace("+00:00", "Z")
    return f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <!-- Google tag (gtag.js) -->
  <script async src="https://www.googletagmanager.com/gtag/js?id=G-V9NBX3H6M9"></script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag() {{dataLayer.push(arguments);}}
    gtag('js', new Date());
    gtag('config', 'G-V9NBX3H6M9');
  </script>
  <title>Ski Resorts Weather Forcast</title>
  <link rel="stylesheet" href="assets/css/weather_page.css" />
</head>
<body>
  <main>
    <h1>Ski Resorts Weather Forcast</h1>
    <div class="report-date">
      <div class="report-powered">
        Powered by <a href="https://open-meteo.com/en/docs/ecmwf-api" target="_blank" rel="noopener noreferrer">Open-Meteo ECMWF IFS 0.25</a>
      </div>
      <div id="report-date" class="report-generated" data-generated-utc="{generated_utc_iso}">Generated At: loading...</div>
    </div>
    {snow_table}
    {rain_table}
    {temp_table}
  </main>
  <footer class="page-footer">
    Author: Codex, vibed by <a href="https://ljcc0930.github.io/" target="_blank" rel="noopener noreferrer">ljcc</a>. <a href="https://github.com/ljcc0930/CloseSnow/issues/new?template=feature_request.yml" target="_blank" rel="noopener noreferrer">feature requests</a> are welcome.
  </footer>
  <script src="assets/js/weather_page.js"></script>
</body>
</html>"""
