"use client";

import { useMemo } from "react";
import { PenLine, AlertCircle, CheckCircle2 } from "lucide-react";
import DataEntryCalendar from "../components/DataEntryCalendar";
import { useHotel, dateToISO } from "../context/HotelContext";

export default function UnosPage() {
  const { selectedHotel, selectedHotelName, selectedPeriod, monthInfo, getEntryForDate } = useHotel();

  const missingDays = useMemo(() => {
    if (!monthInfo) return [];
    const { year, month, daysInMonth } = monthInfo;
    const today = new Date();
    const isCurrentMonth = today.getFullYear() === year && today.getMonth() + 1 === month;
    const lastDay = isCurrentMonth ? today.getDate() - 1 : daysInMonth;
    const missing: number[] = [];
    for (let d = 1; d <= lastDay; d++) {
      if (getEntryForDate(dateToISO(year, month, d)) === null) {
        missing.push(d);
      }
    }
    return missing;
  }, [monthInfo, getEntryForDate]);

  const enteredCount = useMemo(() => {
    if (!monthInfo) return 0;
    const { year, month, daysInMonth } = monthInfo;
    let count = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      if (getEntryForDate(dateToISO(year, month, d)) !== null) count++;
    }
    return count;
  }, [monthInfo, getEntryForDate]);

  return (
    <>
      {/* Hero header */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <PenLine size={18} color="#C9A84C" strokeWidth={2.5} />
            <h1 style={{ fontSize: 20, fontWeight: 800, color: "#111827", letterSpacing: "-0.02em", margin: 0, lineHeight: 1.2 }}>
              Unos Podataka
            </h1>
          </div>
          <div style={{ fontSize: 12, color: "#9ca3af" }}>
            {selectedHotelName && selectedPeriod
              ? `${selectedHotelName} · ${selectedPeriod}`
              : "Izaberite hotel i period iz bočne trake"}
          </div>
        </div>

        {monthInfo && selectedHotel && (
          <div
            className="flex items-center gap-2 rounded-lg"
            style={{
              padding: "8px 14px",
              background: enteredCount > 0 ? "rgba(34,197,94,0.06)" : "#f9fafb",
              border: `1px solid ${enteredCount > 0 ? "rgba(34,197,94,0.2)" : "#e5e7eb"}`,
            }}
          >
            {enteredCount > 0
              ? <CheckCircle2 size={14} color="#16a34a" />
              : <AlertCircle size={14} color="#9ca3af" />}
            <span style={{ fontSize: 12, fontWeight: 600, color: enteredCount > 0 ? "#16a34a" : "#9ca3af" }}>
              {enteredCount} / {monthInfo.daysInMonth} dana
            </span>
          </div>
        )}
      </div>

      {/* Calendar — main focus of this page */}
      {selectedHotel ? (
        <>
          <DataEntryCalendar />

          {/* Missing dates strip */}
          {missingDays.length > 0 && (
            <div
              className="rounded-xl mb-5"
              style={{
                background: "#ffffff",
                border: "1px solid rgba(234,179,8,0.25)",
                boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
              }}
            >
              <div
                className="flex items-start gap-3 px-5 py-4"
              >
                <AlertCircle size={16} color="#ca8a04" style={{ flexShrink: 0, marginTop: 1 }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#92400e", marginBottom: 4 }}>
                    Datumi bez podataka ({missingDays.length})
                  </div>
                  <div style={{ fontSize: 12, color: "#78350f", lineHeight: 1.7 }}>
                    {missingDays.map((d, i) => (
                      <span key={d}>
                        <span
                          style={{
                            display: "inline-block",
                            padding: "1px 7px",
                            borderRadius: 4,
                            background: "rgba(234,179,8,0.1)",
                            border: "1px solid rgba(234,179,8,0.2)",
                            fontWeight: 600,
                            marginRight: 4,
                            marginBottom: 4,
                            fontSize: 11,
                          }}
                        >
                          {d}.
                        </span>
                      </span>
                    ))}
                  </div>
                  <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 4 }}>
                    Kliknite na datum u kalendaru iznad da unesete podatke
                  </div>
                </div>
              </div>
            </div>
          )}

          {missingDays.length === 0 && monthInfo && enteredCount > 0 && (
            <div
              className="flex items-center gap-3 rounded-xl px-5 py-4 mb-5"
              style={{ background: "rgba(34,197,94,0.05)", border: "1px solid rgba(34,197,94,0.2)" }}
            >
              <CheckCircle2 size={16} color="#16a34a" />
              <div style={{ fontSize: 13, fontWeight: 600, color: "#166534" }}>
                Svi prošli datumi imaju unete podatke — odlično!
              </div>
            </div>
          )}
        </>
      ) : (
        <div
          className="flex flex-col items-center justify-center rounded-xl"
          style={{
            minHeight: 300,
            background: "#ffffff",
            border: "1px solid #e5e7eb",
            boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
          }}
        >
          <PenLine size={32} color="#e5e7eb" strokeWidth={1.5} style={{ marginBottom: 12 }} />
          <div style={{ fontSize: 14, fontWeight: 600, color: "#9ca3af", marginBottom: 4 }}>
            Izaberite hotel
          </div>
          <div style={{ fontSize: 12, color: "#d1d5db" }}>
            Izaberite hotel iz bočne trake da biste počeli sa unosom podataka
          </div>
        </div>
      )}
    </>
  );
}
