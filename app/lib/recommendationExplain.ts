// Turns the recommendation engine's already-computed result into plain-Serbian sentences a
// revenue manager can read and verify without knowing anything about the model underneath — no
// weights, no jargon, real numbers only. Every function here is pure formatting: it reads values
// straight off RecommendationInputs / RecommendationResult / RoomTypeAdjustmentResult (the exact
// values the verdict was actually computed from) and never re-derives a score, a verdict, or a
// deviation. If the underlying computation changes, this text changes with it automatically —
// there is no second, parallel copy of the decision logic here to drift out of sync.

import {
  RECOMMENDATION_CONFIG, verdictLabel,
  type RecommendationInputs, type RecommendationResult, type ComponentKey, type Verdict,
} from "./priceRecommendation.ts";
import { ROOM_TYPE_RECOMMENDATION_CONFIG, type RoomTypeAdjustmentResult } from "./roomTypeRecommendation.ts";

function fmtEur(n: number): string {
  return `${Math.round(n).toLocaleString("sr-RS")}€`;
}

function fmtPct(n: number): string {
  return `${Math.round(n).toLocaleString("sr-RS")}%`;
}

function signed(n: number): string {
  return `${n > 0 ? "+" : ""}${n}%`;
}

// Serbian noun plurals for room counts: 1 soba, 2–4 sobe (except 12–14), otherwise soba.
function roomsWord(n: number): string {
  const abs = Math.round(Math.abs(n));
  const mod100 = abs % 100;
  const mod10 = abs % 10;
  if (mod10 === 1 && mod100 !== 11) return "soba";
  if (mod10 >= 2 && mod10 <= 4 && !(mod100 >= 12 && mod100 <= 14)) return "sobe";
  return "soba";
}

// ── Hotel-wide base verdict ─────────────────────────────────────────────────────

export interface BaseExplanation {
  // One line per signal that actually fed the score, in plain words with its real number.
  signalLines: string[];
  // One line per signal that had no data, saying plainly what's missing.
  missingLines: string[];
  // Why this nudge%, and why that verdict — includes the confidence-damping line only when it
  // actually changed the visible number.
  verdictLines: string[];
}

export function explainBaseRecommendation(
  inputs: RecommendationInputs,
  result: RecommendationResult,
): BaseExplanation {
  const componentValue = (key: ComponentKey): number | null =>
    result.components.find(c => c.key === key)?.value ?? null;

  const signalLines: string[] = [];
  const missingLines: string[] = [];

  // Popunjenost vs plan — both sides of this comparison are whole-month figures (see
  // RecommendationInputs), never this one stay date's own occupancy.
  const paceVsTarget = componentValue("paceVsTarget");
  if (paceVsTarget !== null && inputs.onBooksOccPct != null && inputs.targetOccPct != null) {
    const label = inputs.onBooksOccPctIsMonthly ? "Popunjenost (mesečno)" : "Popunjenost";
    const dir = paceVsTarget >= 0 ? "ispred plana" : "iza plana";
    signalLines.push(`${label} ${fmtPct(inputs.onBooksOccPct)}, plan za ${inputs.monthLabel} ${fmtPct(inputs.targetOccPct)} — ${dir}.`);
  } else if (inputs.onBooksOccPct == null) {
    missingLines.push("Popunjenost vs plan: nema podatka o popunjenosti na knjigama za ovaj mesec — signal nije uključen u izračun.");
  } else if (inputs.targetOccPct == null) {
    missingLines.push(`Popunjenost vs plan: nije postavljen mesečni target popunjenosti za ${inputs.monthLabel} — signal nije uključen u izračun.`);
  }

  // Konkurencija
  const competitorGap = componentValue("competitorGap");
  if (competitorGap !== null && inputs.competitorAvgEur != null && inputs.ourRefPriceEur != null) {
    const dir = competitorGap >= 0 ? "jeftiniji smo" : "skuplji smo";
    signalLines.push(`Prosek konkurencije ${fmtEur(inputs.competitorAvgEur)}, naša cena ${fmtEur(inputs.ourRefPriceEur)} — ${dir}.`);
  } else if (inputs.competitorAvgEur == null) {
    missingLines.push("Konkurencija: nema podatka o cenama konkurencije za ovaj datum — signal nije uključen u izračun.");
  } else if (inputs.ourRefPriceEur == null) {
    missingLines.push("Konkurencija: nije uneta naša CLS cena, pa nema sa čim da se poredi — signal nije uključen u izračun.");
  }

  // Prošla godina — also a whole-month total (see RecommendationInputs), not this one stay date's
  // own noćenja.
  const paceVsLastYear = componentValue("paceVsLastYear");
  if (paceVsLastYear !== null && inputs.onBooksNights != null && inputs.sameDayLastYearNights != null) {
    const dir = paceVsLastYear >= 0 ? "iznad prošle godine" : "ispod prošle godine";
    signalLines.push(`Noćenja na knjigama (mesečno) ${Math.round(inputs.onBooksNights).toLocaleString("sr-RS")}, isti dan lane ${Math.round(inputs.sameDayLastYearNights).toLocaleString("sr-RS")} — ${dir}.`);
  } else if (inputs.onBooksNights == null) {
    missingLines.push("Prošla godina: nema podatka o noćenjima na knjigama za ovaj mesec — signal nije uključen u izračun.");
  } else if (inputs.sameDayLastYearNights == null) {
    missingLines.push("Prošla godina: nema podatka o noćenjima od pre godinu dana (isti dan) — signal nije uključen u izračun.");
  }

  // Vikend/događaj — always available (deterministic date math + boolean flag), never missing.
  if (inputs.isWeekend && inputs.hasNearbyEvent) {
    signalLines.push(`Vikend, uz događaj: ${inputs.nearbyEventLabel ?? "događaj u toku"}.`);
  } else if (inputs.isWeekend) {
    signalLines.push("Vikend.");
  } else if (inputs.hasNearbyEvent) {
    signalLines.push(`Događaj: ${inputs.nearbyEventLabel ?? "u toku meseca"}.`);
  } else {
    signalLines.push("Radni dan, nema događaja u blizini.");
  }

  // Verdict reasoning
  const verdictLines: string[] = [];
  const confidencePct = Math.round(result.confidence * 100);
  const damped = result.nudgePercentRaw !== result.nudgePercent;
  if (damped) {
    verdictLines.push(
      `Na osnovu dostupnih signala, kombinovani rezultat bi bio ${signed(result.nudgePercentRaw)}. `
      + `Pouzdanost je ${confidencePct}% (nedostaje: ${result.missingSignals.join(", ")}), pa je predlog smanjen na ${signed(result.nudgePercent)}.`,
    );
  } else {
    verdictLines.push(`Kombinovani rezultat svih dostupnih signala: ${signed(result.nudgePercent)}.`);
  }

  const cfg = RECOMMENDATION_CONFIG;
  if (result.verdict === "RAISE") {
    verdictLines.push(`${signed(result.nudgePercent)} je iznad granice za podizanje cene (+${cfg.raiseThresholdPercent}%), pa je preporuka: ${verdictLabel("RAISE")} — podigni cenu za ${result.nudgePercent}%.`);
  } else if (result.verdict === "LOWER") {
    verdictLines.push(`${signed(result.nudgePercent)} je ispod granice za spuštanje cene (${cfg.lowerThresholdPercent}%), pa je preporuka: ${verdictLabel("LOWER")} — spusti cenu za ${Math.abs(result.nudgePercent)}%.`);
  } else {
    verdictLines.push(`${signed(result.nudgePercent)} je između ${cfg.lowerThresholdPercent}% i +${cfg.raiseThresholdPercent}%, pa je preporuka: ${verdictLabel("HOLD")} — cena ostaje ista.`);
  }

  return { signalLines, missingLines, verdictLines };
}

// ── Per-room-type adjustment ─────────────────────────────────────────────────────

export interface RoomTypeExplanationInput {
  label: string;
  adjustment: RoomTypeAdjustmentResult;
  hotelOccPct: number | null;
  roomsInventory: number | null;
  baseVerdict: Verdict;
  typeNudgePercent: number;
  suggested: number | null;
  laddered: boolean;
  clampedAgainstLabel: string | null;
  clampedAgainstPrice: number | null;
}

export function explainRoomTypeAdjustment(input: RoomTypeExplanationInput): string[] {
  const { label, adjustment, hotelOccPct, roomsInventory, baseVerdict, typeNudgePercent, suggested, laddered, clampedAgainstLabel, clampedAgainstPrice } = input;
  const lines: string[] = [];

  if (!adjustment.dataAvailable) {
    lines.push("Nema podataka po tipu sobe za ovaj datum — cena za ovaj tip prati osnovnu (hotelsku) preporuku.");
    return lines;
  }

  // Both figures here are for this ONE stay date — unlike the base card's "Popunjenost (mesečno)",
  // which is the whole month. Spelled out on both sides so the two numbers are never confused for
  // the same kind of figure, even out of context.
  const typeOccStr = adjustment.occPct != null ? fmtPct(adjustment.occPct) : "nepoznato";
  const hotelOccStr = hotelOccPct != null ? fmtPct(hotelOccPct) : "nepoznato";
  lines.push(`Popunjenost ovog tipa za ovaj datum ${typeOccStr}, popunjenost hotela za ovaj datum ${hotelOccStr}.`);

  const threshold = ROOM_TYPE_RECOMMENDATION_CONFIG.deviationThresholdRooms;

  if (adjustment.deviationRooms == null) {
    lines.push("Nema podatka o ukupnoj popunjenosti hotela za ovaj datum, pa se odstupanje ovog tipa ne može izračunati — cena prati osnovnu preporuku.");
    return lines;
  }

  // Always shown to one decimal (a real, non-rounded-to-illustration value) — a decimal-displayed
  // quantity takes the plural "sobe" in Serbian regardless of its whole-number part ("1.1 sobe", not
  // "1.1 soba"), unlike a genuine integer count (roomsInventory, threshold below), which follows the
  // normal 1/2–4/5+ declension — see roomsWord.
  const devAbs = Math.abs(adjustment.deviationRooms);
  const devStr = devAbs.toFixed(1);

  if (adjustment.direction === "within-threshold") {
    const invPart = roomsInventory != null ? `${label} ima ${roomsInventory} ${roomsWord(roomsInventory)} — ` : "";
    lines.push(`${invPart}razlika je ${devStr} sobe u odnosu na očekivano — premalo (prag: ${threshold} ${roomsWord(threshold)}) da bismo menjali cenu za ovaj tip, pa prati osnovnu preporuku.`);
  } else {
    const aboveBelow = adjustment.direction === "hotter" ? "iznad" : "ispod";
    if (adjustment.verdict === baseVerdict) {
      lines.push(`${label} odstupa ${devStr} sobe ${aboveBelow} očekivane popunjenosti (prag: ${threshold} ${roomsWord(threshold)}), ali osnovna preporuka je već na ${verdictLabel(baseVerdict)} — nema više gde da se pomeri, pa cena za ovaj tip ostaje ista kao osnovna.`);
    } else {
      const stepDir = adjustment.direction === "hotter" ? "gore" : "dole";
      lines.push(`${label} odstupa ${devStr} sobe ${aboveBelow} očekivane popunjenosti (prag: ${threshold} ${roomsWord(threshold)}), pa je preporuka za ovaj tip pomerena jedan korak ${stepDir}: ${verdictLabel(baseVerdict)} → ${verdictLabel(adjustment.verdict)} (${signed(typeNudgePercent)}).`);
    }
  }

  if (laddered && clampedAgainstLabel != null) {
    const suggestedStr = suggested != null ? fmtEur(suggested) : "?";
    const clampedPriceStr = clampedAgainstPrice != null ? ` (${fmtEur(clampedAgainstPrice)})` : "";
    lines.push(`Predložena cena je podignuta na ${suggestedStr} da ne bi pala ispod cene tipa "${clampedAgainstLabel}"${clampedPriceStr} — cenovna lestvica hotela zahteva da skuplji tipovi ostanu skuplji.`);
  }

  return lines;
}
