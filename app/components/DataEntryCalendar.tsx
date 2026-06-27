"use client";

import { useState } from "react";
import { CalendarDays } from "lucide-react";
import DataEntryModal from "./DataEntryModal";
import {
  useHotel,
  emptyEntryData,
  getDayStatus,
  dateToISO,
  type DayStatus,
} from "../context/HotelContext";

const WEEKDAYS_SR = ["Pon", "Uto", "Sre", "Čet", "Pet", "Sub", "Ned"];

const STATUS_STYLES: Record<DayStatus, { bg: string; border: string; dot: string }> = {
  none:   { bg: "#ffffff",              border: "#e5e7eb",            dot: "#d1d5db" },
  green:  { bg: "rgba(34,197,94,0.08)",  border: "rgba(34,197,94,0.3)",  dot: "#16a34a" },
  yellow: { bg: "rgba(234,179,8,0.08)",  border: "rgba(234,179,8,0.3)",  dot: "#ca8a04" },
  red:    { bg: "rgba(239,68,68,0.08)",  border: "rgba(239,68,68,0.3)",  dot: "#dc2626" },
};

const STATUS_LEGEND: { status: DayStatus; label: string }[] = [
  { status: "green", label: "Iznad targeta" },
  { status: "yellow", label: "Blizu targeta" },
  { status: "red", label: "Ispod targeta" },
  { status: "none", label: "Nema podataka" },
];

function formatDateLabel(year: number, month: number, day: number): string {
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString("sr-RS", { day: "numeric", month: "long", year: "numeric" });
}

export default function DataEntryCalendar() {
  const { selectedHotelName, monthInfo, getEntryForDate, saveEntryForDate, loadingMonth } = useHotel();
  const [openDay, setOpenDay] = useState<number | null>(null);

  if (!monthInfo) return null;

  const { year, month, daysInMonth } = monthInfo;
  const firstWeekday = (new Date(year, month - 1, 1).getDay() + 6) % 7; // Monday-first
  const leadingBlanks = Array.from({ length: firstWeekday });
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const openDate = openDay !== null ? dateToISO(year, month, openDay) : null;
  const openEntry = openDate ? getEntryForDate(openDate) : null;

  return (
    <div className="rounded-xl overflow-hidden mb-5" style={{ background: "#ffffff", border: "1px solid #e5e7eb", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid #e5e7eb" }}>
        <div className="flex items-center gap-2">
          <CalendarDays size={16} color="#C9A84C" />
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>Kalendar unosa podataka</div>
            <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 1 }}>Kliknite na datum da unesete ili izmenite podatke</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {STATUS_LEGEND.map(({ status, label }) => (
            <div key={status} className="flex items-center gap-1.5">
              <div className="rounded-full" style={{ width: 7, height: 7, background: STATUS_STYLES[status].dot, flexShrink: 0 }} />
              <span style={{ fontSize: 10, color: "#9ca3af", whiteSpace: "nowrap" }}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Weekday header */}
      <div className="grid grid-cols-7" style={{ borderBottom: "1px solid #f3f4f6" }}>
        {WEEKDAYS_SR.map(d => (
          <div key={d} className="text-center py-2" style={{ fontSize: 10, fontWeight: 600, color: "#9ca3af", letterSpacing: "0.06em", textTransform: "uppercase" }}>
            {d}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7" style={{ opacity: loadingMonth ? 0.6 : 1, transition: "opacity 0.15s" }}>
        {leadingBlanks.map((_, i) => (
          <div key={`blank-${i}`} style={{ minHeight: 64, borderRight: "1px solid #f3f4f6", borderBottom: "1px solid #f3f4f6", background: "#fafafa" }} />
        ))}
        {days.map(day => {
          const dateISO = dateToISO(year, month, day);
          const entry = getEntryForDate(dateISO);
          const status = getDayStatus(entry);
          const styles = STATUS_STYLES[status];
          return (
            <button
              key={day}
              onClick={() => setOpenDay(day)}
              className="flex flex-col items-start text-left"
              style={{
                minHeight: 64,
                padding: "8px 10px",
                borderRight: "1px solid #f3f4f6",
                borderBottom: "1px solid #f3f4f6",
                background: styles.bg,
                cursor: "pointer",
                border: "none",
                borderRadius: 0,
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.filter = "brightness(0.97)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.filter = "none"; }}
            >
              <div className="flex items-center justify-between w-full">
                <span style={{ fontSize: 13, fontWeight: 600, color: "#374151", fontVariantNumeric: "tabular-nums" }}>{day}</span>
                {status !== "none" && (
                  <div className="rounded-full" style={{ width: 7, height: 7, background: styles.dot, flexShrink: 0 }} />
                )}
              </div>
              {entry && (
                <span style={{ fontSize: 10, color: "#9ca3af", marginTop: 4 }}>
                  {Math.round(entry.ukupanPrihod.naKnjigamaDanas).toLocaleString("sr-RS")} RSD
                </span>
              )}
            </button>
          );
        })}
      </div>

      {openDay !== null && openDate && (
        <DataEntryModal
          hotel={selectedHotelName}
          dateLabel={formatDateLabel(year, month, openDay)}
          initialData={openEntry ?? emptyEntryData()}
          onSave={async data => {
            await saveEntryForDate(openDate, data);
            setOpenDay(null);
          }}
          onClose={() => setOpenDay(null)}
        />
      )}
    </div>
  );
}
