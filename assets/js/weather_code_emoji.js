(function () {
  const UNKNOWN_WEATHER_EMOJI = "❓";
  const WEATHER_CODE_EMOJI_GROUPS = [
    [[0], "☀️"],
    [[1], "🌤️"],
    [[2], "⛅"],
    [[3], "☁️"],
    [[45, 48], "🌫️"],
    [[51, 53, 55, 56, 57], "🌦️"],
    [[61, 63, 65, 80, 81, 82], "🌧️"],
    [[71, 73, 75, 77, 85, 86], "❄️"],
    [[95, 96, 99], "⛈️"],
  ];

  const emojiForWeatherCode = (rawCode) => {
    const code = Number(rawCode);
    if (!Number.isFinite(code)) return UNKNOWN_WEATHER_EMOJI;
    const match = WEATHER_CODE_EMOJI_GROUPS.find(([codes]) => codes.includes(code));
    return match ? match[1] : UNKNOWN_WEATHER_EMOJI;
  };

  window.CloseSnowWeatherCode = {
    emojiForWeatherCode,
  };
})();
