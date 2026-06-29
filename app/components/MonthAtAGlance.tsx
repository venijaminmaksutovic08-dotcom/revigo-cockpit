"use client";

import { AlertTriangle, CalendarClock } from "lucide-react";
import { useHotel } from "../context/HotelContext";

const STATUS_CONFIG = {
  ahead:  { emoji: "🟢", label: "Na dobrom putu", sub: "Iznad mesečnog targeta", color: "#16a34a", bg: "rgba(34,197,94,0.06)", border: "rgba(34,197,94,0.25)" },
  onpace: { emoji: "🟡", label: "U okviru plana",  sub: "Blizu mesečnog targeta", color: "#ca8a04", bg: "rgba(234,179,8,0.06)", border: "rgba(234,179,8,0.25)" },
  behind: { emoji: "🔴", label: "Kasnimo za planom", sub: "Ispod mesečnog targeta", color: "#dc2626", bg: "rgba(239,68,68,0.06)", border: "rgba(239,68,68,0.25)" },
  empty:  { emoji: "⚪", label: "Nema podataka",     sub: "Unesite dnevne podatke da vidite status", color: "#9ca3af", bg: "#f9fafb", border: "#e5e7eb" },
};

export default function MonthAtAGlance() {
  const { kpiData, monthProgress, selectedPeriod } = useHotel();

  const withTarget = kpiData.filter(k => k.status !== "empty");
  const behindKpis = kpiData.filter(k => k.status === "behind");

  let overall: keyof typeof STATUS_CONFIG = "empty";
  if (withTarget.length > 0) {
    if (behindKpis.length > 0) overall = "behind";
    else if (withTarget.some(k => k.status === "onpace")) overall = "onpace";
    else overall = "ahead";
  }
  const status = STATUS_CONFIG[overall];

  return (
    <div
      className="rounded-xl mb-5"
      style={{ background: status.bg, border: `1px solid ${status.border}`, overflow: "hidden" }}
    >
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 p-5">
        <div className="flex items-center gap-4">
          <div style={{ fontSize: 34, lineHeight: 1 }}>{status.emoji}</div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 600, color: "#9ca3af", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 3 }}>
              Pregled meseca &middot; {selectedPeriod}
            </div>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#111827", letterSpacing: "-0.01em" }}>
              {status.label}
            </div>
            <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>{status.sub}</div>
          </div>
        </div>

        {monthProgress && (
          <div className="flex items-center gap-2" style={{ flexShrink: 0 }}>
            <CalendarClock size={15} color="#9ca3af" />
            <div style={{ fontSize: 12, color: "#374151" }}>
              Dan <strong>{monthProgress.daysElapsed}</strong> od {monthProgress.daysInMonth}
              <span style={{ color: "#9ca3af" }}> &middot; {monthProgress.daysRemaining} dana preostalo</span>
            </div>
            <div className="rounded-full overflow-hidden" style={{ width: 80, height: 5, background: "#e5e7eb" }}>
              <div className="h-full rounded-full" style={{ width: `${monthProgress.percentElapsed}%`, background: "#C9A84C" }} />
            </div>
          </div>
        )}
      </div>

      {behindKpis.length > 0 && (
        <div className="px-5 pb-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={13} color="#dc2626" />
            <span style={{ fontSize: 11, fontWeight: 700, color: "#991b1b", letterSpacing: "0.04em", textTransform: "uppercase" }}>
              Zahteva pažnju
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {behindKpis.map(kpi => (
              <div
                key={kpi.label}
                className="flex items-center gap-2 rounded-lg"
                style={{ padding: "6px 10px", background: "#ffffff", border: "1px solid rgba(220,38,38,0.2)" }}
              >
                <span style={{ fontSize: 12, fontWeight: 600, color: "#111827" }}>{kpi.label}</span>
                <span style={{ fontSize: 11, color: "#dc2626", fontWeight: 600 }}>{kpi.achievement}% targeta</span>
                <span style={{ fontSize: 11, color: "#9ca3af" }}>&middot; {kpi.remainingLabel}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
