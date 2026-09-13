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


const makeBoard = ({ width = 360, dayWidth = 80, days = 4, identityWidth = 120 } = {}) => {
  const card = makeCard("forecast-board", { width, contentWidth: identityWidth + days * dayWidth });
  Object.assign(card.card, new EventTargetStub());
  card.card.addEventListener = EventTargetStub.prototype.addEventListener;
  card.card.emit = EventTargetStub.prototype.emit;
  const scroller = card.scroller;
  scroller.dataset.timelineResortId = "forecast-board";
  scroller.clientLeft = 0;
  scroller.getBoundingClientRect = () => ({ left: 100, right: 100 + width });
  const calendar = Array.from({ length: days }, (_, index) => ({ dataset: { calendarDay: String(index) } }));
  const rows = ["Alpha", "Beta"].map((name) => {
    const readout = { textContent: `${name} summary` };
    Object.defineProperty(readout, "innerHTML", { set() { throw new Error("Readouts must not parse HTML"); } });
    const identity = { getBoundingClientRect: () => ({ left: 100, right: 100 + identityWidth }) };
    const row = { name, readout, identity };
    row.buttons = Array.from({ length: days }, (_, index) => ({
      dataset: { forecastDay: String(index), dayLabel: `${name} day ${index + 1}: 5 cm` },
      tabIndex: index === 0 ? 0 : -1, focusCalls: [],
      closest(selector) { return selector === "button[data-forecast-day]" ? this : null; },
      contains(target) { return target === this; },
      getBoundingClientRect() {
        const left = 100 + identityWidth + index * dayWidth - scroller.scrollLeft;
        return { left, right: left + dayWidth };
      },
      focus(options) {
        this.focusCalls.push(options);
        scroller.emit("focusin", { target: this });
      },
    }));
    row.querySelector = (selector) => ({ "[data-day-readout]": readout, "[data-forecast-identity]": identity })[selector];
    row.querySelectorAll = (selector) => selector === "button[data-forecast-day]" ? row.buttons : [];
    return row;
  });
  card.card.contains = (target) => [card.card, scroller, card.previous, card.next, ...rows.flatMap((row) => row.buttons)].includes(target);
  scroller.querySelectorAll = (selector) => ({ "[data-forecast-row]": rows, "[data-calendar-day]": calendar })[selector] || [];
  return { ...card, rows, calendar };
};

const activeDays = (board) => board.rows.map((row) => row.buttons.flatMap((button, index) => button.dataset.activeDay === "true" ? [index] : []));

test("hover synchronizes one calendar column across resorts and writes only the active row's safe readout", () => {
  const board = makeBoard();
  const { controller, root } = fixture([board]);
  controller.bind(root);
  const selected = board.rows[0].buttons[2];
  selected.dataset.dayLabel = '<img src=x onerror="alert(1)"> · Snow 5 cm';
  board.scroller.emit("pointerover", { target: selected, pointerType: "mouse" });
  assert.deepEqual(activeDays(board), [[2], [2]]);
  assert.equal(board.calendar[2].dataset.activeDay, "true");
  assert.equal(board.rows[0].readout.textContent, selected.dataset.dayLabel);
  assert.equal(board.rows[1].readout.textContent, "Beta summary");
  board.scroller.emit("pointerover", { target: board.rows[1].buttons[1], pointerType: "mouse" });
  assert.deepEqual(activeDays(board), [[1], [1]]);
  assert.equal(board.rows[0].readout.textContent, "Alpha summary");
  assert.equal(board.rows[1].readout.textContent, "Beta day 2: 5 cm");
  board.scroller.emit("pointerleave");
  assert.deepEqual(activeDays(board), [[], []]);
  assert.deepEqual(board.rows.map((row) => row.readout.textContent), ["Alpha summary", "Beta summary"]);
});

test("click and touch pin a day until another deliberate selection, Escape, or a click outside", () => {
  const board = makeBoard();
  const { controller, root, window } = fixture([board]);
  controller.bind(root);
  const selected = board.rows[0].buttons[1];
  board.scroller.emit("pointerover", { target: selected, pointerType: "touch" });
  assert.deepEqual(activeDays(board), [[], []], "A touch scroll must not create hover selection");
  board.card.emit("click", { target: selected });
  board.scroller.emit("pointerleave");
  board.scroller.emit("pointerover", { target: board.rows[1].buttons[3], pointerType: "mouse" });
  assert.deepEqual(activeDays(board), [[1], [1]], "Hover must not dislodge a clicked selection");
  board.card.emit("click", { target: board.rows[1].buttons[3] });
  assert.deepEqual(activeDays(board), [[3], [3]]);
  assert.equal(board.rows[0].readout.textContent, "Alpha summary");
  assert.equal(board.scroller.emit("keydown", { target: board.rows[1].buttons[3], key: "Escape" }).prevented, true);
  assert.deepEqual(activeDays(board), [[], []]);
  board.card.emit("click", { target: selected });
  window.emit("click", { target: selected });
  assert.deepEqual(activeDays(board), [[1], [1]], "Bubbling clicks inside the board preserve selection");
  window.emit("click", { target: {} });
  assert.deepEqual(activeDays(board), [[], []]);
});

test("roving keyboard focus stays within its row and reveals days past the sticky identity without page scrolling", () => {
  const board = makeBoard();
  const { controller, root } = fixture([board]);
  controller.bind(root);
  const row = board.rows[0];
  board.scroller.emit("focusin", { target: row.buttons[0] });
  assert.deepEqual(activeDays(board), [[0], [0]]);
  assert.equal(board.scroller.emit("keydown", { target: row.buttons[0], key: "End" }).prevented, true);
  assert.deepEqual(row.buttons.map((button) => button.tabIndex), [-1, -1, -1, 0]);
  assert.deepEqual(board.rows[1].buttons.map((button) => button.tabIndex), [0, -1, -1, -1]);
  assert.deepEqual(row.buttons[3].focusCalls, [{ preventScroll: true }]);
  assert.equal(board.scroller.scrollLeft, 80);
  board.scroller.emit("keydown", { target: row.buttons[3], key: "ArrowLeft" });
  assert.deepEqual(activeDays(board), [[2], [2]]);
  assert.deepEqual(row.buttons[2].focusCalls, [{ preventScroll: true }]);
  // At this scroll offset, day two is visible in the viewport but lies under
  // the sticky resort name. Home must reveal it without calling scrollIntoView.
  board.scroller.scrollLeft = 160;
  board.scroller.emit("keydown", { target: row.buttons[2], key: "Home" });
  assert.equal(board.scroller.scrollLeft, 0);
  assert.deepEqual(activeDays(board), [[0], [0]]);
  assert.equal(board.scroller.emit("keydown", { target: row.buttons[0], key: "ArrowLeft" }).prevented, true,
    "Boundary keys must not fall through and scroll the page");
  assert.equal(board.scroller.emit("keydown", { target: row.buttons[0], key: "End", ctrlKey: true }).prevented, false);
});

test("focus leaving the board restores all summaries and rebinding retains the original readout defaults", () => {
  const board = makeBoard();
  const { controller, root, window } = fixture([board]);
  controller.bind(root);
  board.scroller.emit("focusin", { target: board.rows[0].buttons[1] });
  controller.bind(root);
  board.card.emit("focusout", { target: board.rows[0].buttons[1], relatedTarget: {} });
  assert.deepEqual(activeDays(board), [[], []]);
  assert.deepEqual(board.rows.map((row) => row.readout.textContent), ["Alpha summary", "Beta summary"]);
  assert.equal(window.listeners.get("click").size, 1);
  board.scroller.emit("focusin", { target: board.rows[0].buttons[1] });
  board.card.emit("focusout", { target: board.rows[0].buttons[1], relatedTarget: board.rows[1].buttons[2] });
  board.scroller.emit("focusin", { target: board.rows[1].buttons[2] });
  assert.deepEqual(activeDays(board), [[2], [2]]);
  assert.equal(board.rows[0].readout.textContent, "Alpha summary");
  assert.equal(board.rows[1].readout.textContent, "Beta day 3: 5 cm");
});

test("the shared board restores horizontal position after rerender and uses new unit-aware readout labels", () => {
  const boards = [makeBoard()];
  const { controller, root } = fixture(boards);
  controller.bind(root);
  boards[0].scroller.scrollLeft = 60;
  boards[0].card.emit("click", { target: boards[0].rows[0].buttons[2] });
  controller.capture(root);
  boards[0] = makeBoard();
  boards[0].rows[0].buttons[2].dataset.dayLabel = "Alpha day 3: 2 in";
  controller.bind(root);
  assert.equal(boards[0].scroller.scrollLeft, 60);
  assert.deepEqual(activeDays(boards[0]), [[], []]);
  boards[0].card.emit("click", { target: boards[0].rows[0].buttons[2] });
  assert.equal(boards[0].rows[0].readout.textContent, "Alpha day 3: 2 in");
});


test("revealing keyboard focus cannot let a stationary pointer select the wrong date", () => {
  const board = makeBoard({ width: 358, identityWidth: 112, dayWidth: 35, days: 14 });
  const { controller, root } = fixture([board]);
  controller.bind(root);
  const row = board.rows[0];
  // Native sequence: tapping/clicking a date focuses it, End moves focus and
  // scrolls the board, then the browser emits pointerover for the new cell
  // underneath the pointer even though the pointer has not moved.
  board.scroller.emit("focusin", { target: row.buttons[2] });
  board.card.emit("click", { target: row.buttons[2] });
  board.scroller.emit("keydown", { target: row.buttons[2], key: "End" });
  assert.ok(board.scroller.scrollLeft > 0);
  board.scroller.emit("pointerout", { target: row.buttons[2], relatedTarget: row.buttons[9] });
  board.scroller.emit("pointerover", { target: row.buttons[9], pointerType: "mouse" });
  assert.deepEqual(activeDays(board), [[13], [13]]);
  assert.equal(row.readout.textContent, "Alpha day 14: 5 cm");
  assert.deepEqual(row.buttons[13].focusCalls, [{ preventScroll: true }]);
  board.scroller.emit("keydown", { target: row.buttons[13], key: "Escape" });
  board.scroller.emit("pointerover", { target: row.buttons[9], pointerType: "mouse" });
  assert.deepEqual(activeDays(board), [[9], [9]], "Escape releases the keyboard selection for hover again");
});

test("direct focus restoration also stays authoritative while its day is revealed", () => {
  const board = makeBoard({ width: 358, identityWidth: 112, dayWidth: 35, days: 14 });
  const { controller, root } = fixture([board]);
  controller.bind(root);
  board.scroller.emit("focusin", { target: board.rows[1].buttons[13] });
  board.scroller.emit("pointerover", { target: board.rows[0].buttons[9], pointerType: "mouse" });
  assert.deepEqual(activeDays(board), [[13], [13]]);
  assert.equal(board.rows[1].readout.textContent, "Beta day 14: 5 cm");
  assert.equal(board.rows[0].readout.textContent, "Alpha summary");
});
