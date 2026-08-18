import { test } from "node:test";
import assert from "node:assert/strict";
import { parseHotelClassStars, filterComparableCompetitors, COMPARABILITY_CONFIG } from "./competitorComparability.ts";

test("parseHotelClassStars reads SerpAPI's '4-star hotel' style string", () => {
  assert.equal(parseHotelClassStars("4-star hotel"), 4);
  assert.equal(parseHotelClassStars("3.5-star hotel"), 3.5);
  assert.equal(parseHotelClassStars(null), null);
  assert.equal(parseHotelClassStars("Boutique property"), null);
});

test("class_band: keeps competitors within tolerance of our own star class, drops the rest", () => {
  const entries = [
    { name: "Real Comparable", priceExtracted: 100, hotelClass: "4-star hotel" },
    { name: "Also Comparable", priceExtracted: 110, hotelClass: "3-star hotel" }, // within 1 star of 4
    { name: "Budget Villa", priceExtracted: 38, hotelClass: "1-star hotel" }, // 3 stars away — excluded
  ];
  const result = filterComparableCompetitors(entries, 4, null);
  assert.equal(result.method, "class_band");
  assert.deepEqual(result.comparable.map(e => e.name), ["Real Comparable", "Also Comparable"]);
  assert.deepEqual(result.excludedOutOfClassBand.map(e => e.name), ["Budget Villa"]);
});

test("class_band: a result with no hotelClass at all is excluded per the stated missingClassPolicy", () => {
  assert.equal(COMPARABILITY_CONFIG.missingClassPolicy, "exclude");
  const entries = [
    { name: "Unrated Listing", priceExtracted: 90, hotelClass: null },
  ];
  const result = filterComparableCompetitors(entries, 4, null);
  assert.deepEqual(result.comparable, []);
  assert.deepEqual(result.excludedNoClass.map(e => e.name), ["Unrated Listing"]);
});

test("price_band_fallback: used when own star class is unknown but our own price is known — keeps competitors within tolerance of OUR price, not a fixed € band", () => {
  // Own price 125 (Queen of Zlatibor's actual CLS price), tolerance ±40% -> comparable band [75, 175]
  const entries = [
    { name: "Budget Villa", priceExtracted: 38, hotelClass: null },   // below band
    { name: "Real Comparable A", priceExtracted: 98, hotelClass: null },  // in band
    { name: "Real Comparable B", priceExtracted: 137, hotelClass: null }, // in band
  ];
  const result = filterComparableCompetitors(entries, null, 125);
  assert.equal(result.method, "price_band_fallback");
  assert.deepEqual(result.comparable.map(e => e.name), ["Real Comparable A", "Real Comparable B"]);
  assert.deepEqual(result.excludedPriceBand.map(e => e.name), ["Budget Villa"]);
});

test("no_reference_available: neither own star class nor own price known — returns nothing comparable rather than silently averaging everything", () => {
  const entries = [{ name: "Anything", priceExtracted: 90, hotelClass: "4-star hotel" }];
  const result = filterComparableCompetitors(entries, null, null);
  assert.equal(result.method, "no_reference_available");
  assert.deepEqual(result.comparable, []);
});
