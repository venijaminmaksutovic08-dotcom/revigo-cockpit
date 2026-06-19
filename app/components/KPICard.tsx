"use client";

import type { KPIData } from "../data/hotelData";

interface KPICardProps {
  data: KPIData;
  icon: React.ReactNode;
}

export default function KPICard({ data, icon }: KPICardProps) {
  const isEmpty = data.rawValue === 0 && data.rawTarget === 0;

  return (
    <div
      className="rounded-xl flex flex-col"
      style={{
        background: "#ffffff",
        border: "1px solid #e5e7eb",
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
          <div style={{ fontSize: 22, fontWeight: 700, color: isEmpty ? "#d1d5db" : "#111827", letterSpacing: "-0.02em", lineHeight: 1.1 }}>
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

      {/* Progress bar */}
      <div className="mb-3">
        <div className="rounded-full overflow-hidden" style={{ height: 3, background: "#f3f4f6" }}>
          {!isEmpty && (
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.min(data.achievement, 100)}%`,
                background: data.achievement >= 100 ? "#16a34a" : "#dc2626",
                opacity: 0.7,
              }}
            />
          )}
        </div>
      </div>

      {/* Stats row */}
      <div className="flex items-center justify-between">
        <div>
          <div style={{ fontSize: 10, color: "#9ca3af", marginBottom: 2 }}>Target</div>
          <div style={{ fontSize: 12, fontWeight: 500, color: "#6b7280" }}>{data.target}</div>
        </div>
        <div className="text-center">
          <div style={{ fontSize: 10, color: "#9ca3af", marginBottom: 2 }}>Gap</div>
          <div style={{ fontSize: 12, fontWeight: 600, color: isEmpty ? "#d1d5db" : "#374151" }}>{data.gap}</div>
        </div>
        <div className="text-right">
          <div style={{ fontSize: 10, color: "#9ca3af", marginBottom: 2 }}>Ostvarenost</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: isEmpty ? "#d1d5db" : data.achievement >= 100 ? "#16a34a" : "#dc2626" }}>
            {isEmpty ? "—" : `${data.achievement}%`}
          </div>
        </div>
      </div>
    </div>
  );
}
