// One unit control is one action: clicking anywhere reverses its current mode.
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.CloseSnowUnitSwitch = api;
}(typeof window !== "undefined" ? window : null, function () {
  "use strict";

  const sync = (toggle, mode) => {
    const current = mode === "imperial" ? "imperial" : "metric";
    toggle.setAttribute("data-mode", current);
    if (toggle.getAttribute("role") === "switch") toggle.setAttribute("aria-checked", String(current === "imperial"));
    toggle.querySelectorAll("[data-unit-mode]").forEach((option) => {
      const active = option.getAttribute("data-unit-mode") === current;
      option.classList.toggle("is-active", active);
      // Older overview markup still contains two buttons while stacked PRs
      // are merged. Keep those controls synchronized until they are replaced.
      if (option.tagName === "BUTTON") option.setAttribute("aria-pressed", String(active));
      if (!active) toggle.setAttribute("title", `Switch to ${option.textContent.trim()}`);
    });
  };

  const requestFor = (target) => {
    const toggle = target?.closest?.(".unit-toggle");
    if (!toggle || toggle.disabled) return null;
    const mode = toggle.getAttribute("data-mode") === "imperial" ? "metric" : "imperial";
    if (toggle.hasAttribute("data-compact-summary-toggle")) return { scope: "summary", mode };
    if (toggle.hasAttribute("data-sun-time-toggle")) return { scope: "sun", mode };
    const kind = toggle.getAttribute("data-target-kind");
    return ["snow", "rain", "temp"].includes(kind) ? { scope: "metric", kind, mode } : null;
  };

  return { sync, requestFor };
}));
