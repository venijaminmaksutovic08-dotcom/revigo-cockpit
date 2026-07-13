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
import type { KPIData, KPIStatus } from "../data/hotelData";
import type { ParsedMonthMetrics } from "./dailyReportExcelImport";

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

// Builds simple KPICard-ready data: the exact entered value for one date (already an on-books
// total for the target period, e.g. room nights on the books for the whole month as of that day)
// compared directly against the full monthly target — never divided by days in month, since the
// value itself isn't a single day's production. YoY compares against the same calendar date one
// year prior (falling back to the entry's own manually-entered "same day last year" field).
export function buildDayKpiData(
  row: DailyReportRow | null,
  lastYearRow: DailyReportRow | null,
  monthlyTarget: MonthlyTargetRow | null,
): KPIData[] {
  const entry = row ? dbRowToEntryData(row) : null;
  const lastYearEntry = lastYearRow ? dbRowToEntryData(lastYearRow) : null;
  const hasEntry = Boolean(entry);
  const hasTarget = Boolean(monthlyTarget);

  return ROW_DEFS.map(rowDef => {
    const value = entry ? entry[rowDef.key].naKnjigamaDanas : 0;
    const target = monthlyTarget ? monthlyTarget[ROW_TARGET_FIELD[rowDef.key]] : 0;

    const lastYear = lastYearEntry
      ? lastYearEntry[rowDef.key].naKnjigamaDanas
      : entry
        ? entry[rowDef.key].istiDanProsleGodine
        : 0;

    const gap = value - target;
    const achievement = hasTarget && target !== 0 ? Math.round((value / target) * 1000) / 10 : 0;
    const remaining = target - value;
    const yoyChangePct = hasEntry && lastYear !== 0 ? Math.round(((value - lastYear) / lastYear) * 1000) / 10 : null;

    let remainingLabel = "—";
    if (hasEntry && hasTarget) {
      remainingLabel = remaining > 0
        ? `${formatNumber(remaining, rowDef)} preostalo`
        : `${formatNumber(Math.abs(remaining), rowDef)} iznad targeta`;
    }

    return {
      label: rowDef.label,
      value: hasEntry ? formatNumber(value, rowDef) : "—",
      rawValue: value,
      target: hasTarget ? formatNumber(target, rowDef) : "—",
      rawTarget: target,
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

// KPICard-ready data combining two comparisons for a single selected date:
//  - Daily: the exact entered value for that date vs. the monthly target's daily pace
//    (monthly target / days in month for additive rows; the rate target itself for rate rows).
//  - Monthly: the on-books/MTD snapshot vs. the full monthly target. For Room Nights and Revenue
//    this snapshot already IS the whole-month picture (see buildDayKpiData) — it is never rescaled
//    by days elapsed. For ADR/Occupancy/RevPAR it's already an average, so it's also shown as-is.
// Kept for Pace Forecasting only — the KPI cards themselves use the simpler buildDayKpiData above.
export interface DualKpiData {
  key: RowKey;
  label: string;
  unit?: string;
  prefix?: string;

  dailyValueFormatted: string;
  hasDailyEntry: boolean;
  dailyTargetFormatted: string;
  dailyGapFormatted: string;
  dailyAchievement: number;
  dailyStatus: KPIStatus;

  yoyChangePct: number | null;
  lastYearLabel: string;

  hasMtdData: boolean;
  mtdValueFormatted: string;
  hasMonthlyTarget: boolean;
  monthlyTargetFormatted: string;
  monthlyProgressPct: number;
  daysElapsed: number;
  daysInMonth: number;
  daysRemaining: number;
  projectedFormatted: string;
  projectedPct: number;
  monthlyStatus: KPIStatus;
}

// daysElapsed for the pace projection is the number of days that actually have an entered
// report (mtdAgg.daysWithData), not the calendar day-of-month — this keeps the projection honest
// if a report was skipped, instead of silently diluting the average with a phantom missing day.
export function buildDualKpiData(
  row: DailyReportRow | null,
  lastYearRow: DailyReportRow | null,
  monthlyTarget: MonthlyTargetRow | null,
  mtdAgg: PeriodAggregate,
  daysInMonth: number,
): DualKpiData[] {
  const entry = row ? dbRowToEntryData(row) : null;
  const lastYearEntry = lastYearRow ? dbRowToEntryData(lastYearRow) : null;
  const hasEntry = Boolean(entry);
  const hasTarget = Boolean(monthlyTarget);
  const hasMtdData = mtdAgg.daysWithData > 0;
  const daysElapsed = mtdAgg.daysWithData;
  const daysRemaining = Math.max(0, daysInMonth - daysElapsed);

  return ROW_DEFS.map(rowDef => {
    const additive = isAdditiveRow(rowDef.key);

    const danas = entry ? entry[rowDef.key].naKnjigamaDanas : 0;
    const rawMonthlyTarget = monthlyTarget ? monthlyTarget[ROW_TARGET_FIELD[rowDef.key]] : 0;
    const dailyTarget = additive && daysInMonth > 0 ? rawMonthlyTarget / daysInMonth : rawMonthlyTarget;

    const lastYear = lastYearEntry
      ? lastYearEntry[rowDef.key].naKnjigamaDanas
      : entry
        ? entry[rowDef.key].istiDanProsleGodine
        : 0;

    const dailyGap = danas - dailyTarget;
    const dailyAchievement = hasTarget && dailyTarget !== 0 ? Math.round((danas / dailyTarget) * 1000) / 10 : 0;
    const yoyChangePct = hasEntry && lastYear !== 0 ? Math.round(((danas - lastYear) / lastYear) * 1000) / 10 : null;

    const mtdValue = mtdAgg[rowDef.key];
    const monthlyProgressPct = hasTarget && rawMonthlyTarget !== 0 ? Math.round((mtdValue / rawMonthlyTarget) * 1000) / 10 : 0;

    // Room Nights and Revenue are on-books snapshots, not a daily rate — the latest reading already
    // represents the whole target period, so it is never rescaled by days elapsed / days remaining
    // (doing so double-counts the same on-books pipeline of bookings). ADR/Occupancy/RevPAR are
    // already averages for the same reason: the current reading IS the picture, not a partial one.
    const projected = mtdValue;
    const projectedPct = monthlyProgressPct;

    return {
      key: rowDef.key,
      label: rowDef.label,
      unit: rowDef.unit,
      prefix: rowDef.prefix,

      dailyValueFormatted: hasEntry ? formatNumber(danas, rowDef) : "—",
      hasDailyEntry: hasEntry,
      dailyTargetFormatted: hasTarget ? formatNumber(dailyTarget, rowDef) : "—",
      dailyGapFormatted: hasEntry && hasTarget ? `${dailyGap >= 0 ? "+" : ""}${formatNumber(dailyGap, rowDef)}` : "—",
      dailyAchievement: hasEntry ? dailyAchievement : 0,
      dailyStatus: statusFor(dailyAchievement, hasTarget, !hasEntry),

      yoyChangePct,
      lastYearLabel: hasEntry ? formatNumber(lastYear, rowDef) : "—",

      hasMtdData,
      mtdValueFormatted: hasMtdData ? formatNumber(mtdValue, rowDef) : "—",
      hasMonthlyTarget: hasTarget,
      monthlyTargetFormatted: hasTarget ? formatNumber(rawMonthlyTarget, rowDef) : "—",
      monthlyProgressPct,
      daysElapsed,
      daysInMonth,
      daysRemaining,
      projectedFormatted: hasMtdData ? formatNumber(projected, rowDef) : "—",
      projectedPct,
      monthlyStatus: statusFor(projectedPct, hasTarget, !hasMtdData),
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

// Pace Forecast must project from what has actually happened, not from the on-books figure —
// each daily_reports row's on_books_today is already a running total for the whole target period
// as of that row's own report_date (see buildDayKpiData), so summing several rows together (the
// way fetchPeriodAggregate does for the On-Books section) double- and triple-counts the same
// pipeline of bookings. The most recent row dated strictly before today already reflects the
// month's actual pace to date, so that single row — not a sum across rows — is the "actuals so
// far" figure the projection is built from. Row count still feeds the existing days-elapsed /
// insufficient-data logic in buildDualKpiData and PaceForecasting, unchanged.
export async function fetchPaceActuals(hotelId: string, monthStartISO: string, monthEndISO: string): Promise<PeriodAggregate> {
  const { data, error } = await supabase
    .from("daily_reports")
    .select("on_books_today")
    .eq("hotel_id", hotelId)
    .gte("report_date", monthStartISO)
    .lte("report_date", monthEndISO)
    .lt("report_date", todayISO())
    .order("report_date", { ascending: false });

  if (error) console.error("Failed to load pace actuals:", error.message);
  const rows = (data ?? []) as Pick<DailyReportRow, "on_books_today">[];

  if (rows.length === 0) {
    return { brojNocenja: 0, ukupanPrihod: 0, adr: 0, popunjenost: 0, revpar: 0, daysWithData: 0 };
  }

  const latest = rows[0].on_books_today;
  return {
    brojNocenja: Number(latest.brojNocenja ?? 0),
    ukupanPrihod: Number(latest.ukupanPrihod ?? 0),
    adr: Number(latest.adr ?? 0),
    popunjenost: Number(latest.popunjenost ?? 0),
    revpar: Number(latest.revpar ?? 0),
    daysWithData: rows.length,
  };
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

// On-books tracks demand for months that haven't happened yet — the 2 months following the
// snapshot date's own month (that month's actuals already live in daily_reports; see getCurrentMonthDef).
export function getOnBooksStayMonths(dateISO: string): StayMonthDef[] {
  const { year, month } = dateParts(dateISO);
  const defs: StayMonthDef[] = [];
  for (let i = 1; i <= 2; i++) {
    const total = month - 1 + i;
    const y = year + Math.floor(total / 12);
    const m = (total % 12) + 1;
    defs.push({ month: m, year: y, label: `${MONTHS_SR[m - 1]} ${y}` });
  }
  return defs;
}

// The snapshot date's own calendar month — its actuals live in daily_reports rather than
// onbooks_snapshots, but it's shown alongside the future months as the "current month" card.
export function getCurrentMonthDef(dateISO: string): StayMonthDef {
  const { year, month } = dateParts(dateISO);
  return { month, year, label: `${MONTHS_SR[month - 1]} ${year}` };
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

// ── Excel report import (wide "Daily report" pace-report layout) ────────────────

function normalizePercent(n: number): number {
  // The file may store occupancy as a decimal fraction (0.55) or already as a percent (55).
  return n !== 0 && Math.abs(n) <= 1 ? n * 100 : n;
}

// Months after the current calendar month are still open — their figures are forward demand, not
// a finished result, so they're saved as on-books snapshots rather than daily_reports actuals.
export async function importOnBooksMonths(hotelId: string, months: ParsedMonthMetrics[]): Promise<number> {
  const { year, month: currentMonth } = dateParts(todayISO());
  const futureMonths = months.filter(m => m.monthNumber > currentMonth);
  if (futureMonths.length === 0) return 0;

  const entries: OnBooksMonthInput[] = futureMonths.map(m => ({
    stayMonth: m.monthNumber,
    stayYear: year,
    roomsOnbooks: m.roomNights.today,
    revenueOnbooks: m.revenue.today,
    occupancyOnbooks: normalizePercent(m.occupancy.today),
  }));
  await saveOnBooksForDate(hotelId, todayISO(), entries);
  return futureMonths.length;
}

// Months up to and including the current one are actuals: one daily_reports summary row per
// month (dated the month's last day), plus a monthly_targets row if one doesn't already exist —
// an existing manually-set target is never overwritten by the import.
export async function importActualsMonths(hotelId: string, months: ParsedMonthMetrics[]): Promise<number> {
  const { year, month: currentMonth } = dateParts(todayISO());
  const pastMonths = months.filter(m => m.monthNumber <= currentMonth);
  if (pastMonths.length === 0) return 0;

  for (const m of pastMonths) {
    const monthStart = toISO(year, m.monthNumber, 1);
    const reportDate = toISO(year, m.monthNumber, daysInMonthOf(monthStart));

    const payload = {
      hotel_id: hotelId,
      report_date: reportDate,
      last_year: {
        brojNocenja: m.roomNights.totalLastYear,
        ukupanPrihod: m.revenue.totalLastYear,
        adr: m.adr.totalLastYear,
        popunjenost: normalizePercent(m.occupancy.totalLastYear),
        revpar: m.revpar.totalLastYear,
      },
      same_day_last_year: {
        brojNocenja: m.roomNights.sameDayLastYear,
        ukupanPrihod: m.revenue.sameDayLastYear,
        adr: m.adr.sameDayLastYear,
        popunjenost: normalizePercent(m.occupancy.sameDayLastYear),
        revpar: m.revpar.sameDayLastYear,
      },
      on_books_yesterday: { brojNocenja: 0, ukupanPrihod: 0, adr: 0, popunjenost: 0, revpar: 0 },
      on_books_today: {
        brojNocenja: m.roomNights.today,
        ukupanPrihod: m.revenue.today,
        adr: m.adr.today,
        popunjenost: normalizePercent(m.occupancy.today),
        revpar: m.revpar.today,
      },
      target: {
        brojNocenja: m.roomNights.target,
        ukupanPrihod: m.revenue.target,
        adr: m.adr.target,
        popunjenost: normalizePercent(m.occupancy.target),
        revpar: m.revpar.target,
      },
    };

    const { error } = await supabase
      .from("daily_reports")
      .upsert(payload, { onConflict: "hotel_id,report_date" });
    if (error) console.error("Failed to import monthly actuals:", error.message);

    const yearMonth = yearMonthOf(reportDate);
    const { data: existingTarget } = await supabase
      .from("monthly_targets")
      .select("id")
      .eq("hotel_id", hotelId)
      .eq("year_month", yearMonth)
      .maybeSingle();

    if (!existingTarget) {
      const { error: targetError } = await supabase.from("monthly_targets").insert({
        hotel_id: hotelId,
        year_month: yearMonth,
        revenue_target: m.revenue.target,
        room_nights_target: m.roomNights.target,
        adr_target: m.adr.target,
        occupancy_target: normalizePercent(m.occupancy.target),
        revpar_target: m.revpar.target,
      });
      if (targetError) console.error("Failed to save monthly target from import:", targetError.message);
    }
  }

  return pastMonths.length;
}

export type { RowKey };
