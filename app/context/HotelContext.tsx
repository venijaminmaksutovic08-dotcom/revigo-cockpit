"use client";

import { createContext, useContext, useState, useEffect, useMemo, useCallback } from "react";
import { supabase, type DailyReportRow, type MonthlyTargetRow } from "../lib/supabaseClient";
import type { KPIData, KPIStatus } from "../data/hotelData";

export interface SavedHotel {
  id: string;
  name: string;
  rooms: number;
  city: string;
  currentPrice: number | null;
}

export interface NewHotelInput {
  name: string;
  rooms: number;
  city: string;
}

export type RowKey = "brojNocenja" | "ukupanPrihod" | "adr" | "popunjenost" | "revpar";
export type ColumnKey = "prosleGodine" | "istiDanProsleGodine" | "naKnjigamaJuce" | "naKnjigamaDanas" | "target";
export type DayStatus = "none" | "green" | "yellow" | "red";

export interface RowDef {
  key: RowKey;
  label: string;
  unit?: string;
  prefix?: string;
}

export interface ColumnDef {
  key: ColumnKey;
  label: string;
}

export const ROW_DEFS: RowDef[] = [
  { key: "brojNocenja", label: "Broj Noćenja" },
  { key: "ukupanPrihod", label: "Ukupan Prihod", prefix: "RSD " },
  { key: "adr", label: "ADR", prefix: "RSD " },
  { key: "popunjenost", label: "Popunjenost %", unit: "%" },
  { key: "revpar", label: "RevPAR", prefix: "RSD " },
];

export const COLUMN_DEFS: ColumnDef[] = [
  { key: "prosleGodine", label: "Prošla godina" },
  { key: "istiDanProsleGodine", label: "Isti dan prošle godine" },
  { key: "naKnjigamaJuce", label: "Na knjigama juče" },
  { key: "naKnjigamaDanas", label: "Na knjigama danas" },
  { key: "target", label: "Target" },
];

// Maps each daily_reports jsonb column to the period's column key.
const DB_COLUMN_BY_KEY: Record<ColumnKey, keyof Pick<DailyReportRow, "last_year" | "same_day_last_year" | "on_books_yesterday" | "on_books_today" | "target">> = {
  prosleGodine: "last_year",
  istiDanProsleGodine: "same_day_last_year",
  naKnjigamaJuce: "on_books_yesterday",
  naKnjigamaDanas: "on_books_today",
  target: "target",
};

export const MONTHS_SR = [
  "Januar", "Februar", "Mart", "April", "Maj", "Jun",
  "Jul", "Avgust", "Septembar", "Oktobar", "Novembar", "Decembar",
];

export interface MonthInfo {
  year: number;
  month: number; // 1-indexed
  daysInMonth: number;
  startDate: string;
  endDate: string;
}

export function periodToMonthInfo(period: string): MonthInfo | null {
  const [monthName, yearStr] = period.split(" ");
  const monthIndex = MONTHS_SR.indexOf(monthName);
  const year = Number(yearStr);
  if (monthIndex === -1 || !year) return null;
  const month = monthIndex + 1;
  const daysInMonth = new Date(year, month, 0).getDate();
  return {
    year,
    month,
    daysInMonth,
    startDate: `${year}-${String(month).padStart(2, "0")}-01`,
    endDate: `${year}-${String(month).padStart(2, "0")}-${String(daysInMonth).padStart(2, "0")}`,
  };
}

export function dateToISO(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function monthInfoToYearMonth(monthInfo: MonthInfo): string {
  return `${monthInfo.year}-${String(monthInfo.month).padStart(2, "0")}`;
}

// Number of days of the selected month that have actually elapsed and can be reported on:
// - current month: up to (not including) today, since today's numbers aren't final yet
// - a past month: the whole month
// - a future month: zero, nothing to report yet
export function getMtdDayCount(monthInfo: MonthInfo): number {
  const now = new Date();
  const isCurrentMonth = now.getFullYear() === monthInfo.year && now.getMonth() + 1 === monthInfo.month;
  if (isCurrentMonth) return Math.max(0, now.getDate() - 1);

  const firstOfSelected = new Date(monthInfo.year, monthInfo.month - 1, 1);
  const firstOfCurrent = new Date(now.getFullYear(), now.getMonth(), 1);
  if (firstOfSelected < firstOfCurrent) return monthInfo.daysInMonth;
  return 0;
}

export type RowValues = Record<ColumnKey, number>;
export type EntryData = Record<RowKey, RowValues>;

function emptyRowValues(): RowValues {
  return { prosleGodine: 0, istiDanProsleGodine: 0, naKnjigamaJuce: 0, naKnjigamaDanas: 0, target: 0 };
}

export function emptyEntryData(): EntryData {
  return {
    brojNocenja: emptyRowValues(),
    ukupanPrihod: emptyRowValues(),
    adr: emptyRowValues(),
    popunjenost: emptyRowValues(),
    revpar: emptyRowValues(),
  };
}

function entryDataToDbColumns(data: EntryData) {
  const columns: Record<string, Record<RowKey, number>> = {};
  for (const col of COLUMN_DEFS) {
    const dbKey = DB_COLUMN_BY_KEY[col.key];
    columns[dbKey] = {} as Record<RowKey, number>;
    for (const row of ROW_DEFS) {
      columns[dbKey][row.key] = data[row.key][col.key];
    }
  }
  return columns;
}

export function dbRowToEntryData(row: DailyReportRow): EntryData {
  const data = emptyEntryData();
  for (const rowDef of ROW_DEFS) {
    for (const col of COLUMN_DEFS) {
      const dbKey = DB_COLUMN_BY_KEY[col.key];
      const value = Number(row[dbKey]?.[rowDef.key] ?? 0);
      data[rowDef.key][col.key] = value;
    }
  }
  return data;
}

export function formatNumber(n: number, rowDef: RowDef): string {
  const rounded = rowDef.unit === "%" ? Math.round(n * 10) / 10 : Math.round(n);
  return `${rowDef.prefix ?? ""}${rounded.toLocaleString("sr-RS")}${rowDef.unit ?? ""}`;
}

// Ahead: pacing to beat the monthly target. On Pace: within striking distance (85-100%). Behind: needs attention.
export function statusFor(achievement: number, hasTarget: boolean, valueIsEmpty: boolean): KPIStatus {
  if (valueIsEmpty || !hasTarget) return "empty";
  if (achievement >= 100) return "ahead";
  if (achievement >= 85) return "onpace";
  return "behind";
}

// Additive metrics (Revenue, Room Nights) accumulate across days, so their daily target pace is
// monthly target / days in month. Rate metrics (ADR, Occupancy, RevPAR) don't accumulate — the
// monthly target rate IS the daily target rate.
export function isAdditiveRow(key: RowKey): boolean {
  return key === "brojNocenja" || key === "ukupanPrihod";
}

export interface MonthProgress {
  daysElapsed: number;
  daysInMonth: number;
  daysRemaining: number;
  percentElapsed: number;
}

export function getMonthProgress(monthInfo: MonthInfo): MonthProgress {
  const daysElapsed = getMtdDayCount(monthInfo);
  return {
    daysElapsed,
    daysInMonth: monthInfo.daysInMonth,
    daysRemaining: Math.max(0, monthInfo.daysInMonth - daysElapsed),
    percentElapsed: monthInfo.daysInMonth > 0 ? Math.round((daysElapsed / monthInfo.daysInMonth) * 100) : 0,
  };
}

// Revenue achievement vs. target on a given day's entry, used for calendar cell coloring.
export function getDayStatus(entry: EntryData | undefined | null): DayStatus {
  if (!entry) return "none";
  const { naKnjigamaDanas, target } = entry.ukupanPrihod;
  if (target === 0) return naKnjigamaDanas > 0 ? "green" : "none";
  if (naKnjigamaDanas >= target) return "green";
  if (naKnjigamaDanas >= target * 0.9) return "yellow";
  return "red";
}

// A row counts as an anomalous placeholder (not a real report) when every "on the books today"
// field is zero — e.g. a report date that got an empty row instead of no row at all. Real data
// never legitimately zeroes out mid-month since each row is a cumulative month-to-date total.
function isAllZeroToday(entry: EntryData): boolean {
  return ROW_DEFS.every(rowDef => entry[rowDef.key].naKnjigamaDanas === 0);
}

// Picks the on-books picture as of the latest report date among the given dated entries — never
// a sum or average across days. Each day's own values already ARE a cumulative month-to-date
// total (see the /mesecni "Ukupan Prihod" bug: summing them inflated revenue ~14.6x), so the
// newest real row already contains everything the older rows contained plus more. Same pattern as
// dashboardData.ts's fetchLatestReportSnapshot/fetchLatestMonthSnapshot.
function latestEntry(dated: [string, EntryData][]): { data: EntryData; hasAny: boolean } {
  const sorted = [...dated].sort((a, b) => b[0].localeCompare(a[0])); // newest report_date first
  const found = sorted.find(([, entry]) => !isAllZeroToday(entry));
  if (!found) return { data: emptyEntryData(), hasAny: false };
  return { data: found[1], hasAny: true };
}

export interface MonthlyTargetsInput {
  revenueTarget: number;
  roomNightsTarget: number;
  adrTarget: number;
  occupancyTarget: number;
  revparTarget: number;
}

export type PaceForecastStatus = "on_track" | "at_risk" | "off_track" | "no_target";

export interface PaceForecastItem {
  label: string;
  mtdFormatted: string;
  projectedFormatted: string;
  targetFormatted: string;
  projectedPct: number;
  status: PaceForecastStatus;
}

export type PaceForecastResult =
  | { available: true; items: PaceForecastItem[]; daysWithData: number; daysRemaining: number; daysInMonth: number }
  | { available: false; reason: "past_month" | "insufficient_data"; daysWithData: number };

export const ROW_TARGET_FIELD: Record<RowKey, keyof Pick<MonthlyTargetRow, "revenue_target" | "room_nights_target" | "adr_target" | "occupancy_target" | "revpar_target">> = {
  brojNocenja: "room_nights_target",
  ukupanPrihod: "revenue_target",
  adr: "adr_target",
  popunjenost: "occupancy_target",
  revpar: "revpar_target",
};

interface HotelContextValue {
  hotels: SavedHotel[];
  selectedHotel: string;
  selectedHotelName: string;
  selectedPeriod: string;
  setSelectedHotel: (h: string) => void;
  setSelectedPeriod: (p: string) => void;
  addHotel: (hotel: NewHotelInput) => Promise<void>;
  deleteHotel: (id: string) => Promise<void>;
  updateHotelPrice: (id: string, price: number) => Promise<void>;
  monthInfo: MonthInfo | null;
  monthEntries: Record<string, EntryData>;
  getEntryForDate: (dateISO: string) => EntryData | null;
  saveEntryForDate: (dateISO: string, data: EntryData) => Promise<void>;
  monthlyTarget: MonthlyTargetRow | null;
  saveMonthlyTargets: (input: MonthlyTargetsInput) => Promise<void>;
  monthProgress: MonthProgress | null;
  kpiData: KPIData[];
  paceForecast: PaceForecastResult | null;
  saveNotes: (notes: string) => Promise<void>;
  loadingHotels: boolean;
  loadingMonth: boolean;
  loadingTargets: boolean;
}

const HotelContext = createContext<HotelContextValue | null>(null);

export function HotelProvider({ children }: { children: React.ReactNode }) {
  const [hotels, setHotels] = useState<SavedHotel[]>([]);
  const [selectedHotel, setSelectedHotel] = useState("");
  const [selectedPeriod, setSelectedPeriod] = useState("");
  const [loadingHotels, setLoadingHotels] = useState(true);
  const [monthEntries, setMonthEntries] = useState<Record<string, EntryData>>({});
  const [loadingMonth, setLoadingMonth] = useState(false);
  const [monthlyTarget, setMonthlyTarget] = useState<MonthlyTargetRow | null>(null);
  const [loadingTargets, setLoadingTargets] = useState(false);

  // selectedHotel holds the hotel's id (not name) so it stays a stable, unambiguous reference
  // that TopBar and Sidebar both read directly from this context — never a local copy.
  const selectedHotelObj = useMemo(
    () => hotels.find(h => h.id === selectedHotel) ?? null,
    [hotels, selectedHotel]
  );
  const monthInfo = useMemo(
    () => (selectedPeriod ? periodToMonthInfo(selectedPeriod) : null),
    [selectedPeriod]
  );

  // Load hotels from Supabase on mount.
  useEffect(() => {
    let active = true;
    (async () => {
      const { data, error } = await supabase
        .from("hotels")
        .select("id, name, city, rooms, current_price, created_at")
        .order("created_at", { ascending: true });
      if (!active) return;
      if (!error && data) {
        setHotels(data.map(h => ({ id: h.id, name: h.name, city: h.city, rooms: h.rooms, currentPrice: h.current_price })));
      } else if (error) {
        console.error("Failed to load hotels from Supabase:", error.message);
      }
      setLoadingHotels(false);
    })();
    return () => { active = false; };
  }, []);

  // Load every daily report for the selected hotel within the selected month.
  useEffect(() => {
    if (!selectedHotelObj || !monthInfo) {
      setMonthEntries({});
      return;
    }

    let active = true;
    setLoadingMonth(true);
    (async () => {
      const { data, error } = await supabase
        .from("daily_reports")
        .select("*")
        .eq("hotel_id", selectedHotelObj.id)
        .gte("report_date", monthInfo.startDate)
        .lte("report_date", monthInfo.endDate);
      if (!active) return;
      if (!error && data) {
        const byDate: Record<string, EntryData> = {};
        for (const row of data as DailyReportRow[]) {
          byDate[row.report_date] = dbRowToEntryData(row);
        }
        setMonthEntries(byDate);
      } else {
        if (error) console.error("Failed to load daily reports from Supabase:", error.message);
        setMonthEntries({});
      }
      setLoadingMonth(false);
    })();
    return () => { active = false; };
  }, [selectedHotelObj, monthInfo]);

  // Load the monthly targets row for the selected hotel + month.
  useEffect(() => {
    if (!selectedHotelObj || !monthInfo) {
      setMonthlyTarget(null);
      return;
    }

    let active = true;
    setLoadingTargets(true);
    (async () => {
      const { data, error } = await supabase
        .from("monthly_targets")
        .select("*")
        .eq("hotel_id", selectedHotelObj.id)
        .eq("year_month", monthInfoToYearMonth(monthInfo))
        .maybeSingle();
      if (!active) return;
      if (!error) {
        setMonthlyTarget(data ?? null);
      } else {
        console.error("Failed to load monthly targets from Supabase:", error.message);
        setMonthlyTarget(null);
      }
      setLoadingTargets(false);
    })();
    return () => { active = false; };
  }, [selectedHotelObj, monthInfo]);

  const addHotel = useCallback(async (hotel: NewHotelInput) => {
    const { data, error } = await supabase
      .from("hotels")
      .insert({ name: hotel.name, city: hotel.city, rooms: hotel.rooms })
      .select("id, name, city, rooms, current_price, created_at")
      .single();
    if (!error && data) {
      setHotels(prev => [...prev, { id: data.id, name: data.name, city: data.city, rooms: data.rooms, currentPrice: data.current_price }]);
      setSelectedHotel(data.id);
    } else if (error) {
      console.error("Failed to add hotel in Supabase:", error.message);
    }
  }, []);

  const deleteHotel = useCallback(async (id: string) => {
    const { error } = await supabase.from("hotels").delete().eq("id", id);
    if (!error) {
      setHotels(prev => prev.filter(h => h.id !== id));
      setSelectedHotel(prevSelected => (prevSelected === id ? "" : prevSelected));
    } else {
      console.error("Failed to delete hotel in Supabase:", error.message);
    }
  }, []);

  const updateHotelPrice = useCallback(async (id: string, price: number) => {
    const { error } = await supabase.from("hotels").update({ current_price: price }).eq("id", id);
    if (!error) {
      setHotels(prev => prev.map(h => (h.id === id ? { ...h, currentPrice: price } : h)));
    } else {
      console.error("Failed to update hotel price in Supabase:", error.message);
    }
  }, []);

  const getEntryForDate = useCallback(
    (dateISO: string) => monthEntries[dateISO] ?? null,
    [monthEntries]
  );

  const saveEntryForDate = useCallback(
    async (dateISO: string, data: EntryData) => {
      if (!selectedHotelObj) return;

      const payload = {
        hotel_id: selectedHotelObj.id,
        report_date: dateISO,
        ...entryDataToDbColumns(data),
      };

      const { data: saved, error } = await supabase
        .from("daily_reports")
        .upsert(payload, { onConflict: "hotel_id,report_date" })
        .select("*")
        .single();

      if (!error && saved) {
        setMonthEntries(prev => ({ ...prev, [dateISO]: dbRowToEntryData(saved) }));
      } else if (error) {
        console.error("Failed to save daily report in Supabase:", error.message);
      }
    },
    [selectedHotelObj]
  );

  const saveMonthlyTargets = useCallback(
    async (input: MonthlyTargetsInput) => {
      if (!selectedHotelObj || !monthInfo) return;

      const payload = {
        hotel_id: selectedHotelObj.id,
        year_month: monthInfoToYearMonth(monthInfo),
        revenue_target: input.revenueTarget,
        room_nights_target: input.roomNightsTarget,
        adr_target: input.adrTarget,
        occupancy_target: input.occupancyTarget,
        revpar_target: input.revparTarget,
      };

      const { data: saved, error } = await supabase
        .from("monthly_targets")
        .upsert(payload, { onConflict: "hotel_id,year_month" })
        .select("*")
        .single();

      if (!error && saved) {
        setMonthlyTarget(saved);
      } else if (error) {
        console.error("Failed to save monthly targets in Supabase:", error.message);
      }
    },
    [selectedHotelObj, monthInfo]
  );

  const kpiData = useMemo<KPIData[]>(() => {
    const mtdDayCount = monthInfo ? getMtdDayCount(monthInfo) : 0;

    // Only count days that have actually elapsed (current month: up to yesterday; past month: the whole
    // month) — never let a partial current month be diluted by entries for days that haven't happened yet.
    const mtdEntries = Object.entries(monthEntries)
      .filter(([dateISO]) => Number(dateISO.slice(8, 10)) <= mtdDayCount);

    const { data: aggregated, hasAny } = latestEntry(mtdEntries);
    const hasTarget = Boolean(monthlyTarget);

    return ROW_DEFS.map(rowDef => {
      const values = aggregated[rowDef.key];
      const valueIsEmpty = !hasAny;
      const danas = values.naKnjigamaDanas;
      const juce = values.naKnjigamaJuce;
      const lastYear = values.prosleGodine;
      const target = monthlyTarget ? monthlyTarget[ROW_TARGET_FIELD[rowDef.key]] : 0;
      const pickup = danas - juce;
      const gap = danas - target;
      const achievement = hasTarget && target !== 0 ? Math.round((danas / target) * 1000) / 10 : 0;
      const remaining = target - danas;
      const yoyChangePct = !valueIsEmpty && lastYear !== 0 ? Math.round(((danas - lastYear) / lastYear) * 1000) / 10 : null;

      let remainingLabel = "—";
      if (!valueIsEmpty && hasTarget) {
        remainingLabel = remaining > 0
          ? `${formatNumber(remaining, rowDef)} preostalo`
          : `${formatNumber(Math.abs(remaining), rowDef)} iznad targeta`;
      }

      return {
        label: rowDef.label,
        value: valueIsEmpty ? "—" : formatNumber(danas, rowDef),
        rawValue: danas,
        target: hasTarget ? formatNumber(target, rowDef) : "—",
        rawTarget: target,
        gap: valueIsEmpty || !hasTarget ? "—" : `${gap >= 0 ? "+" : ""}${formatNumber(gap, rowDef)}`,
        achievement: valueIsEmpty ? 0 : achievement,
        unit: rowDef.unit,
        prefix: rowDef.prefix,
        pickup,
        status: statusFor(achievement, hasTarget, valueIsEmpty),
        remainingLabel,
        lastYearValue: lastYear,
        lastYearLabel: valueIsEmpty ? "—" : formatNumber(lastYear, rowDef),
        yoyChangePct,
      } as KPIData & { pickup: number };
    });
  }, [monthEntries, monthInfo, monthlyTarget]);

  const saveNotes = useCallback(
    async (notes: string) => {
      if (!selectedHotelObj || !monthInfo) return;
      // Upsert only the notes column; target columns keep existing values (or DB default 0 for new rows).
      const { data: saved, error } = await supabase
        .from("monthly_targets")
        .upsert(
          { hotel_id: selectedHotelObj.id, year_month: monthInfoToYearMonth(monthInfo), notes },
          { onConflict: "hotel_id,year_month" }
        )
        .select("*")
        .maybeSingle();
      if (!error && saved) setMonthlyTarget(saved);
      else if (error) console.error("Failed to save notes:", error.message);
    },
    [selectedHotelObj, monthInfo]
  );

  const monthProgress = useMemo(() => (monthInfo ? getMonthProgress(monthInfo) : null), [monthInfo]);

  const paceForecast = useMemo<PaceForecastResult | null>(() => {
    if (!monthInfo) return null;

    // Only show for the current month — past months are complete, future months have no data.
    const now = new Date();
    const isCurrentMonth = now.getFullYear() === monthInfo.year && now.getMonth() + 1 === monthInfo.month;
    if (!isCurrentMonth) return { available: false, reason: "past_month", daysWithData: 0 };

    const mtdDayCount = getMtdDayCount(monthInfo);
    const daysWithData = Object.keys(monthEntries).filter(
      d => Number(d.slice(8, 10)) <= mtdDayCount
    ).length;

    if (daysWithData < 3) {
      return { available: false, reason: "insufficient_data", daysWithData };
    }

    const daysInMonth = monthInfo.daysInMonth;
    const daysRemaining = daysInMonth - daysWithData;

    const items: PaceForecastItem[] = kpiData.map(kpi => {
      const rowDef = ROW_DEFS.find(r => r.label === kpi.label)!;
      const isAdditive = rowDef.key === "brojNocenja" || rowDef.key === "ukupanPrihod";
      const mtd = kpi.rawValue;
      const target = kpi.rawTarget;

      // Additive metrics (Revenue, Room Nights): project forward at current daily average.
      // Rate metrics (ADR, Occupancy, RevPAR): current average IS the projected EOM average.
      const projected = isAdditive && daysWithData > 0
        ? mtd + (mtd / daysWithData) * daysRemaining
        : mtd;

      const projectedPct = target > 0 ? Math.round((projected / target) * 1000) / 10 : 0;
      const status: PaceForecastStatus = target === 0
        ? "no_target"
        : projectedPct >= 95
          ? "on_track"
          : projectedPct >= 80
            ? "at_risk"
            : "off_track";

      return {
        label: kpi.label,
        mtdFormatted: kpi.value,
        projectedFormatted: kpi.status === "empty" ? "—" : formatNumber(projected, rowDef),
        targetFormatted: kpi.target,
        projectedPct,
        status,
      };
    });

    return { available: true, items, daysWithData, daysRemaining, daysInMonth };
  }, [monthInfo, monthEntries, kpiData]);

  const value: HotelContextValue = {
    hotels,
    selectedHotel,
    selectedHotelName: selectedHotelObj?.name ?? "",
    selectedPeriod,
    setSelectedHotel,
    setSelectedPeriod,
    addHotel,
    deleteHotel,
    updateHotelPrice,
    monthInfo,
    monthEntries,
    getEntryForDate,
    saveEntryForDate,
    monthlyTarget,
    saveMonthlyTargets,
    monthProgress,
    kpiData,
    paceForecast,
    saveNotes,
    loadingHotels,
    loadingMonth,
    loadingTargets,
  };

  return <HotelContext.Provider value={value}>{children}</HotelContext.Provider>;
}

export function useHotel(): HotelContextValue {
  const ctx = useContext(HotelContext);
  if (!ctx) throw new Error("useHotel must be used within a HotelProvider");
  return ctx;
}
