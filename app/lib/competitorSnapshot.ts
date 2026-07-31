import { supabase } from "./supabaseClient";

// Per-(hotel, stay date) cache of the competitor average price, so Preporuka Cena's automatic
// competitor pull only hits SerpAPI once per date — every later visit reads this table instead.
// avg_price_eur is nullable: null means "checked, nothing found" (still cached, so a sparse date
// doesn't get re-queried every load); no row at all means "never checked".

export type CompetitorSnapshotSource = "auto" | "manual";

export interface CompetitorSnapshotRow {
  id: string;
  hotel_id: string;
  snapshot_date: string;
  avg_price_eur: number | null;
  competitor_count: number;
  source: CompetitorSnapshotSource;
  created_at: string;
  updated_at: string;
}

export async function fetchCompetitorSnapshot(hotelId: string, dateISO: string): Promise<CompetitorSnapshotRow | null> {
  const { data, error } = await supabase
    .from("competitor_price_snapshots")
    .select("*")
    .eq("hotel_id", hotelId)
    .eq("snapshot_date", dateISO)
    .maybeSingle();
  if (error) {
    console.error("Failed to load competitor price snapshot:", error.message);
    return null;
  }
  return data as CompetitorSnapshotRow | null;
}

export async function saveCompetitorSnapshot(
  hotelId: string,
  dateISO: string,
  avgPriceEur: number | null,
  competitorCount: number,
  source: CompetitorSnapshotSource,
): Promise<CompetitorSnapshotRow | null> {
  const { data, error } = await supabase
    .from("competitor_price_snapshots")
    .upsert(
      {
        hotel_id: hotelId,
        snapshot_date: dateISO,
        avg_price_eur: avgPriceEur,
        competitor_count: competitorCount,
        source,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "hotel_id,snapshot_date" },
    )
    .select("*")
    .single();
  if (error) {
    console.error("Failed to save competitor price snapshot:", error.message);
    return null;
  }
  return data as CompetitorSnapshotRow;
}
