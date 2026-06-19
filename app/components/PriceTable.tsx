"use client";

import { useState } from "react";
import { Check, Pencil, TableProperties } from "lucide-react";
import type { DayData, DayStatus } from "../data/hotelData";

const STATUS_STYLES: Record<DayStatus, { bg: string; color: string; border: string }> = {
  "Compression":  { bg: "rgba(249,115,22,0.08)",  color: "#c2410c", border: "rgba(249,115,22,0.2)"  },
  "Protect ADR":  { bg: "rgba(59,130,246,0.08)",   color: "#1d4ed8", border: "rgba(59,130,246,0.2)"  },
  "Opportunity":  { bg: "rgba(34,197,94,0.08)",    color: "#15803d", border: "rgba(34,197,94,0.2)"   },
  "Need Day":     { bg: "rgba(234,179,8,0.08)",    color: "#92400e", border: "rgba(234,179,8,0.2)"   },
  "Rescue Day":   { bg: "rgba(239,68,68,0.08)",    color: "#991b1b", border: "rgba(239,68,68,0.2)"   },
};

function StatusBadge({ status }: { status: DayStatus }) {
  const s = STATUS_STYLES[status];
  return (
    <span
      className="inline-flex items-center rounded-md px-2"
      style={{ height: 22, background: s.bg, color: s.color, border: `1px solid ${s.border}`, fontSize: 11, fontWeight: 600, whiteSpace: "nowrap" }}
    >
      {status}
    </span>
  );
}

function DeltaCell({ value, target, suffix = "" }: { value: number; target: number; suffix?: string }) {
  const diff = value - target;
  const pct = Math.round(((value - target) / target) * 100);
  const isGood = diff >= 0;
  const color = isGood ? "#15803d" : "#dc2626";
  return (
    <div className="flex flex-col items-end">
      <div style={{ fontSize: 12, fontWeight: 600, color }}>{isGood ? "+" : ""}{diff.toLocaleString("sr-RS")}{suffix}</div>
      <div style={{ fontSize: 10, color: isGood ? "#86efac" : "#fca5a5" }}>({isGood ? "+" : ""}{pct}%)</div>
    </div>
  );
}

interface PriceTableProps {
  data: DayData[];
  todayIndex?: number;
}

const HEADERS = [
  "Datum", "Dan", "Popunjenost%", "Pop. vs Target",
  "ADR", "ADR vs Target", "Br. Noćenja", "Pickup",
  "Status", "Preporuka Cene", "Akcija",
];

export default function PriceTable({ data, todayIndex = -1 }: PriceTableProps) {
  const [hoveredRow, setHoveredRow] = useState<number | null>(null);
  const [acceptedRows, setAcceptedRows] = useState<Set<number>>(new Set());

  function toggleAccept(i: number) {
    setAcceptedRows(prev => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
  }

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: "#ffffff", border: "1px solid #e5e7eb", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid #e5e7eb" }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>Preporuka Dnevnih Cena</div>
          <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 1 }}>Dnevni prikaz — unesite podatke da biste videli preporuke</div>
        </div>
        <div className="flex items-center gap-3">
          {(Object.keys(STATUS_STYLES) as DayStatus[]).map(s => (
            <div key={s} className="flex items-center gap-1">
              <div className="rounded-full" style={{ width: 7, height: 7, background: STATUS_STYLES[s].color }} />
              <span style={{ fontSize: 10, color: "#9ca3af" }}>{s}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Empty state */}
      {data.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16">
          <div className="rounded-xl flex items-center justify-center mb-4" style={{ width: 56, height: 56, background: "#f9fafb", border: "1px solid #e5e7eb" }}>
            <TableProperties size={24} color="#d1d5db" />
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#374151", marginBottom: 4 }}>Nema podataka</div>
          <div style={{ fontSize: 13, color: "#9ca3af" }}>Podaci o cenama će se prikazati nakon unosa informacija o hotelu.</div>
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 900 }}>
            <thead>
              <tr style={{ background: "#f9fafb" }}>
                {HEADERS.map(h => (
                  <th
                    key={h}
                    style={{
                      padding: "8px 10px",
                      textAlign: "left",
                      fontSize: 10,
                      fontWeight: 600,
                      color: "#9ca3af",
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      whiteSpace: "nowrap",
                      borderBottom: "1px solid #e5e7eb",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((row, i) => {
                const isToday = i === todayIndex;
                const isHovered = hoveredRow === i;
                const isAccepted = acceptedRows.has(i);
                return (
                  <tr
                    key={i}
                    onMouseEnter={() => setHoveredRow(i)}
                    onMouseLeave={() => setHoveredRow(null)}
                    style={{
                      background: isToday ? "rgba(201,168,76,0.04)" : isHovered ? "#fafafa" : "transparent",
                      borderBottom: "1px solid #f3f4f6",
                    }}
                  >
                    <td style={{ padding: "7px 10px" }}>
                      <span style={{ fontSize: 12, fontWeight: isToday ? 700 : 500, color: isToday ? "#C9A84C" : row.isPast ? "#9ca3af" : "#374151", fontVariantNumeric: "tabular-nums" }}>
                        {row.datum}
                      </span>
                    </td>
                    <td style={{ padding: "7px 10px" }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: row.dan === "Sub" || row.dan === "Ned" ? "#C9A84C" : "#9ca3af" }}>
                        {row.dan}
                      </span>
                    </td>
                    <td style={{ padding: "7px 10px" }}>
                      <div className="flex items-center gap-2">
                        <div className="rounded-full overflow-hidden" style={{ width: 40, height: 4, background: "#f3f4f6", flexShrink: 0 }}>
                          <div className="h-full rounded-full" style={{ width: `${row.popunjenost}%`, background: row.popunjenost >= row.targetPopunjenost ? "#16a34a" : "#dc2626" }} />
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 600, color: row.popunjenost >= row.targetPopunjenost ? "#16a34a" : "#dc2626", fontVariantNumeric: "tabular-nums" }}>
                          {row.popunjenost}%
                        </span>
                      </div>
                    </td>
                    <td style={{ padding: "7px 10px" }}>
                      <DeltaCell value={row.popunjenost} target={row.targetPopunjenost} suffix="pp" />
                    </td>
                    <td style={{ padding: "7px 10px" }}>
                      <span style={{ fontSize: 12, fontWeight: 500, color: "#374151", fontVariantNumeric: "tabular-nums" }}>
                        {row.adr.toLocaleString("sr-RS")}
                      </span>
                    </td>
                    <td style={{ padding: "7px 10px" }}>
                      <DeltaCell value={row.adr} target={row.targetAdr} />
                    </td>
                    <td style={{ padding: "7px 10px" }}>
                      <span style={{ fontSize: 12, color: "#374151", fontVariantNumeric: "tabular-nums" }}>
                        {row.brojNocenja} / 30
                      </span>
                    </td>
                    <td style={{ padding: "7px 10px" }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: row.pickup > 0 ? "#16a34a" : row.pickup < 0 ? "#dc2626" : "#6b7280", fontVariantNumeric: "tabular-nums" }}>
                        {row.pickup > 0 ? `+${row.pickup}` : row.pickup}
                      </span>
                    </td>
                    <td style={{ padding: "7px 10px" }}>
                      <StatusBadge status={row.status} />
                    </td>
                    <td style={{ padding: "7px 10px" }}>
                      <div className="inline-flex items-center gap-1 rounded-lg px-2" style={{ height: 26, background: "rgba(201,168,76,0.06)", border: "1px solid rgba(201,168,76,0.15)" }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: "#C9A84C", fontVariantNumeric: "tabular-nums" }}>
                          {row.preporukaCene.toLocaleString("sr-RS")} RSD
                        </span>
                      </div>
                    </td>
                    <td style={{ padding: "7px 10px" }}>
                      {!row.isPast ? (
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => toggleAccept(i)}
                            className="flex items-center gap-1 rounded-md"
                            style={{
                              height: 26, paddingLeft: 8, paddingRight: 8, fontSize: 11, fontWeight: 600, cursor: "pointer", border: "none",
                              background: isAccepted ? "rgba(22,163,74,0.1)" : "rgba(201,168,76,0.08)",
                              color: isAccepted ? "#16a34a" : "#C9A84C",
                            }}
                          >
                            <Check size={11} />
                            {isAccepted ? "OK" : "Prihvati"}
                          </button>
                          {!isAccepted && (
                            <button className="flex items-center justify-center rounded-md" style={{ width: 26, height: 26, background: "#f9fafb", border: "1px solid #e5e7eb", cursor: "pointer" }}>
                              <Pencil size={10} color="#9ca3af" />
                            </button>
                          )}
                        </div>
                      ) : (
                        <span style={{ fontSize: 11, color: "#d1d5db" }}>—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
