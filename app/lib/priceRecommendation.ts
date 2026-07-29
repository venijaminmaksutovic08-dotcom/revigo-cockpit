// Transparent, rule-based nightly-price recommendation engine for Preporuka Cena.
// Pure functions only — no data fetching, no React. Every tunable number (weights, the ±15% cap,
// the RAISE/LOWER thresholds, the €-rounding step) lives in RECOMMENDATION_CONFIG below so the
// model can be retuned without touching any of the logic that uses it.
//
// This is advice-only: nothing here ever writes a price anywhere. It only produces a suggested
// number and the reasons behind it: the page decides whether/when to let a manager apply it.

export const RECOMMENDATION_CONFIG = {
  weights: {
    paceVsTarget: 0.40,
    competitorGap: 0.30,
    paceVsLastYear: 0.20,
    eventsBoost: 0.10,
  },
  eventsBoostValue: 0.3,     // the raw +0.3 bump (weekend or nearby event) before normalizing
  nudgeCapPercent: 15,       // ±15% hard ceiling on the final recommendation
  raiseThresholdPercent: 3,  // nudge% >= this → RAISE
  lowerThresholdPercent: -3, // nudge% <= this → LOWER
  roundToEur: 5,             // suggested prices round to the nearest 5€
  chipDeadband: 0.05,        // a component below this |value| doesn't get its own reason chip
} as const;

export type Verdict = "RAISE" | "HOLD" | "LOWER";
export type ChipTone = "positive" | "negative" | "neutral";

export interface RecommendationInputs {
  onBooksOccPct: number | null;          // current on-books occupancy %, e.g. 68
  targetOccPct: number | null;           // monthly target occupancy %, e.g. 55
  onBooksNights: number | null;          // current on-books room-nights for the period
  sameDayLastYearNights: number | null;  // same-day-last-year room-nights
  competitorAvgEur: number | null;       // average competitor price in EUR
  ourRefPriceEur: number | null;         // our CLS price — the reference for competitorGap
  isWeekend: boolean;
  hasNearbyEvent: boolean;
  nearbyEventLabel: string | null;       // short label of the event, if any, for the reason chip
}

export type ComponentKey = "paceVsTarget" | "competitorGap" | "paceVsLastYear" | "eventsBoost";

export interface RecommendationComponent {
  key: ComponentKey;
  value: number | null; // normalized to [-1, 1] (or null if the underlying data is unavailable)
  weight: number;
}

export interface ReasonChip {
  text: string;
  tone: ChipTone; // positive = supports raising, negative = supports lowering, neutral = context
}

export interface RecommendationResult {
  demandScore: number;
  nudgePercent: number;
  verdict: Verdict;
  usedSignals: string[];    // human labels for components that had real data
  missingSignals: string[]; // human labels for components that had no data
  components: RecommendationComponent[];
  reasons: ReasonChip[];
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

// ── Components — each returns null (never a fake 0) when its inputs aren't available ───────────

export function computePaceVsTarget(onBooksOccPct: number | null, targetOccPct: number | null): number | null {
  if (onBooksOccPct == null || targetOccPct == null || targetOccPct === 0) return null;
  return clamp((onBooksOccPct - targetOccPct) / targetOccPct, -1, 1);
}

export function computePaceVsLastYear(onBooksNights: number | null, sameDayLastYearNights: number | null): number | null {
  if (onBooksNights == null || sameDayLastYearNights == null || sameDayLastYearNights === 0) return null;
  return clamp((onBooksNights - sameDayLastYearNights) / sameDayLastYearNights, -1, 1);
}

export function computeCompetitorGap(competitorAvgEur: number | null, ourRefPriceEur: number | null): number | null {
  if (competitorAvgEur == null || ourRefPriceEur == null || competitorAvgEur === 0) return null;
  return clamp((competitorAvgEur - ourRefPriceEur) / competitorAvgEur, -1, 1);
}

// Weekend/event is always computable (deterministic date math + a boolean event flag) — never null.
export function computeEventsBoost(isWeekend: boolean, hasNearbyEvent: boolean): number {
  return isWeekend || hasNearbyEvent ? RECOMMENDATION_CONFIG.eventsBoostValue : 0;
}

// ── Demand score ─────────────────────────────────────────────────────────────
// Missing components are EXCLUDED entirely (never coerced to 0) and the remaining weights are
// re-normalized over whatever signals ARE available — a missing input degrades confidence in the
// verdict rather than silently dragging it toward HOLD.

export function computeDemandScore(components: RecommendationComponent[]): number {
  const available = components.filter(c => c.value !== null);
  if (available.length === 0) return 0;
  const totalWeight = available.reduce((sum, c) => sum + c.weight, 0);
  if (totalWeight === 0) return 0;
  const weighted = available.reduce((sum, c) => sum + c.weight * (c.value as number), 0);
  return weighted / totalWeight;
}

export function computeNudgePercent(demandScore: number): number {
  const cfg = RECOMMENDATION_CONFIG;
  return clamp(Math.round(demandScore * cfg.nudgeCapPercent), -cfg.nudgeCapPercent, cfg.nudgeCapPercent);
}

export function computeVerdict(nudgePercent: number): Verdict {
  const cfg = RECOMMENDATION_CONFIG;
  if (nudgePercent >= cfg.raiseThresholdPercent) return "RAISE";
  if (nudgePercent <= cfg.lowerThresholdPercent) return "LOWER";
  return "HOLD";
}

export function suggestedPrice(currentPrice: number | null, nudgePercent: number): number | null {
  if (currentPrice == null) return null;
  const raw = currentPrice * (1 + nudgePercent / 100);
  const step = RECOMMENDATION_CONFIG.roundToEur;
  return Math.round(raw / step) * step;
}

export function verdictLabel(verdict: Verdict): string {
  if (verdict === "RAISE") return "Tražnja iznad plana";
  if (verdict === "LOWER") return "Tražnja ispod plana";
  return "Drži cene";
}

// ── Reason chips — built only from components that actually moved the verdict ──────────────────

export function buildReasonChips(
  inputs: RecommendationInputs,
  parts: { paceVsTarget: number | null; competitorGap: number | null; paceVsLastYear: number | null }
): ReasonChip[] {
  const chips: ReasonChip[] = [];
  const deadband = RECOMMENDATION_CONFIG.chipDeadband;

  if (parts.paceVsTarget !== null && Math.abs(parts.paceVsTarget) >= deadband
    && inputs.onBooksOccPct != null && inputs.targetOccPct != null) {
    chips.push({
      text: `Popunjenost ${Math.round(inputs.onBooksOccPct)}% vs ${Math.round(inputs.targetOccPct)}% plan`,
      tone: parts.paceVsTarget > 0 ? "positive" : "negative",
    });
  }

  if (parts.competitorGap !== null && Math.abs(parts.competitorGap) >= deadband
    && inputs.competitorAvgEur != null && inputs.ourRefPriceEur != null) {
    const direction = parts.competitorGap > 0 ? "ispod si" : "iznad si";
    chips.push({
      text: `Konkurencija prosek ${Math.round(inputs.competitorAvgEur)}€ — ${direction}`,
      tone: parts.competitorGap > 0 ? "positive" : "negative",
    });
  }

  if (parts.paceVsLastYear !== null && Math.abs(parts.paceVsLastYear) >= deadband
    && inputs.onBooksNights != null && inputs.sameDayLastYearNights != null) {
    chips.push({
      text: `Noćenja ${Math.round(inputs.onBooksNights)} vs ${Math.round(inputs.sameDayLastYearNights)} lane (isti dan)`,
      tone: parts.paceVsLastYear > 0 ? "positive" : "negative",
    });
  }

  // Events/weekend — always shown, so a HOLD/LOWER verdict still gets an honest supporting
  // reason ("Radni dan, nema događaja") rather than no explanation at all.
  if (inputs.isWeekend && inputs.hasNearbyEvent) {
    chips.push({ text: `Vikend + ${inputs.nearbyEventLabel ?? "događaj"}`, tone: "positive" });
  } else if (inputs.isWeekend) {
    chips.push({ text: "Vikend", tone: "positive" });
  } else if (inputs.hasNearbyEvent) {
    chips.push({ text: inputs.nearbyEventLabel ?? "Događaj u toku meseca", tone: "positive" });
  } else {
    chips.push({ text: "Radni dan, nema događaja", tone: "neutral" });
  }

  return chips;
}

// ── Orchestration ────────────────────────────────────────────────────────────

const SIGNAL_LABELS: Record<Exclude<ComponentKey, "eventsBoost">, string> = {
  paceVsTarget: "Popunjenost vs plan",
  competitorGap: "Konkurencija",
  paceVsLastYear: "Prošla godina",
};

export function computeRecommendation(inputs: RecommendationInputs): RecommendationResult {
  const cfg = RECOMMENDATION_CONFIG;

  const paceVsTarget = computePaceVsTarget(inputs.onBooksOccPct, inputs.targetOccPct);
  const competitorGap = computeCompetitorGap(inputs.competitorAvgEur, inputs.ourRefPriceEur);
  const paceVsLastYear = computePaceVsLastYear(inputs.onBooksNights, inputs.sameDayLastYearNights);
  const eventsBoostRaw = computeEventsBoost(inputs.isWeekend, inputs.hasNearbyEvent);
  const eventsBoostNormalized = eventsBoostRaw / cfg.eventsBoostValue; // always 0 or 1, never null

  const components: RecommendationComponent[] = [
    { key: "paceVsTarget", value: paceVsTarget, weight: cfg.weights.paceVsTarget },
    { key: "competitorGap", value: competitorGap, weight: cfg.weights.competitorGap },
    { key: "paceVsLastYear", value: paceVsLastYear, weight: cfg.weights.paceVsLastYear },
    { key: "eventsBoost", value: eventsBoostNormalized, weight: cfg.weights.eventsBoost },
  ];

  const demandScore = computeDemandScore(components);
  const nudgePercent = computeNudgePercent(demandScore);
  const verdict = computeVerdict(nudgePercent);

  const usedSignals = (Object.keys(SIGNAL_LABELS) as (keyof typeof SIGNAL_LABELS)[])
    .filter(key => components.find(c => c.key === key)?.value !== null)
    .map(key => SIGNAL_LABELS[key]);
  const missingSignals = (Object.keys(SIGNAL_LABELS) as (keyof typeof SIGNAL_LABELS)[])
    .filter(key => components.find(c => c.key === key)?.value === null)
    .map(key => SIGNAL_LABELS[key]);

  const reasons = buildReasonChips(inputs, { paceVsTarget, competitorGap, paceVsLastYear });

  return { demandScore, nudgePercent, verdict, usedSignals, missingSignals, components, reasons };
}
