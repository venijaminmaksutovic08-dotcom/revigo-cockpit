"use client";

import { createContext, useContext, useState, useEffect, useMemo, useCallback } from "react";
import type { KPIData } from "../data/hotelData";

export interface SavedHotel {
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

function formatNumber(n: number, rowDef: RowDef): string {
  const rounded = rowDef.unit === "%" ? Math.round(n * 10) / 10 : Math.round(n);
  return `${rowDef.prefix ?? ""}${rounded.toLocaleString("sr-RS")}${rowDef.unit ?? ""}`;
}

const HOTELS_KEY = "revigo_hotels";
const ENTRIES_KEY = "revigo_entries";

function entryStorageKey(hotel: string, period: string): string {
  return `${hotel}::${period}`;
}

interface HotelContextValue {
  hotels: SavedHotel[];
  selectedHotel: string;
  selectedPeriod: string;
  setSelectedHotel: (h: string) => void;
  setSelectedPeriod: (p: string) => void;
  addHotel: (hotel: SavedHotel) => void;
  currentEntry: EntryData;
  saveEntry: (data: EntryData) => void;
  hasEntry: boolean;
  kpiData: KPIData[];
}

const HotelContext = createContext<HotelContextValue | null>(null);

export function HotelProvider({ children }: { children: React.ReactNode }) {
  const [hotels, setHotels] = useState<SavedHotel[]>([]);
  const [selectedHotel, setSelectedHotel] = useState("");
  const [selectedPeriod, setSelectedPeriod] = useState("");
  const [entries, setEntries] = useState<Record<string, EntryData>>({});

  useEffect(() => {
    try {
      const storedHotels = localStorage.getItem(HOTELS_KEY);
      if (storedHotels) {
        const parsed: SavedHotel[] = JSON.parse(storedHotels);
        setHotels(parsed);
        if (parsed.length > 0) setSelectedHotel(parsed[0].name);
      }
    } catch {
      // ignore parse errors
    }
    try {
      const storedEntries = localStorage.getItem(ENTRIES_KEY);
      if (storedEntries) setEntries(JSON.parse(storedEntries));
    } catch {
      // ignore parse errors
    }
  }, []);

  const addHotel = useCallback((hotel: SavedHotel) => {
    setHotels(prev => {
      const updated = [...prev, hotel];
      try {
        localStorage.setItem(HOTELS_KEY, JSON.stringify(updated));
      } catch {
        // ignore storage errors
      }
      return updated;
    });
    setSelectedHotel(hotel.name);
  }, []);

  const currentEntry = useMemo<EntryData>(() => {
    if (!selectedHotel || !selectedPeriod) return emptyEntryData();
    return entries[entryStorageKey(selectedHotel, selectedPeriod)] ?? emptyEntryData();
  }, [entries, selectedHotel, selectedPeriod]);

  const hasEntry = useMemo(() => {
    if (!selectedHotel || !selectedPeriod) return false;
    return Boolean(entries[entryStorageKey(selectedHotel, selectedPeriod)]);
  }, [entries, selectedHotel, selectedPeriod]);

  const saveEntry = useCallback(
    (data: EntryData) => {
      if (!selectedHotel || !selectedPeriod) return;
      setEntries(prev => {
        const updated = { ...prev, [entryStorageKey(selectedHotel, selectedPeriod)]: data };
        try {
          localStorage.setItem(ENTRIES_KEY, JSON.stringify(updated));
        } catch {
          // ignore storage errors
        }
        return updated;
      });
    },
    [selectedHotel, selectedPeriod]
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
    currentEntry,
    saveEntry,
    hasEntry,
    kpiData,
  };

  return <HotelContext.Provider value={value}>{children}</HotelContext.Provider>;
}

export function useHotel(): HotelContextValue {
  const ctx = useContext(HotelContext);
  if (!ctx) throw new Error("useHotel must be used within a HotelProvider");
  return ctx;
}
