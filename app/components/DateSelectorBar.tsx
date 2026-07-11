"use client";

import { ChevronLeft, ChevronRight, CalendarClock, CalendarRange } from "lucide-react";
import { formatDateSr, shiftDays, todayISO } from "../lib/dashboardData";

export type DashboardViewMode = "day" | "period";

interface DateSelectorBarProps {
  mode: DashboardViewMode;
  selectedDate: string;
  rangeStart: string;
  rangeEnd: string;
  onSelectDate: (dateISO: string) => void;
  onSetMode: (mode: DashboardViewMode) => void;
  onSetRange: (start: string, end: string) => void;
}

function countDaysInclusive(startISO: string, endISO: string): number {
  const start = new Date(`${startISO}T00:00:00`);
  const end = new Date(`${endISO}T00:00:00`);
  return Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);
}

const inputStyle: React.CSSProperties = {
  height: 36, borderRadius: 7, border: "1px solid #e5e7eb",
  paddingLeft: 10, paddingRight: 10, fontSize: 13, color: "#111827",
  background: "#fafafa", outline: "none",
};

const arrowBtnStyle: React.CSSProperties = {
  width: 36, height: 36, borderRadius: 7, border: "1px solid #e5e7eb",
  background: "#f9fafb", display: "flex", alignItems: "center", justifyContent: "center",
  cursor: "pointer", flexShrink: 0,
};

export default function DateSelectorBar({
  mode, selectedDate, rangeStart, rangeEnd,
  onSelectDate, onSetMode, onSetRange,
}: DateSelectorBarProps) {
  const isDay = mode === "day";
  const isFuture = selectedDate >= todayISO();

  return (
    <div
      className="rounded-xl mb-5"
      style={{ background: "#ffffff", border: "1px solid #e5e7eb", boxShadow: "0 1px 4px rgba(0,0,0,0.04)", padding: "14px 18px" }}
    >
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        {/* Always-visible date context label */}
        <div className="flex items-center gap-2">
          {isDay ? <CalendarClock size={16} color="#C9A84C" /> : <CalendarRange size={16} color="#C9A84C" />}
          <div style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>
            {isDay
              ? <>Prikazuješ podatke za: <span style={{ color: "#C9A84C" }}>{formatDateSr(selectedDate)}</span></>
              : <>Prikazuješ period: <span style={{ color: "#C9A84C" }}>{formatDateSr(rangeStart)} — {formatDateSr(rangeEnd)}</span> ({countDaysInclusive(rangeStart, rangeEnd)} dana)</>
            }
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {isDay ? (
            <>
              <button
                onClick={() => onSelectDate(shiftDays(selectedDate, -1))}
                style={arrowBtnStyle}
                aria-label="Prethodni dan"
              >
                <ChevronLeft size={16} color="#374151" />
              </button>
              <input
                type="date"
                value={selectedDate}
                onChange={e => e.target.value && onSelectDate(e.target.value)}
                style={inputStyle}
              />
              <button
                onClick={() => onSelectDate(shiftDays(selectedDate, 1))}
                disabled={isFuture}
                style={{ ...arrowBtnStyle, opacity: isFuture ? 0.4 : 1, cursor: isFuture ? "default" : "pointer" }}
                aria-label="Sledeći dan"
              >
                <ChevronRight size={16} color="#374151" />
              </button>
              <button
                onClick={() => onSetMode("period")}
                className="flex items-center gap-1.5"
                style={{
                  height: 36, paddingLeft: 14, paddingRight: 14, borderRadius: 7,
                  border: "1px solid rgba(201,168,76,0.35)", background: "rgba(201,168,76,0.06)",
                  color: "#C9A84C", fontSize: 12, fontWeight: 600, cursor: "pointer",
                }}
              >
                <CalendarRange size={13} />
                Period
              </button>
            </>
          ) : (
            <>
              <div className="flex items-center gap-1.5">
                <span style={{ fontSize: 11, color: "#9ca3af", fontWeight: 600 }}>Od:</span>
                <input
                  type="date"
                  value={rangeStart}
                  max={rangeEnd}
                  onChange={e => e.target.value && onSetRange(e.target.value, rangeEnd)}
                  style={inputStyle}
                />
              </div>
              <div className="flex items-center gap-1.5">
                <span style={{ fontSize: 11, color: "#9ca3af", fontWeight: 600 }}>Do:</span>
                <input
                  type="date"
                  value={rangeEnd}
                  min={rangeStart}
                  onChange={e => e.target.value && onSetRange(rangeStart, e.target.value)}
                  style={inputStyle}
                />
              </div>
              <button
                onClick={() => onSetMode("day")}
                className="flex items-center gap-1.5"
                style={{
                  height: 36, paddingLeft: 14, paddingRight: 14, borderRadius: 7,
                  border: "1px solid #e5e7eb", background: "#f9fafb",
                  color: "#374151", fontSize: 12, fontWeight: 600, cursor: "pointer",
                }}
              >
                <CalendarClock size={13} />
                Dan
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
