"use client";

import { TrendingUp } from "lucide-react";
import { useHotel, type PaceForecastStatus } from "../context/HotelContext";

const STATUS_CONFIG: Record<PaceForecastStatus, { emoji: string; label: string; color: string; bg: string; border: string }> = {
  on_track:  { emoji: "🟢", label: "Na cilju",    color: "#16a34a", bg: "rgba(34,197,94,0.06)",  border: "rgba(34,197,94,0.2)" },
  at_risk:   { emoji: "🟡", label: "Rizično",     color: "#d97706", bg: "rgba(245,158,11,0.06)", border: "rgba(245,158,11,0.2)" },
  off_track: { emoji: "🔴", label: "Kasni",       color: "#dc2626", bg: "rgba(239,68,68,0.06)",  border: "rgba(239,68,68,0.2)" },
  no_target: { emoji: "⚪", label: "Nema targeta", color: "#9ca3af", bg: "#f9fafb",              border: "#e5e7eb" },
};

export default function PaceForecasting() {
  const { paceForecast, selectedPeriod } = useHotel();

  if (!paceForecast) return null;
  if (!paceForecast.available && paceForecast.reason === "past_month") return null;

  return (
    <div className="rounded-xl mb-5" style={{ background: "#ffffff", border: "1px solid #e5e7eb", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-4 pb-3" style={{ borderBottom: "1px solid #f3f4f6" }}>
        <div className="flex items-center gap-3">
          <div
            className="rounded-xl flex items-center justify-center"
            style={{ width: 36, height: 36, background: "rgba(201,168,76,0.08)", border: "1px solid rgba(201,168,76,0.2)" }}
          >
            <TrendingUp size={18} color="#C9A84C" />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>Pace Prognoza</div>
            <div style={{ fontSize: 11, color: "#9ca3af" }}>{selectedPeriod}</div>
          </div>
        </div>
        {paceForecast.available && (
          <div style={{ fontSize: 11, color: "#9ca3af" }}>
            {paceForecast.daysWithData} dana podataka · {paceForecast.daysRemaining} preostalo
          </div>
        )}
      </div>

      {/* Insufficient data */}
      {!paceForecast.available && paceForecast.reason === "insufficient_data" && (
        <div className="flex items-center justify-center px-5 py-10">
          <div className="text-center">
            <div style={{ fontSize: 28, marginBottom: 8 }}>📊</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#374151", marginBottom: 4 }}>Nedovoljno podataka</div>
            <div style={{ fontSize: 12, color: "#9ca3af" }}>
              Potrebno je minimum 3 dana podataka za prognozu.
              {paceForecast.daysWithData > 0 && ` Trenutno: ${paceForecast.daysWithData} ${paceForecast.daysWithData === 1 ? "dan" : "dana"}.`}
            </div>
          </div>
        </div>
      )}

      {/* Card grid */}
      {paceForecast.available && (
        <>
          <div
            className="grid gap-3 p-4"
            style={{ gridTemplateColumns: `repeat(${Math.min(paceForecast.items.length, 2)}, 1fr)` }}
          >
            {paceForecast.items.map(item => {
              const s = STATUS_CONFIG[item.status];
              return (
                <div
                  key={item.label}
                  className="rounded-xl flex flex-col"
                  style={{
                    padding: "16px 18px",
                    background: s.bg,
                    border: `1px solid ${s.border}`,
                  }}
                >
                  {/* Label + badge */}
                  <div className="flex items-center justify-between mb-3">
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.07em" }}>
                      {item.label}
                    </div>
                    <span
                      className="rounded-full flex items-center gap-1"
                      style={{ height: 20, padding: "0 8px", background: s.bg, border: `1px solid ${s.border}`, fontSize: 10, fontWeight: 700, color: s.color }}
                    >
                      {s.emoji} {s.label}
                    </span>
                  </div>

                  {/* Projected value — large */}
                  <div style={{ fontSize: 24, fontWeight: 800, color: item.status === "no_target" ? "#374151" : s.color, letterSpacing: "-0.03em", lineHeight: 1, marginBottom: 10 }}>
                    {item.projectedFormatted}
                  </div>

                  {/* Stats row */}
                  <div className="flex items-center gap-3 flex-wrap">
                    <div>
                      <div style={{ fontSize: 9, color: "#9ca3af", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em" }}>MTD</div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>{item.mtdFormatted}</div>
                    </div>
                    <div style={{ width: 1, height: 24, background: "#e5e7eb" }} />
                    <div>
                      <div style={{ fontSize: 9, color: "#9ca3af", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em" }}>Target</div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>{item.targetFormatted}</div>
                    </div>
                    {item.status !== "no_target" && (
                      <>
                        <div style={{ width: 1, height: 24, background: "#e5e7eb" }} />
                        <div>
                          <div style={{ fontSize: 9, color: "#9ca3af", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em" }}>% Targeta</div>
                          <div style={{ fontSize: 14, fontWeight: 800, color: s.color }}>{item.projectedPct}%</div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="px-5 pb-3 pt-1" style={{ borderTop: "1px solid #f3f4f6" }}>
            <span style={{ fontSize: 11, color: "#9ca3af" }}>
              🟢 Na cilju ≥95% &nbsp;·&nbsp; 🟡 Rizično 80–95% &nbsp;·&nbsp; 🔴 Kasni &lt;80%
            </span>
          </div>
        </>
      )}
    </div>
  );
}
