"use client";

import { Target, Zap, TrendingUp, AlertCircle } from "lucide-react";
import type { PriorityAction } from "../data/hotelData";

const PRIORITY_CONFIG = {
  High:   { bg: "rgba(239,68,68,0.08)",  border: "rgba(239,68,68,0.2)",  color: "#991b1b", label: "Visok"   },
  Medium: { bg: "rgba(234,179,8,0.08)",  border: "rgba(234,179,8,0.2)",  color: "#92400e", label: "Srednji" },
  Low:    { bg: "rgba(59,130,246,0.08)", border: "rgba(59,130,246,0.2)", color: "#1d4ed8", label: "Nizak"   },
};

interface RightPanelProps {
  actions: PriorityAction[];
  revenueGap: {
    total: number;
    target: number;
    achieved: number;
    items: { label: string; gap: number; isPositive: boolean }[];
  };
}

function EmptyBox({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-8">
      <div style={{ fontSize: 28, fontWeight: 300, color: "#d1d5db", marginBottom: 6 }}>—</div>
      <div style={{ fontSize: 12, color: "#9ca3af" }}>{label}</div>
    </div>
  );
}

export default function RightPanel({ actions, revenueGap }: RightPanelProps) {
  const isEmpty = revenueGap.target === 0;
  const gapPct = isEmpty ? 0 : Math.round(Math.abs(revenueGap.total / revenueGap.target) * 100);
  const achievedPct = isEmpty ? 0 : Math.round((revenueGap.achieved / revenueGap.target) * 100);
  const isNegative = revenueGap.total < 0;

  return (
    <div className="flex flex-col gap-4" style={{ width: 320, flexShrink: 0 }}>

      {/* Revenue Gap Card */}
      <div className="rounded-xl overflow-hidden" style={{ background: "#ffffff", border: "1px solid #e5e7eb", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
        <div className="px-4 py-3 flex items-center gap-2" style={{ borderBottom: "1px solid #e5e7eb" }}>
          <Target size={14} color="#C9A84C" />
          <span style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>Revenue Gap do Targeta</span>
        </div>

        <div className="p-4">
          {isEmpty ? (
            <EmptyBox label="Unesite podatke o hotelu i periodu" />
          ) : (
            <>
              {/* Main gap */}
              <div
                className="rounded-lg p-3 mb-4 flex items-center justify-between"
                style={{
                  background: isNegative ? "rgba(220,38,38,0.04)" : "rgba(22,163,74,0.04)",
                  border: `1px solid ${isNegative ? "rgba(220,38,38,0.12)" : "rgba(22,163,74,0.12)"}`,
                }}
              >
                <div>
                  <div style={{ fontSize: 10, color: "#9ca3af", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>Ukupni Gap</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: isNegative ? "#dc2626" : "#16a34a", letterSpacing: "-0.02em" }}>
                    {revenueGap.total < 0 ? "-" : "+"}{Math.abs(revenueGap.total).toLocaleString("sr-RS")}
                  </div>
                  <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 2 }}>
                    RSD ({isNegative ? "-" : "+"}{gapPct}% od targeta)
                  </div>
                </div>
              </div>

              {/* Progress */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span style={{ fontSize: 11, color: "#6b7280" }}>Ostvarenost</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: isNegative ? "#dc2626" : "#16a34a" }}>{achievedPct}%</span>
                </div>
                <div className="rounded-full overflow-hidden" style={{ height: 6, background: "#f3f4f6" }}>
                  <div className="h-full rounded-full" style={{ width: `${Math.min(achievedPct, 100)}%`, background: isNegative ? "#dc2626" : "#16a34a" }} />
                </div>
                <div className="flex justify-between mt-1">
                  <span style={{ fontSize: 10, color: "#9ca3af" }}>{revenueGap.achieved.toLocaleString("sr-RS")} RSD</span>
                  <span style={{ fontSize: 10, color: "#9ca3af" }}>{revenueGap.target.toLocaleString("sr-RS")} RSD</span>
                </div>
              </div>

              {/* Breakdown */}
              {revenueGap.items.length > 0 && (
                <div>
                  <div style={{ fontSize: 10, fontWeight: 600, color: "#9ca3af", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>Razlog gapa</div>
                  <div className="flex flex-col gap-2">
                    {revenueGap.items.map((item, i) => (
                      <div key={i} className="flex items-center justify-between rounded-lg px-3 py-2"
                        style={{ background: item.isPositive ? "rgba(22,163,74,0.04)" : "rgba(220,38,38,0.04)", border: `1px solid ${item.isPositive ? "rgba(22,163,74,0.1)" : "rgba(220,38,38,0.1)"}` }}>
                        <span style={{ fontSize: 12, color: "#6b7280" }}>{item.label}</span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: item.isPositive ? "#16a34a" : "#dc2626", fontVariantNumeric: "tabular-nums" }}>
                          {item.isPositive ? "+" : "-"}{Math.abs(item.gap).toLocaleString("sr-RS")} RSD
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Priority Actions Card */}
      <div className="rounded-xl overflow-hidden" style={{ background: "#ffffff", border: "1px solid #e5e7eb", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
        <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: "1px solid #e5e7eb" }}>
          <div className="flex items-center gap-2">
            <Zap size={14} color="#C9A84C" />
            <span style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>Top Prioritetne Akcije</span>
          </div>
          {actions.length > 0 && (
            <div className="rounded-full flex items-center justify-center" style={{ width: 20, height: 20, background: "rgba(201,168,76,0.1)", border: "1px solid rgba(201,168,76,0.2)" }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: "#C9A84C" }}>{actions.length}</span>
            </div>
          )}
        </div>

        <div className="p-3">
          {actions.length === 0 ? (
            <EmptyBox label="Akcije će se generisati automatski" />
          ) : (
            <div className="flex flex-col gap-2">
              {actions.map((action) => {
                const cfg = PRIORITY_CONFIG[action.priority];
                return (
                  <div
                    key={action.id}
                    className="rounded-lg p-3 cursor-pointer"
                    style={{ background: "#fafafa", border: "1px solid #f3f4f6" }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#f9fafb"; (e.currentTarget as HTMLElement).style.borderColor = "#e5e7eb"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "#fafafa"; (e.currentTarget as HTMLElement).style.borderColor = "#f3f4f6"; }}
                  >
                    <div className="flex items-start gap-2 mb-1.5">
                      <span className="inline-flex items-center rounded-md px-1.5 flex-shrink-0"
                        style={{ height: 18, marginTop: 1, background: cfg.bg, border: `1px solid ${cfg.border}`, fontSize: 9, fontWeight: 700, color: cfg.color, letterSpacing: "0.05em", textTransform: "uppercase" }}>
                        {cfg.label}
                      </span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: "#374151", flex: 1, lineHeight: 1.3 }}>{action.text}</span>
                    </div>
                    <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 6, lineHeight: 1.4 }}>{action.detail}</div>
                    <div className="inline-flex items-center gap-1 rounded-md px-2" style={{ height: 20, background: "rgba(22,163,74,0.06)", border: "1px solid rgba(22,163,74,0.15)" }}>
                      <TrendingUp size={9} color="#16a34a" />
                      <span style={{ fontSize: 10, fontWeight: 700, color: "#16a34a" }}>{action.impact}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {actions.length > 0 && (
          <div className="px-3 pb-3">
            <button className="w-full flex items-center justify-center gap-2 rounded-lg"
              style={{ height: 36, background: "rgba(201,168,76,0.06)", border: "1px solid rgba(201,168,76,0.15)", color: "#C9A84C", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
              <AlertCircle size={13} />
              Vidi sve akcije →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
