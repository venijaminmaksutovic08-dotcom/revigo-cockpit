import * as XLSX from "xlsx";
import { MONTHS_SR, emptyEntryData, type EntryData } from "../context/HotelContext";

// Parses the wide "Daily report" pace-report layout: for each calendar month (Jan-Dec) a section
// of 5 metric rows (Room Nights, Room Revenue, ADR, % Occ., RevPAR). This is a different shape
// from the per-date CSV import in reportImport.ts — one row per metric grouped by month, not one
// row per date.
//
// Column positions are FIXED, verified against a real export, and are read by index rather than
// by header text — this sheet's headers are unreliable (merged cells, comparison columns like
// "Today vs Target" that collide with substring header-matching, inconsistent wording across
// exports), so header detection has repeatedly misread the wrong column. Position never lies:
//   0: month name        1: metric name         2: Total Last Year   3: Same Day Last Year
//   4: Month Opening (unused)   5: Yesterday (unused)   6: TODAY   7: Pickup (unused)   8: TARGET
// Columns after 8 (Today vs Target, Today vs Last Year, Achievements) are derived and ignored.

export interface MetricColumnValues {
  totalLastYear: number;
  sameDayLastYear: number;
  today: number;
  target: number;
}

export interface ParsedMonthMetrics {
  monthNumber: number; // 1-12
  roomNights: MetricColumnValues;
  revenue: MetricColumnValues;
  adr: MetricColumnValues;
  occupancy: MetricColumnValues; // raw as read from the file — may be a decimal (0.55) or a percent (55)
  revpar: MetricColumnValues;
}

export interface ParseDailyReportResult {
  months: ParsedMonthMetrics[];
  // Whether a "Daily report" sheet was located at all — lets callers distinguish "this isn't that
  // kind of file" (fall back to another parser) from "it's that kind of file but something's wrong
  // with it" (surface the error).
  sheetFound: boolean;
  error: string | null;
}

type MetricRowKey = "roomNights" | "revenue" | "adr" | "occupancy" | "revpar";

const METRIC_KEYWORDS: Record<MetricRowKey, string[]> = {
  roomNights: ["room nights", "room night", "nocenja", "sobe"],
  revenue: ["room revenue", "total revenue", "prihod"],
  adr: ["adr"],
  occupancy: ["occ", "popunjenost"],
  revpar: ["revpar"],
};

const MONTH_KEYWORDS: string[][] = [
  ["january", "januar"],
  ["february", "februar"],
  ["march", "mart"],
  ["april"],
  ["may", "maj"],
  ["june", "jun", "juni"],
  ["july", "jul", "juli"],
  ["august", "avgust"],
  ["september", "septembar"],
  ["october", "oktobar"],
  ["november", "novembar"],
  ["december", "decembar"],
];

const ENGLISH_MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// Fixed 0-based column indices — see module comment for the verified layout.
const COL_TOTAL_LAST_YEAR = 2;
const COL_SAME_DAY_LAST_YEAR = 3;
const COL_TODAY = 6;
const COL_TARGET = 8;

function normalizeCell(value: unknown): string {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip diacritics (š,č,ć,ž,đ...)
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function toNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const cleaned = value.replace(/[^\d.,-]/g, "").replace(",", ".");
    const n = Number(cleaned);
    return isNaN(n) ? 0 : n;
  }
  return 0;
}

function matchMonth(norm: string): number | null {
  if (!norm) return null;
  for (let i = 0; i < MONTH_KEYWORDS.length; i++) {
    if (MONTH_KEYWORDS[i].some(kw => norm === kw || norm.includes(kw))) return i + 1;
  }
  return null;
}

function matchMetric(norm: string): MetricRowKey | null {
  if (!norm) return null;
  for (const key of Object.keys(METRIC_KEYWORDS) as MetricRowKey[]) {
    if (METRIC_KEYWORDS[key].some(kw => norm.includes(kw))) return key;
  }
  return null;
}

function emptyMetric(): MetricColumnValues {
  return { totalLastYear: 0, sameDayLastYear: 0, today: 0, target: 0 };
}

function emptyMonthMetrics(monthNumber: number): ParsedMonthMetrics {
  return {
    monthNumber,
    roomNights: emptyMetric(),
    revenue: emptyMetric(),
    adr: emptyMetric(),
    occupancy: emptyMetric(),
    revpar: emptyMetric(),
  };
}

// Fixed-position read — index 6 is always Today and index 8 is always Target, regardless of
// whatever text (if any) appears in a header row. Never derive these from column headers.
function readMetricValuesFixed(row: unknown[]): MetricColumnValues {
  return {
    totalLastYear: toNumber(row[COL_TOTAL_LAST_YEAR]),
    sameDayLastYear: toNumber(row[COL_SAME_DAY_LAST_YEAR]),
    today: toNumber(row[COL_TODAY]),
    target: toNumber(row[COL_TARGET]),
  };
}

export async function parseDailyReportExcel(file: File): Promise<ParseDailyReportResult> {
  if (!file.name.toLowerCase().endsWith(".xlsx")) {
    return { months: [], sheetFound: false, error: "Pogrešan format fajla. Očekuje se .xlsx" };
  }

  let workbook: XLSX.WorkBook;
  try {
    const buffer = await file.arrayBuffer();
    workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  } catch {
    return { months: [], sheetFound: false, error: "Pogrešan format fajla. Očekuje se .xlsx" };
  }

  let sheetName = workbook.SheetNames.find(n => normalizeCell(n) === "daily report");
  if (!sheetName) sheetName = workbook.SheetNames.find(n => normalizeCell(n).includes("daily report"));
  if (!sheetName) {
    return { months: [], sheetFound: false, error: "Sheet 'Daily report' nije pronađen u fajlu." };
  }

  let raw: unknown[][];
  try {
    const sheet = workbook.Sheets[sheetName];
    raw = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "" });
  } catch {
    return { months: [], sheetFound: true, error: "Nisu pronađeni podaci za uvoz." };
  }

  // No header-row detection at all: column 0 identifies the current month section, column 1
  // identifies a metric row within it, and once inside a month every value is read from its fixed
  // column position. currentMonth carries forward across rows where column 0 is blank (a month's
  // own metric rows may or may not repeat the month name in column 0 — either way works, since we
  // only ever update currentMonth when column 0 actually matches one).
  const monthsMap = new Map<number, ParsedMonthMetrics>();
  let currentMonth: number | null = null;

  for (let r = 0; r < raw.length; r++) {
    const row = raw[r] ?? [];

    const monthNum = matchMonth(normalizeCell(row[0]));
    if (monthNum) {
      currentMonth = monthNum;
      if (!monthsMap.has(monthNum)) monthsMap.set(monthNum, emptyMonthMetrics(monthNum));
    }

    if (currentMonth === null) continue;

    const metricKey = matchMetric(normalizeCell(row[1]));
    if (!metricKey) continue;

    const entry = monthsMap.get(currentMonth) ?? emptyMonthMetrics(currentMonth);
    entry[metricKey] = readMetricValuesFixed(row);
    monthsMap.set(currentMonth, entry);
  }

  const months = Array.from(monthsMap.values()).sort((a, b) => a.monthNumber - b.monthNumber);
  if (months.length === 0) {
    return { months: [], sheetFound: true, error: "Nisu pronađeni podaci za uvoz." };
  }

  // Verification logging for the fixed-position rewrite — confirms the Today column (index 6)
  // landed on the right cell for whichever months this file actually contains.
  for (const m of months) {
    const name = ENGLISH_MONTH_NAMES[m.monthNumber - 1];
    const occPct = m.occupancy.today !== 0 && Math.abs(m.occupancy.today) <= 1 ? m.occupancy.today * 100 : m.occupancy.today;
    console.log(
      `${name} Today values: rooms=${m.roomNights.today}, revenue=${m.revenue.today}, adr=${m.adr.today}, occ=${occPct}, revpar=${m.revpar.today}`
    );
  }

  return { months, sheetFound: true, error: null };
}

// Normalizes a raw occupancy cell to a percent — the sheet may store it as a decimal fraction
// (0.55) or already as a percent (55), same ambiguity handled in dashboardData.ts's monthly import.
function normalizePercent(n: number): number {
  return n !== 0 && Math.abs(n) <= 1 ? n * 100 : n;
}

function metricToRowValues(m: MetricColumnValues, isPercent: boolean) {
  const norm = isPercent ? normalizePercent : (v: number) => v;
  return {
    prosleGodine: norm(m.totalLastYear),
    istiDanProsleGodine: norm(m.sameDayLastYear),
    naKnjigamaJuce: 0, // not present in this sheet layout — no "Yesterday" column
    naKnjigamaDanas: norm(m.today),
    target: norm(m.target),
  };
}

// Converts one month's section of the wide "Daily report" sheet into the app's per-date EntryData
// shape, so it can be saved through the same daily_reports upsert path as a manually entered day.
export function monthMetricsToEntryData(m: ParsedMonthMetrics): EntryData {
  const data = emptyEntryData();
  data.brojNocenja = metricToRowValues(m.roomNights, false);
  data.ukupanPrihod = metricToRowValues(m.revenue, false);
  data.adr = metricToRowValues(m.adr, false);
  data.popunjenost = metricToRowValues(m.occupancy, true);
  data.revpar = metricToRowValues(m.revpar, false);
  return data;
}

export interface ParseSingleMonthResult {
  // False when the file simply isn't this wide-sheet format — callers should fall back to another
  // parser rather than surface an error. True (with an error) means the sheet exists but something
  // about it — or the requested month — couldn't be read, which IS worth surfacing.
  sheetFound: boolean;
  data: EntryData | null;
  error: string | null;
}

// Single-date import: pull just one month's "Today" column values out of the wide "Daily report"
// sheet, for the calendar-selected date's month — used by ImportReportModal instead of the
// generic per-date parser when the uploaded file is this hotel's monthly pace-report export.
export async function parseDailyReportExcelForMonth(file: File, monthNumber: number): Promise<ParseSingleMonthResult> {
  const result = await parseDailyReportExcel(file);
  if (!result.sheetFound) {
    return { sheetFound: false, data: null, error: null };
  }
  if (result.error) {
    return { sheetFound: true, data: null, error: result.error };
  }

  const month = result.months.find(mm => mm.monthNumber === monthNumber);
  if (!month) {
    return { sheetFound: true, data: null, error: `Mesec "${MONTHS_SR[monthNumber - 1]}" nije pronađen u listu "Daily report" ovog fajla.` };
  }

  return { sheetFound: true, data: monthMetricsToEntryData(month), error: null };
}
