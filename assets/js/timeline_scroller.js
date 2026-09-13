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
    let activeOutsideClears = [];
    const clearOutside = (event) => activeOutsideClears.forEach((clear) => clear(event.target));
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

    const attachDaySelection = (scroller, moveTo) => {
      const rows = Array.from(scroller.querySelectorAll?.("[data-forecast-row]") || []).map((row) => {
        const readout = row.querySelector("[data-day-readout]");
        return {
          row, readout, summary: readout?.textContent || "",
          buttons: Array.from(row.querySelectorAll("button[data-forecast-day]")),
        };
      });
      if (!rows.length) return () => {};
      const board = cardFor(scroller) || scroller;
      const buttons = rows.flatMap((row) => row.buttons);
      const calendar = Array.from(scroller.querySelectorAll("[data-calendar-day]"));
      let hovered = null;
      let focused = null;
      let pinned = null;
      const buttonFor = (target) => {
        const button = target?.closest?.("button[data-forecast-day]");
        return buttons.includes(button) ? button : null;
      };
      const rowFor = (button) => rows.find((row) => row.buttons.includes(button));
      const renderSelection = () => {
        const selected = pinned || hovered || focused;
        const index = selected?.dataset.forecastDay;
        buttons.forEach((button) => {
          if (index !== undefined && button.dataset.forecastDay === index) button.dataset.activeDay = "true";
          else delete button.dataset.activeDay;
        });
        calendar.forEach((day) => {
          if (index !== undefined && day.dataset.calendarDay === index) day.dataset.activeDay = "true";
          else delete day.dataset.activeDay;
        });
        const activeRow = rowFor(selected);
        rows.forEach((row) => {
          const text = row === activeRow ? selected.dataset.dayLabel || "" : row.summary;
          if (row.readout && row.readout.textContent !== text) row.readout.textContent = text;
        });
      };
      const clear = () => {
        hovered = null;
        focused = null;
        pinned = null;
        renderSelection();
      };
      const roveTo = (button) => rowFor(button)?.buttons.forEach((candidate) => {
        candidate.tabIndex = candidate === button ? 0 : -1;
      });
      const reveal = (button) => {
        const viewport = scroller.getBoundingClientRect();
        const identity = rowFor(button)?.row.querySelector("[data-forecast-identity]")?.getBoundingClientRect();
        const rect = button.getBoundingClientRect();
        const left = Math.max(viewport.left + (scroller.clientLeft || 0), identity?.right || viewport.left) + 4;
        const right = viewport.left + (scroller.clientLeft || 0) + scroller.clientWidth - 4;
        if (rect.left < left) moveTo(scroller.scrollLeft + rect.left - left);
        else if (rect.right > right) moveTo(scroller.scrollLeft + rect.right - right);
      };
      scroller.addEventListener("pointerover", (event) => {
        if (event.pointerType === "touch" || pinned || scroller.dataset.dragging) return;
        const button = buttonFor(event.target);
        if (!button || button === hovered) return;
        hovered = button;
        renderSelection();
      });
      scroller.addEventListener("pointerout", (event) => {
        const button = buttonFor(event.target);
        if (!button || button !== hovered || button.contains?.(event.relatedTarget)) return;
        hovered = null;
        renderSelection();
      });
      scroller.addEventListener("pointerleave", () => {
        hovered = null;
        renderSelection();
      });
      scroller.addEventListener("focusin", (event) => {
        const button = buttonFor(event.target);
        if (!button) return;
        focused = button;
        hovered = null;
        // Revealing keyboard focus can move other cells under a stationary
        // pointer. Keep focus authoritative until a deliberate new selection.
        pinned = button;
        roveTo(button);
        reveal(button);
        renderSelection();
      });
      (board.addEventListener ? board : scroller).addEventListener("focusout", (event) => {
        if (!board.contains?.(event.relatedTarget)) clear();
        else if (!buttonFor(event.relatedTarget)) {
          focused = null;
          renderSelection();
        }
      });
      (board.addEventListener ? board : scroller).addEventListener("click", (event) => {
        if (event.defaultPrevented) return;
        const button = buttonFor(event.target);
        if (!button) return clear();
        pinned = button;
        hovered = null;
        roveTo(button);
        renderSelection();
      });
      scroller.addEventListener("keydown", (event) => {
        if (event.altKey || event.ctrlKey || event.metaKey) return;
        if (event.key === "Escape") {
          event.preventDefault();
          clear();
          return;
        }
        const button = buttonFor(event.target);
        if (!button) return;
        const row = rowFor(button);
        const index = row.buttons.indexOf(button);
        let nextIndex;
        switch (event.key) {
          case "ArrowLeft": nextIndex = Math.max(0, index - 1); break;
          case "ArrowRight": nextIndex = Math.min(row.buttons.length - 1, index + 1); break;
          case "Home": nextIndex = 0; break;
          case "End": nextIndex = row.buttons.length - 1; break;
          default: return;
        }
        event.preventDefault();
        const next = row.buttons[nextIndex];
        hovered = null;
        focused = next;
        pinned = next;
        roveTo(next);
        next.focus({ preventScroll: true });
        reveal(next);
        renderSelection();
      });
      scroller.addEventListener("forecast-units-change", renderSelection);
      renderSelection();
      return (target) => { if (!board.contains?.(target)) clear(); };
    };

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
      return { update, clearOutside: attachDaySelection(scroller, moveTo) };
    };

    const bind = (root) => {
      observer?.disconnect();
      window?.removeEventListener?.("resize", refresh);
      window?.removeEventListener?.("click", clearOutside);
      activeUpdates = [];
      activeOutsideClears = [];
      observer = window?.ResizeObserver ? new window.ResizeObserver(refresh) : null;
      scrollers(root).forEach((scroller) => {
        const id = idFor(scroller);
        if (id && positions.has(id)) scroller.scrollLeft = bounded(scroller, positions.get(id));
        if (!bindings.has(scroller)) bindings.set(scroller, attach(scroller));
        const { update, clearOutside: clearSelectionOutside } = bindings.get(scroller);
        activeUpdates.push(update);
        activeOutsideClears.push(clearSelectionOutside);
        update();
        observer?.observe(scroller);
        if (scroller.firstElementChild) observer?.observe(scroller.firstElementChild);
      });
      window?.addEventListener?.("resize", refresh, { passive: true });
      window?.addEventListener?.("click", clearOutside);
    };

    return { capture, bind };
  };

  return { createController };
}));
