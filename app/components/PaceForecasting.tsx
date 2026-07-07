"use client";

import { TrendingUp } from "lucide-react";
import { useHotel, type PaceForecastStatus } from "../context/HotelContext";

const STATUS_CONFIG: Record<PaceForecastStatus, { emoji: string; label: string; color: string; bg: string }> = {
  on_track: { emoji: "🟢", label: "On Track",  color: "#16a34a", bg: "rgba(34,197,94,0.08)" },
  at_risk:  { emoji: "🟡", label: "At Risk",   color: "#ca8a04", bg: "rgba(234,179,8,0.08)" },
  off_track:{ emoji: "🔴", label: "Off Track", color: "#dc2626", bg: "rgba(239,68,68,0.08)" },
  no_target:{ emoji: "⚪", label: "No Target", color: "#9ca3af", bg: "#f9fafb" },
};

export default function PaceForecasting() {
  const { paceForecast, selectedPeriod } = useHotel();

  if (!paceForecast) return null;

  // Past month — silently hide
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
            Projekcija bazirana na trenutnom tempu &middot; {paceForecast.daysWithData} dana podataka
          </div>
        )}
      </div>

      {/* Insufficient data state */}
      {!paceForecast.available && paceForecast.reason === "insufficient_data" && (
        <div className="flex items-center justify-center px-5 py-8">
          <div className="text-center">
            <div style={{ fontSize: 24, marginBottom: 8 }}>📊</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#374151", marginBottom: 4 }}>Nedovoljno podataka</div>
            <div style={{ fontSize: 12, color: "#9ca3af" }}>
              Potrebno je minimum 3 dana podataka za prognozu.
              {paceForecast.daysWithData > 0 && ` Trenutno: ${paceForecast.daysWithData} dan${paceForecast.daysWithData === 1 ? "" : paceForecast.daysWithData < 5 ? "a" : "a"}.`}
            </div>
          </div>
        </div>
      )}

      {/* Forecast table */}
      {paceForecast.available && (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0 }}>
            <thead>
              <tr>
                {["Metrika", "MTD trenutno", "Projektovano EOM", "Target", "% Targeta", "Status"].map(h => (
                  <th
                    key={h}
                    style={{
                      textAlign: h === "Metrika" ? "left" : "right",
                      fontSize: 10, fontWeight: 600, color: "#9ca3af",
                      letterSpacing: "0.06em", textTransform: "uppercase",
                      padding: "10px 16px 8px",
                      borderBottom: "1px solid #f3f4f6",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paceForecast.items.map((item, i) => {
                const s = STATUS_CONFIG[item.status];
                const isLast = i === paceForecast.items.length - 1;
                return (
                  <tr key={item.label} style={{ borderBottom: isLast ? "none" : "1px solid #f9fafb" }}>
                    <td style={{ padding: "10px 16px", fontSize: 13, fontWeight: 600, color: "#111827", whiteSpace: "nowrap" }}>
                      {item.label}
                    </td>
                    <td style={{ padding: "10px 16px", fontSize: 13, color: "#374151", textAlign: "right" }}>
                      {item.mtdFormatted}
                    </td>
                    <td style={{ padding: "10px 16px", fontSize: 13, fontWeight: 700, color: item.status === "no_target" ? "#374151" : s.color, textAlign: "right" }}>
                      {item.projectedFormatted}
                    </td>
                    <td style={{ padding: "10px 16px", fontSize: 13, color: "#6b7280", textAlign: "right" }}>
                      {item.targetFormatted}
                    </td>
                    <td style={{ padding: "10px 16px", textAlign: "right" }}>
                      {item.status === "no_target" ? (
                        <span style={{ fontSize: 12, color: "#9ca3af" }}>—</span>
                      ) : (
                        <span style={{ fontSize: 13, fontWeight: 700, color: s.color }}>{item.projectedPct}%</span>
                      )}
                    </td>
                    <td style={{ padding: "10px 16px", textAlign: "right" }}>
                      <span
                        className="inline-flex items-center gap-1 rounded-md"
                        style={{ height: 20, padding: "0 7px", background: s.bg, fontSize: 11, fontWeight: 600, color: s.color, whiteSpace: "nowrap" }}
                      >
                        {s.emoji} {s.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Footer note */}
          <div className="px-5 pb-3 pt-1" style={{ borderTop: "1px solid #f9fafb" }}>
            <span style={{ fontSize: 11, color: "#9ca3af" }}>
              🟢 On Track ≥95% &nbsp;&middot;&nbsp; 🟡 At Risk 80–95% &nbsp;&middot;&nbsp; 🔴 Off Track &lt;80% &nbsp;&middot;&nbsp;
              {paceForecast.daysRemaining} dana preostalo u mesecu
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
