// Fuzzy hotel-name matching, shared by two call sites:
//   1. api/competitors/route.ts — excluding the hotel's own listing from its own search results.
//   2. preporuka/page.tsx — matching the user's hand-picked "saved competitors" list against a
//      date's raw search results (SerpAPI's listing names rarely match the saved name exactly,
//      e.g. "Hotel Golden" vs "Golden Hotel Zlatibor").
//
// A saved competitor that doesn't match anything in a given date's results is NOT dropped — see
// computeSavedCompetitorAverage, which reports it in `matches` with matched: null so the caller can
// surface it instead of silently shrinking the set.

export interface CompetitorPriceEntry {
  name: string;
  priceExtracted: number | null;
}

export function normalizeHotelName(name: string): string {
  return name
    .normalize("NFD").replace(/\p{Diacritic}/gu, "") // strip diacritics (č/ć/š/ž/đ etc.)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Word-subset match, order-independent: the shorter name's words must all appear in the longer
// name's words (after normalization). Order-independence matters in practice — SerpAPI listings are
// often phrased "Hotel X City" while a saved/typed name is "X Hotel" — a plain substring check (the
// pre-existing ownHotel filter in api/competitors/route.ts used one) misses that.
export function namesMatch(a: string, b: string): boolean {
  const wa = new Set(normalizeHotelName(a).split(" ").filter(Boolean));
  const wb = new Set(normalizeHotelName(b).split(" ").filter(Boolean));
  if (wa.size === 0 || wb.size === 0) return false;
  const [smaller, larger] = wa.size <= wb.size ? [wa, wb] : [wb, wa];
  for (const w of smaller) if (!larger.has(w)) return false;
  return true;
}

export interface SavedCompetitorMatch {
  savedName: string;
  matched: CompetitorPriceEntry | null; // null = not found (with a usable price) in this date's results
}

export interface SavedCompetitorAverage {
  avgPrice: number | null; // same unit as the input entries' priceExtracted — caller's responsibility
  matches: SavedCompetitorMatch[]; // one entry per saved name, in input order
  usedCount: number;
}

export function computeSavedCompetitorAverage(
  savedNames: string[],
  results: CompetitorPriceEntry[],
): SavedCompetitorAverage {
  const matches: SavedCompetitorMatch[] = savedNames.map(savedName => {
    const found = results.find(r => r.priceExtracted != null && namesMatch(savedName, r.name)) ?? null;
    return { savedName, matched: found };
  });
  const used = matches.filter(
    (m): m is SavedCompetitorMatch & { matched: CompetitorPriceEntry & { priceExtracted: number } } => m.matched != null,
  );
  if (used.length === 0) return { avgPrice: null, matches, usedCount: 0 };
  const avgPrice = used.reduce((sum, m) => sum + m.matched.priceExtracted, 0) / used.length;
  return { avgPrice, matches, usedCount: used.length };
}
