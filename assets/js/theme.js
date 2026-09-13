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
    let activeTransition = null;
    let revision = 0;
    let targetTheme = null;
    let preference = null;
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (isTheme(saved)) preference = saved;
    } catch (_) {
      // A blocked storage API must not prevent the page or switch from working.
    }

    function updateControls(theme) {
      document.querySelectorAll("[data-theme-toggle]").forEach((button) => {
        button.setAttribute("aria-checked", String(theme === "dark"));
        button.setAttribute("title", theme === "dark" ? "Switch to day theme" : "Switch to night theme");
      });
    }

    function finishTransition() {
      revision += 1;
      if (activeTransition) activeTransition.skipTransition();
      activeTransition = null;
      document.documentElement.dataset.theme = targetTheme;
      delete document.documentElement.dataset.themeTransitioning;
      delete document.documentElement.dataset.themeSnapshot;
    }

    function applyTheme(animate = false) {
      const theme = preference || (media && media.matches ? "dark" : "light");
      updateControls(theme);
      if (theme === targetTheme) return;
      targetTheme = theme;
      const request = ++revision;
      if (activeTransition) activeTransition.skipTransition();
      activeTransition = null;
      delete document.documentElement.dataset.themeTransitioning;
      delete document.documentElement.dataset.themeSnapshot;
      const paint = () => {
        // Skipping a view transition still runs its update callback. A newer
        // choice must win even when an older snapshot has not finished yet.
        if (request !== revision) return;
        document.documentElement.dataset.theme = theme;
        // Capture only the outgoing palette. Capturing the incoming root would
        // remove every live control from hit-testing for the entire animation.
        delete document.documentElement.dataset.themeSnapshot;
      };
      if (!animate || !controlsBound || reducedMotion?.matches || !document.startViewTransition) {
        paint();
        return;
      }
      try {
        // Fade the old page over the live new palette. The switch is excluded
        // from that snapshot so its real thumb, hover, and focus remain intact.
        document.documentElement.dataset.themeTransitioning = "true";
        document.documentElement.dataset.themeSnapshot = "old";
        const transition = document.startViewTransition(paint);
        activeTransition = transition;
        const cleanup = () => {
          if (activeTransition !== transition) return;
          activeTransition = null;
          delete document.documentElement.dataset.themeTransitioning;
          delete document.documentElement.dataset.themeSnapshot;
        };
        transition.ready.catch(() => {}); // Cancellation is expected on rapid toggles.
        transition.finished.then(cleanup, cleanup);
      } catch (_) {
        delete document.documentElement.dataset.themeTransitioning;
        delete document.documentElement.dataset.themeSnapshot;
        paint();
      }
    }

    function toggleTheme() {
      preference = targetTheme === "dark" ? "light" : "dark";
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
      // During snapshot capture the browser can retarget a rapid second click
      // to the root. Keep the theme switch responsive in that short interval.
      document.addEventListener("click", (event) => {
        if (!activeTransition || event.target !== document.documentElement || event.button !== 0) return;
        const hitToggle = [...document.querySelectorAll("[data-theme-toggle]")].some((button) => {
          const bounds = button.getBoundingClientRect();
          return event.clientX >= bounds.left && event.clientX <= bounds.right &&
            event.clientY >= bounds.top && event.clientY <= bounds.bottom;
        });
        if (hitToggle) toggleTheme();
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
