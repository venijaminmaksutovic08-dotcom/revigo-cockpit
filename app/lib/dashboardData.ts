import { supabase, type DailyReportRow, type MonthlyTargetRow, type OnBooksSnapshotRow } from "./supabaseClient";
import {
  ROW_DEFS,
  ROW_TARGET_FIELD,
  MONTHS_SR,
  dbRowToEntryData,
  formatNumber,
  statusFor,
  isAdditiveRow,
  type RowKey,
} from "../context/HotelContext";
import type { KPIData } from "../data/hotelData";

// ── Date helpers ───────────────────────────────────────────────────────────────

export function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function toISO(year: number, month: number, day: number): string {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

export function todayISO(): string {
  const d = new Date();
  return toISO(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

export function shiftDays(dateISO: string, delta: number): string {
  const [y, m, d] = dateISO.split("-").map(Number);
  const dt = new Date(y, m - 1, d + delta);
  return toISO(dt.getFullYear(), dt.getMonth() + 1, dt.getDate());
}

export function shiftYears(dateISO: string, delta: number): string {
  const [y, m, d] = dateISO.split("-").map(Number);
  const dt = new Date(y + delta, m - 1, d);
  return toISO(dt.getFullYear(), dt.getMonth() + 1, dt.getDate());
}

export function dateParts(dateISO: string): { year: number; month: number; day: number } {
  const [y, m, d] = dateISO.split("-").map(Number);
  return { year: y, month: m, day: d };
}

export function daysInMonthOf(dateISO: string): number {
  const { year, month } = dateParts(dateISO);
  return new Date(year, month, 0).getDate();
}

export function yearMonthOf(dateISO: string): string {
  const { year, month } = dateParts(dateISO);
  return `${year}-${pad2(month)}`;
}

// Latin-script Serbian date label matching the rest of the app's MONTHS_SR — e.g. "9. jul 2026".
// (toLocaleDateString("sr-RS") renders Cyrillic, which is inconsistent with the app's Latin UI text.)
export function formatDateSr(dateISO: string): string {
  const { year, month, day } = dateParts(dateISO);
  return `${day}. ${MONTHS_SR[month - 1].toLowerCase()} ${year}`;
}

export function formatDateTimeSr(isoTimestamp: string): string {
  const d = new Date(isoTimestamp);
  const dateLabel = formatDateSr(toISO(d.getFullYear(), d.getMonth() + 1, d.getDate()));
  const time = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  return `${dateLabel} u ${time}`;
}

// ── Snapshot (single-day) fetch ─────────────────────────────────────────────────

export async function fetchLatestReportDate(hotelId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("daily_reports")
    .select("report_date")
    .eq("hotel_id", hotelId)
    .order("report_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) { console.error("Failed to load latest report date:", error.message); return null; }
  return data?.report_date ?? null;
}

export async function fetchDayReport(hotelId: string, dateISO: string): Promise<DailyReportRow | null> {
  const { data, error } = await supabase
    .from("daily_reports")
    .select("*")
    .eq("hotel_id", hotelId)
    .eq("report_date", dateISO)
    .maybeSingle();
  if (error) { console.error("Failed to load day report:", error.message); return null; }
  return data ?? null;
}

export async function fetchMonthlyTargetFor(hotelId: string, yearMonth: string): Promise<MonthlyTargetRow | null> {
  const { data, error } = await supabase
    .from("monthly_targets")
    .select("*")
    .eq("hotel_id", hotelId)
    .eq("year_month", yearMonth)
    .maybeSingle();
  if (error) { console.error("Failed to load monthly target:", error.message); return null; }
  return data ?? null;
}

// Builds day-mode KPICard-ready data: exact entered values for one date, vs. the monthly target's
// daily pace, vs. the actual daily_reports row for the same calendar date one year prior (falling
// back to the entry's own manually-entered "same day last year" field if no historical row exists).
export function buildDayKpiData(
  row: DailyReportRow | null,
  lastYearRow: DailyReportRow | null,
  monthlyTarget: MonthlyTargetRow | null,
  daysInMonth: number,
): KPIData[] {
  const entry = row ? dbRowToEntryData(row) : null;
  const lastYearEntry = lastYearRow ? dbRowToEntryData(lastYearRow) : null;
  const hasEntry = Boolean(entry);
  const hasTarget = Boolean(monthlyTarget);

  return ROW_DEFS.map(rowDef => {
    const danas = entry ? entry[rowDef.key].naKnjigamaDanas : 0;
    const rawMonthlyTarget = monthlyTarget ? monthlyTarget[ROW_TARGET_FIELD[rowDef.key]] : 0;
    const dailyTarget = isAdditiveRow(rowDef.key) && daysInMonth > 0 ? rawMonthlyTarget / daysInMonth : rawMonthlyTarget;

    const lastYear = lastYearEntry
      ? lastYearEntry[rowDef.key].naKnjigamaDanas
      : entry
        ? entry[rowDef.key].istiDanProsleGodine
        : 0;

    const gap = danas - dailyTarget;
    const achievement = hasTarget && dailyTarget !== 0 ? Math.round((danas / dailyTarget) * 1000) / 10 : 0;
    const remaining = dailyTarget - danas;
    const yoyChangePct = hasEntry && lastYear !== 0 ? Math.round(((danas - lastYear) / lastYear) * 1000) / 10 : null;

    let remainingLabel = "—";
    if (hasEntry && hasTarget) {
      remainingLabel = remaining > 0
        ? `${formatNumber(remaining, rowDef)} preostalo`
        : `${formatNumber(Math.abs(remaining), rowDef)} iznad targeta`;
    }

    return {
      label: rowDef.label,
      value: hasEntry ? formatNumber(danas, rowDef) : "—",
      rawValue: danas,
      target: hasTarget ? formatNumber(dailyTarget, rowDef) : "—",
      rawTarget: dailyTarget,
      gap: hasEntry && hasTarget ? `${gap >= 0 ? "+" : ""}${formatNumber(gap, rowDef)}` : "—",
      achievement: hasEntry ? achievement : 0,
      unit: rowDef.unit,
      prefix: rowDef.prefix,
      status: statusFor(achievement, hasTarget, !hasEntry),
      remainingLabel,
      lastYearValue: lastYear,
      lastYearLabel: hasEntry ? formatNumber(lastYear, rowDef) : "—",
      yoyChangePct,
    };
  });
}

// ── Period (date range) aggregate ───────────────────────────────────────────────

export interface PeriodAggregate {
  brojNocenja: number;
  ukupanPrihod: number;
  adr: number;
  popunjenost: number;
  revpar: number;
  daysWithData: number;
}

export async function fetchPeriodAggregate(hotelId: string, startISO: string, endISO: string): Promise<PeriodAggregate> {
  const { data, error } = await supabase
    .from("daily_reports")
    .select("on_books_today")
    .eq("hotel_id", hotelId)
    .gte("report_date", startISO)
    .lte("report_date", endISO);

  if (error) console.error("Failed to load period aggregate:", error.message);

  const rows = (data ?? []) as Pick<DailyReportRow, "on_books_today">[];
  let nights = 0, revenue = 0, occSum = 0, occCount = 0, revparSum = 0, revparCount = 0;

  for (const r of rows) {
    const o = r.on_books_today;
    nights += Number(o.brojNocenja ?? 0);
    revenue += Number(o.ukupanPrihod ?? 0);
    const occ = Number(o.popunjenost ?? 0);
    const rp = Number(o.revpar ?? 0);
    if (occ !== 0) { occSum += occ; occCount++; }
    if (rp !== 0) { revparSum += rp; revparCount++; }
  }

  return {
    brojNocenja: nights,
    ukupanPrihod: revenue,
    adr: nights > 0 ? revenue / nights : 0,
    popunjenost: occCount > 0 ? occSum / occCount : 0,
    revpar: revparCount > 0 ? revparSum / revparCount : 0,
    daysWithData: rows.length,
  };
}

// ── Report log ───────────────────────────────────────────────────────────────

export interface ReportLogEntry {
  dateISO: string;
  createdAt: string;
}

export async function fetchReportLog(hotelId: string, year: number, month: number): Promise<ReportLogEntry[]> {
  const start = toISO(year, month, 1);
  const end = toISO(year, month, new Date(year, month, 0).getDate());
  const { data, error } = await supabase
    .from("daily_reports")
    .select("report_date, created_at")
    .eq("hotel_id", hotelId)
    .gte("report_date", start)
    .lte("report_date", end)
    .order("report_date", { ascending: true });

  if (error) { console.error("Failed to load report log:", error.message); return []; }
  return (data ?? []).map(r => ({ dateISO: r.report_date, createdAt: r.created_at }));
}

// ── On-books snapshots ───────────────────────────────────────────────────────

export interface OnBooksMonthInput {
  stayMonth: number;
  stayYear: number;
  roomsOnbooks: number;
  revenueOnbooks: number;
  occupancyOnbooks: number;
}

export interface StayMonthDef {
  month: number;
  year: number;
  label: string;
}

// On-books tracks demand for months that haven't happened yet — the 3 months following the
// snapshot date's own month (that month's actuals already live in daily_reports).
export function getOnBooksStayMonths(dateISO: string): StayMonthDef[] {
  const { year, month } = dateParts(dateISO);
  const defs: StayMonthDef[] = [];
  for (let i = 1; i <= 3; i++) {
    const total = month - 1 + i;
    const y = year + Math.floor(total / 12);
    const m = (total % 12) + 1;
    defs.push({ month: m, year: y, label: `${MONTHS_SR[m - 1]} ${y}` });
  }
  return defs;
}

export function emptyOnBooksMonths(dateISO: string): OnBooksMonthInput[] {
  return getOnBooksStayMonths(dateISO).map(({ month, year }) => ({
    stayMonth: month, stayYear: year, roomsOnbooks: 0, revenueOnbooks: 0, occupancyOnbooks: 0,
  }));
}

export async function fetchOnBooksForDate(hotelId: string, dateISO: string): Promise<OnBooksMonthInput[]> {
  const stayMonths = getOnBooksStayMonths(dateISO);
  const { data, error } = await supabase
    .from("onbooks_snapshots")
    .select("*")
    .eq("hotel_id", hotelId)
    .eq("snapshot_date", dateISO);

  if (error) console.error("Failed to load on-books snapshot:", error.message);
  const rows = (data ?? []) as OnBooksSnapshotRow[];

  return stayMonths.map(({ month, year }) => {
    const found = rows.find(r => r.stay_month === month && r.stay_year === year);
    return {
      stayMonth: month,
      stayYear: year,
      roomsOnbooks: found?.rooms_onbooks ?? 0,
      revenueOnbooks: found?.revenue_onbooks ?? 0,
      occupancyOnbooks: found?.occupancy_onbooks ?? 0,
    };
  });
}

export async function saveOnBooksForDate(hotelId: string, dateISO: string, entries: OnBooksMonthInput[]): Promise<void> {
  const payload = entries.map(e => ({
    hotel_id: hotelId,
    snapshot_date: dateISO,
    stay_month: e.stayMonth,
    stay_year: e.stayYear,
    rooms_onbooks: e.roomsOnbooks,
    revenue_onbooks: e.revenueOnbooks,
    occupancy_onbooks: e.occupancyOnbooks,
  }));
  const { error } = await supabase
    .from("onbooks_snapshots")
    .upsert(payload, { onConflict: "hotel_id,snapshot_date,stay_month,stay_year" });
  if (error) console.error("Failed to save on-books snapshot:", error.message);
}

// Same target stay month one year earlier, measured on the same relative snapshot date one year
// earlier — e.g. August 2026 on-books as of 9 jul 2026 vs. August 2025 on-books as of 9 jul 2025.
export async function fetchOnBooksLastYear(
  hotelId: string,
  dateISO: string,
  stayMonth: number,
  stayYear: number,
): Promise<OnBooksSnapshotRow | null> {
  const lastYearSnapshotDate = shiftYears(dateISO, -1);
  const { data, error } = await supabase
    .from("onbooks_snapshots")
    .select("*")
    .eq("hotel_id", hotelId)
    .eq("snapshot_date", lastYearSnapshotDate)
    .eq("stay_month", stayMonth)
    .eq("stay_year", stayYear - 1)
    .maybeSingle();
  if (error) { console.error("Failed to load on-books last-year comparison:", error.message); return null; }
  return data ?? null;
}

export type { RowKey };
