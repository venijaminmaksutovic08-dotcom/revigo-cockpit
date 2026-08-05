import { MONTHS_SR, emptyEntryData, type EntryData } from "../context/HotelContext";
import {
  parseDailyReportExcel,
  type MetricColumnValues,
  type MetricRowKey,
  type ParsedMonthMetrics,
} from "./dailyReportExcelParse";

// The wide "Daily report" sheet parsing lives in the dependency-free ./dailyReportExcelParse module
// (so it can be unit-tested in Node without pulling in HotelContext/React). This file adds the
// pieces that DO depend on the app's EntryData shape, and re-exports the pure parser + helpers so
// existing importers of "./dailyReportExcelImport" keep working unchanged.
export { parseDailyReportExcel, parseDateFromFilename } from "./dailyReportExcelParse";
export type {
  MetricColumnValues,
  MetricRowKey,
  ParsedMonthMetrics,
  ParseDailyReportResult,
  FilenameDateResult,
} from "./dailyReportExcelParse";

// Normalizes a raw occupancy cell to a percent — the sheet may store it as a decimal fraction
// (0.55) or already as a percent (55), same ambiguity handled in dashboardData.ts's monthly import.
function normalizePercent(n: number): number {
  return n !== 0 && Math.abs(n) <= 1 ? n * 100 : n;
}

const COLUMN_LABELS: Record<keyof MetricColumnValues, string> = {
  totalLastYear: "Prošla godina",
  sameDayLastYear: "Isti dan prošle godine",
  yesterday: "Na knjigama juče",
  today: "Na knjigama danas",
  target: "Target",
  pickup: "Pickup",
};

// Pickup is only meaningful for additive metrics (Room Nights, Revenue) — ADR/Occupancy/RevPAR
// are ratios, and the file's Pickup column has been observed reporting garbage for them (e.g. an
// ADR pickup cell that just mirrors Revenue's). Those three never capture a pickup value at all.
const PICKUP_METRIC_ROW_KEYS: MetricRowKey[] = ["roomNights", "revenue"];

// Converts one metric's four/five columns into the app's per-column EntryData shape. A missing
// (null) cell is stored as 0 in EntryData — the daily_reports jsonb columns are numeric and can't
// carry a separate "missing" marker — but every missing cell is also recorded in `missing` so the
// caller can warn about it BEFORE the user saves, instead of a silent fake zero going through
// unannounced. capturePickup is false for metrics where pickup isn't tracked at all — a null
// pickup on those never gets warned about, since it was never expected in the first place.
function metricToRowValues(m: MetricColumnValues, isPercent: boolean, metricLabel: string, missing: string[], capturePickup: boolean) {
  const norm = (v: number | null): number => {
    if (v === null) return 0;
    return isPercent ? normalizePercent(v) : v;
  };
  (Object.keys(COLUMN_LABELS) as (keyof MetricColumnValues)[])
    .filter(key => capturePickup || key !== "pickup")
    .forEach(key => {
      if (m[key] === null) missing.push(`${metricLabel} — ${COLUMN_LABELS[key]}`);
    });

  return {
    prosleGodine: norm(m.totalLastYear),
    istiDanProsleGodine: norm(m.sameDayLastYear),
    naKnjigamaJuce: norm(m.yesterday),
    naKnjigamaDanas: norm(m.today),
    target: norm(m.target),
    pickup: capturePickup ? norm(m.pickup) : 0,
  };
}

// Converts one month's section of the wide "Daily report" sheet into the app's per-date EntryData
// shape, so it can be saved through the same daily_reports upsert path as a manually entered day.
// Also returns which specific fields the parser couldn't read, for the caller to warn about.
export function monthMetricsToEntryData(m: ParsedMonthMetrics): { data: EntryData; missingFields: string[] } {
  const missing: string[] = [];
  const data = emptyEntryData();
  const capturePickup = (key: MetricRowKey) => PICKUP_METRIC_ROW_KEYS.includes(key);
  data.brojNocenja = metricToRowValues(m.roomNights, false, "Room Nights", missing, capturePickup("roomNights"));
  data.ukupanPrihod = metricToRowValues(m.revenue, false, "Revenue", missing, capturePickup("revenue"));
  data.adr = metricToRowValues(m.adr, false, "ADR", missing, capturePickup("adr"));
  data.popunjenost = metricToRowValues(m.occupancy, true, "% Occ.", missing, capturePickup("occupancy"));
  data.revpar = metricToRowValues(m.revpar, false, "RevPAR", missing, capturePickup("revpar"));
  return { data, missingFields: missing };
}

export interface ParseSingleMonthResult {
  // False when the file simply isn't this wide-sheet format — callers should fall back to another
  // parser rather than surface an error. True (with an error) means the sheet exists but something
  // about it — or the requested month — couldn't be read, which IS worth surfacing.
  sheetFound: boolean;
  data: EntryData | null;
  missingFields: string[];
  error: string | null;
  // Every month the file actually contains (the same full parse `data` was drawn from) — lets a
  // single-date import ALSO save the forward-looking on-books months (e.g. Aug/Sep) via
  // importOnBooksMonths, without re-parsing the file a second time. Empty when the file couldn't
  // be parsed at all.
  allMonths: ParsedMonthMetrics[];
}

// Single-date import: pull just one month's on-the-books values out of the wide "Daily report"
// sheet, for the calendar-selected date's month — used by ImportReportModal instead of the
// generic per-date parser when the uploaded file is this hotel's monthly pace-report export.
export async function parseDailyReportExcelForMonth(file: File, monthNumber: number): Promise<ParseSingleMonthResult> {
  const result = await parseDailyReportExcel(file);
  if (!result.sheetFound) {
    return { sheetFound: false, data: null, missingFields: [], error: null, allMonths: [] };
  }
  if (result.error) {
    return { sheetFound: true, data: null, missingFields: [], error: result.error, allMonths: [] };
  }

  const month = result.months.find(mm => mm.monthNumber === monthNumber);
  if (!month) {
    return { sheetFound: true, data: null, missingFields: [], error: `Mesec "${MONTHS_SR[monthNumber - 1]}" nije pronađen u listu "Daily report" ovog fajla.`, allMonths: result.months };
  }

  const { data, missingFields } = monthMetricsToEntryData(month);
  return { sheetFound: true, data, missingFields, error: null, allMonths: result.months };
}
