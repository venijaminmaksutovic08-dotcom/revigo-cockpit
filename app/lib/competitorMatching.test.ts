import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeHotelName, namesMatch, computeSavedCompetitorAverage } from "./competitorMatching.ts";

test("normalizeHotelName strips diacritics, case, and punctuation", () => {
  assert.equal(normalizeHotelName("Hotel Čigota – Zlatibor"), "hotel cigota zlatibor");
});

test("namesMatch: substring match in either direction after normalization", () => {
  assert.equal(namesMatch("Golden Hotel", "Hotel Golden Zlatibor"), true);
  assert.equal(namesMatch("Panorama", "Panorama"), true);
  assert.equal(namesMatch("Queen of Zlatibor", "Hotel Mona"), false);
});

test("namesMatch: own-hotel exclusion still works (diacritics + case variants)", () => {
  assert.equal(namesMatch("panorama", "Hotel Panorama Zlatibor"), true);
  assert.equal(namesMatch("Čigota", "Hotel ČIGOTA"), true);
});

test("saved list present: only saved-and-matched hotels are averaged", () => {
  const results = [
    { name: "Hotel Mona Zlatibor", priceExtracted: 9000 },
    { name: "Golden Hotel Zlatibor", priceExtracted: 11000 },
    { name: "Some Random Villa", priceExtracted: 3000 }, // NOT saved — must not affect the average
  ];
  const { avgPrice, usedCount, matches } = computeSavedCompetitorAverage(["Hotel Mona", "Golden Hotel"], results);
  assert.equal(avgPrice, 10000); // (9000 + 11000) / 2 — the unsaved villa is excluded
  assert.equal(usedCount, 2);
  assert.equal(matches.length, 2);
  assert.ok(matches.every(m => m.matched != null));
});

test("saved list present, one name unmatched: average uses only the matched ones, unmatched is reported (not dropped silently)", () => {
  const results = [
    { name: "Hotel Mona Zlatibor", priceExtracted: 8000 },
  ];
  const { avgPrice, usedCount, matches } = computeSavedCompetitorAverage(["Hotel Mona", "Hotel Nowhere"], results);
  assert.equal(avgPrice, 8000);
  assert.equal(usedCount, 1);
  assert.equal(matches.length, 2);
  const unmatched = matches.find(m => m.savedName === "Hotel Nowhere");
  assert.ok(unmatched);
  assert.equal(unmatched.matched, null);
  const matched = matches.find(m => m.savedName === "Hotel Mona");
  assert.equal(matched?.matched?.priceExtracted, 8000);
});

test("saved list present, none matched: no average, all reported as unmatched", () => {
  const results = [{ name: "Totally Different Hotel", priceExtracted: 5000 }];
  const { avgPrice, usedCount, matches } = computeSavedCompetitorAverage(["Hotel Mona", "Hotel Nowhere"], results);
  assert.equal(avgPrice, null);
  assert.equal(usedCount, 0);
  assert.ok(matches.every(m => m.matched === null));
});

test("saved list present, a result matches by name but has no price: treated as unmatched, not used", () => {
  const results = [{ name: "Hotel Mona Zlatibor", priceExtracted: null }];
  const { avgPrice, usedCount, matches } = computeSavedCompetitorAverage(["Hotel Mona"], results);
  assert.equal(avgPrice, null);
  assert.equal(usedCount, 0);
  assert.equal(matches[0].matched, null);
});
