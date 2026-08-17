import { supabase } from "./supabaseClient";
import type { RoomTypeOnBooksRow } from "./roomTypeRecommendation";

// Fetches every room type's on-books reading for one hotel + stay date, resolved to each type's
// MOST RECENT report_date — room_type_daily_onbooks keeps one row per (hotel, report_date,
// stay_date, room_type), so a stay date accumulates a new row on every daily import that still
// covers it. Rows are read in ascending report_date order and folded into a per-type map, so the
// last write for each room_type is the latest one — same "latest snapshot wins" convention used
// everywhere else in this app (see e.g. fetchLatestReportSnapshot in dashboardData.ts).
export async function fetchRoomTypeOnBooksForDate(hotelId: string, stayDateISO: string): Promise<RoomTypeOnBooksRow[]> {
  const { data, error } = await supabase
    .from("room_type_daily_onbooks")
    .select("room_type, room_nights, rooms_inventory, pickup_room_nights, report_date, prev_report_date")
    .eq("hotel_id", hotelId)
    .eq("stay_date", stayDateISO)
    .order("report_date", { ascending: true });

  if (error) {
    console.error("Failed to load per-room-type on-books:", error.message);
    return [];
  }

  const rows = (data ?? []) as {
    room_type: string;
    room_nights: number | null;
    rooms_inventory: number;
    pickup_room_nights: number | null;
    report_date: string;
    prev_report_date: string | null;
  }[];

  const latestByType = new Map<string, RoomTypeOnBooksRow>();
  for (const r of rows) {
    latestByType.set(r.room_type, {
      roomType: r.room_type,
      roomNights: r.room_nights,
      roomsInventory: r.rooms_inventory,
      pickupRoomNights: r.pickup_room_nights,
      reportDate: r.report_date,
      prevReportDate: r.prev_report_date,
    });
  }
  return Array.from(latestByType.values());
}
