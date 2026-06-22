"use client";

import { createContext, useContext, useState, useEffect, useMemo, useCallback } from "react";
import { supabase, type DailyReportRow } from "../lib/supabaseClient";
import type { KPIData } from "../data/hotelData";

export interface SavedHotel {
  id: string;
  name: string;
  rooms: number;
  city: string;
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

function dbRowToEntryData(row: DailyReportRow): EntryData {
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

function formatNumber(n: number, rowDef: RowDef): string {
  const rounded = rowDef.unit === "%" ? Math.round(n * 10) / 10 : Math.round(n);
  return `${rowDef.prefix ?? ""}${rounded.toLocaleString("sr-RS")}${rowDef.unit ?? ""}`;
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

// Sums the two additive metrics across a set of daily entries and re-derives ADR/Popunjenost/RevPAR from the totals.
function aggregateEntries(entries: EntryData[], rooms: number): { data: EntryData; hasAny: boolean } {
  const data = emptyEntryData();
  if (entries.length === 0) return { data, hasAny: false };

  const roomNights = rooms * entries.length;

  for (const col of COLUMN_DEFS) {
    let brojNocenjaSum = 0;
    let ukupanPrihodSum = 0;
    for (const entry of entries) {
      brojNocenjaSum += entry.brojNocenja[col.key];
      ukupanPrihodSum += entry.ukupanPrihod[col.key];
    }
    data.brojNocenja[col.key] = brojNocenjaSum;
    data.ukupanPrihod[col.key] = ukupanPrihodSum;
    data.adr[col.key] = brojNocenjaSum > 0 ? ukupanPrihodSum / brojNocenjaSum : 0;
    data.popunjenost[col.key] = roomNights > 0 ? (brojNocenjaSum / roomNights) * 100 : 0;
    data.revpar[col.key] = roomNights > 0 ? ukupanPrihodSum / roomNights : 0;
  }

  return { data, hasAny: true };
}

interface HotelContextValue {
  hotels: SavedHotel[];
  selectedHotel: string;
  selectedPeriod: string;
  setSelectedHotel: (h: string) => void;
  setSelectedPeriod: (p: string) => void;
  addHotel: (hotel: NewHotelInput) => Promise<void>;
  deleteHotel: (name: string) => Promise<void>;
  monthInfo: MonthInfo | null;
  monthEntries: Record<string, EntryData>;
  getEntryForDate: (dateISO: string) => EntryData | null;
  saveEntryForDate: (dateISO: string, data: EntryData) => Promise<void>;
  kpiData: KPIData[];
  loadingHotels: boolean;
  loadingMonth: boolean;
}

const HotelContext = createContext<HotelContextValue | null>(null);

export function HotelProvider({ children }: { children: React.ReactNode }) {
  const [hotels, setHotels] = useState<SavedHotel[]>([]);
  const [selectedHotel, setSelectedHotel] = useState("");
  const [selectedPeriod, setSelectedPeriod] = useState("");
  const [loadingHotels, setLoadingHotels] = useState(true);
  const [monthEntries, setMonthEntries] = useState<Record<string, EntryData>>({});
  const [loadingMonth, setLoadingMonth] = useState(false);

  const selectedHotelObj = useMemo(
    () => hotels.find(h => h.name === selectedHotel) ?? null,
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
        .select("id, name, city, rooms, created_at")
        .order("created_at", { ascending: true });
      if (!active) return;
      if (!error && data) {
        setHotels(data);
        if (data.length > 0) setSelectedHotel(data[0].name);
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
        setMonthEntries({});
      }
      setLoadingMonth(false);
    })();
    return () => { active = false; };
  }, [selectedHotelObj, monthInfo]);

  const addHotel = useCallback(async (hotel: NewHotelInput) => {
    const { data, error } = await supabase
      .from("hotels")
      .insert({ name: hotel.name, city: hotel.city, rooms: hotel.rooms })
      .select("id, name, city, rooms, created_at")
      .single();
    if (!error && data) {
      setHotels(prev => [...prev, data]);
      setSelectedHotel(data.name);
    }
  }, []);

  const deleteHotel = useCallback(async (name: string) => {
    const hotel = hotels.find(h => h.name === name);
    if (!hotel) return;
    const { error } = await supabase.from("hotels").delete().eq("id", hotel.id);
    if (!error) {
      setHotels(prev => prev.filter(h => h.id !== hotel.id));
      setSelectedHotel(prevSelected => (prevSelected === name ? "" : prevSelected));
    }
  }, [hotels]);

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
      }
    },
    [selectedHotelObj]
  );

  const kpiData = useMemo<KPIData[]>(() => {
    const entries = Object.values(monthEntries);
    const rooms = selectedHotelObj?.rooms ?? 0;
    const { data: aggregated, hasAny } = aggregateEntries(entries, rooms);

    return ROW_DEFS.map(rowDef => {
      const values = aggregated[rowDef.key];
      const isEmpty = !hasAny;
      const danas = values.naKnjigamaDanas;
      const juce = values.naKnjigamaJuce;
      const target = values.target;
      const pickup = danas - juce;
      const gap = danas - target;
      const achievement = target !== 0 ? Math.round((danas / target) * 1000) / 10 : 0;

      return {
        label: rowDef.label,
        value: isEmpty ? "—" : formatNumber(danas, rowDef),
        rawValue: danas,
        target: isEmpty ? "—" : formatNumber(target, rowDef),
        rawTarget: target,
        gap: isEmpty ? "—" : `${gap >= 0 ? "+" : ""}${formatNumber(gap, rowDef)}`,
        achievement: isEmpty ? 0 : achievement,
        unit: rowDef.unit,
        prefix: rowDef.prefix,
        pickup,
      } as KPIData & { pickup: number };
    });
  }, [monthEntries, selectedHotelObj]);

  const value: HotelContextValue = {
    hotels,
    selectedHotel,
    selectedPeriod,
    setSelectedHotel,
    setSelectedPeriod,
    addHotel,
    deleteHotel,
    monthInfo,
    monthEntries,
    getEntryForDate,
    saveEntryForDate,
    kpiData,
    loadingHotels,
    loadingMonth,
  };

  return <HotelContext.Provider value={value}>{children}</HotelContext.Provider>;
}

export function useHotel(): HotelContextValue {
  const ctx = useContext(HotelContext);
  if (!ctx) throw new Error("useHotel must be used within a HotelProvider");
  return ctx;
}
