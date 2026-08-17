// Per-room-type layer on top of the hotel-wide price recommendation (see priceRecommendation.ts).
// Pure functions only — no data fetching, no React — same discipline as priceRecommendation.ts, so
// this can be unit-tested in plain Node (see roomTypeRecommendation.test.ts).
//
// Deliberately generic: this app is meant to run many hotels, each with its own room types,
// inventory, and price structure. Nothing here assumes a fixed number of room types or particular
// type codes — every function operates on whatever rows the caller passes in, sourced from
// room_type_daily_onbooks for that hotel. The only hotel this has real data for today (Queen of
// Zlatibor, codes CLS/DPLX/KING/SUP) is not referenced anywhere in this file; see
// roomTypeRecommendation.test.ts for a fixture using entirely different codes.

import type { Verdict } from "./priceRecommendation";

export const ROOM_TYPE_RECOMMENDATION_CONFIG = {
  // How many rooms a type's actual room-nights must deviate from "what it would have if it tracked
  // the hotel's own occupancy rate exactly" before its verdict moves one notch off the hotel-wide
  // base. A FIXED room count (not a percentage) is what makes this inventory-aware on its own: the
  // same absolute deviation is a much bigger relative swing for a small-inventory type than a large
  // one, so small types naturally need more real demand before they move, and large types respond
  // to smaller relative changes — with no per-hotel tuning needed. Tune this one number after
  // seeing real output; nothing else in this file encodes the threshold.
  deviationThresholdRooms: 3,
  // Nudge magnitude (%) applied ONLY when a notch has moved a type's verdict away from the base —
  // see resolveTypeNudgePercent. The base's own nudge% can be small and same-signed as the base
  // verdict (e.g. HOLD at +2%, just under the RAISE threshold); reusing it as-is for a type that
  // notched the OPPOSITE way (say, down to LOWER) would move that type's price in the wrong
  // direction relative to its own label. This fixed, correctly-signed magnitude is used instead
  // whenever the type's verdict differs from the base.
  notchOverrideNudgePercent: 4,
} as const;

export type NotchDirection = "hotter" | "colder" | "within-threshold";

export interface RoomTypeOnBooksRow {
  roomType: string;
  // null = the cell was never entered for this stay date — never coerced to 0, which would read as
  // "zero rooms booked" instead of "we don't know."
  roomNights: number | null;
  roomsInventory: number;
  // Change since the PREVIOUS export, not a per-day figure — see normalizePickupPerDay, which is
  // the only thing allowed to turn this into a rate.
  pickupRoomNights: number | null;
  reportDate: string;
  prevReportDate: string | null;
}

export interface HotelOccupancyForDate {
  occPct: number | null;
  totalRoomNights: number;
  totalInventory: number;
  typesUsed: number;
}

// Sums only the types that actually have a room_nights reading for this stay date. A type with no
// reading is excluded from BOTH the numerator and its own inventory in the denominator — including
// its inventory while treating its nights as 0 would silently deflate the hotel's real occupancy
// with rooms nobody has actually reported on yet.
export function computeHotelOccupancyForDate(rows: RoomTypeOnBooksRow[]): HotelOccupancyForDate {
  const usable = rows.filter(r => r.roomNights !== null && r.roomsInventory > 0);
  if (usable.length === 0) return { occPct: null, totalRoomNights: 0, totalInventory: 0, typesUsed: 0 };
  const totalRoomNights = usable.reduce((sum, r) => sum + (r.roomNights as number), 0);
  const totalInventory = usable.reduce((sum, r) => sum + r.roomsInventory, 0);
  return {
    occPct: totalInventory > 0 ? (totalRoomNights / totalInventory) * 100 : null,
    totalRoomNights,
    totalInventory,
    typesUsed: usable.length,
  };
}

export function computeTypeOccupancyPct(row: RoomTypeOnBooksRow): number | null {
  if (row.roomNights === null || row.roomsInventory <= 0) return null;
  return (row.roomNights / row.roomsInventory) * 100;
}

// How many rooms this type's actual on-books figure deviates from "what it would have if this type
// alone tracked the hotel's overall occupancy rate exactly." Expressed in rooms (not percentage
// points) so the fixed threshold above is meaningful at any inventory size — see module comment.
export function computeDeviationRooms(row: RoomTypeOnBooksRow, hotelOccPct: number | null): number | null {
  if (row.roomNights === null || hotelOccPct === null) return null;
  const expectedRoomNights = (hotelOccPct / 100) * row.roomsInventory;
  return row.roomNights - expectedRoomNights;
}

export function classifyDeviation(deviationRooms: number | null): NotchDirection | null {
  if (deviationRooms === null) return null;
  const threshold = ROOM_TYPE_RECOMMENDATION_CONFIG.deviationThresholdRooms;
  if (deviationRooms >= threshold) return "hotter";
  if (deviationRooms <= -threshold) return "colder";
  return "within-threshold";
}

const VERDICT_ORDER: Record<Verdict, number> = { LOWER: -1, HOLD: 0, RAISE: 1 };
const ORDER_TO_VERDICT: Verdict[] = ["LOWER", "HOLD", "RAISE"]; // index = order + 1

// ONE notch only, in either direction — a type can never move more than one step away from the
// hotel-wide base verdict, however extreme its own deviation is.
export function applyNotch(baseVerdict: Verdict, direction: NotchDirection | null): Verdict {
  if (direction === null || direction === "within-threshold") return baseVerdict;
  const base = VERDICT_ORDER[baseVerdict];
  const delta = direction === "hotter" ? 1 : -1;
  const clamped = Math.max(-1, Math.min(1, base + delta));
  return ORDER_TO_VERDICT[clamped + 1];
}

// The base recommendation's nudge% is only ever sign-consistent with the BASE verdict (RAISE ⇒
// positive, LOWER ⇒ negative, HOLD ⇒ irrelevant since suggestedPrice short-circuits on HOLD anyway).
// A per-type verdict that a notch has moved AWAY from the base can't safely reuse that raw number —
// e.g. a HOLD base sitting at +2% (just under the RAISE threshold) notched DOWN to LOWER would, if
// given that same +2%, produce a HIGHER suggested price under a "LOWER" label. So: when the type's
// verdict still equals the base's, its price uses the base's own nudge (already correctly signed).
// When a notch has actually changed it, price uses the fixed, correctly-signed override magnitude
// instead — never the base's number with the wrong sign attached.
export function resolveTypeNudgePercent(baseVerdict: Verdict, baseNudgePercent: number, typeVerdict: Verdict): number {
  if (typeVerdict === baseVerdict) return baseNudgePercent;
  if (typeVerdict === "HOLD") return 0;
  const magnitude = ROOM_TYPE_RECOMMENDATION_CONFIG.notchOverrideNudgePercent;
  return typeVerdict === "RAISE" ? magnitude : -magnitude;
}

function daysBetween(fromISO: string, toISO: string): number {
  const from = new Date(`${fromISO}T00:00:00Z`).getTime();
  const to = new Date(`${toISO}T00:00:00Z`).getTime();
  return Math.round((to - from) / 86_400_000);
}

// pickup_room_nights is the change since the PREVIOUS export, over however many days actually
// elapsed — never assume it's a daily figure. Returns rooms/day, or null when it can't be
// meaningfully normalized: no previous export to diff against (prevReportDate null), or a
// zero/negative day span (same-day re-upload, bad data) where "per day" is undefined.
export function normalizePickupPerDay(
  row: Pick<RoomTypeOnBooksRow, "pickupRoomNights" | "reportDate" | "prevReportDate">,
): number | null {
  if (row.pickupRoomNights === null || row.prevReportDate === null) return null;
  const days = daysBetween(row.prevReportDate, row.reportDate);
  if (days <= 0) return null;
  return row.pickupRoomNights / days;
}

// Hotel-wide day-normalized pickup, for context alongside a type's own rate. Sums raw pickup across
// every type that has one, then divides by ONE shared elapsed-day span rather than averaging
// already-normalized per-type rates — every type's pickup comes from the same daily import, so they
// share the same (report_date, prev_report_date) pair by construction; this avoids a mix of
// differently-aged rows silently skewing the total if that assumption is ever violated.
export function computeHotelPickupPerDay(rows: RoomTypeOnBooksRow[]): number | null {
  const usable = rows.filter(r => r.pickupRoomNights !== null && r.prevReportDate !== null);
  if (usable.length === 0) return null;
  const totalPickup = usable.reduce((sum, r) => sum + (r.pickupRoomNights as number), 0);
  const days = daysBetween(usable[0].prevReportDate as string, usable[0].reportDate);
  if (days <= 0) return null;
  return totalPickup / days;
}

export interface RoomTypeAdjustmentResult {
  roomType: string;
  // false = no row for this stay date, or a row with no room_nights reading — the per-type verdict
  // falls back to the hotel-wide base untouched, and the UI must say plainly that data is missing
  // rather than silently showing the base as if it were a real per-type read.
  dataAvailable: boolean;
  occPct: number | null;
  deviationRooms: number | null;
  direction: NotchDirection | null;
  verdict: Verdict;
  pickupPerDay: number | null;
  hotelPickupPerDay: number | null;
}

// One notch of adjustment layered on top of the hotel-wide base verdict — never a replacement for
// it. Pickup is normalized and carried through for display/context (see normalizePickupPerDay) but
// does not independently move the verdict; the notch decision is driven solely by the occupancy
// deviation, which is the one mechanism this was specified against unambiguously.
export function computeRoomTypeAdjustment(
  row: RoomTypeOnBooksRow | null,
  hotelOccPct: number | null,
  hotelPickupPerDay: number | null,
  baseVerdict: Verdict,
): RoomTypeAdjustmentResult {
  if (row === null || row.roomNights === null) {
    return {
      roomType: row?.roomType ?? "",
      dataAvailable: false,
      occPct: null,
      deviationRooms: null,
      direction: null,
      verdict: baseVerdict,
      pickupPerDay: null,
      hotelPickupPerDay,
    };
  }
  const occPct = computeTypeOccupancyPct(row);
  const deviationRooms = computeDeviationRooms(row, hotelOccPct);
  const direction = classifyDeviation(deviationRooms);
  const verdict = applyNotch(baseVerdict, direction);
  return {
    roomType: row.roomType,
    dataAvailable: true,
    occPct,
    deviationRooms,
    direction,
    verdict,
    pickupPerDay: normalizePickupPerDay(row),
    hotelPickupPerDay,
  };
}

// Matches a fixed price-slot key/label (e.g. this app's existing RoomTypeKey — "cls", "superior")
// against whatever free-form room_type code the archive actually has for a hotel (e.g. "CLS",
// "SUP") — never a hardcoded per-code table. Real PMS room-type codes are near-universally an
// abbreviation of the full name (SUP for Superior, DLX for Deluxe, STD for Standard, …), so a
// case-insensitive exact-or-prefix match against both the slot's key and its label covers that
// convention generically, without knowing any specific hotel's codes in advance.
export function matchesArchiveRoomType(archiveRoomType: string, priceSlotKey: string, priceSlotLabel: string): boolean {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");
  const archive = norm(archiveRoomType);
  const key = norm(priceSlotKey);
  const label = norm(priceSlotLabel);
  if (!archive) return false;
  if (archive === key || archive === label) return true;
  if (label && (label.startsWith(archive) || archive.startsWith(label))) return true;
  if (key && (key.startsWith(archive) || archive.startsWith(key))) return true;
  return false;
}

export interface LadderInput {
  roomTypeKey: string;
  baselinePrice: number | null;
  suggestedPrice: number | null;
}

export interface LadderResult {
  roomTypeKey: string;
  finalPrice: number | null;
  clamped: boolean;
}

// Enforces the SAME relative price ordering the hotel's own configured baseline prices already
// imply — derived from those prices themselves (sorted ascending), never a hardcoded assumption
// about which type is cheapest. A single forward pass in baseline-ascending order: each subsequent
// suggested price is raised to at least the previous (already-processed) one whenever a per-type
// notch would otherwise have priced a baseline-cheaper type above a baseline-pricier one. Types with
// no baseline price at all can't be placed in the ladder and pass through unclamped.
export function enforcePriceLadder(inputs: LadderInput[]): LadderResult[] {
  const withBaseline = inputs.filter((i): i is LadderInput & { baselinePrice: number } => i.baselinePrice !== null);
  const withoutBaseline = inputs.filter(i => i.baselinePrice === null);
  const sorted = [...withBaseline].sort((a, b) => a.baselinePrice - b.baselinePrice);

  const results: LadderResult[] = [];
  let floor: number | null = null;
  for (const item of sorted) {
    if (item.suggestedPrice === null) {
      results.push({ roomTypeKey: item.roomTypeKey, finalPrice: null, clamped: false });
      continue;
    }
    let final = item.suggestedPrice;
    let clamped = false;
    if (floor !== null && final < floor) {
      final = floor;
      clamped = true;
    }
    results.push({ roomTypeKey: item.roomTypeKey, finalPrice: final, clamped });
    floor = final;
  }
  for (const item of withoutBaseline) {
    results.push({ roomTypeKey: item.roomTypeKey, finalPrice: item.suggestedPrice, clamped: false });
  }
  return results;
}
