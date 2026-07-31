import { NextRequest, NextResponse } from "next/server";

export interface CompetitorResult {
  name: string;
  priceFormatted: string;      // e.g. "RSD 9.000" or "$120"
  priceExtracted: number | null;
  rating: number | null;
  reviews: number | null;
  hotelClass: string | null;
  link: string | null;
  source: string | null;       // which OTA supplied the price (Booking.com, etc.)
}

interface SerpHotelProperty {
  name?: string;
  link?: string;
  overall_rating?: number;
  reviews?: number;
  hotel_class?: string;
  rate_per_night?: {
    lowest?: string;
    extracted_lowest?: number;
  };
  prices?: { source?: string }[];
}

interface SerpHotelsResponse {
  properties?: SerpHotelProperty[];
  error?: string;
}

function toResult(p: SerpHotelProperty): CompetitorResult | null {
  if (!p.name) return null;
  const rateStr = p.rate_per_night?.lowest ?? null;
  const rateNum = p.rate_per_night?.extracted_lowest ?? null;
  const source  = p.prices?.[0]?.source ?? null;
  return {
    name: p.name,
    priceFormatted: rateStr ?? "—",
    priceExtracted: rateNum,
    rating: p.overall_rating ?? null,
    reviews: p.reviews ?? null,
    hotelClass: p.hotel_class ?? null,
    link: p.link ?? null,
    source,
  };
}

// SerpAPI signals an exhausted plan/monthly search quota either via HTTP status (429 Too Many
// Requests, sometimes 402 Payment Required) or an HTTP-200 response whose body still carries an
// `error` field describing the same thing — the wording isn't perfectly stable, so this matches on
// keywords rather than an exact string.
function isQuotaError(status: number, json: SerpHotelsResponse | null): boolean {
  if (status === 429 || status === 402) return true;
  const msg = json?.error?.toLowerCase() ?? "";
  return /quota|limit|run out|exceeded/.test(msg);
}

type SearchOutcome =
  | { ok: true; results: CompetitorResult[] }
  | { ok: false; quotaExceeded: boolean };

async function searchHotels(
  query: string,
  checkin: string,
  checkout: string,
  apiKey: string,
): Promise<SearchOutcome> {
  const params = new URLSearchParams({
    engine:          "google_hotels",
    q:               query,
    check_in_date:   checkin,
    check_out_date:  checkout,
    currency:        "RSD",
    gl:              "rs",
    hl:              "sr",
    api_key:         apiKey,
  });

  const res = await fetch(`https://serpapi.com/search.json?${params}`, {
    next: { revalidate: 1800 }, // cache 30 min — Google Hotels costs 3 credits/search
  });

  let json: SerpHotelsResponse | null = null;
  try { json = await res.json(); } catch { json = null; }

  if (!res.ok || json?.error) {
    return { ok: false, quotaExceeded: isQuotaError(res.status, json) };
  }
  if (!json?.properties?.length) return { ok: true, results: [] };

  return { ok: true, results: json.properties.map(toResult).filter((r): r is CompetitorResult => r !== null) };
}

export async function GET(request: NextRequest) {
  const sp       = new URL(request.url).searchParams;
  const location = (sp.get("location") ?? "").trim();
  const checkin  = (sp.get("checkin")  ?? "").trim();
  const checkout = (sp.get("checkout") ?? "").trim();
  const q        = (sp.get("q")        ?? "").trim(); // optional: specific hotel name
  const ownHotel = (sp.get("ownHotel") ?? "").trim().toLowerCase();

  const apiKey = process.env.SERPAPI_KEY;
  if (!apiKey || !location || !checkin || !checkout) {
    return NextResponse.json([]);
  }

  try {
    // Broader, localized phrasing surfaces more local hotels than a bare city name or
    // English "hotels in X" — Google Hotels' relevance ranking responds better to it.
    const primaryQuery = q ? `${q} ${location}` : `hoteli ${location}`;
    const primary = await searchHotels(primaryQuery, checkin, checkout, apiKey);

    // A quota error means we were BLOCKED, not that there's genuinely no data — callers need to
    // tell the two apart (see Preporuka Cena's competitor cache), so this is a distinct HTTP 429
    // rather than the plain `[]` a real empty result returns.
    if (!primary.ok) {
      if (primary.quotaExceeded) {
        return NextResponse.json({ error: "quota_exceeded" }, { status: 429 });
      }
      return NextResponse.json([]);
    }

    const results = primary.results;

    // If the primary query came back sparse (a known issue for smaller destinations),
    // retry with a second phrasing and merge in any hotels it turned up that we missed.
    if (!q && results.length < 5) {
      const fallback = await searchHotels(`hotel ${location} srbija`, checkin, checkout, apiKey);
      if (fallback.ok) {
        const seen = new Set(results.map(r => r.name.toLowerCase()));
        for (const r of fallback.results) {
          if (!seen.has(r.name.toLowerCase())) {
            results.push(r);
            seen.add(r.name.toLowerCase());
          }
        }
      } else if (fallback.quotaExceeded && results.length === 0) {
        // Primary succeeded with zero results and the fallback got blocked by quota — still
        // report quota-exceeded rather than a false "checked, found nothing".
        return NextResponse.json({ error: "quota_exceeded" }, { status: 429 });
      }
    }

    const filtered = ownHotel
      ? results.filter(r => {
          const name = r.name.toLowerCase();
          return !name.includes(ownHotel) && !ownHotel.includes(name);
        })
      : results;

    return NextResponse.json(filtered.slice(0, 10));
  } catch {
    return NextResponse.json([]);
  }
}
