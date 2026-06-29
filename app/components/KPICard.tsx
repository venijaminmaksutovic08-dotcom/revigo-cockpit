"use client";

import type { KPIData } from "../data/hotelData";

interface KPICardProps {
  data: KPIData;
  icon: React.ReactNode;
}

const STATUS_CONFIG = {
  ahead:  { emoji: "🟢", label: "Ahead",   color: "#16a34a", bg: "rgba(34,197,94,0.08)" },
  onpace: { emoji: "🟡", label: "On Pace", color: "#ca8a04", bg: "rgba(234,179,8,0.08)" },
  behind: { emoji: "🔴", label: "Behind",  color: "#dc2626", bg: "rgba(239,68,68,0.08)" },
  empty:  { emoji: "⚪", label: "Nema podataka", color: "#9ca3af", bg: "#f9fafb" },
};

export default function KPICard({ data, icon }: KPICardProps) {
  const isEmpty = data.status === "empty";
  const status = STATUS_CONFIG[data.status];
  const barPct = Math.min(Math.max(data.achievement, 0), 100);

  return (
    <div
      className="rounded-xl flex flex-col"
      style={{
        background: "#ffffff",
        border: `1px solid ${isEmpty ? "#e5e7eb" : status.color + "33"}`,
        boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
        padding: "16px 18px",
        flex: 1,
        minWidth: 0,
      }}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#9ca3af", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 }}>
            {data.label}
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, color: isEmpty ? "#d1d5db" : "#111827", letterSpacing: "-0.02em", lineHeight: 1.1 }}>
            {data.value}
          </div>
        </div>
        <div
          className="rounded-lg flex items-center justify-center"
          style={{ width: 36, height: 36, background: "#f9fafb", border: "1px solid #e5e7eb", flexShrink: 0 }}
        >
          {icon}
        </div>
      </div>

      {/* Status badge */}
      <div className="flex items-center gap-1.5 mb-3">
        <span
          className="inline-flex items-center gap-1 rounded-md"
          style={{ height: 20, padding: "0 7px", background: status.bg, fontSize: 11, fontWeight: 600, color: status.color }}
        >
          <span>{status.emoji}</span>
          {status.label}
        </span>
        {data.yoyChangePct !== null && (
          <span style={{ fontSize: 11, color: data.yoyChangePct >= 0 ? "#16a34a" : "#dc2626" }}>
            {data.yoyChangePct >= 0 ? "▲" : "▼"} {Math.abs(data.yoyChangePct)}% vs LG
          </span>
        )}
      </div>

      {/* Progress bar */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1">
          <span style={{ fontSize: 10, color: "#9ca3af" }}>Target: {data.target}</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: isEmpty ? "#d1d5db" : status.color }}>
            {isEmpty ? "—" : `${data.achievement}%`}
          </span>
        </div>
        <div className="rounded-full overflow-hidden" style={{ height: 6, background: "#f3f4f6" }}>
          {!isEmpty && (
            <div
              className="h-full rounded-full"
              style={{ width: `${barPct}%`, background: status.color, transition: "width 0.2s" }}
            />
          )}
        </div>
      </div>

      {/* Footer: remaining + YoY value */}
      <div className="flex items-center justify-between" style={{ paddingTop: 8, borderTop: "1px solid #f3f4f6" }}>
        <div style={{ fontSize: 11, color: "#6b7280" }}>{data.remainingLabel}</div>
        <div style={{ fontSize: 11, color: "#9ca3af" }}>LG: {data.lastYearLabel}</div>
      </div>
    </div>
  );
}
