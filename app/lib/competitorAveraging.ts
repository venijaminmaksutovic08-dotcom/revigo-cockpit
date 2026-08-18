// Decides which set of competitors feeds Preporuka Cena's competitorAvgEur signal, and how to
// average them. Tried in order:
//   1. Saved competitors ("Sačuvani Konkurenti", see competitorMatching.ts) — if the hotel has any
//      saved, ONLY those are used, matched by fuzzy name against the date's search results. If the
//      list exists but nothing in it matched this date, that's reported as its own outcome — never
//      silently widened back out to the full search result set.
//   2. Comparability filter (see competitorComparability.ts) — only when there's no saved list.
// Either way the caller gets back exactly which hotels were used and which were excluded (and why),
// so the number is never a black box — see preporuka/page.tsx for how this is rendered.

import { computeSavedCompetitorAverage, type CompetitorPriceEntry, type SavedCompetitorMatch } from "./competitorMatching.ts";
import { filterComparableCompetitors, type ComparabilityEntry, type ComparabilityResult } from "./competitorComparability.ts";

export type CompetitorEntry = CompetitorPriceEntry & ComparabilityEntry;

export type CompetitorAverageOutcome =
  | { method: "saved"; avgPrice: number; usedCount: number; matches: SavedCompetitorMatch[] }
  | { method: "saved_none_matched"; matches: SavedCompetitorMatch[] }
  | { method: "class_band" | "price_band_fallback" | "no_reference_available"; avgPrice: number | null; comparability: ComparabilityResult };

export function computeCompetitorAverage(
  savedNames: string[],
  results: CompetitorEntry[],
  ownHotelClassStars: number | null,
  ownPrice: number | null,
): CompetitorAverageOutcome {
  if (savedNames.length > 0) {
    const { avgPrice, matches, usedCount } = computeSavedCompetitorAverage(savedNames, results);
    if (avgPrice == null) return { method: "saved_none_matched", matches };
    return { method: "saved", avgPrice, usedCount, matches };
  }

  const comparability = filterComparableCompetitors(results, ownHotelClassStars, ownPrice);
  const avgPrice = comparability.comparable.length > 0
    ? comparability.comparable.reduce((sum, e) => sum + (e.priceExtracted as number), 0) / comparability.comparable.length
    : null;
  return { method: comparability.method, avgPrice, comparability };
}

// Convenience for callers (preporuka/page.tsx) that just need the number and how many hotels fed
// it — e.g. for caching in competitor_price_snapshots, which only stores the aggregate.
export function outcomeSummary(outcome: CompetitorAverageOutcome): { avgPrice: number | null; count: number } {
  if (outcome.method === "saved") return { avgPrice: outcome.avgPrice, count: outcome.usedCount };
  if (outcome.method === "saved_none_matched") return { avgPrice: null, count: 0 };
  return { avgPrice: outcome.avgPrice, count: outcome.comparability.comparable.length };
}
