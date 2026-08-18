import { test } from "node:test";
import assert from "node:assert/strict";
import { computeCompetitorAverage, outcomeSummary } from "./competitorAveraging.ts";

// The 19 Aug-shaped scenario: a raw search full of small villas plus a couple of real comparables.
const rawSearchResults = [
  { name: "Budget Villa 1", priceExtracted: 38, hotelClass: "1-star hotel" },
  { name: "Budget Villa 2", priceExtracted: 42, hotelClass: null },
  { name: "Golden Hotel Zlatibor", priceExtracted: 98, hotelClass: "4-star hotel" },
  { name: "Hotel Mona Zlatibor", priceExtracted: 137, hotelClass: "4-star hotel" },
];

test("saved list present: only those hotels are averaged, ignoring the rest of the raw search", () => {
  const outcome = computeCompetitorAverage(["Golden Hotel", "Hotel Mona"], rawSearchResults, null, null);
  assert.equal(outcome.method, "saved");
  if (outcome.method !== "saved") throw new Error("unreachable");
  assert.equal(outcome.avgPrice, 117.5); // (98 + 137) / 2 — Budget Villas never enter the average
  assert.equal(outcome.usedCount, 2);
});

test("saved list present, one name unmatched: average uses the matched ones AND the unmatched one is reported", () => {
  const outcome = computeCompetitorAverage(["Golden Hotel", "Hotel Nowhere"], rawSearchResults, null, null);
  assert.equal(outcome.method, "saved");
  if (outcome.method !== "saved") throw new Error("unreachable");
  assert.equal(outcome.avgPrice, 98);
  assert.equal(outcome.usedCount, 1);
  const unmatched = outcome.matches.find(m => m.savedName === "Hotel Nowhere");
  assert.equal(unmatched?.matched, null);
});

test("saved list present, none matched: degraded confidence (no avgPrice), not a silent fallback to the raw average", () => {
  const outcome = computeCompetitorAverage(["Hotel Nowhere At All"], rawSearchResults, null, null);
  assert.equal(outcome.method, "saved_none_matched");
  if (outcome.method !== "saved_none_matched") throw new Error("unreachable");
  assert.equal(outcome.matches[0].matched, null);
  // No avgPrice field at all on this outcome shape — there is nothing to silently fall back to.
});

test("saved list empty: comparability filter applied (price-band fallback here) instead of averaging every result", () => {
  const outcome = computeCompetitorAverage([], rawSearchResults, null, 125); // our own price 125
  assert.equal(outcome.method, "price_band_fallback");
  if (outcome.method !== "price_band_fallback" && outcome.method !== "class_band") throw new Error("unreachable");
  // Budget villas (38, 42) fall outside the ±40% band around 125 ([75, 175]) and are excluded —
  // the recomputed average should sit far above the raw ~72.5 average of all four raw results.
  assert.equal(outcome.avgPrice, 117.5); // (98 + 137) / 2
});

test("saved list empty, own price unknown too: no reference to judge comparability, so no average rather than a false one", () => {
  const outcome = computeCompetitorAverage([], rawSearchResults, null, null);
  assert.equal(outcome.method, "no_reference_available");
  assert.equal(outcome.avgPrice, null);
});

test("own hotel is never in the candidate set to begin with (route.ts excludes it before this runs) — sanity check the orchestrator doesn't need to re-filter it", () => {
  // api/competitors/route.ts strips the own-hotel listing via namesMatch before results ever reach
  // this module (see competitorMatching.test.ts for that behavior) — nothing to do here but confirm
  // a clean result set with no self-entry behaves normally.
  const outcome = computeCompetitorAverage([], rawSearchResults, null, 125);
  assert.equal(outcome.avgPrice, 117.5);
});

test("outcomeSummary: saved -> matched count and average", () => {
  const outcome = computeCompetitorAverage(["Golden Hotel"], rawSearchResults, null, null);
  assert.deepEqual(outcomeSummary(outcome), { avgPrice: 98, count: 1 });
});

test("outcomeSummary: saved_none_matched -> null average, zero count (never a silent fallback average)", () => {
  const outcome = computeCompetitorAverage(["Nowhere"], rawSearchResults, null, null);
  assert.deepEqual(outcomeSummary(outcome), { avgPrice: null, count: 0 });
});

test("outcomeSummary: comparability fallback -> comparable count and average", () => {
  const outcome = computeCompetitorAverage([], rawSearchResults, null, 125);
  assert.deepEqual(outcomeSummary(outcome), { avgPrice: 117.5, count: 2 });
});
