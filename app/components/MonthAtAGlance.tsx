"use client";

import { AlertTriangle, CalendarClock } from "lucide-react";
import { useHotel } from "../context/HotelContext";

const STATUS_CONFIG = {
  ahead:  {
    emoji: "🚀", label: "Na dobrom putu", sub: "Iznad mesečnog targeta",
    gradient: "linear-gradient(135deg, #065F46 0%, #047857 100%)",
    bar: "rgba(255,255,255,0.3)", badgeBg: "rgba(255,255,255,0.12)", badgeBorder: "rgba(255,255,255,0.2)",
  },
  onpace: {
    emoji: "📊", label: "U okviru plana", sub: "Blizu mesečnog targeta",
    gradient: "linear-gradient(135deg, #78350F 0%, #92400E 100%)",
    bar: "rgba(255,255,255,0.3)", badgeBg: "rgba(255,255,255,0.12)", badgeBorder: "rgba(255,255,255,0.2)",
  },
  behind: {
    emoji: "⚠️", label: "Kasnimo za planom", sub: "Ispod mesečnog targeta",
    gradient: "linear-gradient(135deg, #7F1D1D 0%, #991B1B 100%)",
    bar: "rgba(255,255,255,0.3)", badgeBg: "rgba(255,255,255,0.12)", badgeBorder: "rgba(255,255,255,0.2)",
  },
  empty:  {
    emoji: "📅", label: "Nema podataka", sub: "Unesite dnevne podatke da vidite status",
    gradient: "linear-gradient(135deg, #1f2937 0%, #374151 100%)",
    bar: "rgba(255,255,255,0.15)", badgeBg: "rgba(255,255,255,0.08)", badgeBorder: "rgba(255,255,255,0.12)",
  },
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
      className="rounded-xl mb-5 overflow-hidden"
      style={{ background: status.gradient, boxShadow: "0 4px 16px rgba(0,0,0,0.15)" }}
    >
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 p-5">
        <div className="flex items-center gap-4">
          <div style={{ fontSize: 36, lineHeight: 1, filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.2))" }}>
            {status.emoji}
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.5)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 3 }}>
              Pregled meseca &middot; {selectedPeriod}
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#ffffff", letterSpacing: "-0.02em", lineHeight: 1.1 }}>
              {status.label}
            </div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", marginTop: 3 }}>{status.sub}</div>
          </div>
        </div>

        {monthProgress && (
          <div
            className="flex flex-col gap-2 rounded-xl"
            style={{
              padding: "10px 16px", background: status.badgeBg,
              border: `1px solid ${status.badgeBorder}`, flexShrink: 0, minWidth: 180,
            }}
          >
            <div className="flex items-center gap-2">
              <CalendarClock size={13} color="rgba(255,255,255,0.6)" />
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.7)" }}>
                Dan <strong style={{ color: "#fff" }}>{monthProgress.daysElapsed}</strong> od {monthProgress.daysInMonth}
                &nbsp;&middot;&nbsp;<strong style={{ color: "#fff" }}>{monthProgress.daysRemaining}</strong> preostalo
              </div>
            </div>
            <div className="rounded-full overflow-hidden" style={{ height: 6, background: "rgba(255,255,255,0.15)" }}>
              <div className="h-full rounded-full" style={{ width: `${monthProgress.percentElapsed}%`, background: "rgba(255,255,255,0.55)", transition: "width 0.6s ease-out" }} />
            </div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.45)", textAlign: "right" }}>
              {monthProgress.percentElapsed}% meseca prošlo
            </div>
          </div>
        )}
      </div>

      {behindKpis.length > 0 && (
        <div className="px-5 pb-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={12} color="rgba(255,255,255,0.7)" />
            <span style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.6)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
              Zahteva pažnju
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {behindKpis.map(kpi => (
              <div
                key={kpi.label}
                className="flex items-center gap-2 rounded-lg"
                style={{ padding: "5px 10px", background: status.badgeBg, border: `1px solid ${status.badgeBorder}` }}
              >
                <span style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.9)" }}>{kpi.label}</span>
                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", fontWeight: 500 }}>{kpi.achievement}% targeta</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
