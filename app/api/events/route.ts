import { NextRequest, NextResponse } from "next/server";

export interface EventResult {
  title: string;
  url: string;
  domain: string;
  description: string;
  date?: string;
}

interface SerpOrganicResult {
  title?: string;
  link?: string;
  displayed_link?: string;
  snippet?: string;
  date?: string;
}

interface SerpResponse {
  organic_results?: SerpOrganicResult[];
  error?: string;
}

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

async function fetchSerpResults(query: string, apiKey: string): Promise<EventResult[]> {
  const params = new URLSearchParams({
    engine: "google",
    q: query,
    api_key: apiKey,
    num: "8",
    gl: "rs",
    hl: "sr",
    google_domain: "google.rs",
  });

  const res = await fetch(`https://serpapi.com/search.json?${params}`, {
    next: { revalidate: 3600 }, // cache for 1 hour — 100/month free tier is precious
  });

  if (!res.ok) return [];

  const json: SerpResponse = await res.json();
  if (!json.organic_results) return [];

  const results: EventResult[] = [];
  for (const r of json.organic_results) {
    // Require all three fields; skip anything vague
    if (!r.title || !r.link || !r.snippet) continue;
    results.push({
      title: r.title,
      url: r.link,
      domain: r.displayed_link ? extractDomain(r.displayed_link) : extractDomain(r.link),
      description: r.snippet,
      date: r.date,
    });
  }
  return results;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const location = (searchParams.get("location") ?? "").trim();
  const month    = (searchParams.get("month")    ?? "").trim(); // Serbian month name, lowercase
  const year     = (searchParams.get("year")     ?? "").trim();

  // Return empty gracefully if key missing or params incomplete
  const apiKey = process.env.SERPAPI_KEY;
  if (!apiKey || !location || !month || !year) {
    return NextResponse.json([]);
  }

  // Two searches: broad events + local festivals/manifestations
  const queries = [
    `${location} eventi ${month} ${year}`,
    `${location} manifestacije ${month} ${year}`,
  ];

  let allResults: EventResult[] = [];
  try {
    const settled = await Promise.allSettled(queries.map(q => fetchSerpResults(q, apiKey)));
    for (const r of settled) {
      if (r.status === "fulfilled") allResults = allResults.concat(r.value);
    }
  } catch {
    // Never surface API errors to the client
    return NextResponse.json([]);
  }

  // Deduplicate by URL, keep insertion order (first query has priority)
  const seen = new Set<string>();
  const deduped = allResults.filter(r => {
    if (seen.has(r.url)) return false;
    seen.add(r.url);
    return true;
  });

  return NextResponse.json(deduped.slice(0, 5));
}
