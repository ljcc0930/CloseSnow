// Keep timeline scrolling independent of forecast rendering and native touch gestures.
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.CloseSnowTimelineScroller = api;
}(typeof window !== "undefined" ? window : null, function () {
  "use strict";

  const createController = ({ window } = {}) => {
    const positions = new Map();
    const bindings = new WeakMap();
    let activeUpdates = [];
    let observer = null;
    const refresh = () => activeUpdates.forEach((update) => update());
    const scrollers = (root) => Array.from(root?.querySelectorAll("[data-timeline-scroll]") || []);
    const cardFor = (scroller) => scroller.closest("[data-timeline-card]");
    const idFor = (scroller) => scroller.dataset.timelineResortId || cardFor(scroller)?.dataset.timelineResortId;
    const maximum = (scroller) => Math.max(0, scroller.scrollWidth - scroller.clientWidth);
    const bounded = (scroller, value) => Math.max(0, Math.min(maximum(scroller), Number(value) || 0));
    const remember = (scroller) => {
      const id = idFor(scroller);
      if (id) positions.set(id, bounded(scroller, scroller.scrollLeft));
    };

    const capture = (root) => scrollers(root).forEach(remember);

    const attach = (scroller) => {
      const card = cardFor(scroller);
      const previous = card?.querySelector('[data-timeline-direction="previous"]');
      const next = card?.querySelector('[data-timeline-direction="next"]');
      const hint = card?.querySelector("[data-timeline-hint]");
      let drag = null;
      let suppressClick = false;

      const update = () => {
        const max = maximum(scroller);
        const left = bounded(scroller, scroller.scrollLeft);
        if (previous) {
          previous.hidden = max <= 1;
          previous.disabled = left <= 1;
        }
        if (next) {
          next.hidden = max <= 1;
          next.disabled = max - left <= 1;
        }
        if (hint) hint.hidden = max <= 1 || max - left <= 1;
        remember(scroller);
      };

      const moveTo = (left) => {
        const position = bounded(scroller, left);
        // Immediate scrolling also respects reduced-motion preferences.
        if (typeof scroller.scrollTo === "function") scroller.scrollTo({ left: position, behavior: "auto" });
        else scroller.scrollLeft = position;
        update();
      };
      const pageStep = () => Math.max(48, Math.round(scroller.clientWidth * 0.85));
      previous?.addEventListener("click", () => moveTo(scroller.scrollLeft - pageStep()));
      next?.addEventListener("click", () => moveTo(scroller.scrollLeft + pageStep()));
      scroller.addEventListener("scroll", update, { passive: true });
      scroller.addEventListener("keydown", (event) => {
        if (event.target !== scroller || event.altKey || event.ctrlKey || event.metaKey) return;
        let destination;
        switch (event.key) {
          case "ArrowLeft": destination = scroller.scrollLeft - 48; break;
          case "ArrowRight": destination = scroller.scrollLeft + 48; break;
          case "PageUp": destination = scroller.scrollLeft - pageStep(); break;
          case "PageDown": destination = scroller.scrollLeft + pageStep(); break;
          case "Home": destination = 0; break;
          case "End": destination = maximum(scroller); break;
          default: return;
        }
        if (maximum(scroller) <= 1) return;
        event.preventDefault();
        moveTo(destination);
      });

      scroller.addEventListener("pointerdown", (event) => {
        if (event.pointerType !== "mouse" || event.button !== 0 || drag || maximum(scroller) <= 1) return;
        if (event.target?.closest?.("a, button, input, select, textarea, [contenteditable]")) return;
        suppressClick = false;
        drag = { id: event.pointerId, x: event.clientX, left: scroller.scrollLeft };
        scroller.setPointerCapture?.(event.pointerId);
      });
      scroller.addEventListener("pointermove", (event) => {
        if (!drag || event.pointerId !== drag.id) return;
        const delta = event.clientX - drag.x;
        if (!suppressClick && Math.abs(delta) <= 3) return;
        suppressClick = true;
        scroller.dataset.dragging = "true";
        event.preventDefault();
        scroller.scrollLeft = bounded(scroller, drag.left - delta);
        update();
      });
      const finishDrag = (event) => {
        if (!drag || event.pointerId !== drag.id) return;
        const id = drag.id;
        drag = null;
        delete scroller.dataset.dragging;
        if (event.type === "pointercancel") suppressClick = false;
        if (scroller.hasPointerCapture?.(id)) scroller.releasePointerCapture(id);
      };
      scroller.addEventListener("pointerup", finishDrag);
      scroller.addEventListener("pointercancel", finishDrag);
      scroller.addEventListener("lostpointercapture", finishDrag);
      scroller.addEventListener("click", (event) => {
        if (!suppressClick) return;
        suppressClick = false;
        event.preventDefault();
        event.stopPropagation();
      }, true);
      return update;
    };

    const bind = (root) => {
      observer?.disconnect();
      window?.removeEventListener?.("resize", refresh);
      activeUpdates = [];
      observer = window?.ResizeObserver ? new window.ResizeObserver(refresh) : null;
      scrollers(root).forEach((scroller) => {
        const id = idFor(scroller);
        if (id && positions.has(id)) scroller.scrollLeft = bounded(scroller, positions.get(id));
        if (!bindings.has(scroller)) bindings.set(scroller, attach(scroller));
        const update = bindings.get(scroller);
        activeUpdates.push(update);
        update();
        observer?.observe(scroller);
        if (scroller.firstElementChild) observer?.observe(scroller.firstElementChild);
      });
      window?.addEventListener?.("resize", refresh, { passive: true });
    };

    return { capture, bind };
  };

  return { createController };
}));
