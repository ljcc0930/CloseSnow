const test = require("node:test");
const assert = require("node:assert/strict");
const model = require("../../assets/js/weather_report_model.js");

const reports = [
  { resort_id: "alpine", query: "Alpine", admin1: "CA", subregion: "west-coast", default_resort: true, pass_types: ["IKON"], daily: [{ snowfall_cm: 0 }], week1_total_snowfall_cm: 4, week2_total_snowfall_cm: 2 },
  { resort_id: "bowl", query: "Snow Bowl", admin1: "CO", subregion: "rockies", pass_types: ["epic"], search_terms: ["Hidden Valley"], daily: [{ snowfall_cm: 5 }], week1_total_snowfall_cm: 12, week2_total_snowfall_cm: null },
  { resort_id: "cedar", query: "Cedar", admin1: "UT", subregion: "rockies", ljcc_favorite: true, pass_types: ["ikon"], daily: [], week1_total_snowfall_cm: null, week2_total_snowfall_cm: 8 },
];
const filters = (overrides = {}) => ({
  search: "", searchAll: true, favoritesOnly: false, includeDefault: false,
  passTypes: new Set(), subregions: new Set(), sortBy: "name", ...overrides,
});
const ids = (items) => items.map((report) => report.resort_id);

test("search all overrides saved scope but still matches indexed aliases", () => {
  assert.deepEqual(ids(model.selectReports(reports, filters({
    search: " HIDDEN VALLEY ", favoritesOnly: true, includeDefault: true,
    passTypes: new Set(["ikon"]), subregions: new Set(["west-coast"]),
  }), new Set())), ["bowl"]);
});

test("search within filters retains favorites, pass, and regional restrictions", () => {
  const scoped = filters({ search: "bowl", searchAll: false, favoritesOnly: true, passTypes: ["EPIC"], subregions: ["ROCKIES"] });
  assert.deepEqual(ids(model.selectReports(reports, scoped, new Set(["bowl"]))), ["bowl"]);
  assert.deepEqual(model.selectReports(reports, scoped, new Set()), []);
});

test("region search matches region fields and readable subregion names", () => {
  assert.deepEqual(ids(model.selectReports(reports, filters({ search: "Rockies" }))), ["cedar", "bowl"]);
  assert.deepEqual(ids(model.selectReports(reports, filters({ search: "West Coast" }))), ["alpine"]);
  assert.deepEqual(ids(model.selectReports(reports, filters({ search: "west-coast" }))), ["alpine"]);
  const regional = [{ resort_id: "southern", query: "Southern", region: "oceania", subregion: "australia-new-zealand" }];
  for (const search of ["Oceania", "Australia / New Zealand", "Australia New Zealand", "australia-new-zealand"]) {
    assert.deepEqual(ids(model.selectReports(regional, filters({ search }))), ["southern"], search);
  }
});

test("default scope accepts the legacy default flag; blank search does not bypass it", () => {
  assert.deepEqual(ids(model.selectReports(reports, filters({ includeDefault: true, search: "  " }))), ["alpine", "cedar"]);
});

test("snow sorts handle missing values, zero, and partial two-week totals", () => {
  assert.deepEqual(ids(model.sortReports(reports, "today_snow")), ["bowl", "alpine", "cedar"]);
  assert.deepEqual(ids(model.sortReports(reports, "week_snow")), ["bowl", "alpine", "cedar"]);
  assert.deepEqual(ids(model.sortReports(reports, "next_week_snow")), ["cedar", "alpine", "bowl"]);
  assert.deepEqual(ids(model.sortReports(reports, "two_week_snow")), ["bowl", "cedar", "alpine"]);
});

test("equal missing snow values use the geographic tie-break", () => {
  const missing = [{ query: "Zulu", admin1: "UT" }, { query: "Alpha", admin1: "CA" }];
  assert.deepEqual(model.sortReports(missing, "week_snow").map((report) => report.query), ["Alpha", "Zulu"]);
});

test("favorite sorting and selection are pure and cannot mutate source arrays", () => {
  const source = Object.freeze([...reports]);
  const favorites = new Set(["cedar"]);
  assert.deepEqual(ids(model.sortReports(source, "favorites", favorites)), ["cedar", "alpine", "bowl"]);
  assert.deepEqual(ids(model.selectReports(source, filters({ sortBy: "week_snow" }), favorites)), ["bowl", "alpine", "cedar"]);
  assert.deepEqual(ids(source), ["alpine", "bowl", "cedar"]);
  assert.deepEqual([...favorites], ["cedar"]);
});

test("payload and filter metadata tolerate invalid rows and normalize pass labels", () => {
  assert.deepEqual(model.payloadReports({ reports: [null, false, [], ...reports] }), reports);
  assert.deepEqual(model.deriveAvailableFilters(reports).pass_type, { ikon: 2, epic: 1 });
});
