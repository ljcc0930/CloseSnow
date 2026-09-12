(function (root, factory) {
  const createThemeController = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = createThemeController;
  } else {
    createThemeController(root);
  }
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  const STORAGE_KEY = "closesnow_theme_v1";
  const isTheme = (value) => value === "light" || value === "dark";

  return function createThemeController(window) {
    const document = window.document;
    const media = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;
    let preference = null;
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (isTheme(saved)) preference = saved;
    } catch (_) {
      // A blocked storage API must not prevent the page or switch from working.
    }

    function applyTheme() {
      const theme = preference || (media && media.matches ? "dark" : "light");
      document.documentElement.dataset.theme = theme;
      document.querySelectorAll("[data-theme-toggle]").forEach((button) => {
        button.setAttribute("aria-checked", String(theme === "dark"));
        button.setAttribute("title", theme === "dark" ? "Switch to day theme" : "Switch to night theme");
      });
    }

    function toggleTheme() {
      preference = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
      try {
        window.localStorage.setItem(STORAGE_KEY, preference);
      } catch (_) {
        // Keep the in-memory choice for this page when persistence is unavailable.
      }
      applyTheme();
    }

    // This script runs in the head so the first styled paint uses the right theme.
    applyTheme();
    function bindControls() {
      document.querySelectorAll("[data-theme-toggle]").forEach((button) => {
        button.addEventListener("click", toggleTheme);
      });
      applyTheme();
    }
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", bindControls, { once: true });
    } else {
      bindControls();
    }

    if (media) {
      if (media.addEventListener) media.addEventListener("change", applyTheme);
      else if (media.addListener) media.addListener(applyTheme);
    }
    window.addEventListener("storage", (event) => {
      if (event.key !== STORAGE_KEY && event.key !== null) return;
      try {
        if (event.storageArea && event.storageArea !== window.localStorage) return;
      } catch (_) {
        return;
      }
      preference = isTheme(event.newValue) ? event.newValue : null;
      applyTheme();
    });
  };
});
