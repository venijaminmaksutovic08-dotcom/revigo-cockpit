"use client";

import { useState, useEffect } from "react";
import type { DualKpiData } from "../lib/dashboardData";

interface KPICardProps {
  data:   DualKpiData;
  icon:   React.ReactNode;
  index?: number;
}

const STATUS_CONFIG = {
  ahead:  { label: "Iznad targeta", emoji: "🟢", color: "#16a34a", bgCard: "rgba(34,197,94,0.04)",  border: "#16a34a", barColor: "#16a34a" },
  onpace: { label: "U planu",       emoji: "🟡", color: "#d97706", bgCard: "rgba(245,158,11,0.04)", border: "#d97706", barColor: "#d97706" },
  behind: { label: "Ispod targeta", emoji: "🔴", color: "#dc2626", bgCard: "rgba(239,68,68,0.04)",  border: "#dc2626", barColor: "#dc2626" },
  empty:  { label: "Nema podataka", emoji: "⚪", color: "#9ca3af", bgCard: "#ffffff",               border: "#e5e7eb", barColor: "#e5e7eb" },
};

export default function KPICard({ data, icon, index = 0 }: KPICardProps) {
  const isEmpty     = data.dailyStatus === "empty";
  const dailyStatus = STATUS_CONFIG[data.dailyStatus];
  const monthStatus = STATUS_CONFIG[data.monthlyStatus];
  const barPct       = Math.min(Math.max(data.dailyAchievement, 0), 150);
  const progressBarPct = Math.min(Math.max(data.monthlyProgressPct, 0), 100);

  const [visible, setVisible]   = useState(false);
  const [barWidth, setBarWidth] = useState(0);
  const [hovered, setHovered]   = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setVisible(true), index * 80);
    const t2 = setTimeout(() => setBarWidth(barPct), index * 80 + 200);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [index, barPct]);

  return (
    <div
      className="rounded-xl flex flex-col"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: dailyStatus.bgCard,
        border: `1px solid ${dailyStatus.border}40`,
        borderLeft: `4px solid ${dailyStatus.border}`,
        boxShadow: hovered
          ? "0 8px 24px rgba(0,0,0,0.10)"
          : "0 1px 4px rgba(0,0,0,0.04)",
        padding: "18px 18px",
        flex: 1,
        minWidth: 0,
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(10px)",
        transition: "opacity 0.35s ease-out, transform 0.35s ease-out, box-shadow 0.15s ease-out",
      }}
    >
      {/* Header: label + icon */}
      <div className="flex items-start justify-between mb-3">
        <div style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", letterSpacing: "0.08em", textTransform: "uppercase" }}>
          {data.label}
        </div>
        <div
          className="rounded-xl flex items-center justify-center"
          style={{ width: 32, height: 32, background: `${dailyStatus.border}12`, border: `1px solid ${dailyStatus.border}25`, flexShrink: 0 }}
        >
          {icon}
        </div>
      </div>

      {/* ── Section 1: Today vs. daily target ─────────────────────────────── */}
      <div style={{ fontSize: 9, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>
        Danas
      </div>
      <div
        style={{
          fontSize: 26, fontWeight: 800, color: isEmpty ? "#d1d5db" : "#111827",
          letterSpacing: "-0.03em", lineHeight: 1, marginBottom: 6,
        }}
      >
        {data.dailyValueFormatted}
      </div>
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <span style={{ fontSize: 11, color: "#6b7280" }}>Target: {data.dailyTargetFormatted}</span>
        {!isEmpty && data.hasMonthlyTarget && (
          <span style={{ fontSize: 11, fontWeight: 700, color: dailyStatus.color }}>
            {data.dailyGapFormatted} ({data.dailyAchievement}%) {dailyStatus.emoji}
          </span>
        )}
        {data.yoyChangePct !== null && (
          <span style={{ fontSize: 10, fontWeight: 600, color: data.yoyChangePct >= 0 ? "#16a34a" : "#dc2626" }}>
            {data.yoyChangePct >= 0 ? "▲" : "▼"} {Math.abs(data.yoyChangePct)}% vs LG ({data.lastYearLabel})
          </span>
        )}
      </div>
      <div className="rounded-full overflow-hidden mb-4" style={{ height: 6, background: `${dailyStatus.border}18` }}>
        {!isEmpty && (
          <div
            className="h-full rounded-full"
            style={{
              width: `${Math.min(barWidth, 100)}%`,
              background: `linear-gradient(90deg, ${dailyStatus.barColor}cc, ${dailyStatus.barColor})`,
              transition: "width 0.9s cubic-bezier(0.22, 1, 0.36, 1)",
            }}
          />
        )}
      </div>

      {/* ── Section 2: Month-to-date vs. monthly target ───────────────────── */}
      <div
        className="flex flex-col"
        style={{ paddingTop: 10, borderTop: `1px solid ${dailyStatus.border}18` }}
      >
        <div style={{ fontSize: 9, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>
          Mesec do sada
        </div>
        <div className="flex items-center justify-between mb-1.5">
          <span style={{ fontSize: 15, fontWeight: 800, color: data.hasMtdData ? "#111827" : "#d1d5db" }}>{data.mtdValueFormatted}</span>
          <span style={{ fontSize: 10, color: "#9ca3af" }}>Target: {data.monthlyTargetFormatted}</span>
        </div>
        <div className="rounded-full overflow-hidden mb-2" style={{ height: 6, background: "#f3f4f6" }}>
          {data.hasMtdData && data.hasMonthlyTarget && (
            <div
              className="h-full rounded-full"
              style={{ width: `${progressBarPct}%`, background: "#9ca3af", transition: "width 0.9s cubic-bezier(0.22, 1, 0.36, 1)" }}
            />
          )}
        </div>
        <div className="flex items-center justify-between flex-wrap gap-1">
          <span style={{ fontSize: 11, color: "#6b7280" }}>
            Progres: {data.hasMonthlyTarget ? `${data.monthlyProgressPct}%` : "—"}
          </span>
          {data.hasMtdData && data.hasMonthlyTarget ? (
            <span style={{ fontSize: 11, fontWeight: 700, color: monthStatus.color }}>
              Projekcija: {data.projectedFormatted} ({data.projectedPct}%) {monthStatus.emoji}
            </span>
          ) : (
            <span style={{ fontSize: 11, color: "#d1d5db" }}>Projekcija: —</span>
          )}
        </div>
        <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 6 }}>
          {data.daysRemaining} {data.daysRemaining === 1 ? "dan" : "dana"} preostalo u mesecu
        </div>
      </div>
    </div>
  );
}
