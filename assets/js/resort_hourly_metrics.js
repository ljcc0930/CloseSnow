(function () {
  const metricDefs = [
    { key: "snowfall", label: "snowfall (cm)", title: "Snowfall", unit: "cm", color: "#2563eb" },
    { key: "rain", label: "rain (mm)", title: "Rain", unit: "mm", color: "#0891b2" },
    {
      key: "precipitation_probability",
      label: "precip prob (%)",
      title: "Precipitation Probability",
      unit: "%",
      color: "#7c3aed",
    },
    { key: "snow_depth", label: "snow depth (m)", title: "Snow Depth", unit: "m", color: "#0f766e" },
    { key: "wind_speed_10m", label: "wind speed (km/h)", title: "Wind Speed 10m", unit: "km/h", color: "#b45309" },
    {
      key: "wind_direction_10m",
      label: "wind dir (deg)",
      title: "Wind Direction 10m",
      unit: "deg",
      color: "#be185d",
    },
    { key: "visibility", label: "visibility (m)", title: "Visibility", unit: "m", color: "#334155" },
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
