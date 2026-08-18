// Pure classification for why a competitor-price lookup produced no usable result — shared between
// the /api/competitors fetch call site (preporuka/page.tsx) and its tests. No framework or Supabase
// dependency (unlike competitorSnapshot.ts), so this can be unit-tested in plain Node — see
// competitorLookup.test.ts.

// null means the lookup ran to completion — the caller's own result (possibly zero competitors
// found) is the real, final answer, not a failure. The other two values mean it never really ran:
// "quota_exceeded" (blocked, SerpAPI's own monthly limit) or "not_configured" (missing SERPAPI_KEY
// server-side, or an unexpected failure calling out — see the API route's catch block).
export type CompetitorLookupFailure = "quota_exceeded" | "not_configured" | null;

// Maps the /api/competitors route's HTTP status to why a lookup didn't produce a usable result.
export function classifyCompetitorLookupStatus(status: number): CompetitorLookupFailure {
  if (status === 429) return "quota_exceeded";
  if (status === 503 || status === 502) return "not_configured";
  return null;
}

// The two failure cases read identically to a naive "no price" check unless labeled apart: a
// missing key (or a quota block) is a setup/availability problem, never "we checked and there's
// genuinely no competitor data for this date." Both still leave competitorAvgEur null and degrade
// the recommendation's confidence exactly the same way — priceRecommendation.ts doesn't need to
// know WHY the signal is missing, only that it is. This only controls what the user reads.
export function competitorEmptyStateMessage(failure: CompetitorLookupFailure): string {
  if (failure === "quota_exceeded") {
    return "Cene konkurencije trenutno nedostupne — mesečni limit pretraga je dostignut. Unesi ručno ili pokušaj kasnije.";
  }
  if (failure === "not_configured") {
    return "Provera cena konkurencije nije podešena. Unesi ručno ili obavesti administratora.";
  }
  return "Nema dostupnih cena konkurencije za ovaj datum.";
}
