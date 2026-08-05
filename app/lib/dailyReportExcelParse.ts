import * as XLSX from "xlsx";

// Pure parser for the wide "Daily report" pace-report layout: one 8-row block per calendar month
// (month name in column A, then 5 metric rows — Room Nights, Revenue, ADR, % Occ., RevPAR — then 2
// spacer rows before the next month). This is a different shape from the per-date CSV import in
// reportImport.ts — one row per metric grouped by month, not one row per date.
//
// This module deliberately has NO dependency on HotelContext/React so it can be unit-tested in
// plain Node (see dailyReportExcelParse.test.ts). The EntryData conversion lives in
// dailyReportExcelImport.ts, which re-exports everything here.
//
// Two things about this sheet have burned this parser before, so both are handled defensively:
//
// 1. Column layout: the On-the-Books sub-columns (Total Last Year, Same Day Last Year, Month
//    Opening, Yesterday, Today, Target) are located by their header labels — never by a fixed
//    index. A fixed index broke the very first time this sheet added/removed a column. Labels are
//    matched case-/whitespace-/diacritic-insensitively in BOTH English and Serbian (Yesterday/Juče,
//    Today/Danas, …), and comparison columns like "Today vs Target" are skipped so their substrings
//    can't clobber the real columns.
//
// 2. Row layout: the metric row LABEL varies between exports ("Room Revenue" vs "Total Revenue"),
//    so metric rows are identified by their fixed POSITION within a month's block, not by matching
//    label text.

export interface MetricColumnValues {
  // null = the parser could not read this cell (blank, an Excel error like #REF!/#DIV/0!, or
  // unparsable text) — never coerced to 0, since a fake zero would hide from a real reading of
  // zero and would get imported as if it were real data.
  totalLastYear: number | null;
  sameDayLastYear: number | null;
  yesterday: number | null;
  today: number | null;
  target: number | null;
  pickup: number | null;
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

export type MetricRowKey = "roomNights" | "revenue" | "adr" | "occupancy" | "revpar";

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

// The month name normally sits in column A, but tolerate a shifted layout that adds a leading
// blank/label column by checking the first few cells of the row. Month keywords are specific
// enough (januar…decembar / january…december) that a metric label or a number won't match.
function matchMonthInRow(row: unknown[]): number | null {
  const limit = Math.min(row.length, 3);
  for (let c = 0; c < limit; c++) {
    const m = matchMonth(normalizeCell(row[c]));
    if (m) return m;
  }
  return null;
}

function emptyMetric(): MetricColumnValues {
  return { totalLastYear: null, sameDayLastYear: null, yesterday: null, today: null, target: null, pickup: null };
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
  pickup?: number;
}

// Which normalized substrings identify each On-the-Books column, in BOTH English and Serbian.
// normalizeCell has already lowercased, stripped diacritics (juče→juce, prošle→prosle) and
// collapsed whitespace/punctuation, so these are plain lowercase ASCII substrings — a header
// cell matches as long as it CONTAINS one of them (partial match, order/spacing-insensitive).
// The two "last year" labels are listed first and matched first, because their Serbian forms
// share the token "godin[ae]" and would otherwise be ambiguous; "isti dan" alone pins Same Day.
const COLUMN_LABEL_KEYWORDS: { key: keyof OnBooksColumnMap; any: string[] }[] = [
  { key: "sameDayLastYear", any: ["same day", "isti dan"] },
  { key: "totalLastYear", any: ["total last", "prosla godin", "prosle godin"] },
  { key: "yesterday", any: ["yesterday", "juce"] },
  { key: "today", any: ["today", "danas"] },
  { key: "target", any: ["target", "cilj"] },
  { key: "pickup", any: ["pickup"] },
];

function scanRowForColumnLabels(row: unknown[]): OnBooksColumnMap {
  const cols: OnBooksColumnMap = {};
  for (let c = 0; c < row.length; c++) {
    const norm = normalizeCell(row[c]);
    if (!norm) continue;
    // Comparison/delta columns ("Today vs Target", "Danas vs Target", "Today vs Last Year")
    // contain the base words as substrings too — skip anything phrased as "X vs Y".
    if (norm.includes(" vs ")) continue;
    // First matching keyword wins for this cell, and the earlier (more specific "last year")
    // entries are tested first so a shared token can't double-map a single cell. Set-once so an
    // earlier column occurrence isn't overwritten by a later stray one.
    for (const { key, any } of COLUMN_LABEL_KEYWORDS) {
      if (any.some(kw => norm.includes(kw))) {
        if (cols[key] === undefined) cols[key] = c;
        break;
      }
    }
  }
  return cols;
}

const CORE_COLUMNS: (keyof OnBooksColumnMap)[] = ["yesterday", "today", "target"];
const ALL_COLUMNS: (keyof OnBooksColumnMap)[] = [
  "totalLastYear", "sameDayLastYear", "yesterday", "today", "target", "pickup",
];

function coreCount(cols: OnBooksColumnMap): number {
  return CORE_COLUMNS.filter(k => cols[k] !== undefined).length;
}

// Locates the On-the-Books sub-columns by header label, scanned once for the whole sheet (every
// month's block shares the same physical columns). The header row is chosen as the one resolving
// the MOST of the core columns (Yesterday/Juče, Today/Danas, Target), requiring at least two so a
// stray cell that happens to say "Target" can't be mistaken for it while still tolerating a file
// that dropped one sub-column. This sheet's real layout splits the header across TWO rows — a
// group row with "Total Last Year"/"Same Day Last Year" (and a decoy "Target" for a different
// column) directly above a sub-header row with "Yesterday"/"Today"/the real "Target" — so any
// column missing from the chosen sub-header row is merged in from the row directly above it, with
// the chosen row's own hits always winning so the decoy never overwrites the real Target.
function findColumnMap(raw: unknown[][]): OnBooksColumnMap | null {
  let best: OnBooksColumnMap | null = null;
  let bestRow = -1;
  let bestScore = 0;
  for (let r = 0; r < raw.length; r++) {
    const cols = scanRowForColumnLabels(raw[r] ?? []);
    const score = coreCount(cols);
    if (score >= 2 && score > bestScore) {
      best = cols;
      bestRow = r;
      bestScore = score;
    }
  }
  if (!best) return null;
  if (bestRow > 0) {
    const above = scanRowForColumnLabels(raw[bestRow - 1] ?? []);
    for (const k of ALL_COLUMNS) {
      if (best[k] === undefined && above[k] !== undefined) best[k] = above[k];
    }
  }
  return best;
}

// Human-readable summary of which On-the-Books labels a sheet did/didn't yield, unioned across all
// its rows — used only to build a specific error when no sheet qualifies, so the message can name
// exactly what was and wasn't found in each sheet.
function describeSheetLabels(raw: unknown[][]): string {
  const found = new Set<keyof OnBooksColumnMap>();
  for (const row of raw) {
    const cols = scanRowForColumnLabels(row ?? []);
    for (const k of ALL_COLUMNS) if (cols[k] !== undefined) found.add(k);
  }
  const labelOf: Record<keyof OnBooksColumnMap, string> = {
    yesterday: "Yesterday/Juče", today: "Today/Danas", target: "Target",
    totalLastYear: "Total Last Year/Prošla godina", sameDayLastYear: "Same Day Last Year/Isti dan prošle godine",
    pickup: "Pickup",
  };
  const foundList = ALL_COLUMNS.filter(k => found.has(k)).map(k => labelOf[k]);
  return foundList.length ? `pronađeno: ${foundList.join(", ")}` : "nijedna tražena kolona nije prepoznata";
}

function readMetricRow(row: unknown[], cols: OnBooksColumnMap): MetricColumnValues {
  return {
    totalLastYear: cols.totalLastYear !== undefined ? toNumberOrMissing(row[cols.totalLastYear]) : null,
    sameDayLastYear: cols.sameDayLastYear !== undefined ? toNumberOrMissing(row[cols.sameDayLastYear]) : null,
    yesterday: cols.yesterday !== undefined ? toNumberOrMissing(row[cols.yesterday]) : null,
    today: cols.today !== undefined ? toNumberOrMissing(row[cols.today]) : null,
    target: cols.target !== undefined ? toNumberOrMissing(row[cols.target]) : null,
    pickup: cols.pickup !== undefined ? toNumberOrMissing(row[cols.pickup]) : null,
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
  const diagnostics: string[] = []; // per-sheet summary, only used to build a failure message
  for (const name of candidates) {
    let candidateRaw: unknown[][];
    try {
      candidateRaw = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[name], { header: 1, defval: "" });
    } catch {
      diagnostics.push(`„${name}“: nije moguće pročitati list`);
      continue;
    }
    const candidateCols = findColumnMap(candidateRaw);
    if (candidateCols) {
      raw = candidateRaw;
      cols = candidateCols;
      break;
    }
    diagnostics.push(`„${name}“: ${describeSheetLabels(candidateRaw)}`);
  }

  if (!raw || !cols) {
    // sheetFound: true (not false) — this genuinely is (or was meant to be) this report format,
    // so the caller should surface this error directly rather than silently trying some other
    // parser that expects a date column this sheet will never have. The message names exactly what
    // was searched for (both languages) and what each scanned sheet did/didn't contain.
    const error =
      "Nije prepoznat list sa dnevnim izveštajem. Traženo je zaglavlje sa najmanje dve od kolona: " +
      "Yesterday/Juče, Today/Danas, Target (uz Total Last Year/Prošla godina i Same Day Last Year/" +
      "Isti dan prošle godine). Pretraženi listovi — " + diagnostics.join("; ") + ".";
    return { months: [], sheetFound: true, error };
  }

  // Column 0 identifies a month's block start; the 5 metric rows are read from their fixed
  // position below it (see METRIC_ROW_OFFSETS), not by re-matching a label per row.
  const monthsMap = new Map<number, ParsedMonthMetrics>();

  for (let r = 0; r < raw.length; r++) {
    const row = raw[r] ?? [];
    const monthNum = matchMonthInRow(row);
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
      `today(rooms=${m.roomNights.today}, revenue=${m.revenue.today}, adr=${m.adr.today}, occ=${occPct}, revpar=${m.revpar.today}) ` +
      `pickup(rooms=${m.roomNights.pickup}, revenue=${m.revenue.pickup})`
    );
  }

  return { months, sheetFound: true, error: null };
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
