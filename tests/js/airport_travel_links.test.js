const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const travel = require("../../assets/js/airport_travel_links.js");

function decodeFields(bytes) {
  let offset = 0;
  const varint = () => {
    let value = 0n;
    let shift = 0n;
    while (offset < bytes.length) {
      const byte = bytes[offset++];
      value |= BigInt(byte & 127) << shift;
      if (!(byte & 128)) return value;
      shift += 7n;
    }
    throw new Error("Truncated protobuf value");
  };
  const fields = [];
  while (offset < bytes.length) {
    const tag = Number(varint());
    const field = tag >> 3;
    const wire = tag & 7;
    if (wire === 0) fields.push({ field, value: varint() });
    else if (wire === 2) {
      const length = Number(varint());
      const value = bytes.subarray(offset, offset + length);
      assert.equal(value.length, length);
      offset += length;
      fields.push({ field, value });
    } else throw new Error(`Unexpected wire type ${wire}`);
  }
  return fields;
}

test("Flights links preserve the verified destination-only blank-date UI state", () => {
  assert.equal(travel.buildFlightsUrl("RNO"),
    "https://www.google.com/travel/flights?tfs=CBwQARoJcgcIARIDUk5PGglqBwgBEgNSTk9AAUgBcAGCAQsI____________AZgBAQ&tfu=KgIIAw");
  for (const code of ["RNO", "JFK", "LHR", "HND", "SFO"]) {
    const url = new URL(travel.buildFlightsUrl(code.toLowerCase()));
    assert.equal(url.origin + url.pathname, "https://www.google.com/travel/flights");
    assert.equal(url.searchParams.has("q"), false, "Text searches can add unwanted dates");
    const token = url.searchParams.get("tfs");
    assert.match(token, /^[A-Za-z0-9_-]+$/);
    const bytes = Buffer.from(token, "base64url");
    assert.equal(bytes.includes(Buffer.from("/m/0d6lp")), false, "No fixed departure city");
    const legs = decodeFields(bytes).filter((item) => item.field === 3);
    assert.equal(legs.length, 2);
    legs.forEach((leg, index) => {
      const fields = decodeFields(leg.value);
      assert.deepEqual(fields.map((item) => item.field), [index === 0 ? 14 : 13],
        "Legs contain only the destination airport, with no origin or date fields");
      const airport = decodeFields(fields[0].value);
      assert.equal(airport[0].value, 1n);
      assert.equal(airport[1].value.toString("ascii"), code);
    });
  }
});

test("only normalized three-letter IATA codes produce Flights links", () => {
  assert.equal(travel.normalizeIata(" rno \n"), "RNO");
  for (const invalid of [null, undefined, 123, "", "---", "RN", "RN00", "R1O", "ＲＮＯ", "RNO&origin=SFO", '<svg onload="x">']) {
    assert.equal(travel.buildFlightsUrl(invalid), "");
  }
});

test("Maps uses exact valid coordinates and never turns missing coordinates into zero", () => {
  const airport = { iataCode: "RNO", displayName: "Reno-Tahoe International Airport", locationLabel: "Reno, NV, US" };
  const exact = new URL(travel.buildMapsUrl({ ...airport, latitude: "39.4991", longitude: -119.7681 }));
  assert.equal(exact.searchParams.get("api"), "1");
  assert.equal(exact.searchParams.get("query"), "39.4991,-119.7681");
  assert.equal(exact.searchParams.has("origin"), false);
  for (const coords of [{}, { latitude: null, longitude: null }, { latitude: "", longitude: " " }, { latitude: 91, longitude: 0 }, { latitude: false, longitude: 10 }]) {
    assert.equal(new URL(travel.buildMapsUrl({ ...airport, ...coords })).searchParams.get("query"),
      "Reno-Tahoe International Airport RNO Reno, NV, US");
  }
  assert.equal(new URL(travel.buildMapsUrl({ latitude: 0, longitude: 0 })).searchParams.get("query"), "0,0");
  assert.equal(travel.buildMapsUrl({ iataCode: "---" }), "");
});

test("name fallback stays URL-encoded and supports Map without a valid IATA code", () => {
  const name = "Aéroport <Mountain> & Lake";
  const url = new URL(travel.buildMapsUrl({ displayName: name, iataCode: "???", locationLabel: "Québec, CA" }));
  assert.equal(url.origin + url.pathname, "https://www.google.com/maps/search/");
  assert.equal(url.searchParams.get("query"), `${name} Québec, CA`);
  assert.equal(url.searchParams.size, 2);
});

class Element {
  constructor(tagName = "div") { this.tagName = tagName; this.children = []; this.attributes = {}; this.text = ""; }
  appendChild(child) { this.children.push(child); return child; }
  setAttribute(name, value) { this.attributes[name] = value; }
  get childNodes() { return this.children; }
  set textContent(value) { this.text = value; this.children = []; }
  get textContent() { return this.text + this.children.map((child) => child.textContent || "").join(""); }
}

const linksWithin = (element) => element.children.flatMap((child) => child.href ? [child] : linksWithin(child));

async function bootHourly({ airports, payloadAirports, fail = false }) {
  const airportRoot = new Element();
  const airportSection = new Element();
  const sandbox = {
    URL, btoa,
    window: {
      CLOSESNOW_HOURLY_CONTEXT: { resortId: "test", dailySummary: { nearbyAirports: airports } },
      location: { pathname: "/resort/test/", href: "https://example.com/resort/test/", origin: "https://example.com" },
      addEventListener() {}, setInterval() { return 1; },
    },
    document: {
      getElementById: (id) => ({ "resort-airport-access-root": airportRoot, "resort-airport-access-section": airportSection })[id] || null,
      createElement: (tag) => new Element(tag),
      createElementNS: (_, tag) => new Element(tag),
      createTextNode: (textContent) => ({ textContent }),
    },
    navigator: { get geolocation() { throw new Error("Airport links must never request user location"); } },
    fetch: async () => {
      if (fail) throw new Error("Offline");
      return { ok: true, json: async () => ({ display_name: "Test Resort", nearby_airports: payloadAirports }) };
    },
  };
  vm.createContext(sandbox);
  for (const filename of ["airport_travel_links.js", "resort_hourly.js"]) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, "../../assets/js", filename), "utf8"), sandbox);
  }
  const initialLinks = linksWithin(airportRoot);
  await new Promise(setImmediate);
  return { initialLinks, links: linksWithin(airportRoot), airportSection };
}

const airport = {
  iata_code: "rno", display_name: "Reno-Tahoe International Airport", location_label: "Reno, NV, US",
  latitude: 39.4991, longitude: -119.7681, distance_miles: 24,
};

test("actual hourly script boot renders accessible links before fetch and refreshes them from payload", async () => {
  const payloadAirport = { ...airport, iata_code: "SLC", display_name: "Salt Lake City International Airport", latitude: 40.7884, longitude: -111.9778 };
  const { initialLinks, links, airportSection } = await bootHourly({ airports: [airport], payloadAirports: [payloadAirport] });
  assert.equal(initialLinks[0].href, travel.buildFlightsUrl("RNO"));
  assert.equal(links[0].href, travel.buildFlightsUrl("SLC"));
  assert.equal(new URL(links[1].href).searchParams.get("query"), "40.7884,-111.9778");
  assert.equal(airportSection.hidden, false);
  assert.deepEqual(links.map((link) => link.textContent), ["Flights", "Map"]);
  for (const link of links) {
    assert.equal(link.target, "_blank");
    assert.equal(link.rel, "noopener noreferrer");
    assert.match(link.attributes["aria-label"], /Salt Lake City International Airport.*opens in a new tab/);
    assert.equal(link.children[0].attributes["aria-hidden"], "true");
  }
});

test("offline fallback retains usable links; invalid IATA keeps only the airport Map action", async () => {
  const { links } = await bootHourly({ airports: [{ ...airport, iata_code: "---", latitude: null, longitude: null }], fail: true });
  assert.equal(links.length, 1);
  assert.equal(links[0].textContent, "Map");
  assert.equal(new URL(links[0].href).searchParams.get("query"), "Reno-Tahoe International Airport Reno, NV, US");
  const empty = await bootHourly({ airports: [], fail: true });
  assert.equal(empty.links.length, 0);
});

test("the detail template loads the travel module before the boot script", () => {
  const template = fs.readFileSync(path.join(__dirname, "../../src/web/templates/resort_hourly_page.html"), "utf8");
  const assets = [...template.matchAll(/<script src="[^\"]*\/js\/([^\"]+)"/g)].map((match) => match[1]);
  assert.ok(assets.indexOf("airport_travel_links.js") >= 0);
  assert.ok(assets.indexOf("airport_travel_links.js") < assets.indexOf("resort_hourly.js"));
});
