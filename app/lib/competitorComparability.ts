// Level-2 fallback for Preporuka Cena's competitor average: used only when the hotel has no saved
// competitors for this date (see competitorMatching.ts for the Level-1 path, which wins whenever a
// saved list exists). Rather than averaging every hotel Google Hotels returns for the city — which
// mixes small unrated/budget villas in with the real comparables and drags the average down hard —
// this filters to a comparable subset first.
//
// Two rules, tried in order:
//   1. Star-class band: keep competitors within `classToleranceStars` of OUR OWN hotel's star class.
//      This is the intended primary rule, but it needs to know our own hotel's star class — and as
//      of this writing, `hotels` has no such column (checked the schema directly: id, name, city,
//      rooms, created_at, current_price, price_cls/dplx/superior/king — no star rating anywhere).
//      So `ownHotelClassStars` is always null from today's call site; this branch is implemented and
//      tested so it activates the moment that data exists, without further changes here.
//   2. Price-band fallback (what actually runs today): keep competitors priced within
//      `priceBandTolerancePct` of OUR OWN current price. Comparable price tier is a reasonable proxy
//      for comparable market segment, and — critically — it scales with each hotel's own price, so
//      it's not a fixed € band tuned for any one hotel (e.g. Queen of Zlatibor).
// If neither our star class nor our own price is known, comparability can't be judged at all —
// this returns nothing comparable rather than silently falling back to "average everything".

export const COMPARABILITY_CONFIG = {
  // Rule 1 (class-band, inactive until `hotels` gains a star-class column — see module comment).
  classToleranceStars: 1,
  // A result with no hotelClass at all is unverifiable — it could be exactly the kind of unrated
  // budget villa this filter exists to keep out — so treat "unknown" as "not proven comparable"
  // rather than assume it's fine. Flip to "include" here if that's too strict in practice.
  missingClassPolicy: "exclude" as "exclude" | "include",
  // Rule 2 (price-band fallback, what's active today).
  priceBandTolerancePct: 0.4, // keep competitors priced within ±40% of our own current price
};

export interface ComparabilityEntry {
  name: string;
  priceExtracted: number | null;
  hotelClass: string | null;
}

export type ComparabilityMethod = "class_band" | "price_band_fallback" | "no_reference_available";

export interface ComparabilityResult {
  comparable: ComparabilityEntry[];
  excludedOutOfClassBand: ComparabilityEntry[];
  excludedNoClass: ComparabilityEntry[];
  excludedPriceBand: ComparabilityEntry[];
  method: ComparabilityMethod;
}

// SerpAPI's hotel_class field reads like "4-star hotel" or "3.5-star hotel".
export function parseHotelClassStars(hotelClass: string | null): number | null {
  if (!hotelClass) return null;
  const m = hotelClass.match(/(\d+(?:\.\d+)?)\s*-?\s*star/i);
  return m ? Number(m[1]) : null;
}

function classBandFilter(entries: ComparabilityEntry[], ownHotelClassStars: number): ComparabilityResult {
  const priced = entries.filter((e): e is ComparabilityEntry & { priceExtracted: number } => e.priceExtracted != null);
  const comparable: ComparabilityEntry[] = [];
  const excludedOutOfClassBand: ComparabilityEntry[] = [];
  const excludedNoClass: ComparabilityEntry[] = [];
  for (const e of priced) {
    const stars = parseHotelClassStars(e.hotelClass);
    if (stars == null) {
      if (COMPARABILITY_CONFIG.missingClassPolicy === "include") comparable.push(e);
      else excludedNoClass.push(e);
      continue;
    }
    if (Math.abs(stars - ownHotelClassStars) <= COMPARABILITY_CONFIG.classToleranceStars) {
      comparable.push(e);
    } else {
      excludedOutOfClassBand.push(e);
    }
  }
  return { comparable, excludedOutOfClassBand, excludedNoClass, excludedPriceBand: [], method: "class_band" };
}

function priceBandFallback(entries: ComparabilityEntry[], ownPrice: number): ComparabilityResult {
  const lo = ownPrice * (1 - COMPARABILITY_CONFIG.priceBandTolerancePct);
  const hi = ownPrice * (1 + COMPARABILITY_CONFIG.priceBandTolerancePct);
  const priced = entries.filter((e): e is ComparabilityEntry & { priceExtracted: number } => e.priceExtracted != null);
  const comparable = priced.filter(e => e.priceExtracted >= lo && e.priceExtracted <= hi);
  const excludedPriceBand = priced.filter(e => e.priceExtracted < lo || e.priceExtracted > hi);
  return { comparable, excludedOutOfClassBand: [], excludedNoClass: [], excludedPriceBand, method: "price_band_fallback" };
}

export function filterComparableCompetitors(
  entries: ComparabilityEntry[],
  ownHotelClassStars: number | null,
  ownPrice: number | null, // must be the same unit as entries[].priceExtracted — caller's responsibility
): ComparabilityResult {
  if (ownHotelClassStars != null) {
    return classBandFilter(entries, ownHotelClassStars);
  }
  if (ownPrice != null && ownPrice > 0) {
    return priceBandFallback(entries, ownPrice);
  }
  return {
    comparable: [],
    excludedOutOfClassBand: [],
    excludedNoClass: [],
    excludedPriceBand: entries.filter(e => e.priceExtracted != null),
    method: "no_reference_available",
  };
}
