import { supabase } from "./supabaseClient";

// The "Sačuvani Konkurenti" list a manager curates on the Dashboard (see CompetitorPrices.tsx) —
// read-only here. Preporuka Cena uses this list, when non-empty, as the ONLY competitor set for its
// price signal (see competitorAveraging.ts) instead of the raw, unfiltered Google Hotels search.
export async function fetchSavedCompetitorNames(hotelId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("competitors")
    .select("competitor_name")
    .eq("hotel_id", hotelId);
  if (error) {
    console.error("Failed to load saved competitors:", error.message);
    return [];
  }
  return (data ?? []).map(row => row.competitor_name as string);
}
