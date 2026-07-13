"use client";

import { TrendingUp } from "lucide-react";
import type { DualKpiData } from "../lib/dashboardData";
import type { KPIStatus } from "../data/hotelData";

const STATUS_CONFIG: Record<KPIStatus, { emoji: string; label: string; color: string; bg: string; border: string }> = {
  ahead:  { emoji: "🟢", label: "Iznad targeta", color: "#16a34a", bg: "rgba(34,197,94,0.06)",  border: "rgba(34,197,94,0.2)" },
  onpace: { emoji: "🟡", label: "U planu",       color: "#d97706", bg: "rgba(245,158,11,0.06)", border: "rgba(245,158,11,0.2)" },
  behind: { emoji: "🔴", label: "Ispod targeta", color: "#dc2626", bg: "rgba(239,68,68,0.06)",  border: "rgba(239,68,68,0.2)" },
  empty:  { emoji: "⚪", label: "Nema targeta",  color: "#9ca3af", bg: "#f9fafb",              border: "#e5e7eb" },
};

interface PaceForecastingProps {
  data: DualKpiData[];
  daysWithData: number;
  daysInMonth: number;
  daysRemaining: number;
  periodLabel: string;
}

// Driven by the same month-to-date aggregate as the dashboard's KPI cards (dashboardData.ts's
// buildDualKpiData) so the two never disagree: additive metrics (revenue, room nights) project
// forward at the current run-rate, rate metrics (ADR, occupancy, RevPAR) project as their MTD
// average unchanged — averages don't get bigger by "summing more days".
export default function PaceForecasting({ data, daysWithData, daysInMonth, daysRemaining, periodLabel }: PaceForecastingProps) {
  const available = daysWithData >= 3;

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
            <div style={{ fontSize: 11, color: "#9ca3af" }}>{periodLabel}</div>
          </div>
        </div>
        {available && (
          <div style={{ fontSize: 11, color: "#9ca3af" }}>
            Na osnovu {daysWithData} {daysWithData === 1 ? "dana" : "dana"} podataka · {daysRemaining} preostalo
          </div>
        )}
      </div>

      {/* Insufficient data */}
      {!available && (
        <div className="flex items-center justify-center px-5 py-10">
          <div className="text-center">
            <div style={{ fontSize: 28, marginBottom: 8 }}>📊</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#374151", marginBottom: 4 }}>Nedovoljno podataka</div>
            <div style={{ fontSize: 12, color: "#9ca3af" }}>
              Potrebno je minimum 3 dana podataka za prognozu.
              {daysWithData > 0 && ` Trenutno: ${daysWithData} ${daysWithData === 1 ? "dan" : "dana"}.`}
            </div>
          </div>
        </div>
      )}

      {/* Card grid */}
      {available && (
        <>
          <div className="grid gap-3 p-4" style={{ gridTemplateColumns: `repeat(${Math.min(data.length, 3)}, 1fr)` }}>
            {data.map(item => {
              const s = STATUS_CONFIG[item.hasMonthlyTarget ? item.monthlyStatus : "empty"];
              return (
                <div
                  key={item.label}
                  className="rounded-xl flex flex-col"
                  style={{ padding: "16px 18px", background: s.bg, border: `1px solid ${s.border}` }}
                >
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

                  <div style={{ fontSize: 24, fontWeight: 800, color: item.hasMonthlyTarget ? s.color : "#374151", letterSpacing: "-0.03em", lineHeight: 1, marginBottom: 10 }}>
                    {item.projectedFormatted}
                  </div>

                  <div className="flex items-center gap-3 flex-wrap">
                    <div>
                      <div style={{ fontSize: 9, color: "#9ca3af", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em" }}>MTD</div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>{item.mtdValueFormatted}</div>
                    </div>
                    <div style={{ width: 1, height: 24, background: "#e5e7eb" }} />
                    <div>
                      <div style={{ fontSize: 9, color: "#9ca3af", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em" }}>Target</div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>{item.monthlyTargetFormatted}</div>
                    </div>
                    {item.hasMonthlyTarget && (
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
              🟢 Iznad targeta ≥100% &nbsp;·&nbsp; 🟡 U planu 85–100% &nbsp;·&nbsp; 🔴 Ispod targeta &lt;85%
            </span>
          </div>
        </>
      )}
    </div>
  );
}
