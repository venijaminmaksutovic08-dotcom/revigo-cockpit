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

const MONTHS_SR = [
  "Januar", "Februar", "Mart", "April", "Maj", "Jun",
  "Jul", "Avgust", "Septembar", "Oktobar", "Novembar", "Decembar",
];

function periodToDate(period: string): string | null {
  const [monthName, yearStr] = period.split(" ");
  const monthIndex = MONTHS_SR.indexOf(monthName);
  const year = Number(yearStr);
  if (monthIndex === -1 || !year) return null;
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}-01`;
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

interface HotelContextValue {
  hotels: SavedHotel[];
  selectedHotel: string;
  selectedPeriod: string;
  setSelectedHotel: (h: string) => void;
  setSelectedPeriod: (p: string) => void;
  addHotel: (hotel: NewHotelInput) => Promise<void>;
  deleteHotel: (name: string) => Promise<void>;
  currentEntry: EntryData;
  saveEntry: (data: EntryData) => Promise<void>;
  hasEntry: boolean;
  kpiData: KPIData[];
  loadingHotels: boolean;
  loadingEntry: boolean;
}

const HotelContext = createContext<HotelContextValue | null>(null);

export function HotelProvider({ children }: { children: React.ReactNode }) {
  const [hotels, setHotels] = useState<SavedHotel[]>([]);
  const [selectedHotel, setSelectedHotel] = useState("");
  const [selectedPeriod, setSelectedPeriod] = useState("");
  const [loadingHotels, setLoadingHotels] = useState(true);
  const [currentEntry, setCurrentEntry] = useState<EntryData>(emptyEntryData());
  const [hasEntry, setHasEntry] = useState(false);
  const [loadingEntry, setLoadingEntry] = useState(false);

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

  // Load the daily report for the selected hotel + period from Supabase.
  useEffect(() => {
    const hotel = hotels.find(h => h.name === selectedHotel);
    const reportDate = selectedPeriod ? periodToDate(selectedPeriod) : null;

    if (!hotel || !reportDate) {
      setCurrentEntry(emptyEntryData());
      setHasEntry(false);
      return;
    }

    let active = true;
    setLoadingEntry(true);
    (async () => {
      const { data, error } = await supabase
        .from("daily_reports")
        .select("*")
        .eq("hotel_id", hotel.id)
        .eq("report_date", reportDate)
        .maybeSingle();
      if (!active) return;
      if (!error && data) {
        setCurrentEntry(dbRowToEntryData(data));
        setHasEntry(true);
      } else {
        setCurrentEntry(emptyEntryData());
        setHasEntry(false);
      }
      setLoadingEntry(false);
    })();
    return () => { active = false; };
  }, [hotels, selectedHotel, selectedPeriod]);

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

  const saveEntry = useCallback(
    async (data: EntryData) => {
      const hotel = hotels.find(h => h.name === selectedHotel);
      const reportDate = selectedPeriod ? periodToDate(selectedPeriod) : null;
      if (!hotel || !reportDate) return;

      const payload = {
        hotel_id: hotel.id,
        report_date: reportDate,
        ...entryDataToDbColumns(data),
      };

      const { data: saved, error } = await supabase
        .from("daily_reports")
        .upsert(payload, { onConflict: "hotel_id,report_date" })
        .select("*")
        .single();

      if (!error && saved) {
        setCurrentEntry(dbRowToEntryData(saved));
        setHasEntry(true);
      }
    },
    [hotels, selectedHotel, selectedPeriod]
  );

  const kpiData = useMemo<KPIData[]>(() => {
    return ROW_DEFS.map(rowDef => {
      const values = currentEntry[rowDef.key];
      const isEmpty = !hasEntry;
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
  }, [currentEntry, hasEntry]);

  const value: HotelContextValue = {
    hotels,
    selectedHotel,
    selectedPeriod,
    setSelectedHotel,
    setSelectedPeriod,
    addHotel,
    deleteHotel,
    currentEntry,
    saveEntry,
    hasEntry,
    kpiData,
    loadingHotels,
    loadingEntry,
  };

  return <HotelContext.Provider value={value}>{children}</HotelContext.Provider>;
}

export function useHotel(): HotelContextValue {
  const ctx = useContext(HotelContext);
  if (!ctx) throw new Error("useHotel must be used within a HotelProvider");
  return ctx;
}
