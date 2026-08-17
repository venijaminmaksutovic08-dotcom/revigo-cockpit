// Regression tests for the per-room-type sheet parser. Run with: npm test
//
// Builds real .xlsx workbooks in memory (via the same xlsx lib the app uses), same style as
// dailyReportExcelParse.test.ts. Data is synthetic.
import { test } from "node:test";
import assert from "node:assert/strict";
import * as XLSX from "xlsx";
import { parseRoomTypeSheets, ROOM_TYPE_CODES } from "./roomTypeSheetParse.ts";

const SHEET_DAY_BY_DAY = "Day by day";
const SHEET_DAY_BY_DAY_INPUT = "Day By Day Input";

// One room-type row: [code, inventory, day1..day31, capacity(AH), sum(AI), pct(AJ)]. `days` may
// contain null for a genuinely blank cell (never coerced to 0) — matches KING's real gaps.
function roomTypeRow(code: string, inventory: number, days: (number | null)[], capacityOverride?: number): unknown[] {
  const sum = days.reduce((a: number, d) => a + (typeof d === "number" ? d : 0), 0);
  const capacity = capacityOverride ?? inventory * 31;
  return [
    code, String(inventory),
    ...days.map(d => (d === null ? "" : String(d))),
    String(capacity), String(sum), capacity ? String((sum / capacity) * 100) : "0",
  ];
}

function defaultDays(base: number): number[] {
  return Array.from({ length: 31 }, (_, i) => base + i);
}

interface Overrides {
  cumulative?: (rows: unknown[][]) => void;
  delta?: (rows: unknown[][]) => void;
  juce?: (rows: unknown[][]) => void;
  omitSheet?: string;
}

function buildWorkbook(opts: Overrides = {}): File {
  const cumulative = [
    roomTypeRow("CLS", 95, defaultDays(50)),
    roomTypeRow("DPLX", 19, defaultDays(10)),
    roomTypeRow("KING", 5, defaultDays(2)),
    roomTypeRow("SUP", 31, defaultDays(20)),
  ];
  const delta = [
    roomTypeRow("CLS", 95, defaultDays(1)),
    roomTypeRow("DPLX", 19, defaultDays(0)),
    roomTypeRow("KING", 5, defaultDays(0)),
    roomTypeRow("SUP", 31, defaultDays(1)),
  ];
  const juce = [
    roomTypeRow("CLS", 95, defaultDays(49)),
    roomTypeRow("DPLX", 19, defaultDays(10)),
    roomTypeRow("KING", 5, defaultDays(2)),
    roomTypeRow("SUP", 31, defaultDays(19)),
  ];
  opts.cumulative?.(cumulative);
  opts.delta?.(delta);
  opts.juce?.(juce);

  // A truly empty array ([]) creates no cell refs, so aoa_to_sheet/sheet_to_json compact those rows
  // out and every later row shifts up — nothing like how a real exported file's blank rows behave.
  // A row with one blank-string cell still counts as "present", which keeps row indices stable.
  const dayByDayAoa: unknown[][] = [];
  for (let i = 0; i < 20; i++) dayByDayAoa.push([""]);
  dayByDayAoa[3] = cumulative[0]; dayByDayAoa[4] = cumulative[1]; dayByDayAoa[5] = cumulative[2]; dayByDayAoa[6] = cumulative[3];
  dayByDayAoa[15] = delta[0]; dayByDayAoa[16] = delta[1]; dayByDayAoa[17] = delta[2]; dayByDayAoa[18] = delta[3];

  const dayByDayInputAoa: unknown[][] = [];
  for (let i = 0; i < 10; i++) dayByDayInputAoa.push([""]);
  dayByDayInputAoa[2] = juce[0]; dayByDayInputAoa[3] = juce[1]; dayByDayInputAoa[4] = juce[2]; dayByDayInputAoa[5] = juce[3];

  const wb = XLSX.utils.book_new();
  if (opts.omitSheet !== SHEET_DAY_BY_DAY) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(dayByDayAoa), SHEET_DAY_BY_DAY);
  }
  if (opts.omitSheet !== SHEET_DAY_BY_DAY_INPUT) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(dayByDayInputAoa), SHEET_DAY_BY_DAY_INPUT);
  }
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as BlobPart;
  return new File([buf], "test.xlsx");
}

test("parses a well-formed file: 4 room types x 31 days = 124 rows, all room types present", async () => {
  const file = buildWorkbook();
  const result = await parseRoomTypeSheets(file, "2026-08-13");
  assert.equal(result.error, null);
  assert.equal(result.rows.length, 124);
  for (const code of ROOM_TYPE_CODES) {
    assert.equal(result.rows.filter(r => r.roomType === code).length, 31, `${code} should have 31 day rows`);
  }
});

test("blank cells for KING stay null, never coerced to 0", async () => {
  const file = buildWorkbook({
    cumulative: rows => {
      const kingDays = defaultDays(2) as (number | null)[];
      kingDays[0] = null;  // S01 genuinely blank
      kingDays[1] = 0;     // S02 genuinely zero
      rows[2] = roomTypeRow("KING", 5, kingDays);
    },
  });
  const result = await parseRoomTypeSheets(file, "2026-08-13");
  assert.equal(result.error, null);
  const king = result.rows.filter(r => r.roomType === "KING");
  const day1 = king.find(r => r.dayIndex === 1)!;
  const day2 = king.find(r => r.dayIndex === 2)!;
  assert.equal(day1.roomNights, null, "blank cell must stay null, not become 0");
  assert.equal(day2.roomNights, 0, "an actual 0 in the file must be written as 0, not null");
});

test("comma-and-trailing-space formatted numbers parse correctly", async () => {
  const file = buildWorkbook({
    cumulative: rows => {
      const clsDays = defaultDays(50) as (number | null)[];
      rows[0] = roomTypeRow("CLS", 95, clsDays);
      // Overwrite the day-3 cell directly with a comma-formatted, space-padded string, the exact
      // shape seen in the real aggregate sheet's "Today" cells.
      (rows[0] as unknown[])[2 + 2] = "2,563 ";
    },
  });
  const result = await parseRoomTypeSheets(file, "2026-08-13");
  assert.equal(result.error, null);
  const cls = result.rows.filter(r => r.roomType === "CLS");
  const day3 = cls.find(r => r.dayIndex === 3)!;
  assert.equal(day3.roomNights, 2563, "comma + trailing space must be stripped before Number()");
});

test("a wrong room-type label at a verified position aborts cleanly with a specific error", async () => {
  const file = buildWorkbook({
    cumulative: rows => {
      rows[1] = roomTypeRow("XXXX", 19, defaultDays(10)); // should be DPLX at row 5
    },
  });
  const result = await parseRoomTypeSheets(file, "2026-08-13");
  assert.equal(result.rows.length, 0);
  assert.ok(result.error, "should abort with a non-null error");
  assert.match(result.error!, /red 5/, "error should name the row");
  assert.match(result.error!, /DPLX/, "error should name the expected code");
  assert.match(result.error!, /XXXX/, "error should name what it actually found");
});

test("a missing sheet produces a clear, specific error instead of crashing", async () => {
  const file = buildWorkbook({ omitSheet: SHEET_DAY_BY_DAY_INPUT });
  const result = await parseRoomTypeSheets(file, "2026-08-13");
  assert.equal(result.rows.length, 0);
  assert.ok(result.error);
  assert.match(result.error!, /Day By Day Input/);
});

test("days-in-month guard flags stay_month_suspect when AH/colB disagrees with the inferred month", async () => {
  // 2026-02 has 28 days (2026 is not a leap year), but every room type's AH/colB here still
  // implies 31 (inventory * 31, the default capacityOverride) — a real mismatch.
  const file = buildWorkbook();
  const result = await parseRoomTypeSheets(file, "2026-02-15");
  assert.equal(result.error, null);
  assert.equal(result.stayMonthSuspect, true);
  assert.equal(result.daysInMonthImplied, 31);
  // Only 28 calendar days exist in February — day 29/30/31 must not be fabricated.
  assert.equal(result.rows.filter(r => r.roomType === "CLS").length, 28);
});

test("days-in-month guard stays false when AH/colB agrees with the inferred month", async () => {
  const file = buildWorkbook(); // capacity = inventory * 31, matches August's 31 days
  const result = await parseRoomTypeSheets(file, "2026-08-13");
  assert.equal(result.stayMonthSuspect, false);
  assert.equal(result.daysInMonthImplied, 31);
});

test("pickup_room_nights and room_nights_prev are read from their own distinct blocks", async () => {
  const file = buildWorkbook();
  const result = await parseRoomTypeSheets(file, "2026-08-13");
  const cls = result.rows.filter(r => r.roomType === "CLS");
  const day1 = cls.find(r => r.dayIndex === 1)!;
  // cumulative day1 = 50, juce day1 = 49, delta day1 = 1 — three independently-sourced values.
  assert.equal(day1.roomNights, 50);
  assert.equal(day1.roomNightsPrev, 49);
  assert.equal(day1.pickupRoomNights, 1);
});
