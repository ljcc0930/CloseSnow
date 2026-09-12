const test = require("node:test");
const assert = require("node:assert/strict");
const { createController } = require("../../assets/js/timeline_scroller.js");

class EventTargetStub {
  constructor() { this.listeners = new Map(); }
  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) || new Set();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }
  removeEventListener(type, listener) { this.listeners.get(type)?.delete(listener); }
  emit(type, values = {}) {
    const event = {
      type, target: this, prevented: false, stopped: false,
      preventDefault() { this.prevented = true; },
      stopPropagation() { this.stopped = true; },
      ...values,
    };
    this.listeners.get(type)?.forEach((listener) => listener(event));
    return event;
  }
}

const makeCard = (id, { width = 240, contentWidth = 672, position = 0, controls = true } = {}) => {
  const previous = new EventTargetStub();
  const next = new EventTargetStub();
  const hint = {};
  const card = {
    dataset: { timelineResortId: id },
    querySelector: (selector) => controls ? {
      '[data-timeline-direction="previous"]': previous,
      '[data-timeline-direction="next"]': next,
      "[data-timeline-hint]": hint,
    }[selector] : null,
  };
  const scroller = Object.assign(new EventTargetStub(), {
    dataset: {}, scrollLeft: position, clientWidth: width, scrollWidth: contentWidth,
    firstElementChild: {}, captured: new Set(), calls: [],
    closest: (selector) => selector === "[data-timeline-card]" ? card : null,
    scrollTo(options) { this.calls.push(options); this.scrollLeft = options.left; },
    setPointerCapture(id) { this.captured.add(id); },
    hasPointerCapture(id) { return this.captured.has(id); },
    releasePointerCapture(id) { this.captured.delete(id); },
  });
  return { scroller, card, previous, next, hint };
};

const fixture = (cards) => {
  const observers = [];
  const window = Object.assign(new EventTargetStub(), {
    ResizeObserver: class {
      constructor(callback) { this.callback = callback; this.elements = []; observers.push(this); }
      observe(element) { this.elements.push(element); }
      disconnect() { this.disconnected = true; }
    },
  });
  const root = { querySelectorAll: () => cards.map((card) => card.scroller) };
  const controller = createController({ window });
  return { controller, root, window, observers };
};

const mouse = (values = {}) => ({ pointerType: "mouse", pointerId: 1, button: 0, clientX: 200, ...values });

test("arrows and overflow hint follow native scrolling and fractional scroll bounds", () => {
  const card = makeCard("snow");
  const { controller, root } = fixture([card]);
  controller.bind(root);
  assert.equal(card.previous.disabled, true);
  assert.equal(card.next.disabled, false);
  assert.equal(card.previous.hidden, false);
  assert.equal(card.next.hidden, false);
  assert.equal(card.hint.hidden, false);
  card.scroller.scrollLeft = 431.5;
  card.scroller.emit("scroll");
  assert.equal(card.previous.disabled, false);
  assert.equal(card.next.disabled, true);
  assert.equal(card.hint.hidden, true);
  card.scroller.scrollLeft = -20;
  card.scroller.emit("scroll");
  assert.equal(card.previous.disabled, true);
  assert.equal(card.next.disabled, false);
});

test("capture and bind preserve independent resort positions across reorder, filtering and shorter forecasts", () => {
  const cards = [makeCard("a"), makeCard("b")];
  const { controller, root } = fixture(cards);
  controller.bind(root);
  cards[0].scroller.scrollLeft = 120;
  cards[1].scroller.scrollLeft = 400;
  controller.capture(root);
  cards.splice(0, 2, makeCard("b", { contentWidth: 400 }));
  controller.bind(root);
  assert.equal(cards[0].scroller.scrollLeft, 160);
  cards.push(makeCard("a"), makeCard("new"));
  controller.bind(root);
  assert.equal(cards[1].scroller.scrollLeft, 120);
  assert.equal(cards[2].scroller.scrollLeft, 0);
});

test("buttons page within bounds without animation and rebinding never duplicates listeners", () => {
  const card = makeCard("snow");
  const { controller, root, observers, window } = fixture([card]);
  controller.bind(root);
  controller.bind(root);
  card.next.emit("click");
  assert.equal(card.scroller.scrollLeft, 204);
  assert.deepEqual(card.scroller.calls, [{ left: 204, behavior: "auto" }]);
  card.next.emit("click");
  card.next.emit("click");
  assert.equal(card.scroller.scrollLeft, 432);
  assert.equal(card.next.disabled, true);
  card.previous.emit("click");
  assert.equal(card.scroller.scrollLeft, 228);
  assert.equal(observers[0].disconnected, true);
  assert.equal(window.listeners.get("resize").size, 1);
});

test("focused timeline supports arrows, page keys and Home/End without intercepting other controls", () => {
  const card = makeCard("snow");
  const { controller, root } = fixture([card]);
  controller.bind(root);
  for (const [key, left] of [["ArrowRight", 48], ["PageDown", 252], ["ArrowLeft", 204], ["PageUp", 0], ["End", 432], ["Home", 0]]) {
    assert.equal(card.scroller.emit("keydown", { key }).prevented, true);
    assert.equal(card.scroller.scrollLeft, left);
  }
  assert.equal(card.scroller.emit("keydown", { key: "ArrowRight", target: card.next }).prevented, false);
  assert.equal(card.scroller.emit("keydown", { key: "End", ctrlKey: true }).prevented, false);
  assert.equal(card.scroller.emit("keydown", { key: "ArrowDown" }).prevented, false);
  assert.equal(card.scroller.scrollLeft, 0);
});

test("mouse dragging waits for movement, captures the pointer and suppresses only the resulting click", () => {
  const card = makeCard("snow");
  const { controller, root } = fixture([card]);
  controller.bind(root);
  card.scroller.emit("pointerdown", mouse());
  assert.equal(card.scroller.captured.has(1), true);
  assert.equal(card.scroller.emit("pointermove", mouse({ clientX: 198 })).prevented, false);
  assert.equal(card.scroller.emit("pointermove", mouse({ clientX: 100 })).prevented, true);
  assert.equal(card.scroller.scrollLeft, 100);
  assert.equal(card.scroller.dataset.dragging, "true");
  card.scroller.emit("pointermove", mouse({ pointerId: 2, clientX: 0 }));
  assert.equal(card.scroller.scrollLeft, 100);
  card.scroller.emit("pointerup", mouse({ clientX: 100 }));
  assert.equal(card.scroller.captured.size, 0);
  assert.equal(card.scroller.dataset.dragging, undefined);
  const click = card.scroller.emit("click");
  assert.equal(click.prevented, true);
  assert.equal(click.stopped, true);
  assert.equal(card.scroller.emit("click").prevented, false);
});

test("touch, pen, secondary mouse buttons and interactive children retain native behavior", () => {
  const card = makeCard("snow");
  const { controller, root } = fixture([card]);
  controller.bind(root);
  for (const values of [{ pointerType: "touch" }, { pointerType: "pen" }, { button: 2 }, { target: { closest: () => ({}) } }]) {
    assert.equal(card.scroller.emit("pointerdown", mouse(values)).prevented, false);
    assert.equal(card.scroller.emit("pointermove", mouse({ ...values, clientX: 0 })).prevented, false);
    assert.equal(card.scroller.scrollLeft, 0);
    assert.equal(card.scroller.captured.size, 0);
  }
  assert.equal(card.scroller.listeners.has("touchmove"), false);
  assert.equal(card.scroller.listeners.has("wheel"), false);
});

test("cancellation and lost pointer capture finish dragging and permit another drag", () => {
  const card = makeCard("snow");
  const { controller, root } = fixture([card]);
  controller.bind(root);
  for (const type of ["pointercancel", "lostpointercapture"]) {
    card.scroller.emit("pointerdown", mouse());
    card.scroller.emit("pointermove", mouse({ clientX: 100 }));
    card.scroller.emit(type, mouse());
    assert.equal(card.scroller.dataset.dragging, undefined);
    const left = card.scroller.scrollLeft;
    card.scroller.emit("pointermove", mouse({ clientX: 0 }));
    assert.equal(card.scroller.scrollLeft, left);
  }
});

test("resize refreshes overflow controls and a non-overflowing card leaves keyboard scrolling alone", () => {
  const card = makeCard("snow", { width: 700 });
  const { controller, root, observers, window } = fixture([card]);
  controller.bind(root);
  assert.equal(card.previous.disabled, true);
  assert.equal(card.next.disabled, true);
  assert.equal(card.previous.hidden, true);
  assert.equal(card.next.hidden, true);
  assert.equal(card.hint.hidden, true);
  assert.equal(card.scroller.emit("keydown", { key: "PageDown" }).prevented, false);
  card.scroller.clientWidth = 300;
  observers[0].callback();
  assert.equal(card.previous.hidden, false);
  assert.equal(card.next.hidden, false);
  assert.equal(card.next.disabled, false);
  assert.equal(card.hint.hidden, false);
  card.scroller.clientWidth = 800;
  window.emit("resize");
  assert.equal(card.previous.hidden, true);
  assert.equal(card.next.hidden, true);
  assert.equal(card.next.disabled, true);
  assert.equal(card.hint.hidden, true);
});

test("optional controls, missing roots and older browsers do not prevent position restoration", () => {
  const cards = [makeCard(undefined, { controls: false })];
  cards[0].scroller.dataset.timelineResortId = "on-scroller";
  const { root } = fixture(cards);
  const controller = createController();
  controller.bind(null);
  controller.capture(null);
  controller.bind(root);
  cards[0].scroller.scrollLeft = 100;
  controller.capture(root);
  cards[0] = makeCard(undefined, { controls: false });
  cards[0].scroller.dataset.timelineResortId = "on-scroller";
  delete cards[0].scroller.scrollTo;
  controller.bind(root);
  assert.equal(cards[0].scroller.scrollLeft, 100);
  cards[0].scroller.emit("keydown", { key: "End" });
  assert.equal(cards[0].scroller.scrollLeft, 432);
});
