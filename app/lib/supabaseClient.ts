import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface HotelRow {
  id: string;
  name: string;
  city: string;
  rooms: number;
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
  created_at: string;
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
  created_at: string;
}
