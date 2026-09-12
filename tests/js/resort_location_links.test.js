const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

class Element {
  constructor() { this.children = []; this.attributes = {}; this.text = ""; }
  appendChild(child) { this.children.push(child); }
  setAttribute(name, value) { this.attributes[name] = value; }
  set textContent(value) { this.text = value; this.children = []; }
  get textContent() { return this.text + this.children.map((child) => child.textContent).join(""); }
}

const renderLocation = async (coordinates) => {
  const location = new Element();
  const meta = new Element();
  const context = {
    URL,
    window: {
      CLOSESNOW_HOURLY_CONTEXT: { resortId: "test-resort" },
      location: { pathname: "/resort/test-resort/", href: "https://closesnow.netlify.app/resort/test-resort/", origin: "https://closesnow.netlify.app" },
      addEventListener: () => {}, setInterval: () => 1,
    },
    document: {
      getElementById: (id) => ({ "resort-location-link": location, "hourly-meta": meta }[id] || null),
      createElement: () => new Element(),
      createTextNode: (text) => ({ textContent: text }),
    },
    fetch: async () => ({ ok: true, json: async () => ({ display_name: "Test Resort", timezone: "America/Denver", ...coordinates }) }),
  };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(__dirname, "../../assets/js/resort_hourly.js"), "utf8"), context);
  await new Promise(setImmediate);
  return location;
};

test("compact location links preserve exact map coordinates and prefilled correction report", async () => {
  const location = await renderLocation({ input_latitude: 40.123456, input_longitude: -110.987654 });
  const links = location.children.filter((child) => child.href);
  assert.equal(links.length, 2);
  const map = new URL(links[0].href);
  assert.equal(map.searchParams.get("query"), "40.123456,-110.987654");
  const report = new URL(links[1].href);
  assert.equal(report.searchParams.get("template"), "01-coordinate-correction.yml");
  assert.equal(report.searchParams.get("current_coordinates"), "40.123456, -110.987654");
  assert.equal(report.searchParams.get("current_map_link"), links[0].href);
  assert.equal(report.searchParams.get("resort_name"), "Test Resort");
  assert.equal(report.searchParams.get("resort_page"), "https://ljcc0930.github.io/CloseSnow/resort/test-resort/");
  assert.match(links[1].attributes["aria-label"], /Test Resort/);
  assert.doesNotMatch(location.textContent, /40\.123456|110\.987654/);
});

test("missing coordinates do not create map or correction links for a fabricated zero point", async () => {
  for (const coordinates of [{}, { input_latitude: null, input_longitude: null }, { input_latitude: "", input_longitude: "" }]) {
    const location = await renderLocation(coordinates);
    assert.equal(location.children.length, 0);
  }
  const location = await renderLocation({ input_latitude: 0, input_longitude: 0 });
  assert.equal(location.children.filter((child) => child.href).length, 2);
});
