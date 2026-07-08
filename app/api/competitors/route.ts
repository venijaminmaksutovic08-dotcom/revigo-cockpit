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

async function searchHotels(
  query: string,
  checkin: string,
  checkout: string,
  apiKey: string,
): Promise<CompetitorResult[]> {
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
  if (!res.ok) return [];

  const json: SerpHotelsResponse = await res.json();
  if (!json.properties?.length) return [];

  return json.properties.map(toResult).filter((r): r is CompetitorResult => r !== null);
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
    const results = await searchHotels(primaryQuery, checkin, checkout, apiKey);

    // If the primary query came back sparse (a known issue for smaller destinations),
    // retry with a second phrasing and merge in any hotels it turned up that we missed.
    if (!q && results.length < 5) {
      const fallbackResults = await searchHotels(`hotel ${location} srbija`, checkin, checkout, apiKey);
      const seen = new Set(results.map(r => r.name.toLowerCase()));
      for (const r of fallbackResults) {
        if (!seen.has(r.name.toLowerCase())) {
          results.push(r);
          seen.add(r.name.toLowerCase());
        }
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
