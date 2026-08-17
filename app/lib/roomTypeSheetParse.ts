import * as XLSX from "xlsx";

// Pure parser for the per-room-type breakdown carried on two sheets alongside the aggregate
// "Daily report" sheet (see dailyReportExcelParse.ts, which this module is deliberately independent
// of — no shared code, no dependency on HotelContext/React, so it can be unit-tested in plain Node;
// see roomTypeSheetParse.test.ts). Everything below was verified against 5 real archived exports —
// see the archive diagnostics from this session.
//
// Layout (identical in every file checked, sheet names byte-for-byte, row positions fixed):
//   "Day by day"        block1 rows 4-7   (cumulative "today" on-books, one row per room type)
//                        block2 rows 16-19 (pickup DELTA since the previous export — see below)
//   "Day By Day Input"  block1 rows 3-6   ("Juce"/Yesterday — actually the previous EXPORT's
//                                          snapshot, not literally yesterday, see below)
// Room types are fixed-position codes in column A, always in this order: CLS, DPLX, KING, SUP.
// Column B = room inventory count for that type ("UKP"). Columns C..AG = S01..S31, one column per
// day-of-month, the room-nights on the books for that type on that day. Column AH (S_ZBR) = that
// type's capacity in room-nights (inventory × days-in-month) — used only for the days-in-month
// guard below, never written to the DB.
//
// IMPORTANT — the "Juce" (Yesterday) block is not literally yesterday. Verified: the "Danas"
// (Today) block's total in one file equals the "Juce" block's total in the NEXT archived file,
// even when those files are several days apart (a gap where no file was uploaded in between). So
// "Juce" is the state as of the PREVIOUS ProSoft export run, not calendar-yesterday — pickup here
// is change-since-last-export over a variable number of days, not a strict daily delta. Callers
// must not assume prev_report_date = report_date - 1 day.
//
// IMPORTANT — there is no month/year label anywhere on either sheet. The stay month is inferred as
// month(reportDate) (same rule importOnBooksMonths already uses), which callers must supply.

export const ROOM_TYPE_CODES = ["CLS", "DPLX", "KING", "SUP"] as const;
export type RoomTypeCode = (typeof ROOM_TYPE_CODES)[number];

const SHEET_DAY_BY_DAY = "Day by day";
const SHEET_DAY_BY_DAY_INPUT = "Day By Day Input";

const CUMULATIVE_START_ROW = 4;  // "Day by day", rows 4-7
const DELTA_START_ROW = 16;      // "Day by day", rows 16-19
const JUCE_START_ROW = 3;        // "Day By Day Input", rows 3-6

const COL_ROOM_TYPE = 0;   // A
const COL_INVENTORY = 1;   // B (UKP)
const COL_DAY_START = 2;   // C (S01)
const DAYS_PER_BLOCK = 31; // C..AG = S01..S31
const COL_CAPACITY = 33;   // AH (S_ZBR)

export interface RoomTypeDayRow {
  roomType: RoomTypeCode;
  dayIndex: number; // 1-31, calendar day of the inferred stay month
  roomsInventory: number;
  // null = the cell was genuinely blank in the file (KING has real gaps) — never coerced to 0, a
  // real 0 is only ever written when the cell actually contained 0.
  roomNights: number | null;       // "Day by day" cumulative block (today, as of this export)
  roomNightsPrev: number | null;   // "Day By Day Input" Juce block (as of the PREVIOUS export)
  pickupRoomNights: number | null; // "Day by day" delta block (change since previous export)
}

export interface RoomTypeSheetParseResult {
  rows: RoomTypeDayRow[];
  // Implied days-in-month from AH/colB, for whichever room type resolved it first — informational,
  // the actual guard result is stayMonthSuspect.
  daysInMonthImplied: number | null;
  // Set when AH/colB disagrees with the real number of days in the inferred stay month for ANY
  // room type — the inferred month is probably wrong, but the import still proceeds (flagged, not
  // refused) since nothing else can determine the real stay month from this sheet.
  stayMonthSuspect: boolean;
  // Non-null only for a total failure (missing sheet, wrong room-type label at a verified
  // position) — rows is empty in that case. Never thrown; the caller decides how to surface it.
  error: string | null;
}

// Cells here are read as formatted TEXT (see readAoa's raw:false) so a numeric cell can come
// through as e.g. "2,563 " (thousands-separator comma + trailing space) rather than a plain
// number — naive Number() on that is NaN. Strip commas/whitespace first. A genuinely blank cell
// stays null; "0" parses to a real 0 — these are never conflated.
function parseRoomTypeNumber(value: unknown): number | null {
  if (value === "" || value === null || value === undefined) return null;
  const stripped = String(value).replace(/[,\s]/g, "");
  if (stripped === "") return null;
  const n = Number(stripped);
  return Number.isNaN(n) ? null : n;
}

function readAoa(workbook: XLSX.WorkBook, sheetName: string): unknown[][] {
  return XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName], { header: 1, defval: "", raw: false });
}

function verifyRoomTypeLabel(sheet: string, row1: number, cellValue: unknown, expected: RoomTypeCode): string | null {
  const actual = String(cellValue ?? "").trim().toUpperCase();
  if (actual === expected) return null;
  return (
    `Neočekivana oznaka tipa sobe u listu "${sheet}", red ${row1}: ` +
    `očekivano "${expected}", pronađeno "${actual || "(prazno)"}".`
  );
}

interface RoomTypeBlockRow {
  roomType: RoomTypeCode;
  roomsInventory: number | null;
  dayValues: (number | null)[]; // 31 entries, index 0 = day 1 (S01)
  capacityRoomNights: number | null; // AH — only meaningful on the cumulative block
}

// Reads the 4 fixed room-type rows starting at startRow1 (1-indexed), verifying each row's column-A
// label matches the expected code at that position — aborts (does not silently shift rows) the
// moment one doesn't match, per the caller's requirement to never guess past a layout drift.
function readBlock(aoa: unknown[][], sheet: string, startRow1: number): { rows: RoomTypeBlockRow[]; error: string | null } {
  const rows: RoomTypeBlockRow[] = [];
  for (let i = 0; i < ROOM_TYPE_CODES.length; i++) {
    const expected = ROOM_TYPE_CODES[i];
    const row1 = startRow1 + i;
    const row = aoa[row1 - 1] ?? [];

    const labelError = verifyRoomTypeLabel(sheet, row1, row[COL_ROOM_TYPE], expected);
    if (labelError) return { rows: [], error: labelError };

    const dayValues: (number | null)[] = [];
    for (let d = 0; d < DAYS_PER_BLOCK; d++) dayValues.push(parseRoomTypeNumber(row[COL_DAY_START + d]));

    rows.push({
      roomType: expected,
      roomsInventory: parseRoomTypeNumber(row[COL_INVENTORY]),
      dayValues,
      capacityRoomNights: parseRoomTypeNumber(row[COL_CAPACITY]),
    });
  }
  return { rows, error: null };
}

function dateParts(iso: string): { year: number; month: number } {
  return { year: Number(iso.slice(0, 4)), month: Number(iso.slice(5, 7)) };
}

export async function parseRoomTypeSheets(file: File, reportDateISO: string): Promise<RoomTypeSheetParseResult> {
  const fail = (error: string): RoomTypeSheetParseResult => ({ rows: [], daysInMonthImplied: null, stayMonthSuspect: false, error });

  let workbook: XLSX.WorkBook;
  try {
    const buffer = await file.arrayBuffer();
    workbook = XLSX.read(buffer, { type: "array" });
  } catch {
    return fail("Pogrešan format fajla. Očekuje se .xlsx");
  }

  for (const sheet of [SHEET_DAY_BY_DAY, SHEET_DAY_BY_DAY_INPUT]) {
    if (!workbook.SheetNames.includes(sheet)) {
      return fail(`Nedostaje list "${sheet}" — parsiranje po tipu sobe nije moguće.`);
    }
  }

  const dayByDayAoa = readAoa(workbook, SHEET_DAY_BY_DAY);
  const dayByDayInputAoa = readAoa(workbook, SHEET_DAY_BY_DAY_INPUT);

  const cumulative = readBlock(dayByDayAoa, SHEET_DAY_BY_DAY, CUMULATIVE_START_ROW);
  if (cumulative.error) return fail(cumulative.error);
  const delta = readBlock(dayByDayAoa, SHEET_DAY_BY_DAY, DELTA_START_ROW);
  if (delta.error) return fail(delta.error);
  const juce = readBlock(dayByDayInputAoa, SHEET_DAY_BY_DAY_INPUT, JUCE_START_ROW);
  if (juce.error) return fail(juce.error);

  // Days-in-month guard: there's no month/year label on this sheet at all, so the stay month is
  // always just inferred as month(reportDate) — this only checks whether that inference is
  // plausible (AH/colB should equal the real days-in-month for that inferred month), not whether
  // it's actually correct. Flags, never refuses — nothing on this sheet could tell us the real
  // month if the inference is wrong.
  const { year: stayYear, month: stayMonth } = dateParts(reportDateISO);
  const realDaysInMonth = new Date(stayYear, stayMonth, 0).getDate();
  let daysInMonthImplied: number | null = null;
  let stayMonthSuspect = false;
  for (const r of cumulative.rows) {
    if (r.roomsInventory && r.capacityRoomNights !== null) {
      const implied = r.capacityRoomNights / r.roomsInventory;
      if (daysInMonthImplied === null) daysInMonthImplied = implied;
      if (implied !== realDaysInMonth) {
        stayMonthSuspect = true;
        console.error(
          `roomTypeSheetParse: days-in-month mismatch for ${r.roomType} on ${reportDateISO} — ` +
          `AH/colB implies ${implied} days, but month ${stayMonth}/${stayYear} has ${realDaysInMonth}. ` +
          `Flagging stay_month_suspect; the inferred stay month may be wrong.`
        );
      }
    }
  }

  const rows: RoomTypeDayRow[] = [];
  for (let i = 0; i < ROOM_TYPE_CODES.length; i++) {
    const roomType = ROOM_TYPE_CODES[i];
    const cumRow = cumulative.rows[i];
    const deltaRow = delta.rows[i];
    const juceRow = juce.rows[i];
    for (let d = 0; d < DAYS_PER_BLOCK; d++) {
      const dayIndex = d + 1;
      if (dayIndex > realDaysInMonth) continue; // no such calendar day in a shorter month
      rows.push({
        roomType,
        dayIndex,
        roomsInventory: cumRow.roomsInventory ?? 0,
        roomNights: cumRow.dayValues[d],
        roomNightsPrev: juceRow.dayValues[d],
        pickupRoomNights: deltaRow.dayValues[d],
      });
    }
  }

  return { rows, daysInMonthImplied, stayMonthSuspect, error: null };
}
