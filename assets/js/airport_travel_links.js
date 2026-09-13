// Destination-only links; no location lookup or travel dates are needed.
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.CloseSnowAirportTravelLinks = api;
}(typeof window !== "undefined" ? window : null, function () {
  "use strict";

  const normalizeIata = (value) => {
    const code = typeof value === "string" ? value.trim().toUpperCase() : "";
    return /^[A-Z]{3}$/.test(code) ? code : "";
  };

  const buildFlightsUrl = (iataCode) => {
    const code = normalizeIata(iataCode);
    if (!code) return "";
    const airport = [8, 1, 18, 3, ...Array.from(code, (letter) => letter.charCodeAt(0))];
    // This undocumented URL format was verified against a link produced by the
    // Google Flights UI in September 2026. Each leg contains only the destination
    // airport (outbound arrival / return departure), with no origin or date.
    const bytes = [
      8, 28, 16, 1,
      26, 9, 114, 7, ...airport,
      26, 9, 106, 7, ...airport,
      64, 1, 72, 1, 112, 1, 130, 1, 11, 8,
      255, 255, 255, 255, 255, 255, 255, 255, 255, 1, 152, 1, 1,
    ];
    const token = btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    const url = new URL("https://www.google.com/travel/flights");
    url.searchParams.set("tfs", token);
    url.searchParams.set("tfu", "KgIIAw");
    return url.toString();
  };

  const coordinate = (value, limit) => {
    if (value === null || value === undefined || typeof value === "boolean" || String(value).trim() === "") return null;
    const number = Number(value);
    return Number.isFinite(number) && Math.abs(number) <= limit ? number : null;
  };

  const buildMapsUrl = (airport = {}) => {
    const latitude = coordinate(airport.latitude, 90);
    const longitude = coordinate(airport.longitude, 180);
    const name = String(airport.displayName || "").trim();
    const code = normalizeIata(airport.iataCode);
    const location = String(airport.locationLabel || "").trim();
    const query = latitude !== null && longitude !== null
      ? `${latitude},${longitude}`
      : name ? [name, code, location].filter(Boolean).join(" ") : "";
    if (!query) return "";
    const url = new URL("https://www.google.com/maps/search/");
    url.searchParams.set("api", "1");
    url.searchParams.set("query", query);
    return url.toString();
  };

  const createIcon = (document, kind) => {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", kind === "flights"
      ? "M12 2c1 0 1.5 1 1.5 2v4.5l7 4v2l-7-2V18l3 2v1l-4.5-1-4.5 1v-1l3-2v-5.5l-7 2v-2l7-4V4c0-1 .5-2 1.5-2Z"
      : "M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z M15 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z");
    svg.appendChild(path);
    return svg;
  };

  const createActions = (document, airport) => {
    const links = [
      { kind: "flights", label: "Flights", href: buildFlightsUrl(airport.iataCode) },
      { kind: "map", label: "Map", href: buildMapsUrl(airport) },
    ].filter((link) => link.href);
    if (!links.length) return null;
    const actions = document.createElement("div");
    actions.className = "airport-travel-actions";
    const name = airport.displayName || normalizeIata(airport.iataCode) || "airport";
    links.forEach(({ kind, label, href }) => {
      const link = document.createElement("a");
      link.className = `airport-travel-link airport-travel-link-${kind}`;
      link.href = href;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.setAttribute("aria-label", `${kind === "flights" ? "Find flights to" : "View map of"} ${name} (opens in a new tab)`);
      link.appendChild(createIcon(document, kind));
      const text = document.createElement("span");
      text.textContent = label;
      link.appendChild(text);
      actions.appendChild(link);
    });
    return actions;
  };

  return { normalizeIata, buildFlightsUrl, buildMapsUrl, createActions };
}));
