"use client";

import { useEffect, useMemo, useState } from "react";
import { ClipboardList, ChevronDown } from "lucide-react";
import { fetchReportLog, formatDateSr, formatDateTimeSr, toISO, type ReportLogEntry } from "../lib/dashboardData";

interface ReportLogProps {
  hotelId: string;
  year: number;
  month: number;
  selectedDate: string;
  onSelectDate: (dateISO: string) => void;
  refreshKey?: number;
}

export default function ReportLog({ hotelId, year, month, selectedDate, onSelectDate, refreshKey }: ReportLogProps) {
  const [entries, setEntries] = useState<ReportLogEntry[] | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!hotelId) { setEntries(null); return; }
    let cancelled = false;
    fetchReportLog(hotelId, year, month).then(data => { if (!cancelled) setEntries(data); });
    return () => { cancelled = true; };
  }, [hotelId, year, month, refreshKey]);

  const daysInMonth = new Date(year, month, 0).getDate();
  const byDate = useMemo(() => {
    const map = new Map<string, ReportLogEntry>();
    for (const e of entries ?? []) map.set(e.dateISO, e);
    return map;
  }, [entries]);

  const lastEntered = useMemo(() => {
    if (!entries || entries.length === 0) return null;
    return entries.reduce((latest, e) => (e.createdAt > latest.createdAt ? e : latest), entries[0]);
  }, [entries]);

  const enteredCount = entries?.length ?? 0;

  return (
    <div
      className="rounded-xl mb-5"
      style={{ background: "#ffffff", border: "1px solid #e5e7eb", boxShadow: "0 1px 4px rgba(0,0,0,0.04)", overflow: "hidden" }}
    >
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center justify-between w-full"
        style={{ padding: "14px 18px", background: "transparent", border: "none", cursor: "pointer" }}
      >
        <div className="flex items-center gap-2">
          <ClipboardList size={16} color="#C9A84C" />
          <span style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>📋 Uneti izveštaji</span>
          <span style={{ fontSize: 12, color: "#9ca3af" }}>({enteredCount}/{daysInMonth})</span>
        </div>
        <ChevronDown size={16} color="#9ca3af" style={{ transform: open ? "rotate(180deg)" : undefined, transition: "transform 0.15s" }} />
      </button>

      {open && (
        <div className="px-4 pb-4">
          <div className="flex flex-wrap gap-1.5 mb-3">
            {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
              const dateISO = toISO(year, month, day);
              const hasEntry = byDate.has(dateISO);
              const isSelected = dateISO === selectedDate;
              return (
                <button
                  key={day}
                  onClick={() => onSelectDate(dateISO)}
                  title={formatDateSr(dateISO)}
                  style={{
                    width: 30, height: 30, borderRadius: 7,
                    fontSize: 11, fontWeight: 700, cursor: "pointer",
                    background: hasEntry ? "rgba(34,197,94,0.1)" : "#f3f4f6",
                    color: hasEntry ? "#16a34a" : "#9ca3af",
                    border: isSelected ? "2px solid #C9A84C" : `1px solid ${hasEntry ? "rgba(34,197,94,0.3)" : "#e5e7eb"}`,
                  }}
                >
                  {day}
                </button>
              );
            })}
          </div>
          <div style={{ fontSize: 11, color: "#9ca3af" }}>
            {lastEntered ? `Poslednji unos: ${formatDateTimeSr(lastEntered.createdAt)}` : "Nema unetih izveštaja za ovaj mesec"}
          </div>
        </div>
      )}
    </div>
  );
}
