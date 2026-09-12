(function () {
  const UNKNOWN_WEATHER_EMOJI = "❓";
  const WEATHER_CODE_EMOJI_GROUPS = [
    [[0], "☀️", "Clear sky"],
    [[1], "🌤️", "Mainly clear"],
    [[2], "⛅", "Partly cloudy"],
    [[3], "☁️", "Overcast"],
    [[45, 48], "🌫️", "Fog"],
    [[51, 53, 55, 56, 57], "🌦️", "Drizzle"],
    [[61, 63, 65, 80, 81, 82], "🌧️", "Rain"],
    [[71, 73, 75, 77, 85, 86], "❄️", "Snow"],
    [[95, 96, 99], "⛈️", "Thunderstorms"],
  ];

  const groupForWeatherCode = (rawCode) => {
    if (rawCode === null || rawCode === undefined || (typeof rawCode === "string" && !rawCode.trim())) {
      return null;
    }
    const code = Number(rawCode);
    if (!Number.isFinite(code)) return null;
    return WEATHER_CODE_EMOJI_GROUPS.find(([codes]) => codes.includes(code)) || null;
  };
  const emojiForWeatherCode = (rawCode) => groupForWeatherCode(rawCode)?.[1] || UNKNOWN_WEATHER_EMOJI;
  const descriptionForWeatherCode = (rawCode) => groupForWeatherCode(rawCode)?.[2] || "Weather unavailable";

  window.CloseSnowWeatherCode = {
    emojiForWeatherCode,
    descriptionForWeatherCode,
  };
})();
