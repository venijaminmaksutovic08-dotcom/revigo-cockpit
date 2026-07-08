"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { X, Zap, CheckCircle2 } from "lucide-react";
import { useHotel } from "../context/HotelContext";
import { useBriefingItems, type ActionSeverity } from "../hooks/useBriefingItems";

const TODAY_ISO = new Date().toISOString().slice(0, 10);
const SESSION_KEY = `briefing-dismissed-${TODAY_ISO}`;

const SEVERITY_STYLES: Record<ActionSeverity, { dot: string; bg: string; border: string; text: string; btnBorder: string }> = {
  red:    { dot: "#ef4444", bg: "#FEF2F2", border: "rgba(239,68,68,0.2)",  text: "#b91c1c", btnBorder: "rgba(239,68,68,0.4)" },
  yellow: { dot: "#f59e0b", bg: "#FFFBEB", border: "rgba(245,158,11,0.2)", text: "#92400e", btnBorder: "rgba(245,158,11,0.4)" },
  green:  { dot: "#22c55e", bg: "#F0FDF4", border: "rgba(34,197,94,0.2)",  text: "#166534", btnBorder: "rgba(34,197,94,0.4)" },
};

const TODAY_LABEL = new Date().toLocaleDateString("sr-RS", {
  weekday: "long", day: "numeric", month: "long", year: "numeric",
});

export default function DailyBriefing() {
  const { selectedHotel, selectedHotelName } = useHotel();
  const { items, ready } = useBriefingItems();
  const router = useRouter();

  const [dismissed, setDismissed] = useState(false);
  const [visible,   setVisible]   = useState(false);

  useEffect(() => {
    try { setDismissed(sessionStorage.getItem(SESSION_KEY) === "1"); } catch { /* SSR */ }
    const t = setTimeout(() => setVisible(true), 60);
    return () => clearTimeout(t);
  }, []);

  function dismiss() {
    setDismissed(true);
    try { sessionStorage.setItem(SESSION_KEY, "1"); } catch { /* SSR */ }
  }

  if (!selectedHotel || dismissed) return null;

  const hasUrgent = items.some(i => i.severity === "red");

  return (
    <div
      className="rounded-xl mb-5"
      style={{
        background: "linear-gradient(135deg, #fafafa 0%, #ffffff 100%)",
        border: `1px solid ${hasUrgent ? "rgba(239,68,68,0.25)" : "#e5e7eb"}`,
        boxShadow: hasUrgent ? "0 2px 8px rgba(239,68,68,0.08)" : "0 1px 4px rgba(0,0,0,0.04)",
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(-6px)",
        transition: "opacity 0.3s ease-out, transform 0.3s ease-out",
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-5 pt-4 pb-3"
        style={{ borderBottom: "1px solid #f3f4f6" }}
      >
        <div className="flex items-center gap-3">
          <div
            className="rounded-xl flex items-center justify-center"
            style={{
              width: 36, height: 36,
              background: hasUrgent ? "rgba(239,68,68,0.08)" : "rgba(201,168,76,0.08)",
              border:     hasUrgent ? "1px solid rgba(239,68,68,0.2)" : "1px solid rgba(201,168,76,0.2)",
            }}
          >
            <Zap size={17} color={hasUrgent ? "#ef4444" : "#C9A84C"} strokeWidth={2.5} />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>Dnevni Briefing</div>
            <div style={{ fontSize: 11, color: "#9ca3af" }}>
              {TODAY_LABEL} · {selectedHotelName}
            </div>
          </div>
        </div>
        <button
          onClick={dismiss}
          className="flex items-center justify-center rounded-lg"
          style={{ width: 28, height: 28, background: "#f9fafb", border: "1px solid #e5e7eb", cursor: "pointer", flexShrink: 0 }}
          title="Zatvori do sutra"
        >
          <X size={13} color="#9ca3af" />
        </button>
      </div>

      {/* Body */}
      <div className="px-5 py-3">
        {ready && items.length === 0 && (
          <div className="flex items-center gap-2" style={{ padding: "4px 0" }}>
            <CheckCircle2 size={15} color="#22c55e" />
            <span style={{ fontSize: 13, color: "#166534", fontWeight: 500 }}>
              Sve je u redu — nema hitnih akcija za danas
            </span>
          </div>
        )}

        {ready && items.length > 0 && (
          <div className="flex flex-col gap-2">
            {items.map((item, idx) => {
              const s = SEVERITY_STYLES[item.severity];
              return (
                <div
                  key={item.id}
                  style={{
                    padding: "10px 14px",
                    borderRadius: 10,
                    background: s.bg,
                    border: `1px solid ${s.border}`,
                    borderLeft: `4px solid ${s.dot}`,
                    opacity: visible ? 1 : 0,
                    transform: visible ? "translateX(0)" : "translateX(-8px)",
                    transition: `opacity 0.3s ease-out ${idx * 60 + 100}ms, transform 0.3s ease-out ${idx * 60 + 100}ms`,
                  }}
                >
                  <div className="flex items-center gap-3">
                    <span style={{ fontSize: 15, lineHeight: 1, flexShrink: 0 }}>{item.emoji}</span>
                    <span style={{ fontSize: 13, color: s.text, fontWeight: 600, flex: 1 }}>{item.message}</span>
                    {item.actionLabel && item.actionHref && (
                      <button
                        onClick={() => router.push(item.actionHref!)}
                        style={{
                          height: 28, paddingLeft: 14, paddingRight: 14,
                          borderRadius: 20,
                          border: `1px solid ${s.btnBorder}`,
                          background: "#ffffff",
                          color: s.text,
                          fontSize: 11, fontWeight: 700,
                          cursor: "pointer", flexShrink: 0, whiteSpace: "nowrap",
                          boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
                        }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = s.bg; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "#ffffff"; }}
                      >
                        {item.actionLabel}
                      </button>
                    )}
                  </div>
                  {item.detail && (
                    <div style={{ fontSize: 11, color: s.text, marginTop: 5, marginLeft: 28, opacity: 0.75, lineHeight: 1.5 }}>
                      {item.detail}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
