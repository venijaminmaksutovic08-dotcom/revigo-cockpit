"use client";

import { useState, useEffect } from "react";
import type { KPIData } from "../data/hotelData";

interface KPICardProps {
  data:   KPIData;
  icon:   React.ReactNode;
  index?: number;
}

const STATUS_CONFIG = {
  ahead:  { label: "Iznad targeta", color: "#16a34a", bgCard: "rgba(34,197,94,0.04)",  border: "#16a34a", barColor: "#16a34a" },
  onpace: { label: "U planu",       color: "#d97706", bgCard: "rgba(245,158,11,0.04)", border: "#d97706", barColor: "#d97706" },
  behind: { label: "Ispod targeta", color: "#dc2626", bgCard: "rgba(239,68,68,0.04)",  border: "#dc2626", barColor: "#dc2626" },
  empty:  { label: "Nema podataka", color: "#9ca3af", bgCard: "#ffffff",               border: "#e5e7eb", barColor: "#e5e7eb" },
};

export default function KPICard({ data, icon, index = 0 }: KPICardProps) {
  const isEmpty  = data.status === "empty";
  const status   = STATUS_CONFIG[data.status];
  const barPct   = Math.min(Math.max(data.achievement, 0), 150);

  // Staggered fade-in + slide-up
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
        background: status.bgCard,
        border: `1px solid ${status.border}40`,
        borderLeft: `4px solid ${status.border}`,
        boxShadow: hovered
          ? "0 8px 24px rgba(0,0,0,0.10)"
          : "0 1px 4px rgba(0,0,0,0.04)",
        padding: "20px 20px",
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
          style={{ width: 34, height: 34, background: `${status.border}12`, border: `1px solid ${status.border}25`, flexShrink: 0 }}
        >
          {icon}
        </div>
      </div>

      {/* Main value */}
      <div
        style={{
          fontSize: 30,
          fontWeight: 800,
          color: isEmpty ? "#d1d5db" : "#111827",
          letterSpacing: "-0.03em",
          lineHeight: 1,
          marginBottom: 10,
        }}
      >
        {data.value}
      </div>

      {/* Status badge + YoY */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <span
          className="inline-flex items-center rounded-full"
          style={{
            height: 20, padding: "0 8px",
            background: `${status.color}15`,
            border: `1px solid ${status.color}30`,
            fontSize: 10, fontWeight: 700, color: status.color,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
          }}
        >
          {status.label}
        </span>
        {data.yoyChangePct !== null && (
          <span style={{ fontSize: 11, fontWeight: 600, color: data.yoyChangePct >= 0 ? "#16a34a" : "#dc2626" }}>
            {data.yoyChangePct >= 0 ? "▲" : "▼"} {Math.abs(data.yoyChangePct)}% vs LG
          </span>
        )}
      </div>

      {/* Progress bar */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1.5">
          <span style={{ fontSize: 10, color: "#9ca3af" }}>Target: {data.target}</span>
          <span style={{ fontSize: 12, fontWeight: 800, color: isEmpty ? "#d1d5db" : status.color }}>
            {isEmpty ? "—" : `${data.achievement}%`}
          </span>
        </div>
        <div className="rounded-full overflow-hidden" style={{ height: 8, background: `${status.border}18` }}>
          {!isEmpty && (
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.min(barWidth, 100)}%`,
                background: `linear-gradient(90deg, ${status.barColor}cc, ${status.barColor})`,
                transition: "width 0.9s cubic-bezier(0.22, 1, 0.36, 1)",
              }}
            />
          )}
        </div>
      </div>

      {/* Footer */}
      <div
        className="flex items-center justify-between"
        style={{ paddingTop: 10, borderTop: `1px solid ${status.border}18` }}
      >
        <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 500 }}>{data.remainingLabel}</div>
        <div style={{ fontSize: 11, color: "#9ca3af" }}>LG: {data.lastYearLabel}</div>
      </div>
    </div>
  );
}
