// Ocean Tide configuration
window.CONFIG = {
  // NOAA tide PREDICTION station (Destin, East Pass, FL — subordinate, predictions only)
  tideStation: "8729511",
  stationName: "Destin (East Pass)",
  // Nearest reference gauge that reports water temperature (Pensacola)
  waterTempStation: "8729840",
  // Location for sun/moon + weather (Destin / East Pass)
  lat: 30.393, lon: -86.513,
  tz: "America/Chicago",
  units: { tide: "ft", temp: "°F", wind: "mph" },
  datum: "MLLW",
  // Day/night auto-dim schedule (local hours, 24h). Night = dark theme.
  nightStart: 21, nightEnd: 6,
  refreshMinutes: 30,
  // How many days of future tide predictions the chart can be scrolled through.
  chartDays: 30,
  // How many days of past tides the chart can be scrolled back through.
  pastDays: 3,
  // When true, render from built-in sample data (no network) so the layout shows offline.
  useMock: false
};
