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
    const reducedMotion = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
    let controlsBound = false;
    let transitionTimer = null;
    let preference = null;
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (isTheme(saved)) preference = saved;
    } catch (_) {
      // A blocked storage API must not prevent the page or switch from working.
    }

    function finishTransition() {
      if (transitionTimer !== null) window.clearTimeout(transitionTimer);
      transitionTimer = null;
      delete document.documentElement.dataset.themeTransitioning;
    }

    function applyTheme(animate = false) {
      const theme = preference || (media && media.matches ? "dark" : "light");
      const changed = document.documentElement.dataset.theme !== theme;
      if (changed) {
        finishTransition();
        if (animate && controlsBound && !reducedMotion?.matches) {
          // CSS interpolates only colors; a new choice replaces the previous
          // transition without delaying state, focus, or the user's next click.
          document.documentElement.dataset.themeTransitioning = "true";
          transitionTimer = window.setTimeout(finishTransition, 240);
        }
      }
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
      applyTheme(true);
    }

    // This script runs in the head so the first styled paint uses the right theme.
    applyTheme();
    function bindControls() {
      document.querySelectorAll("[data-theme-toggle]").forEach((button) => {
        button.addEventListener("click", toggleTheme);
      });
      applyTheme();
      controlsBound = true;
    }
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", bindControls, { once: true });
    } else {
      bindControls();
    }

    if (media) {
      const followSystem = () => applyTheme(true);
      if (media.addEventListener) media.addEventListener("change", followSystem);
      else if (media.addListener) media.addListener(followSystem);
    }
    if (reducedMotion) {
      const respectReducedMotion = () => { if (reducedMotion.matches) finishTransition(); };
      if (reducedMotion.addEventListener) reducedMotion.addEventListener("change", respectReducedMotion);
      else if (reducedMotion.addListener) reducedMotion.addListener(respectReducedMotion);
    }
    window.addEventListener("storage", (event) => {
      if (event.key !== STORAGE_KEY && event.key !== null) return;
      try {
        if (event.storageArea && event.storageArea !== window.localStorage) return;
      } catch (_) {
        return;
      }
      preference = isTheme(event.newValue) ? event.newValue : null;
      applyTheme(true);
    });
  };
});
