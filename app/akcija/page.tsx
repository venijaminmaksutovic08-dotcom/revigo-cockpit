"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Zap, PenLine, Target, Building2, CheckCircle2,
  AlertCircle, Clock, ChevronRight,
} from "lucide-react";
import { useHotel, dateToISO } from "../context/HotelContext";
import { supabase } from "../lib/supabaseClient";
import { useBriefingItems, type ActionSeverity } from "../hooks/useBriefingItems";

const SEVERITY_STYLES: Record<ActionSeverity, { bg: string; border: string; dot: string; text: string; label: string }> = {
  red:    { bg: "rgba(239,68,68,0.06)",  border: "rgba(239,68,68,0.2)",  dot: "#ef4444", text: "#b91c1c", label: "Hitno" },
  yellow: { bg: "rgba(245,158,11,0.06)", border: "rgba(245,158,11,0.2)", dot: "#f59e0b", text: "#92400e", label: "Pažnja" },
  green:  { bg: "rgba(34,197,94,0.06)",  border: "rgba(34,197,94,0.2)",  dot: "#22c55e", text: "#166534", label: "Info" },
};

interface HistoryDay {
  iso:     string;
  label:   string;
  weekday: string;
  hasData: boolean;
}

export default function AkcijaPage() {
  const router = useRouter();
  const { selectedHotel, selectedHotelName } = useHotel();
  const { items, ready } = useBriefingItems();

  const [history, setHistory] = useState<HistoryDay[]>([]);

  // Load last 7 days of report status
  useEffect(() => {
    if (!selectedHotel) { setHistory([]); return; }

    const dates: { iso: string; label: string; weekday: string }[] = [];
    for (let i = 7; i >= 1; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      dates.push({
        iso:     dateToISO(d.getFullYear(), d.getMonth() + 1, d.getDate()),
        label:   d.toLocaleDateString("sr-RS", { day: "numeric", month: "short" }),
        weekday: d.toLocaleDateString("sr-RS", { weekday: "short" }),
      });
    }

    const from = dates[0].iso;
    const to   = dates[dates.length - 1].iso;

    supabase
      .from("daily_reports")
      .select("report_date")
      .eq("hotel_id", selectedHotel)
      .gte("report_date", from)
      .lte("report_date", to)
      .then(({ data }) => {
        const existing = new Set((data ?? []).map(r => r.report_date));
        setHistory(dates.map(d => ({ ...d, hasData: existing.has(d.iso) })));
      });
  }, [selectedHotel]);

  const urgentCount  = items.filter(i => i.severity === "red").length;
  const warningCount = items.filter(i => i.severity === "yellow").length;

  const QUICK_ACTIONS = [
    {
      icon: PenLine,
      label: "Unesi izveštaj",
      description: "Otvori kalendar za unos dnevnih podataka",
      href: "/unos",
      color: "#C9A84C",
    },
    {
      icon: Target,
      label: "Postavi targete",
      description: "Definiši mesečne ciljeve prihoda i popunjenosti",
      href: "/",
      color: "#6366f1",
    },
    {
      icon: Building2,
      label: "Proveri konkurente",
      description: "Skeniranje tržišnih cena za sutra",
      href: "/",
      color: "#0ea5e9",
    },
  ];

  return (
    <>
      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Zap size={18} color="#C9A84C" strokeWidth={2.5} />
            <h1 style={{ fontSize: 20, fontWeight: 800, color: "#111827", letterSpacing: "-0.02em", margin: 0 }}>
              Centar Akcija
            </h1>
          </div>
          <div style={{ fontSize: 12, color: "#9ca3af" }}>
            {selectedHotelName
              ? `${selectedHotelName} · Prioritetne akcije i preporuke`
              : "Izaberite hotel iz bočne trake"}
          </div>
        </div>

        {selectedHotel && (
          <div className="flex items-center gap-2">
            {urgentCount > 0 && (
              <div
                className="flex items-center gap-1.5 rounded-full"
                style={{ padding: "4px 12px", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}
              >
                <div className="rounded-full" style={{ width: 6, height: 6, background: "#ef4444" }} />
                <span style={{ fontSize: 12, fontWeight: 700, color: "#b91c1c" }}>{urgentCount} hitno</span>
              </div>
            )}
            {warningCount > 0 && (
              <div
                className="flex items-center gap-1.5 rounded-full"
                style={{ padding: "4px 12px", background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)" }}
              >
                <div className="rounded-full" style={{ width: 6, height: 6, background: "#f59e0b" }} />
                <span style={{ fontSize: 12, fontWeight: 700, color: "#92400e" }}>{warningCount} pažnja</span>
              </div>
            )}
          </div>
        )}
      </div>

      {!selectedHotel ? (
        <div
          className="flex flex-col items-center justify-center rounded-xl"
          style={{ minHeight: 300, background: "#ffffff", border: "1px solid #e5e7eb" }}
        >
          <Zap size={32} color="#e5e7eb" strokeWidth={1.5} style={{ marginBottom: 12 }} />
          <div style={{ fontSize: 14, fontWeight: 600, color: "#9ca3af" }}>Izaberite hotel</div>
          <div style={{ fontSize: 12, color: "#d1d5db", marginTop: 4 }}>
            Izaberite hotel iz bočne trake da vidite akcije
          </div>
        </div>
      ) : (
        <>
          {/* ── Quick actions ─────────────────────────────────────────────────── */}
          <div
            className="rounded-xl mb-5"
            style={{ background: "#ffffff", border: "1px solid #e5e7eb", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}
          >
            <div className="px-5 pt-4 pb-3" style={{ borderBottom: "1px solid #f3f4f6" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Brze Akcije
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-4">
              {QUICK_ACTIONS.map(({ icon: Icon, label, description, href, color }) => (
                <button
                  key={label}
                  onClick={() => router.push(href)}
                  className="flex items-center gap-3 rounded-xl text-left w-full"
                  style={{
                    padding: "14px 16px",
                    background: "#f9fafb",
                    border: "1.5px solid #e5e7eb",
                    cursor: "pointer",
                    transition: "all 0.15s",
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLElement).style.background = "#f3f4f6";
                    (e.currentTarget as HTMLElement).style.borderColor = color + "55";
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLElement).style.background = "#f9fafb";
                    (e.currentTarget as HTMLElement).style.borderColor = "#e5e7eb";
                  }}
                >
                  <div
                    className="rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ width: 40, height: 40, background: `${color}15`, border: `1px solid ${color}30` }}
                  >
                    <Icon size={18} color={color} strokeWidth={2} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>{label}</div>
                    <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 1, lineHeight: 1.4 }}>{description}</div>
                  </div>
                  <ChevronRight size={14} color="#d1d5db" />
                </button>
              ))}
            </div>
          </div>

          {/* ── Action items ──────────────────────────────────────────────────── */}
          <div
            className="rounded-xl mb-5"
            style={{ background: "#ffffff", border: "1px solid #e5e7eb", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}
          >
            <div className="flex items-center justify-between px-5 pt-4 pb-3" style={{ borderBottom: "1px solid #f3f4f6" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Akcije za danas
              </div>
              {items.length > 0 && (
                <span style={{ fontSize: 11, color: "#9ca3af" }}>{items.length} stavki</span>
              )}
            </div>

            <div className="px-5 py-4 flex flex-col gap-3">
              {!ready && (
                <div style={{ fontSize: 12, color: "#9ca3af" }}>Učitavanje…</div>
              )}

              {ready && items.length === 0 && (
                <div className="flex items-center gap-3" style={{ padding: "12px 0" }}>
                  <CheckCircle2 size={20} color="#22c55e" />
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "#166534" }}>
                      Sve je u redu — nema hitnih akcija
                    </div>
                    <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 2 }}>
                      Nastavi s redovnim praćenjem metrika
                    </div>
                  </div>
                </div>
              )}

              {ready && items.map(item => {
                const s = SEVERITY_STYLES[item.severity];
                return (
                  <div
                    key={item.id}
                    className="rounded-xl"
                    style={{ padding: "14px 16px", background: s.bg, border: `1px solid ${s.border}` }}
                  >
                    <div className="flex items-center gap-3">
                      <span style={{ fontSize: 18, lineHeight: 1, flexShrink: 0 }}>{item.emoji}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span style={{ fontSize: 13, fontWeight: 600, color: s.text }}>
                            {item.message}
                          </span>
                          <span
                            style={{
                              fontSize: 9, fontWeight: 700, color: s.dot,
                              background: s.bg, border: `1px solid ${s.border}`,
                              borderRadius: 3, padding: "1px 6px",
                              textTransform: "uppercase", letterSpacing: "0.06em",
                            }}
                          >
                            {s.label}
                          </span>
                        </div>
                        {item.detail && (
                          <div style={{ fontSize: 11, color: "#6b7280", marginTop: 3, lineHeight: 1.5 }}>
                            {item.detail}
                          </div>
                        )}
                      </div>
                      {item.actionLabel && item.actionHref && (
                        <button
                          onClick={() => router.push(item.actionHref!)}
                          style={{
                            height: 32, paddingLeft: 14, paddingRight: 14, borderRadius: 7,
                            border: `1px solid ${s.border}`,
                            background: "#ffffff",
                            color: s.text,
                            fontSize: 12, fontWeight: 700,
                            cursor: "pointer", flexShrink: 0, whiteSpace: "nowrap",
                          }}
                        >
                          {item.actionLabel}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Last 7 days history ───────────────────────────────────────────── */}
          <div
            className="rounded-xl mb-5"
            style={{ background: "#ffffff", border: "1px solid #e5e7eb", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}
          >
            <div className="flex items-center gap-2 px-5 pt-4 pb-3" style={{ borderBottom: "1px solid #f3f4f6" }}>
              <Clock size={13} color="#9ca3af" />
              <div style={{ fontSize: 12, fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Istorija — poslednjih 7 dana
              </div>
            </div>

            <div className="px-5 py-4">
              {history.length === 0 ? (
                <div style={{ fontSize: 12, color: "#9ca3af" }}>Učitavanje…</div>
              ) : (
                <div className="flex flex-col gap-2">
                  {history.map(day => (
                    <div
                      key={day.iso}
                      className="flex items-center gap-3"
                      style={{
                        padding: "8px 12px",
                        borderRadius: 8,
                        background: day.hasData ? "rgba(34,197,94,0.04)" : "rgba(239,68,68,0.04)",
                        border: `1px solid ${day.hasData ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)"}`,
                      }}
                    >
                      {day.hasData
                        ? <CheckCircle2 size={14} color="#22c55e" />
                        : <AlertCircle  size={14} color="#ef4444" />}

                      <span style={{ fontSize: 12, fontWeight: 600, color: "#374151", minWidth: 36 }}>
                        {day.weekday}
                      </span>
                      <span style={{ fontSize: 12, color: "#6b7280", flex: 1 }}>{day.label}</span>
                      <span style={{
                        fontSize: 11, fontWeight: 600,
                        color: day.hasData ? "#16a34a" : "#dc2626",
                      }}>
                        {day.hasData ? "Uneto ✓" : "Nedostaje"}
                      </span>
                      {!day.hasData && (
                        <button
                          onClick={() => router.push("/unos")}
                          style={{
                            height: 24, paddingLeft: 10, paddingRight: 10, borderRadius: 5,
                            border: "1px solid rgba(239,68,68,0.3)",
                            background: "#fff5f5",
                            color: "#dc2626", fontSize: 10, fontWeight: 700,
                            cursor: "pointer",
                          }}
                        >
                          Unesi
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}
