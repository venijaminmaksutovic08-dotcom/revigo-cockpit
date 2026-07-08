"use client";

import { useState } from "react";
import { CalendarDays } from "lucide-react";
import DataEntryModal from "./DataEntryModal";
import DateActionModal from "./DateActionModal";
import ImportReportModal from "./ImportReportModal";
import {
  useHotel,
  emptyEntryData,
  getDayStatus,
  dateToISO,
  type DayStatus,
} from "../context/HotelContext";
import type { ParsedReportRow } from "../lib/reportImport";

const WEEKDAYS_SR = ["Pon", "Uto", "Sre", "Čet", "Pet", "Sub", "Ned"];

const STATUS_STYLES: Record<DayStatus, { bg: string; border: string; dot: string }> = {
  none:   { bg: "#ffffff",              border: "#e5e7eb",              dot: "#d1d5db" },
  green:  { bg: "rgba(34,197,94,0.08)", border: "rgba(34,197,94,0.3)", dot: "#16a34a" },
  yellow: { bg: "rgba(234,179,8,0.08)", border: "rgba(234,179,8,0.3)", dot: "#ca8a04" },
  red:    { bg: "rgba(239,68,68,0.08)", border: "rgba(239,68,68,0.3)", dot: "#dc2626" },
};

const STATUS_LEGEND: { status: DayStatus; label: string }[] = [
  { status: "green",  label: "Iznad targeta" },
  { status: "yellow", label: "Blizu targeta" },
  { status: "red",    label: "Ispod targeta" },
  { status: "none",   label: "Nema podataka" },
];

function formatDateLabel(year: number, month: number, day: number): string {
  return new Date(year, month - 1, day).toLocaleDateString("sr-RS", {
    day: "numeric", month: "long", year: "numeric",
  });
}

type ModalMode = "action" | "manual" | "import" | null;

const TODAY = new Date();

export default function DataEntryCalendar() {
  const {
    selectedHotelName,
    monthInfo,
    getEntryForDate,
    saveEntryForDate,
    loadingMonth,
  } = useHotel();

  const [openDay, setOpenDay] = useState<number | null>(null);
  const [mode, setMode]       = useState<ModalMode>(null);

  if (!monthInfo) return null;

  const { year, month, daysInMonth } = monthInfo;
  const firstWeekday = (new Date(year, month - 1, 1).getDay() + 6) % 7; // Monday-first
  const leadingBlanks = Array.from({ length: firstWeekday });
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const openDate    = openDay !== null ? dateToISO(year, month, openDay)   : null;
  const openEntry   = openDate          ? getEntryForDate(openDate)         : null;
  const dateLabel   = openDay !== null  ? formatDateLabel(year, month, openDay) : "";
  const hasExisting = openEntry !== null;

  function handleDayClick(day: number) {
    setOpenDay(day);
    setMode("action");
  }

  function closeAll() {
    setOpenDay(null);
    setMode(null);
  }

  return (
    <div
      className="rounded-xl overflow-hidden mb-5"
      style={{ background: "#ffffff", border: "1px solid #e5e7eb", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}
    >
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between px-4 py-3 gap-2" style={{ borderBottom: "1px solid #e5e7eb" }}>
        <div className="flex items-center gap-2">
          <CalendarDays size={16} color="#C9A84C" />
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>Kalendar unosa podataka</div>
            <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 1 }}>
              Kliknite na datum da unesete ručno ili uvezete izveštaj
            </div>
          </div>
        </div>
        <div className="flex items-center flex-wrap gap-3">
          {STATUS_LEGEND.map(({ status, label }) => (
            <div key={status} className="flex items-center gap-1.5">
              <div
                className="rounded-full"
                style={{ width: 7, height: 7, background: STATUS_STYLES[status].dot, flexShrink: 0 }}
              />
              <span style={{ fontSize: 10, color: "#9ca3af", whiteSpace: "nowrap" }}>{label}</span>
            </div>
          ))}
          {/* "has data" indicator legend */}
          <div className="flex items-center gap-1.5">
            <span style={{ fontSize: 11, color: "#9ca3af" }}>✓</span>
            <span style={{ fontSize: 10, color: "#9ca3af" }}>Uneto</span>
          </div>
        </div>
      </div>

      {/* Weekday header */}
      <div className="grid grid-cols-7" style={{ borderBottom: "1px solid #f3f4f6" }}>
        {WEEKDAYS_SR.map(d => (
          <div
            key={d}
            className="text-center py-2"
            style={{ fontSize: 10, fontWeight: 600, color: "#9ca3af", letterSpacing: "0.06em", textTransform: "uppercase" }}
          >
            {d}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div
        className="grid grid-cols-7"
        style={{ opacity: loadingMonth ? 0.6 : 1, transition: "opacity 0.15s" }}
      >
        {leadingBlanks.map((_, i) => (
          <div
            key={`blank-${i}`}
            style={{ minHeight: 64, borderRight: "1px solid #f3f4f6", borderBottom: "1px solid #f3f4f6", background: "#fafafa" }}
          />
        ))}

        {days.map(day => {
          const dateISO   = dateToISO(year, month, day);
          const entry     = getEntryForDate(dateISO);
          const hasData   = entry !== null;
          const status    = getDayStatus(entry);
          const styles    = STATUS_STYLES[status];
          const isToday   = TODAY.getFullYear() === year && TODAY.getMonth() + 1 === month && TODAY.getDate() === day;

          return (
            <button
              key={day}
              onClick={() => handleDayClick(day)}
              className="flex flex-col items-start text-left relative"
              style={{
                minHeight: 64,
                padding: "8px 10px",
                borderRight: "1px solid #f3f4f6",
                borderBottom: "1px solid #f3f4f6",
                background: isToday && !hasData ? "rgba(201,168,76,0.06)" : styles.bg,
                cursor: "pointer",
                border: "none",
                borderRadius: 0,
                outline: isToday ? "2px solid rgba(201,168,76,0.4)" : "none",
                outlineOffset: "-2px",
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.filter = "brightness(0.97)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.filter = "none"; }}
            >
              {/* Day number + status dot */}
              <div className="flex items-center justify-between w-full">
                <span style={{
                  fontSize: 13,
                  fontWeight: isToday ? 800 : 600,
                  color: isToday ? "#C9A84C" : "#374151",
                  fontVariantNumeric: "tabular-nums",
                }}>
                  {day}
                </span>
                {hasData && status === "none" && (
                  <span style={{ fontSize: 10, color: "#6b7280", lineHeight: 1 }}>✓</span>
                )}
                {status !== "none" && (
                  <div
                    className="rounded-full"
                    style={{ width: 7, height: 7, background: styles.dot, flexShrink: 0 }}
                  />
                )}
              </div>

              {/* Revenue preview for days with data */}
              {entry && entry.ukupanPrihod.naKnjigamaDanas > 0 && (
                <span style={{ fontSize: 10, color: "#9ca3af", marginTop: 4 }}>
                  {Math.round(entry.ukupanPrihod.naKnjigamaDanas).toLocaleString("sr-RS")} RSD
                </span>
              )}

              {/* "no data" cue */}
              {!hasData && (
                <span style={{ fontSize: 11, color: "#d1d5db", marginTop: 4, lineHeight: 1 }}>+</span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Action chooser ─────────────────────────────────────────────────── */}
      {mode === "action" && openDay !== null && (
        <DateActionModal
          dateLabel={dateLabel}
          hotel={selectedHotelName}
          hasExistingEntry={hasExisting}
          onManual={() => setMode("manual")}
          onImport={() => setMode("import")}
          onClose={closeAll}
        />
      )}

      {/* ── Manual entry modal ─────────────────────────────────────────────── */}
      {mode === "manual" && openDay !== null && openDate && (
        <DataEntryModal
          hotel={selectedHotelName}
          dateLabel={dateLabel}
          initialData={openEntry ?? emptyEntryData()}
          onSave={async data => {
            await saveEntryForDate(openDate, data);
            closeAll();
          }}
          onClose={closeAll}
        />
      )}

      {/* ── Single-date import modal ───────────────────────────────────────── */}
      {mode === "import" && openDay !== null && openDate && (
        <ImportReportModal
          hotel={selectedHotelName}
          fixedDate={{ dateISO: openDate, dateLabel }}
          onConfirm={async (rows: ParsedReportRow[]) => {
            if (rows.length > 0) {
              await saveEntryForDate(openDate, rows[0].data);
            }
            closeAll();
          }}
          onClose={closeAll}
        />
      )}
    </div>
  );
}
