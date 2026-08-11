import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface HotelRow {
  id: string;
  name: string;
  city: string;
  rooms: number;
  current_price: number | null;
  created_at: string;
}

export interface DailyReportRow {
  id: string;
  hotel_id: string;
  report_date: string;
  last_year: Record<string, number>;
  same_day_last_year: Record<string, number>;
  on_books_yesterday: Record<string, number>;
  on_books_today: Record<string, number>;
  target: Record<string, number>;
  // Optional: the pickup column migration may not be applied yet in every environment — see
  // upsertDailyReportRow below, which degrades gracefully when it's missing.
  pickup?: Record<string, number>;
  created_at: string;
}

export function isMissingColumnError(error: { message: string } | null): boolean {
  if (!error) return false;
  const msg = error.message.toLowerCase();
  return msg.includes("column") && (msg.includes("schema cache") || msg.includes("does not exist"));
}

// Upserts a daily_reports row, tolerating an unapplied `pickup` migration: if the column doesn't
// exist yet in this environment, retries once with `pickup` stripped from the payload rather than
// failing the whole save over one field that hasn't been migrated in.
export async function upsertDailyReportRow(payload: Record<string, unknown>) {
  const first = await supabase.from("daily_reports").upsert(payload, { onConflict: "hotel_id,report_date" }).select("*").single();
  if (!first.error || !isMissingColumnError(first.error) || !("pickup" in payload)) return first;
  console.error("daily_reports.pickup column unavailable (run the latest migration?) — retrying without it:", first.error.message);
  const { pickup: _pickup, ...withoutPickup } = payload;
  return supabase.from("daily_reports").upsert(withoutPickup, { onConflict: "hotel_id,report_date" }).select("*").single();
}

export interface OnBooksSnapshotRow {
  id: string;
  hotel_id: string;
  snapshot_date: string;
  stay_month: number;
  stay_year: number;
  rooms_onbooks: number;
  revenue_onbooks: number;
  occupancy_onbooks: number;
  // Optional: the last-year columns migration may not be applied yet in every environment — see
  // upsertOnBooksSnapshotRows below, which degrades gracefully when they're missing.
  rooms_last_year?: number | null;
  revenue_last_year?: number | null;
  occupancy_last_year?: number | null;
  notes: string | null;
  created_at: string;
}

const LAST_YEAR_ONBOOKS_KEYS = ["rooms_last_year", "revenue_last_year", "occupancy_last_year"] as const;

// Upserts onbooks_snapshots rows, tolerating an unapplied last-year-columns migration: if those
// columns don't exist yet, retries once with them stripped from every row rather than failing the
// whole on-books save (this year's rooms/revenue/occupancy) over three extra fields.
export async function upsertOnBooksSnapshotRows(payload: Record<string, unknown>[]) {
  const first = await supabase.from("onbooks_snapshots").upsert(payload, { onConflict: "hotel_id,snapshot_date,stay_month,stay_year" });
  const hasLastYearFields = payload.some(row => LAST_YEAR_ONBOOKS_KEYS.some(k => k in row));
  if (!first.error || !isMissingColumnError(first.error) || !hasLastYearFields) return first;
  console.error("onbooks_snapshots last-year columns unavailable (run the latest migration?) — retrying without them:", first.error.message);
  const stripped = payload.map(row => {
    const copy = { ...row };
    for (const k of LAST_YEAR_ONBOOKS_KEYS) delete copy[k];
    return copy;
  });
  return supabase.from("onbooks_snapshots").upsert(stripped, { onConflict: "hotel_id,snapshot_date,stay_month,stay_year" });
}

export interface MonthlyTargetRow {
  id: string;
  hotel_id: string;
  year_month: string;
  revenue_target: number;
  room_nights_target: number;
  adr_target: number;
  occupancy_target: number;
  revpar_target: number;
  notes: string | null;
  created_at: string;
}
