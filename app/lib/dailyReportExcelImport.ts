import * as XLSX from "xlsx";
import { MONTHS_SR, emptyEntryData, type EntryData } from "../context/HotelContext";

// Parses the wide "Daily report" pace-report layout: one 8-row block per calendar month (month
// name in column A, then 5 metric rows — Room Nights, Revenue, ADR, % Occ., RevPAR — then 2 spacer
// rows before the next month). This is a different shape from the per-date CSV import in
// reportImport.ts — one row per metric grouped by month, not one row per date.
//
// Two things about this sheet have burned this parser before, so both are handled defensively:
//
// 1. Column layout: the On-the-Books sub-columns (Total Last Year, Same Day Last Year, Month
//    Opening, Yesterday, Today, Target) are located ONCE by their header labels — never by a fixed
//    index. A fixed index broke the very first time this sheet added/removed a column (that's how
//    "Yesterday" ended up hardcoded to 0 for a while: nobody was reading column F at all). Header
//    text is still unreliable in its own way — comparison columns like "Today vs Target" contain
//    "today" and "target" as substrings — so those are explicitly skipped (see findColumnMap).
//
// 2. Row layout: the metric row LABEL varies between exports ("Room Revenue" in some files, "Total
//    Revenue" in others), so metric rows are identified by their fixed POSITION within a month's
//    block (Room Nights is always the row right after the month name, Revenue the one after that,
//    etc.) rather than by matching that label text — a label that's phrased differently one month
//    would otherwise silently vanish as an unmatched row.

export interface MetricColumnValues {
  // null = the parser could not read this cell (blank, an Excel error like #REF!/#DIV/0!, or
  // unparsable text) — never coerced to 0, since a fake zero would hide from a real reading of
  // zero and would get imported as if it were real data.
  totalLastYear: number | null;
  sameDayLastYear: number | null;
  yesterday: number | null;
  today: number | null;
  target: number | null;
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

// Fixed offsets (in rows) from the month-name row to each metric row within its block. Not label
// text — see module comment. The month-name row IS the Room Nights row (col A = month, col B =
// "Room Nights", data starts col C) — there is no separate blank row above it — so roomNights is
// offset 0, not 1.
const METRIC_ROW_OFFSETS: { key: MetricRowKey; offset: number }[] = [
  { key: "roomNights", offset: 0 },
  { key: "revenue", offset: 1 },
  { key: "adr", offset: 2 },
  { key: "occupancy", offset: 3 },
  { key: "revpar", offset: 4 },
];

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

const ERROR_STRINGS = new Set(["#ref!", "#div/0!", "#n/a", "#value!", "#name?", "#null!", "#num!"]);

function normalizeCell(value: unknown): string {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip diacritics (š,č,ć,ž,đ...)
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function isErrorCell(value: unknown): boolean {
  return typeof value === "string" && ERROR_STRINGS.has(value.trim().toLowerCase());
}

// Returns null (missing) rather than 0 for a blank cell, an Excel error value, or text that isn't
// really a number — the caller decides how to surface that (never silently treated as a real zero).
function toNumberOrMissing(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return null;
  if (isErrorCell(value)) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const cleaned = value.replace(/[^\d.,-]/g, "").replace(",", ".");
    if (!cleaned || cleaned === "-" || cleaned === ".") return null;
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function matchMonth(norm: string): number | null {
  if (!norm) return null;
  for (let i = 0; i < MONTH_KEYWORDS.length; i++) {
    if (MONTH_KEYWORDS[i].some(kw => norm === kw || norm.includes(kw))) return i + 1;
  }
  return null;
}

function emptyMetric(): MetricColumnValues {
  return { totalLastYear: null, sameDayLastYear: null, yesterday: null, today: null, target: null };
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

interface OnBooksColumnMap {
  totalLastYear?: number;
  sameDayLastYear?: number;
  yesterday?: number;
  today?: number;
  target?: number;
}

function scanRowForColumnLabels(row: unknown[]): OnBooksColumnMap {
  const cols: OnBooksColumnMap = {};
  for (let c = 0; c < row.length; c++) {
    const norm = normalizeCell(row[c]);
    if (!norm) continue;
    // Comparison/delta columns ("Today vs Target", "Today vs Last Year") contain "today" and
    // "target" as substrings too — skip them so they don't clobber the real columns.
    if (norm.includes(" vs ")) continue;
    if (norm.includes("same day last year")) cols.sameDayLastYear = c;
    else if (norm.includes("total last year")) cols.totalLastYear = c;
    else if (norm === "yesterday" || norm.includes("yesterday")) cols.yesterday = c;
    else if (norm === "today" || norm.includes("today")) cols.today = c;
    else if (norm === "target" || norm.includes("target")) cols.target = c;
  }
  return cols;
}

// Locates the On-the-Books sub-columns by header label, scanned once for the whole sheet (every
// month's block shares the same physical columns). Requires yesterday+today+target together on
// one row before accepting it, so a stray cell elsewhere that happens to say "Target" can't be
// mistaken for the header row. This sheet's real layout splits the header across TWO rows — a
// group row with "Total Last Year"/"Same Day Last Year" (and a decoy "Target" that belongs to a
// different column than the real one) directly above a sub-header row with "Yesterday"/"Today"/
// the real "Target" — so once the anchor row (yesterday+today+target) is found, the row directly
// above it is also checked for the two Last Year labels and merged in.
function findColumnMap(raw: unknown[][]): OnBooksColumnMap | null {
  for (let r = 0; r < raw.length; r++) {
    const cols = scanRowForColumnLabels(raw[r] ?? []);
    if (cols.yesterday !== undefined && cols.today !== undefined && cols.target !== undefined) {
      if (r > 0) {
        const above = scanRowForColumnLabels(raw[r - 1] ?? []);
        if (cols.totalLastYear === undefined) cols.totalLastYear = above.totalLastYear;
        if (cols.sameDayLastYear === undefined) cols.sameDayLastYear = above.sameDayLastYear;
      }
      return cols;
    }
  }
  return null;
}

function readMetricRow(row: unknown[], cols: OnBooksColumnMap): MetricColumnValues {
  return {
    totalLastYear: cols.totalLastYear !== undefined ? toNumberOrMissing(row[cols.totalLastYear]) : null,
    sameDayLastYear: cols.sameDayLastYear !== undefined ? toNumberOrMissing(row[cols.sameDayLastYear]) : null,
    yesterday: cols.yesterday !== undefined ? toNumberOrMissing(row[cols.yesterday]) : null,
    today: cols.today !== undefined ? toNumberOrMissing(row[cols.today]) : null,
    target: cols.target !== undefined ? toNumberOrMissing(row[cols.target]) : null,
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

  if (workbook.SheetNames.length === 0) {
    return { months: [], sheetFound: false, error: "Fajl ne sadrži nijedan list." };
  }

  // The sheet is identified by its STRUCTURE (a row with Yesterday/Today/Target headers), not by
  // its exact name — the name has varied between exports and this sheet never has a date column
  // to fall back on, so getting sheet detection wrong here means the import can't work at all.
  // Sheets whose name mentions "daily" are tried first (fast path for the common case), then
  // every other sheet, so a differently-named export still gets found.
  const byNameScore = (n: string) => (normalizeCell(n).includes("daily") ? 0 : 1);
  const candidates = [...workbook.SheetNames].sort((a, b) => byNameScore(a) - byNameScore(b));

  let raw: unknown[][] | null = null;
  let cols: OnBooksColumnMap | null = null;
  for (const name of candidates) {
    let candidateRaw: unknown[][];
    try {
      candidateRaw = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[name], { header: 1, defval: "" });
    } catch {
      continue;
    }
    const candidateCols = findColumnMap(candidateRaw);
    if (candidateCols) {
      raw = candidateRaw;
      cols = candidateCols;
      break;
    }
  }

  if (!raw || !cols) {
    // sheetFound: true (not false) — this genuinely is (or was meant to be) this report format,
    // so the caller should surface this error directly rather than silently trying some other
    // parser that expects a date column this sheet will never have.
    return { months: [], sheetFound: true, error: "Nije prepoznat list sa dnevnim izveštajem (kolone Yesterday/Today/Target nisu pronađene ni u jednom listu)." };
  }

  // Column 0 identifies a month's block start; the 5 metric rows are read from their fixed
  // position below it (see METRIC_ROW_OFFSETS), not by re-matching a label per row.
  const monthsMap = new Map<number, ParsedMonthMetrics>();

  for (let r = 0; r < raw.length; r++) {
    const row = raw[r] ?? [];
    const monthNum = matchMonth(normalizeCell(row[0]));
    if (!monthNum) continue;

    const entry = emptyMonthMetrics(monthNum);
    for (const { key, offset } of METRIC_ROW_OFFSETS) {
      entry[key] = readMetricRow(raw[r + offset] ?? [], cols);
    }
    monthsMap.set(monthNum, entry);
  }

  const months = Array.from(monthsMap.values()).sort((a, b) => a.monthNumber - b.monthNumber);
  if (months.length === 0) {
    return { months: [], sheetFound: true, error: "Nisu pronađeni podaci za uvoz." };
  }

  // Verification logging — confirms Today/Yesterday landed on the right cells for whichever
  // months this file actually contains.
  for (const m of months) {
    const name = ENGLISH_MONTH_NAMES[m.monthNumber - 1];
    const occToday = m.occupancy.today;
    const occPct = occToday !== null && occToday !== 0 && Math.abs(occToday) <= 1 ? occToday * 100 : occToday;
    console.log(
      `${name}: yesterday(rooms=${m.roomNights.yesterday}, revenue=${m.revenue.yesterday}) ` +
      `today(rooms=${m.roomNights.today}, revenue=${m.revenue.today}, adr=${m.adr.today}, occ=${occPct}, revpar=${m.revpar.today})`
    );
  }

  return { months, sheetFound: true, error: null };
}

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
};

// Converts one metric's four/five columns into the app's per-column EntryData shape. A missing
// (null) cell is stored as 0 in EntryData — the daily_reports jsonb columns are numeric and can't
// carry a separate "missing" marker — but every missing cell is also recorded in `missing` so the
// caller can warn about it BEFORE the user saves, instead of a silent fake zero going through
// unannounced.
function metricToRowValues(m: MetricColumnValues, isPercent: boolean, metricLabel: string, missing: string[]) {
  const norm = (v: number | null): number => {
    if (v === null) return 0;
    return isPercent ? normalizePercent(v) : v;
  };
  (Object.keys(COLUMN_LABELS) as (keyof MetricColumnValues)[]).forEach(key => {
    if (m[key] === null) missing.push(`${metricLabel} — ${COLUMN_LABELS[key]}`);
  });

  return {
    prosleGodine: norm(m.totalLastYear),
    istiDanProsleGodine: norm(m.sameDayLastYear),
    naKnjigamaJuce: norm(m.yesterday),
    naKnjigamaDanas: norm(m.today),
    target: norm(m.target),
  };
}

// Converts one month's section of the wide "Daily report" sheet into the app's per-date EntryData
// shape, so it can be saved through the same daily_reports upsert path as a manually entered day.
// Also returns which specific fields the parser couldn't read, for the caller to warn about.
export function monthMetricsToEntryData(m: ParsedMonthMetrics): { data: EntryData; missingFields: string[] } {
  const missing: string[] = [];
  const data = emptyEntryData();
  data.brojNocenja = metricToRowValues(m.roomNights, false, "Room Nights", missing);
  data.ukupanPrihod = metricToRowValues(m.revenue, false, "Revenue", missing);
  data.adr = metricToRowValues(m.adr, false, "ADR", missing);
  data.popunjenost = metricToRowValues(m.occupancy, true, "% Occ.", missing);
  data.revpar = metricToRowValues(m.revpar, false, "RevPAR", missing);
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
}

// Single-date import: pull just one month's on-the-books values out of the wide "Daily report"
// sheet, for the calendar-selected date's month — used by ImportReportModal instead of the
// generic per-date parser when the uploaded file is this hotel's monthly pace-report export.
export async function parseDailyReportExcelForMonth(file: File, monthNumber: number): Promise<ParseSingleMonthResult> {
  const result = await parseDailyReportExcel(file);
  if (!result.sheetFound) {
    return { sheetFound: false, data: null, missingFields: [], error: null };
  }
  if (result.error) {
    return { sheetFound: true, data: null, missingFields: [], error: result.error };
  }

  const month = result.months.find(mm => mm.monthNumber === monthNumber);
  if (!month) {
    return { sheetFound: true, data: null, missingFields: [], error: `Mesec "${MONTHS_SR[monthNumber - 1]}" nije pronađen u listu "Daily report" ovog fajla.` };
  }

  const { data, missingFields } = monthMetricsToEntryData(month);
  return { sheetFound: true, data, missingFields, error: null };
}

// ── Filename-derived "as of" date ────────────────────────────────────────────────
// This sheet has no date cell of its own — the report's "as of" date is only encoded in the
// filename (e.g. "Queen_Daily_report_26_07.xlsx" = 26 July). Accepts day/month separated by _/-/.,
// with an optional trailing year (2 or 4 digits); assumes the current year when none is given.

export interface FilenameDateResult {
  dateISO: string | null;
  error: string | null;
}

export function parseDateFromFilename(filename: string, now: Date = new Date()): FilenameDateResult {
  const base = filename.replace(/\.[a-z0-9]+$/i, ""); // drop extension
  const match = base.match(/(\d{1,2})[_\-.](\d{1,2})(?:[_\-.](\d{2,4}))?(?!\d)/);
  if (!match) {
    return { dateISO: null, error: "Nije moguće pročitati datum iz naziva fajla — potvrdite datum ručno." };
  }

  const day = Number(match[1]);
  const month = Number(match[2]);
  let year = match[3] ? Number(match[3]) : now.getFullYear();
  if (match[3] && match[3].length === 2) year += 2000;

  if (day < 1 || day > 31 || month < 1 || month > 12) {
    return { dateISO: null, error: "Nije moguće pročitati datum iz naziva fajla — potvrdite datum ručno." };
  }
  const daysInMonth = new Date(year, month, 0).getDate();
  if (day > daysInMonth) {
    return { dateISO: null, error: "Nije moguće pročitati datum iz naziva fajla — potvrdite datum ručno." };
  }

  const pad2 = (n: number) => String(n).padStart(2, "0");
  return { dateISO: `${year}-${pad2(month)}-${pad2(day)}`, error: null };
}
