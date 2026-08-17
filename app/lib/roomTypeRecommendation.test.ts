// Regression tests for the per-room-type recommendation layer. Run with: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  computeTypeOccupancyPct, computeHotelOccupancyForDate, computeDeviationRooms, classifyDeviation,
  applyNotch, normalizePickupPerDay, computeHotelPickupPerDay, matchesArchiveRoomType,
  enforcePriceLadder, computeRoomTypeAdjustment, resolveTypeNudgePercent, ROOM_TYPE_RECOMMENDATION_CONFIG,
  type RoomTypeOnBooksRow, type LadderInput,
} from "./roomTypeRecommendation.ts";
import { suggestedPrice } from "./priceRecommendation.ts";

function row(overrides: Partial<RoomTypeOnBooksRow> = {}): RoomTypeOnBooksRow {
  return {
    roomType: "CLS",
    roomNights: 50,
    roomsInventory: 100,
    pickupRoomNights: null,
    reportDate: "2026-08-13",
    prevReportDate: null,
    ...overrides,
  };
}

// ── Per-type / hotel occupancy, including null handling ────────────────────────────

test("computeTypeOccupancyPct: room_nights / rooms_inventory, and null when room_nights is null", () => {
  assert.equal(computeTypeOccupancyPct(row({ roomNights: 40, roomsInventory: 80 })), 50);
  assert.equal(computeTypeOccupancyPct(row({ roomNights: null })), null, "null room_nights must stay null, never become 0%");
  assert.equal(computeTypeOccupancyPct(row({ roomNights: 10, roomsInventory: 0 })), null, "zero inventory must not divide-by-zero into a fake number");
});

test("computeHotelOccupancyForDate: sums only types with a real reading, excludes null types from both sides", () => {
  const rows = [
    row({ roomType: "A", roomNights: 60, roomsInventory: 100 }),
    row({ roomType: "B", roomNights: 20, roomsInventory: 50 }),
    row({ roomType: "C", roomNights: null, roomsInventory: 30 }), // no reading — must be excluded entirely
  ];
  const result = computeHotelOccupancyForDate(rows);
  assert.equal(result.totalRoomNights, 80);
  assert.equal(result.totalInventory, 150, "type C's inventory must NOT be counted — it has no reading");
  assert.equal(result.occPct, (80 / 150) * 100);
  assert.equal(result.typesUsed, 2);
});

test("computeHotelOccupancyForDate: null when nothing usable at all", () => {
  const result = computeHotelOccupancyForDate([row({ roomNights: null }), row({ roomType: "B", roomNights: null })]);
  assert.equal(result.occPct, null);
  assert.equal(result.typesUsed, 0);
});

// ── Inventory-aware threshold — the core requirement ────────────────────────────────

test("a 1-room change on a 5-room type stays within threshold (does not move the verdict)", () => {
  // Hotel occupancy 60% → this 5-room type "should" have 3 rooms on the books; it actually has 4 —
  // a 1-room change from expectation, and a real 20% swing in the type's OWN occupancy.
  const small = row({ roomType: "SMALL", roomNights: 4, roomsInventory: 5 });
  const deviation = computeDeviationRooms(small, 60);
  assert.equal(deviation, 1);
  assert.equal(classifyDeviation(deviation), "within-threshold");
  assert.equal(applyNotch("HOLD", classifyDeviation(deviation)), "HOLD", "must not flip off a single booking");
});

test("an equivalent proportional change on a 95-room type DOES cross the threshold", () => {
  // Same 60% hotel occupancy → this 95-room type "should" have 57 rooms; the PROPORTIONALLY
  // equivalent swing to the 5-room case above (20% of inventory) is 19 rooms, landing at 76.
  const large = row({ roomType: "LARGE", roomNights: 76, roomsInventory: 95 });
  const deviation = computeDeviationRooms(large, 60);
  assert.equal(deviation, 19);
  assert.equal(classifyDeviation(deviation), "hotter");
  assert.equal(applyNotch("HOLD", classifyDeviation(deviation)), "RAISE");
});

test("deviation right at the threshold boundary moves the verdict; just under does not", () => {
  const t = ROOM_TYPE_RECOMMENDATION_CONFIG.deviationThresholdRooms;
  assert.equal(classifyDeviation(t), "hotter");
  assert.equal(classifyDeviation(t - 0.01), "within-threshold");
  assert.equal(classifyDeviation(-t), "colder");
  assert.equal(classifyDeviation(-t + 0.01), "within-threshold");
});

test("applyNotch moves exactly one step and never more, in either direction, and clamps at the ends", () => {
  assert.equal(applyNotch("HOLD", "hotter"), "RAISE");
  assert.equal(applyNotch("HOLD", "colder"), "LOWER");
  assert.equal(applyNotch("RAISE", "hotter"), "RAISE", "already at the top — cannot go higher");
  assert.equal(applyNotch("RAISE", "colder"), "HOLD", "one step down from RAISE");
  assert.equal(applyNotch("LOWER", "colder"), "LOWER", "already at the bottom — cannot go lower");
  assert.equal(applyNotch("LOWER", "hotter"), "HOLD", "one step up from LOWER");
  assert.equal(applyNotch("HOLD", "within-threshold"), "HOLD");
  assert.equal(applyNotch("RAISE", null), "RAISE", "no data — base verdict passes through unchanged");
});

// ── Pickup normalization ─────────────────────────────────────────────────────────

test("pickup is normalized by the actual elapsed days, not treated as a daily figure", () => {
  const r = row({ pickupRoomNights: 9, reportDate: "2026-08-13", prevReportDate: "2026-08-10" }); // 3-day gap
  assert.equal(normalizePickupPerDay(r), 3);
});

test("pickup is ignored entirely when prev_report_date is null", () => {
  const r = row({ pickupRoomNights: 20, reportDate: "2026-08-13", prevReportDate: null });
  assert.equal(normalizePickupPerDay(r), null);
});

test("pickup normalization guards a zero/negative day span rather than dividing oddly", () => {
  assert.equal(normalizePickupPerDay(row({ pickupRoomNights: 5, reportDate: "2026-08-13", prevReportDate: "2026-08-13" })), null);
  assert.equal(normalizePickupPerDay(row({ pickupRoomNights: 5, reportDate: "2026-08-10", prevReportDate: "2026-08-13" })), null);
});

test("computeHotelPickupPerDay sums raw pickup across types and normalizes once by the shared gap", () => {
  const rows = [
    row({ roomType: "A", pickupRoomNights: 4, reportDate: "2026-08-13", prevReportDate: "2026-08-11" }),
    row({ roomType: "B", pickupRoomNights: 6, reportDate: "2026-08-13", prevReportDate: "2026-08-11" }),
    row({ roomType: "C", pickupRoomNights: null, prevReportDate: null }), // excluded
  ];
  assert.equal(computeHotelPickupPerDay(rows), 5); // (4+6) / 2 days
});

// ── Full per-type orchestration, including the "no data for this date" fallback ────

test("computeRoomTypeAdjustment falls back to the base verdict, honestly flagged, when there's no row or no reading", () => {
  const noRow = computeRoomTypeAdjustment(null, 55, null, "RAISE");
  assert.equal(noRow.dataAvailable, false);
  assert.equal(noRow.verdict, "RAISE");

  const nullReading = computeRoomTypeAdjustment(row({ roomNights: null }), 55, null, "LOWER");
  assert.equal(nullReading.dataAvailable, false);
  assert.equal(nullReading.verdict, "LOWER");
});

test("computeRoomTypeAdjustment applies the notch end-to-end for a hot type", () => {
  const hot = row({ roomType: "HOT", roomNights: 76, roomsInventory: 95 });
  const result = computeRoomTypeAdjustment(hot, 60, 2.5, "HOLD");
  assert.equal(result.dataAvailable, true);
  assert.equal(result.verdict, "RAISE");
  assert.equal(result.direction, "hotter");
  assert.equal(result.hotelPickupPerDay, 2.5);
});

// ── Per-type nudge sign correctness — a LOWER verdict must never produce a higher price ──────────

test("resolveTypeNudgePercent reuses the base nudge when the type's verdict didn't actually change", () => {
  assert.equal(resolveTypeNudgePercent("RAISE", 7, "RAISE"), 7);
  assert.equal(resolveTypeNudgePercent("LOWER", -6, "LOWER"), -6);
});

test("resolveTypeNudgePercent overrides with a correctly-signed magnitude when a notch changed the verdict", () => {
  // The exact bug this guards: a mildly positive HOLD-base nudge, reused as-is for a type notched
  // DOWN to LOWER, would push that type's price UP under a "LOWER" label.
  const overridden = resolveTypeNudgePercent("HOLD", 2, "LOWER");
  assert.ok(overridden < 0, "a LOWER verdict must always get a negative nudge, regardless of the base's own sign");
  const raised = resolveTypeNudgePercent("HOLD", -2, "RAISE");
  assert.ok(raised > 0, "a RAISE verdict must always get a positive nudge, regardless of the base's own sign");
});

test("end-to-end: a per-type LOWER verdict never produces a suggested price above the baseline", () => {
  const baseVerdict = "HOLD";
  const baseNudge = 2; // mildly positive — the exact scenario that exposed the bug
  const typeVerdict = "LOWER"; // this type notched down despite the base's mild positive lean
  const nudge = resolveTypeNudgePercent(baseVerdict, baseNudge, typeVerdict);
  const price = suggestedPrice(171, nudge, typeVerdict);
  assert.ok(price! <= 171, `LOWER must not raise the price (got ${price} from baseline 171)`);
});

test("end-to-end: a per-type RAISE verdict never produces a suggested price below the baseline", () => {
  const baseVerdict = "HOLD";
  const baseNudge = -2; // mildly negative
  const typeVerdict = "RAISE";
  const nudge = resolveTypeNudgePercent(baseVerdict, baseNudge, typeVerdict);
  const price = suggestedPrice(140, nudge, typeVerdict);
  assert.ok(price! >= 140, `RAISE must not lower the price (got ${price} from baseline 140)`);
});

// ── Price ladder clamp ───────────────────────────────────────────────────────────

test("enforcePriceLadder clamps an inversion by raising the lagging price to the previous floor", () => {
  const inputs: LadderInput[] = [
    { roomTypeKey: "A", baselinePrice: 100, suggestedPrice: 100 },
    { roomTypeKey: "B", baselinePrice: 150, suggestedPrice: 90 }, // would drop BELOW cheaper-baseline A — inversion
    { roomTypeKey: "C", baselinePrice: 200, suggestedPrice: 200 },
  ];
  const results = enforcePriceLadder(inputs);
  const byKey = Object.fromEntries(results.map(r => [r.roomTypeKey, r]));
  assert.equal(byKey.A.finalPrice, 100);
  assert.equal(byKey.A.clamped, false);
  assert.equal(byKey.B.finalPrice, 100, "clamped up to preserve baseline ordering");
  assert.equal(byKey.B.clamped, true);
  assert.equal(byKey.C.finalPrice, 200);
  assert.equal(byKey.C.clamped, false);
});

test("enforcePriceLadder does nothing when the order was never violated", () => {
  const inputs: LadderInput[] = [
    { roomTypeKey: "A", baselinePrice: 100, suggestedPrice: 105 },
    { roomTypeKey: "B", baselinePrice: 150, suggestedPrice: 160 },
  ];
  const results = enforcePriceLadder(inputs);
  assert.ok(results.every(r => !r.clamped));
});

test("enforcePriceLadder passes through types with no baseline price unclamped", () => {
  const inputs: LadderInput[] = [{ roomTypeKey: "X", baselinePrice: null, suggestedPrice: 999 }];
  const results = enforcePriceLadder(inputs);
  assert.equal(results[0].finalPrice, 999);
  assert.equal(results[0].clamped, false);
});

// ── No-hardcoding guard: a hotel with a different room-type count and different codes ──────────

test("a hotel with 5 room types using entirely different codes still computes correctly", () => {
  const rows: RoomTypeOnBooksRow[] = [
    row({ roomType: "STD", roomNights: 30, roomsInventory: 60 }),
    row({ roomType: "DLX", roomNights: 18, roomsInventory: 20 }),
    row({ roomType: "STE", roomNights: 4, roomsInventory: 8 }),
    row({ roomType: "EXE", roomNights: 2, roomsInventory: 6 }),
    row({ roomType: "PEN", roomNights: null, roomsInventory: 2 }), // no reading yet
  ];
  const hotel = computeHotelOccupancyForDate(rows);
  assert.equal(hotel.totalInventory, 94, "PEN's 2 rooms excluded — no reading");
  assert.equal(hotel.totalRoomNights, 54);
  assert.equal(hotel.typesUsed, 4);

  // DLX is running far hotter than the house (90% vs the hotel's ~57%) — should notch up.
  const dlx = rows.find(r => r.roomType === "DLX")!;
  const dlxAdj = computeRoomTypeAdjustment(dlx, hotel.occPct, null, "HOLD");
  assert.equal(dlxAdj.direction, "hotter");
  assert.equal(dlxAdj.verdict, "RAISE");

  // PEN has no reading at all — must fall back honestly, not invent a number.
  const pen = rows.find(r => r.roomType === "PEN")!;
  const penAdj = computeRoomTypeAdjustment(pen, hotel.occPct, null, "HOLD");
  assert.equal(penAdj.dataAvailable, false);
  assert.equal(penAdj.verdict, "HOLD");
});

test("matchesArchiveRoomType matches abbreviation-style codes generically, not via a hardcoded table", () => {
  assert.equal(matchesArchiveRoomType("CLS", "cls", "CLS"), true);
  assert.equal(matchesArchiveRoomType("SUP", "superior", "Superior"), true, "SUP is a prefix-abbreviation of Superior");
  assert.equal(matchesArchiveRoomType("STD", "std", "Standard"), true, "STD is a prefix-abbreviation of Standard");
  assert.equal(matchesArchiveRoomType("DLX", "dplx", "DPLX"), false, "DLX must not falsely match a differently-spelled DPLX slot");
  assert.equal(matchesArchiveRoomType("", "cls", "CLS"), false, "an empty archive code must never match");
});
