import { test } from "node:test";
import assert from "node:assert/strict";
import { computeRecommendation, type RecommendationInputs } from "./priceRecommendation.ts";
import { explainBaseRecommendation, explainRoomTypeAdjustment } from "./recommendationExplain.ts";
import type { RoomTypeAdjustmentResult } from "./roomTypeRecommendation.ts";

// onBooksOccPctIsMonthly: true here is the CORRECT, realistic value for the primary/non-fallback
// path too — both of Preporuka Cena's occupancy sources are whole-month figures (see
// RecommendationInputs in priceRecommendation.ts), never this one stay date's own reading. Before
// the label-honesty fix, page.tsx silently passed `false` here whenever the primary path was used,
// which is exactly the case this fixture now locks in as `true`.
const FULL_INPUTS: RecommendationInputs = {
  onBooksOccPct: 81, onBooksOccPctIsMonthly: true, targetOccPct: 74,
  onBooksNights: 2779, sameDayLastYearNights: 1738,
  competitorAvgEur: 106, ourRefPriceEur: 125,
  isWeekend: false, hasNearbyEvent: false, nearbyEventLabel: null, monthLabel: "avgust",
};

// ── Base verdict explanation ─────────────────────────────────────────────────────

test("base explanation: every available signal gets a plain-language line with its real number", () => {
  const result = computeRecommendation(FULL_INPUTS);
  const explanation = explainBaseRecommendation(FULL_INPUTS, result);
  assert.equal(explanation.missingLines.length, 0, "all four signals are present in FULL_INPUTS");
  assert.ok(explanation.signalLines.some(l => l.includes("81%") && l.includes("74%") && l.includes("ispred plana")));
  assert.ok(explanation.signalLines.some(l => l.includes("106€") && l.includes("125€") && l.includes("skuplji smo")));
  assert.ok(explanation.signalLines.some(l => l.includes("2.779") || l.includes("2779")));
  assert.ok(explanation.signalLines.some(l => l.includes("Radni dan")));
});

test("base occupancy figure is marked (mesečno) on the NORMAL (non-fallback) path — this was the case that was silently wrong", () => {
  // FULL_INPUTS.onBooksOccPctIsMonthly is true, simulating page.tsx's corrected behavior for the
  // primary daily_reports-snapshot path, not just the onbooks_snapshots fallback.
  const result = computeRecommendation(FULL_INPUTS);
  const explanation = explainBaseRecommendation(FULL_INPUTS, result);
  const occLine = explanation.signalLines.find(l => l.startsWith("Popunjenost"));
  assert.ok(occLine, "expected an occupancy signal line");
  assert.match(occLine as string, /^Popunjenost \(mesečno\)/, "must be marked monthly even on the primary path, not only the fallback");
});

test("target/plan is labeled with the derived month, never hardcoded and never 'ovaj datum'", () => {
  const result = computeRecommendation(FULL_INPUTS);
  const explanation = explainBaseRecommendation(FULL_INPUTS, result);
  const occLine = explanation.signalLines.find(l => l.startsWith("Popunjenost")) as string;
  assert.match(occLine, /plan za avgust/);
  assert.doesNotMatch(occLine, /ovaj datum/);

  const septInputs: RecommendationInputs = { ...FULL_INPUTS, monthLabel: "septembar" };
  const septResult = computeRecommendation(septInputs);
  const septExplanation = explainBaseRecommendation(septInputs, septResult);
  const septOccLine = septExplanation.signalLines.find(l => l.startsWith("Popunjenost")) as string;
  assert.match(septOccLine, /plan za septembar/, "month label must come from the input, not be hardcoded to avgust");
});

test("noćenja (pace vs last year) signal is also marked (mesečno)", () => {
  const result = computeRecommendation(FULL_INPUTS);
  const explanation = explainBaseRecommendation(FULL_INPUTS, result);
  assert.ok(explanation.signalLines.some(l => l.startsWith("Noćenja na knjigama (mesečno)")));
});

test("base explanation: never prints a raw weight like 'paceVsTarget 40%'", () => {
  const result = computeRecommendation(FULL_INPUTS);
  const explanation = explainBaseRecommendation(FULL_INPUTS, result);
  const all = [...explanation.signalLines, ...explanation.missingLines, ...explanation.verdictLines].join(" ");
  assert.doesNotMatch(all, /paceVsTarget|competitorGap|paceVsLastYear|eventsBoost/i);
  assert.doesNotMatch(all, /0\.\d+\s*(weight|težin)/i);
});

test("a missing competitor signal appears in explainBaseRecommendation's missingLines (the always-visible area is driven by the same result.missingSignals, tested separately below)", () => {
  const inputs: RecommendationInputs = { ...FULL_INPUTS, competitorAvgEur: null };
  const result = computeRecommendation(inputs);
  // This is the exact array preporuka/page.tsx already renders outside the toggle, unconditionally.
  assert.ok(result.missingSignals.includes("Konkurencija"), "always-visible missing-signal list must include it");
  const explanation = explainBaseRecommendation(inputs, result);
  assert.ok(explanation.missingLines.some(l => l.startsWith("Konkurencija:")), "the expanded explanation also names it, with why");
  assert.ok(!explanation.signalLines.some(l => l.includes("Prosek konkurencije")), "no fabricated competitor line when the signal is missing");
});

test("base explanation: confidence damper mentioned explicitly only when it actually changed the number", () => {
  const partial: RecommendationInputs = { ...FULL_INPUTS, competitorAvgEur: null, sameDayLastYearNights: null };
  const result = computeRecommendation(partial);
  const explanation = explainBaseRecommendation(partial, result);
  if (result.nudgePercentRaw !== result.nudgePercent) {
    assert.ok(explanation.verdictLines[0].includes("smanjen"), "damping line must be explicit when the number actually changed");
    assert.match(explanation.verdictLines[0], /\d+%/, "must cite the real confidence percentage");
  }
  // Full-confidence case must NOT claim damping happened.
  const fullResult = computeRecommendation(FULL_INPUTS);
  const fullExplanation = explainBaseRecommendation(FULL_INPUTS, fullResult);
  assert.doesNotMatch(fullExplanation.verdictLines[0], /smanjen/);
});

test("base explanation: verdict line states the correct direction and magnitude for RAISE / HOLD / LOWER", () => {
  const raiseInputs: RecommendationInputs = {
    ...FULL_INPUTS, onBooksOccPct: 90, targetOccPct: 60, competitorAvgEur: 150, ourRefPriceEur: 100,
    onBooksNights: 3000, sameDayLastYearNights: 1500,
  };
  const raiseResult = computeRecommendation(raiseInputs);
  const raiseExp = explainBaseRecommendation(raiseInputs, raiseResult);
  assert.equal(raiseResult.verdict, "RAISE");
  assert.ok(raiseExp.verdictLines.some(l => l.includes("podigni cenu")));

  const lowerInputs: RecommendationInputs = { ...FULL_INPUTS, onBooksOccPct: 40, targetOccPct: 74, competitorAvgEur: 90, ourRefPriceEur: 125 };
  const lowerResult = computeRecommendation(lowerInputs);
  const lowerExp = explainBaseRecommendation(lowerInputs, lowerResult);
  assert.equal(lowerResult.verdict, "LOWER");
  assert.ok(lowerExp.verdictLines.some(l => l.includes("spusti cenu")));

  const holdInputs: RecommendationInputs = { ...FULL_INPUTS, onBooksOccPct: 74, targetOccPct: 74, competitorAvgEur: 125, ourRefPriceEur: 125, isWeekend: false };
  const holdResult = computeRecommendation(holdInputs);
  const holdExp = explainBaseRecommendation(holdInputs, holdResult);
  assert.equal(holdResult.verdict, "HOLD");
  assert.ok(holdExp.verdictLines.some(l => l.includes("cena ostaje ista")));
});

// ── Per-room-type explanation ─────────────────────────────────────────────────────

function typeRow(overrides: Partial<RoomTypeAdjustmentResult> = {}): RoomTypeAdjustmentResult {
  return {
    roomType: "X", dataAvailable: true, occPct: 70, deviationRooms: 0, direction: "within-threshold",
    verdict: "RAISE", pickupPerDay: null, hotelPickupPerDay: null, ...overrides,
  };
}

test("a type nudged UP produces a distinct explanation naming the step and the new verdict", () => {
  const adjustment = typeRow({ verdict: "RAISE", direction: "hotter", deviationRooms: 4.2, occPct: 90 });
  const lines = explainRoomTypeAdjustment({
    label: "Superior", adjustment, hotelOccPct: 69, roomsInventory: 20, baseVerdict: "HOLD",
    typeNudgePercent: 4, suggested: 130, laddered: false, clampedAgainstLabel: null, clampedAgainstPrice: null,
  });
  const text = lines.join(" ");
  assert.match(text, /Superior odstupa 4\.2 sobe iznad/);
  assert.match(text, /Drži cene → Tražnja iznad plana/);
  assert.match(text, /\+4%/);
  assert.match(text, /popunjenost hotela za ovaj datum 69%/, "per-type hotel occupancy must read as THIS night's figure, distinct from the base card's monthly one");
});

test("a type nudged DOWN produces a distinct explanation, correctly signed", () => {
  const adjustment = typeRow({ verdict: "LOWER", direction: "colder", deviationRooms: -3.6, occPct: 30 });
  const lines = explainRoomTypeAdjustment({
    label: "DPLX", adjustment, hotelOccPct: 69, roomsInventory: 15, baseVerdict: "HOLD",
    typeNudgePercent: -4, suggested: 80, laddered: false, clampedAgainstLabel: null, clampedAgainstPrice: null,
  });
  const text = lines.join(" ");
  assert.match(text, /DPLX odstupa 3\.6 sobe ispod/);
  assert.match(text, /Drži cene → Tražnja ispod plana/);
  assert.match(text, /-4%/);
});

test("a type that FOLLOWS the base (within threshold) explains why in plain words, naming the type's own inventory", () => {
  const adjustment = typeRow({ verdict: "HOLD", direction: "within-threshold", deviationRooms: 1.1, occPct: 60 });
  const lines = explainRoomTypeAdjustment({
    label: "King", adjustment, hotelOccPct: 62, roomsInventory: 5, baseVerdict: "HOLD",
    typeNudgePercent: 0, suggested: 200, laddered: false, clampedAgainstLabel: null, clampedAgainstPrice: null,
  });
  const text = lines.join(" ");
  assert.match(text, /King ima 5 soba/, "must name the type's own real inventory count, not an illustration");
  assert.match(text, /razlika je 1\.1 sobe/);
  assert.match(text, /premalo/);
});

test("all three (up/down/within-threshold) produce genuinely different text for the same base inputs", () => {
  const base = { hotelOccPct: 69, roomsInventory: 10, baseVerdict: "HOLD" as const, laddered: false, clampedAgainstLabel: null, clampedAgainstPrice: null };
  const up = explainRoomTypeAdjustment({ label: "A", adjustment: typeRow({ verdict: "RAISE", direction: "hotter", deviationRooms: 4 }), typeNudgePercent: 4, suggested: 110, ...base }).join(" ");
  const down = explainRoomTypeAdjustment({ label: "B", adjustment: typeRow({ verdict: "LOWER", direction: "colder", deviationRooms: -4 }), typeNudgePercent: -4, suggested: 90, ...base }).join(" ");
  const flat = explainRoomTypeAdjustment({ label: "C", adjustment: typeRow({ verdict: "HOLD", direction: "within-threshold", deviationRooms: 1 }), typeNudgePercent: 0, suggested: 100, ...base }).join(" ");
  assert.notEqual(up, down);
  assert.notEqual(up, flat);
  assert.notEqual(down, flat);
});

test("inventory-threshold explanation fires for a small-inventory type: a small absolute deviation stays within-threshold", () => {
  // King has only 5 rooms — even a 1-room swing is a 20% occupancy swing, but the FIXED room
  // threshold (3) still means it takes 3 rooms of deviation to move, same as any other type.
  const adjustment = typeRow({ verdict: "HOLD", direction: "within-threshold", deviationRooms: 1.0, occPct: 80 });
  const lines = explainRoomTypeAdjustment({
    label: "King", adjustment, hotelOccPct: 60, roomsInventory: 5, baseVerdict: "HOLD",
    typeNudgePercent: 0, suggested: 200, laddered: false, clampedAgainstLabel: null, clampedAgainstPrice: null,
  });
  assert.match(lines.join(" "), /King ima 5 soba — razlika je 1\.0 sobe u odnosu na očekivano — premalo \(prag: 3 sobe\)/);
});

test("the ladder-clamp explanation names the exact type it was clamped against, and its price", () => {
  const adjustment = typeRow({ verdict: "RAISE", direction: "hotter", deviationRooms: 5 });
  const lines = explainRoomTypeAdjustment({
    label: "DPLX", adjustment, hotelOccPct: 69, roomsInventory: 20, baseVerdict: "HOLD",
    typeNudgePercent: 4, suggested: 130, laddered: true, clampedAgainstLabel: "CLS", clampedAgainstPrice: 130,
  });
  const text = lines.join(" ");
  assert.match(text, /podignuta na 130€/);
  assert.match(text, /tipa "CLS" \(130€\)/, "must name the specific type it was clamped against, not a generic message");
});

test("no per-type data: keeps the existing plain message, never fabricates numbers", () => {
  const adjustment = typeRow({ dataAvailable: false, occPct: null, deviationRooms: null, direction: null, verdict: "HOLD" });
  const lines = explainRoomTypeAdjustment({
    label: "Suite", adjustment, hotelOccPct: 69, roomsInventory: 8, baseVerdict: "HOLD",
    typeNudgePercent: 0, suggested: null, laddered: false, clampedAgainstLabel: null, clampedAgainstPrice: null,
  });
  assert.equal(lines.length, 1);
  assert.match(lines[0], /Nema podataka po tipu sobe za ovaj datum/);
});

// ── No-hardcoding guard: a hotel with entirely different room-type codes ──────────────────

test("reads correctly for a hotel with different room-type codes (not CLS/DPLX/Superior/King)", () => {
  const adjustment = typeRow({ verdict: "LOWER", direction: "colder", deviationRooms: -6, occPct: 20 });
  const lines = explainRoomTypeAdjustment({
    label: "Twin Garden View", adjustment, hotelOccPct: 55, roomsInventory: 40, baseVerdict: "HOLD",
    typeNudgePercent: -4, suggested: 75, laddered: false, clampedAgainstLabel: null, clampedAgainstPrice: null,
  });
  const text = lines.join(" ");
  assert.match(text, /Twin Garden View odstupa 6\.0 sobe ispod/);
  assert.doesNotMatch(text, /CLS|DPLX|Superior|King/);
});
