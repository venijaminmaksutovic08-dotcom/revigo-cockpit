import { supabase } from "./supabaseClient";
import { parseRoomTypeSheets } from "./roomTypeSheetParse";

// Glue layer between the pure parser (roomTypeSheetParse.ts) and the room_type_daily_onbooks
// table — mirrors how dashboardData.ts's importOnBooksMonths sits on top of the pure aggregate
// parser. Deliberately separate from reportArchive.ts: this writes a NEW, additive table (the
// pricing engine doesn't read it yet), so a failure here must never touch the aggregate import or
// the existing archive, and is surfaced the same way an archive miss is (see describeRoomTypeSaveMiss,
// used identically to describeArchiveMiss by every upload call site).

const TABLE = "room_type_daily_onbooks";

export interface RoomTypeSaveOutcome {
  ok: boolean;
  error: string | null;
  rowsWritten: number;
  stayMonthSuspect: boolean;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

// The previous archived import for this hotel, if any — used for prev_report_date. Never assumed
// to be reportDate-1: the "Juce" block inside the file is the state as of THAT import, whatever day
// it actually ran (see roomTypeSheetParse.ts's module comment), so this must be looked up, not
// computed from a fixed offset.
async function fetchPreviousReportDate(hotelId: string, reportDate: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("report_imports")
    .select("report_date")
    .eq("hotel_id", hotelId)
    .lt("report_date", reportDate)
    .order("report_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error("room_type_daily_onbooks: failed to look up previous report date:", error.message);
    return null;
  }
  return data?.report_date ?? null;
}

// Parses the per-room-type sheets and upserts every (room_type, day) row for this report date.
// Never throws — a parse failure or a DB error both come back as ok:false in the returned outcome,
// for the caller to log and surface via a warning without blocking the aggregate import that
// already succeeded by the time this runs.
export async function saveRoomTypeDailyOnBooks(hotelId: string, reportDate: string, file: File): Promise<RoomTypeSaveOutcome> {
  const parsed = await parseRoomTypeSheets(file, reportDate);
  if (parsed.error) {
    console.error("room_type_daily_onbooks: parse failed —", parsed.error);
    return { ok: false, error: parsed.error, rowsWritten: 0, stayMonthSuspect: false };
  }
  if (parsed.rows.length === 0) {
    return { ok: true, error: null, rowsWritten: 0, stayMonthSuspect: parsed.stayMonthSuspect };
  }

  const prevReportDate = await fetchPreviousReportDate(hotelId, reportDate);
  const [stayYear, stayMonth] = reportDate.split("-").map(Number);

  const payload = parsed.rows.map(r => ({
    hotel_id: hotelId,
    report_date: reportDate,
    stay_date: `${stayYear}-${pad2(stayMonth)}-${pad2(r.dayIndex)}`,
    day_index: r.dayIndex,
    room_type: r.roomType,
    rooms_inventory: r.roomsInventory,
    room_nights: r.roomNights,
    room_nights_prev: r.roomNightsPrev,
    pickup_room_nights: r.pickupRoomNights,
    prev_report_date: prevReportDate,
    stay_month_source: "inferred_report_month",
    stay_month_suspect: parsed.stayMonthSuspect,
    source_sheet: "Day by day, Day By Day Input",
  }));

  const { error } = await supabase.from(TABLE).upsert(payload, { onConflict: "hotel_id,report_date,stay_date,room_type" });
  if (error) {
    console.error("room_type_daily_onbooks: DB write failed —", error.message);
    return { ok: false, error: error.message, rowsWritten: 0, stayMonthSuspect: parsed.stayMonthSuspect };
  }

  return { ok: true, error: null, rowsWritten: payload.length, stayMonthSuspect: parsed.stayMonthSuspect };
}

// Shared wording for the visible warning every upload UI shows when the room-type save didn't
// succeed — null when it's fine, so callers can just do `if (msg) show(msg)`, same pattern as
// reportArchive.ts's describeArchiveMiss.
export function describeRoomTypeSaveMiss(outcome: RoomTypeSaveOutcome): string | null {
  if (outcome.ok) return null;
  return "Raspodela po tipu sobe nije sačuvana za ovaj izveštaj.";
}
