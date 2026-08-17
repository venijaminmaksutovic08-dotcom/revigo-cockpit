// Regression tests for the wide "Daily report" Excel parser. Run with: npm test
//
// These build real .xlsx workbooks in memory (via the same xlsx lib the app uses) and drive the
// real parseDailyReportExcel end-to-end, so a future change that re-breaks sheet/header/month
// detection fails here. Data is synthetic — no real hotel figures are committed — but the STRUCTURE
// mirrors the actual export: a two-row header (group row with Total/Same-Day Last Year and a decoy
// "Target", above a sub-header with Yesterday/Today/Pickup/the real Target), then 5 metric rows per
// month. Each column carries a distinct value so a mis-mapped column is caught, and August/September
// Room Nights are 1727/971 — the known-good figures from the real 27_07 file.
import { test } from "node:test";
import assert from "node:assert/strict";
import * as XLSX from "xlsx";
import { parseDailyReportExcel } from "./dailyReportExcelParse.ts";

const MONTHS_EN = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const MONTHS_SR = ["Januar","Februar","Mart","April","Maj","Jun","Jul","Avgust","Septembar","Oktobar","Novembar","Decembar"];

// Distinct per-column expected values so a column swap can't pass. Column roles:
// tLY=+2, sameDay=+3, yesterday=+5, today=+6, pickup=+7, target=+8 (relative to a per-metric base).
const RN_BASE = (m: number) => m * 1000;
const REV_BASE = (m: number) => m * 1_000_000;
const expToday = (m: number) => (m === 8 ? 1727 : m === 9 ? 971 : RN_BASE(m) + 6);

// One metric row: [colA, label, tLY, sameDay, monthOpening, yesterday, today, pickup, target, …delta…]
function metricRow(colA: string, label: string, base: number, today: number, occDecimal = false): unknown[] {
  const v = (off: number) => (occDecimal ? 0.5 : base + off);
  return [
    colA, label,
    v(2), v(3), "",           // tLY, sameDay, Month Opening (blank)
    v(5), today, v(7), v(8),  // yesterday, today, pickup, target
    -1, -2, 0.99,             // Today vs Target, Today vs Last year, Achivments (decoys)
  ];
}

// The full base "Daily report" sheet: title, two-row header, then 12 month blocks (5 metric rows +
// spacer each). The group row's col-7 "Target" is a DECOY for a different column than the real
// Target in the sub-header's col 8.
function baseAOA(): unknown[][] {
  const rows: unknown[][] = [];
  rows.push(["", "Queen synthetic"]);
  const group: unknown[] = []; group[2] = "Total Last Year"; group[3] = "Same Day Last Year"; group[4] = "On the Books"; group[7] = "Target";
  rows.push(group);
  rows.push(["", "", "", "", "Month Opening", "Yesterday", "Today", "Pickup", "Target", "Today vs Target", "Today vs Last year", "Achivments"]);
  for (let m = 1; m <= 12; m++) {
    rows.push(metricRow(MONTHS_EN[m - 1], "Room Nights", RN_BASE(m), expToday(m)));
    rows.push(metricRow("", "Total Revenue", REV_BASE(m), REV_BASE(m) + 6));
    rows.push(metricRow("", "ADR", m * 100, m * 100 + 6));
    rows.push(metricRow("", "% Occ.", 0, 0.5, true));
    rows.push(metricRow("", "RevPAR", m * 10, m * 10 + 6));
    rows.push([]); // spacer
  }
  return rows;
}

function xlsxFile(sheets: Record<string, unknown[][]>, filename: string): File {
  const wb = XLSX.utils.book_new();
  for (const [name, aoa] of Object.entries(sheets)) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), name);
  }
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as BlobPart;
  return new File([buf], filename);
}

// The parser logs a verification line per month; silence it so test output stays readable.
async function parse(file: File) {
  const orig = console.log;
  console.log = () => {};
  try {
    return await parseDailyReportExcel(file);
  } finally {
    console.log = orig;
  }
}

// Asserts the full column map for every month resolved to the right cells.
function assertAllMonths(months: Awaited<ReturnType<typeof parseDailyReportExcel>>["months"]) {
  assert.equal(months.length, 12, "should parse all 12 months");
  for (let m = 1; m <= 12; m++) {
    const mm = months.find(x => x.monthNumber === m);
    assert.ok(mm, `month ${m} present`);
    const rn = mm!.roomNights;
    assert.equal(rn.today, expToday(m), `M${m} RoomNights.today`);
    assert.equal(rn.yesterday, RN_BASE(m) + 5, `M${m} RoomNights.yesterday`);
    assert.equal(rn.target, RN_BASE(m) + 8, `M${m} RoomNights.target`);
    assert.equal(rn.pickup, RN_BASE(m) + 7, `M${m} RoomNights.pickup`);
    assert.equal(rn.totalLastYear, RN_BASE(m) + 2, `M${m} RoomNights.totalLastYear`);
    assert.equal(rn.sameDayLastYear, RN_BASE(m) + 3, `M${m} RoomNights.sameDayLastYear`);
    assert.equal(mm!.revenue.today, REV_BASE(m) + 6, `M${m} Revenue.today`);
    assert.equal(mm!.occupancy.today, 0.5, `M${m} Occupancy.today (raw decimal)`);
  }
  // The two figures the brother's real 27_07 file is known to contain.
  assert.equal(months.find(x => x.monthNumber === 8)!.roomNights.today, 1727, "August = 1727");
  assert.equal(months.find(x => x.monthNumber === 9)!.roomNights.today, 971, "September = 971");
}

test("English layout (known-good 27_07 shape) parses all months with correct column mapping", async () => {
  const res = await parse(xlsxFile({ "Daily report": baseAOA() }, "Queen Daily report 27_07.xlsx"));
  assert.equal(res.error, null);
  assert.equal(res.sheetFound, true);
  assertAllMonths(res.months);
});

test("Serbian-relabelled headers + Serbian month names + renamed sheet still parse identically", async () => {
  const relabels: Record<string, string> = {
    "Total Last Year": "Prošla godina",
    "Same Day Last Year": "Isti dan prošle godine",
    "On the Books": "Na knjigama",
    "Month Opening": "Otvaranje meseca",
    "Yesterday": "Juče",
    "Today": "Danas",
    "Today vs Target": "Danas vs Target",
    "Today vs Last year": "Danas vs prošle godine",
    "Room Nights": "Broj noćenja",
    "Total Revenue": "Ukupan prihod",
  };
  const monthMap: Record<string, string> = Object.fromEntries(MONTHS_EN.map((en, i) => [en, MONTHS_SR[i]]));
  const srAOA = baseAOA().map(row => row.map(cell => {
    const s = String(cell).trim();
    return relabels[s] ?? monthMap[s] ?? cell;
  }));
  // Note: sheet is NOT named "daily" — detection must fall back to structure, not name.
  const res = await parse(xlsxFile({ "Dnevni izveštaj": srAOA }, "Kraljica dnevni izvestaj 27_07.xlsx"));
  assert.equal(res.error, null);
  assert.equal(res.sheetFound, true);
  assertAllMonths(res.months);
});

test("Column-shifted layout (leading blank column) re-derives the map and still parses", async () => {
  const shifted = baseAOA().map(row => ["", ...row]);
  const res = await parse(xlsxFile({ "Daily report": shifted }, "Queen Daily report 27_07.xlsx"));
  assert.equal(res.error, null);
  assert.equal(res.sheetFound, true);
  assertAllMonths(res.months);
});

test("Unrecognized file yields sheetFound=true and a specific error naming labels and sheets", async () => {
  const res = await parse(xlsxFile(
    { "Sheet1": [["hello", "world"], ["a", "b", "c"]], "Notes": [["nothing here"]] },
    "random.xlsx",
  ));
  assert.equal(res.sheetFound, true, "it IS meant to be this format, so surface the error");
  assert.equal(res.months.length, 0);
  assert.ok(res.error, "error present");
  assert.equal(res.errorKind, undefined, "an unrelated file must not be misclassified as wrong_report_type");
  // Names exactly what it searched for, in both languages…
  assert.match(res.error!, /Yesterday\/Juče/);
  assert.match(res.error!, /Today\/Danas/);
  // …and which sheets it looked in.
  assert.match(res.error!, /Sheet1/);
  assert.match(res.error!, /Notes/);
});

test("Ordinary missing-columns failure (normal sheet name) still returns the existing generic error, unchanged", async () => {
  const res = await parse(xlsxFile(
    { "Daily report": [["", "Queen synthetic"], ["", "", "", "", "", "", "", "Target"], ["January", "Room Nights", "100"]] },
    "Queen Daily report 27_07.xlsx",
  ));
  assert.equal(res.sheetFound, true);
  assert.equal(res.months.length, 0);
  assert.ok(res.error);
  assert.equal(res.errorKind, undefined, "an ordinary parse failure must not be misclassified as wrong_report_type");
  assert.match(res.error!, /Nije prepoznat list sa dnevnim izveštajem/);
});

// Row-3 field names from the real "Logo A3" print export ProSoft/Access generates — the wrong file
// the brother's two failed uploads turned out to be, not the Daily report workbook this app needs.
function accessRow3(): unknown[] {
  return ["Datum", "strana", "OD_DTM", "Text432", "KontIdSoba", "DO_DTM", "Text434", "LUKP"];
}

test("A single-sheet 'Logo A3' Access export is detected as wrong_report_type, not the generic error", async () => {
  const rows: unknown[][] = [
    ["", "Apart hotel & SPA Queen of Zlatibor"],
    [],
    accessRow3(),
    ["", "", "", "", "", "", "", "", "", "", "", "", "", "", "CLS", "95.00", "54"],
  ];
  const res = await parse(xlsxFile({ "Logo A3": rows }, "13.08.26.xlsx"));
  assert.equal(res.months.length, 0);
  assert.equal(res.errorKind, "wrong_report_type");
  assert.ok(res.error);
  assert.match(res.error!, /ProSofta/);
  assert.match(res.error!, /Logo A3/);
  assert.match(res.error!, /Daily report, Day by day, Day By Day Input/);
  assert.match(res.error!, /Google Sheet/);
});

test("A strong wrong-file-type signal never overrides a file that actually has valid Daily report columns", async () => {
  // Can't literally round-trip a custom workbook Props.Application via this xlsx library (its
  // writer hardcodes Application="SheetJS" on every write — see write_ext_props in xlsx.js), so this
  // exercises the sheet-NAME signal instead, which is the strongest of the three checks. The
  // guarantee is identical for all three: they only run inside parseDailyReportExcel's
  // `if (!raw || !cols)` branch, so a file that resolves real Yesterday/Today/Target columns can
  // never reach any of them, regardless of its sheet name, Application property, or row-3 content.
  const res = await parse(xlsxFile({ "Logo A3": baseAOA() }, "Queen Daily report 27_07.xlsx"));
  assert.equal(res.error, null);
  assert.equal(res.errorKind, undefined);
  assertAllMonths(res.months);
});
