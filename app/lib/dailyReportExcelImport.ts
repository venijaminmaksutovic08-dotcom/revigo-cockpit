import * as XLSX from "xlsx";

// Parses the wide "Daily report" pace-report layout: for each calendar month (Jan-Dec) a section
// of 5 metric rows (Room Nights, Total Revenue, ADR, % Occ., RevPAR), each with 4 data columns
// (Total Last Year, Same Day Last Year, Today, Target). This is a different shape from the
// per-date CSV import in reportImport.ts — one row per metric grouped by month, not one row per
// date — so it needs its own column/row detection rather than sheet_to_json's header-per-row model.

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
  error: string | null;
}

type MetricRowKey = "roomNights" | "revenue" | "adr" | "occupancy" | "revpar";

const METRIC_KEYWORDS: Record<MetricRowKey, string[]> = {
  roomNights: ["room nights", "room night", "nocenja", "sobe"],
  revenue: ["total revenue", "room revenue", "prihod"],
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

interface ColumnIndexes {
  totalLastYear?: number;
  sameDayLastYear?: number;
  today?: number;
  target?: number;
}

function findHeaderRow(raw: unknown[][]): { rowIndex: number; cols: ColumnIndexes } | null {
  for (let r = 0; r < raw.length; r++) {
    const row = raw[r] ?? [];
    const cols: ColumnIndexes = {};
    for (let c = 0; c < row.length; c++) {
      const norm = normalizeCell(row[c]);
      if (!norm) continue;
      if (norm.includes("same day last year")) cols.sameDayLastYear = c;
      else if (norm.includes("total last year")) cols.totalLastYear = c;
      else if (norm === "today" || norm.includes("today")) cols.today = c;
      else if (norm === "target" || norm.includes("target")) cols.target = c;
    }
    if (cols.today !== undefined && cols.target !== undefined) {
      return { rowIndex: r, cols };
    }
  }
  return null;
}

function readMetricValues(row: unknown[], cols: ColumnIndexes): MetricColumnValues {
  return {
    totalLastYear: cols.totalLastYear !== undefined ? toNumber(row[cols.totalLastYear]) : 0,
    sameDayLastYear: cols.sameDayLastYear !== undefined ? toNumber(row[cols.sameDayLastYear]) : 0,
    today: cols.today !== undefined ? toNumber(row[cols.today]) : 0,
    target: cols.target !== undefined ? toNumber(row[cols.target]) : 0,
  };
}

export async function parseDailyReportExcel(file: File): Promise<ParseDailyReportResult> {
  if (!file.name.toLowerCase().endsWith(".xlsx")) {
    return { months: [], error: "Pogrešan format fajla. Očekuje se .xlsx" };
  }

  let workbook: XLSX.WorkBook;
  try {
    const buffer = await file.arrayBuffer();
    workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  } catch {
    return { months: [], error: "Pogrešan format fajla. Očekuje se .xlsx" };
  }

  let sheetName = workbook.SheetNames.find(n => normalizeCell(n) === "daily report");
  if (!sheetName) sheetName = workbook.SheetNames.find(n => normalizeCell(n).includes("daily report"));
  if (!sheetName) {
    return { months: [], error: "Sheet 'Daily report' nije pronađen u fajlu." };
  }

  let raw: unknown[][];
  try {
    const sheet = workbook.Sheets[sheetName];
    raw = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "" });
  } catch {
    return { months: [], error: "Nisu pronađeni podaci za uvoz." };
  }

  const header = findHeaderRow(raw);
  if (!header) {
    return { months: [], error: "Nisu pronađeni podaci za uvoz." };
  }

  const monthsMap = new Map<number, ParsedMonthMetrics>();
  let currentMonth: number | null = null;

  for (let r = header.rowIndex + 1; r < raw.length; r++) {
    const row = raw[r] ?? [];
    const label = normalizeCell(row[0]);
    if (!label) continue;

    const monthNum = matchMonth(label);
    if (monthNum) {
      currentMonth = monthNum;
      if (!monthsMap.has(monthNum)) monthsMap.set(monthNum, emptyMonthMetrics(monthNum));
      continue;
    }

    if (currentMonth === null) continue;

    const metricKey = matchMetric(label);
    if (!metricKey) continue;

    const entry = monthsMap.get(currentMonth) ?? emptyMonthMetrics(currentMonth);
    entry[metricKey] = readMetricValues(row, header.cols);
    monthsMap.set(currentMonth, entry);
  }

  const months = Array.from(monthsMap.values()).sort((a, b) => a.monthNumber - b.monthNumber);
  if (months.length === 0) {
    return { months: [], error: "Nisu pronađeni podaci za uvoz." };
  }

  return { months, error: null };
}
