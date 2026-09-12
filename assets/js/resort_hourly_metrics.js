(function () {
  const metricDefs = [
    { key: "snowfall", label: "snowfall (cm)", title: "Snowfall", unit: "cm", color: "var(--chart-snow)" },
    { key: "rain", label: "rain (mm)", title: "Rain", unit: "mm", color: "var(--chart-rain)" },
    {
      key: "precipitation_probability",
      label: "precip prob (%)",
      title: "Precipitation Probability",
      unit: "%",
      color: "var(--chart-probability)",
    },
    { key: "snow_depth", label: "snow depth (m)", title: "Snow Depth", unit: "m", color: "var(--chart-depth)" },
    { key: "wind_speed_10m", label: "wind speed (km/h)", title: "Wind Speed 10m", unit: "km/h", color: "var(--chart-wind)" },
    {
      key: "wind_direction_10m",
      label: "wind dir (deg)",
      title: "Wind Direction 10m",
      unit: "deg",
      color: "var(--chart-direction)",
    },
    { key: "visibility", label: "visibility (m)", title: "Visibility", unit: "m", color: "var(--chart-visibility)" },
  ];

  const trimHourlyPayload = (payload, hours) => {
    const hourly = payload?.hourly || {};
    const times = Array.isArray(hourly.time) ? hourly.time : [];
    const maxHours = Math.max(1, Number(hours) || 72);
    const n = Math.min(maxHours, times.length);
    const trimmedHourly = { time: times.slice(0, n) };
    metricDefs.forEach((metric) => {
      const values = Array.isArray(hourly[metric.key]) ? hourly[metric.key] : [];
      trimmedHourly[metric.key] = values.slice(0, n);
    });
    return {
      ...payload,
      hours: n,
      hourly: trimmedHourly,
    };
  };

  window.CloseSnowResortHourlyMetrics = {
    metricDefs,
    metricKeys: metricDefs.map((metric) => metric.key),
    trimHourlyPayload,
  };
}());
