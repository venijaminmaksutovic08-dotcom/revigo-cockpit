import * as XLSX from "xlsx";
import {
  ROW_DEFS,
  COLUMN_DEFS,
  emptyEntryData,
  type RowKey,
  type ColumnKey,
  type EntryData,
} from "../context/HotelContext";

export interface ParsedReportRow {
  dateISO: string;
  dateLabel: string;
  data: EntryData;
}

export interface ParseReportResult {
  rows: ParsedReportRow[];
  unmatchedHeaders: string[];
  matchedHeaders: string[];
  defaultedColumnHeaders: string[];
  error: string | null;
}

const ROW_KEYWORDS: Record<RowKey, string[]> = {
  brojNocenja: ["room night", "roomnight", "broj nocenja", "nocenja"],
  ukupanPrihod: ["total revenue", "revenue", "ukupan prihod", "prihod"],
  adr: ["adr"],
  popunjenost: ["occupancy", "popunjenost", "occ %", "occ%"],
  revpar: ["revpar"],
};

// Checked in this order so multi-word phrases match before generic single words.
const COLUMN_KEYWORDS: { key: ColumnKey; keywords: string[] }[] = [
  { key: "prosleGodine", keywords: ["total last year", "last year", "prosla godina", "godine"] },
  { key: "istiDanProsleGodine", keywords: ["same day last year", "isti dan", "sdly"] },
  { key: "naKnjigamaJuce", keywords: ["yesterday", "juce"] },
  { key: "naKnjigamaDanas", keywords: ["on the books today", "today", "danas"] },
  { key: "target", keywords: ["target"] },
];

const DATE_KEYWORDS = ["date", "datum"];

function normalize(header: string): string {
  return header
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip diacritics (š,č,ć,ž,đ...)
    .replace(/[._-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function matchRowKey(norm: string): RowKey | null {
  for (const rowDef of ROW_DEFS) {
    if (ROW_KEYWORDS[rowDef.key].some(kw => norm.includes(kw))) return rowDef.key;
  }
  return null;
}

function matchColumnKey(norm: string): ColumnKey | null {
  for (const { key, keywords } of COLUMN_KEYWORDS) {
    if (keywords.some(kw => norm.includes(kw))) return key;
  }
  return null;
}

function isDateHeader(norm: string): boolean {
  return DATE_KEYWORDS.some(kw => norm === kw || norm.includes(kw));
}

function excelSerialToISO(serial: number): string {
  // Excel's epoch is 1899-12-30 (accounting for its leap-year bug).
  const ms = Math.round((serial - 25569) * 86400 * 1000);
  return new Date(ms).toISOString().slice(0, 10);
}

function parseDateValue(value: unknown): string | null {
  if (value instanceof Date && !isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === "number" && value > 0) {
    return excelSerialToISO(value);
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    const dotted = trimmed.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})\.?$/);
    if (dotted) {
      const [, d, m, y] = dotted;
      const year = y.length === 2 ? `20${y}` : y;
      return `${year}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
    }
    const slashed = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
    if (slashed) {
      const [, mo, d, y] = slashed;
      const year = y.length === 2 ? `20${y}` : y;
      return `${year}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
    }
    const isoLike = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (isoLike) {
      const [, y, m, d] = isoLike;
      return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
    }
    const parsed = new Date(trimmed);
    if (!isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  }
  return null;
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

export async function parseReportFile(file: File): Promise<ParseReportResult> {
  const isCsv = file.name.toLowerCase().endsWith(".csv");
  const buffer = await file.arrayBuffer();

  let workbook: XLSX.WorkBook;
  try {
    if (isCsv) {
      const text = new TextDecoder("utf-8").decode(buffer);
      workbook = XLSX.read(text, { type: "string", cellDates: true });
    } else {
      workbook = XLSX.read(buffer, { type: "array", cellDates: true });
    }
  } catch {
    return { rows: [], unmatchedHeaders: [], matchedHeaders: [], defaultedColumnHeaders: [], error: "Ne mogu da pročitam fajl. Provjerite da je u .xlsx ili .csv formatu." };
  }

  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    return { rows: [], unmatchedHeaders: [], matchedHeaders: [], defaultedColumnHeaders: [], error: "Fajl ne sadrži nijedan list sa podacima." };
  }

  const sheet = workbook.Sheets[sheetName];
  const records = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
  if (records.length === 0) {
    return { rows: [], unmatchedHeaders: [], matchedHeaders: [], defaultedColumnHeaders: [], error: "Fajl ne sadrži nijedan red podataka." };
  }

  const headers = Object.keys(records[0]);
  let dateHeader: string | null = null;
  const headerMap: { header: string; rowKey: RowKey; colKey: ColumnKey; defaulted: boolean }[] = [];
  const unmatchedHeaders: string[] = [];

  for (const header of headers) {
    const norm = normalize(header);
    if (isDateHeader(norm)) {
      dateHeader = header;
      continue;
    }
    const rowKey = matchRowKey(norm);
    const colKey = matchColumnKey(norm);
    if (rowKey && colKey) {
      headerMap.push({ header, rowKey, colKey, defaulted: false });
    } else if (rowKey && !colKey) {
      headerMap.push({ header, rowKey, colKey: "naKnjigamaDanas", defaulted: true });
    } else if (!rowKey && colKey) {
      headerMap.push({ header, rowKey: "ukupanPrihod", colKey, defaulted: true });
    } else {
      unmatchedHeaders.push(header);
    }
  }

  if (!dateHeader) {
    return { rows: [], unmatchedHeaders, matchedHeaders: [], defaultedColumnHeaders: [], error: "Nije pronađena kolona za datum (Date/Datum) u fajlu." };
  }
  if (headerMap.length === 0) {
    return { rows: [], unmatchedHeaders, matchedHeaders: [], defaultedColumnHeaders: [], error: "Nije prepoznata nijedna kolona sa podacima o prihodu, noćenjima, ADR-u, popunjenosti ili RevPAR-u." };
  }

  const rows: ParsedReportRow[] = [];
  for (const record of records) {
    const dateISO = parseDateValue(record[dateHeader]);
    if (!dateISO) continue;

    const data = emptyEntryData();
    for (const { header, rowKey, colKey } of headerMap) {
      data[rowKey][colKey] = toNumber(record[header]);
    }

    rows.push({
      dateISO,
      dateLabel: new Date(`${dateISO}T00:00:00`).toLocaleDateString("sr-RS", { day: "numeric", month: "long", year: "numeric" }),
      data,
    });
  }

  rows.sort((a, b) => a.dateISO.localeCompare(b.dateISO));

  return {
    rows,
    unmatchedHeaders,
    matchedHeaders: headerMap.filter(m => !m.defaulted).map(m => m.header),
    defaultedColumnHeaders: headerMap.filter(m => m.defaulted).map(m => m.header),
    error: rows.length === 0 ? "Nijedan red nije sadržao prepoznatljiv datum." : null,
  };
}
