"use client";

import { useState, useEffect, useCallback } from "react";
import { BarChart3, TrendingUp, TrendingDown, Minus, CalendarDays } from "lucide-react";
import { useHotel, ROW_DEFS, PICKUP_ROW_KEYS, formatNumber, type RowKey, type RowDef } from "../context/HotelContext";
import {
  fetchLatestReportDate, fetchDayReport, fetchPickupPeriodTotals,
  todayISO, dateParts, toISO, formatDateSr,
  type PickupPeriodTotals,
} from "../lib/dashboardData";
import type { DailyReportRow } from "../lib/supabaseClient";

// ── Helpers ──────────────────────────────────────────────────────────────────

// A stored pickup of exactly 0 means "not captured" — same 0-means-missing convention used
// throughout this app (a real hotel practically never has a literal zero-movement day on every
// metric at once), so it renders as "nema podatka" rather than a misleading real zero.
function dayPickupValue(row: DailyReportRow | null, key: RowKey): number | null {
  if (!row) return null;
  const v = Number(row.pickup?.[key] ?? 0);
  return v !== 0 ? v : null;
}

function fmtSigned(n: number, rowDef: RowDef): string {
  const formatted = formatNumber(n, rowDef);
  return n > 0 ? `+${formatted}` : formatted;
}

// Pickup is only tracked for Room Nights and Revenue (see PICKUP_ROW_KEYS) — ADR/Occupancy/RevPAR
// are ratios and never get a pickup row here.
const PICKUP_ROW_DEFS = ROW_DEFS.filter(r => PICKUP_ROW_KEYS.includes(r.key));

function inputStyle(): React.CSSProperties {
  return {
    height: 34, borderRadius: 7, border: "1px solid #e5e7eb",
    paddingLeft: 10, paddingRight: 10, fontSize: 13, color: "#111827",
    background: "#fafafa", outline: "none",
  };
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function PickupPage() {
  const { selectedHotel, selectedHotelName } = useHotel();

  // ── Section 1: Pickup vs Yesterday (single date) ────────────────────────────
  const [selectedDate, setSelectedDate] = useState(() => todayISO());
  const [dayRow, setDayRow] = useState<DailyReportRow | null>(null);
  const [loadingDay, setLoadingDay] = useState(false);
  const [dateSeeded, setDateSeeded] = useState(false);

  // Seed the date picker with the hotel's latest actual report once, on hotel change — the
  // most recent report is almost always what someone opening this page wants to see first.
  useEffect(() => {
    setDateSeeded(false);
    if (!selectedHotel) return;
    let cancelled = false;
    fetchLatestReportDate(selectedHotel).then(date => {
      if (cancelled) return;
      if (date) setSelectedDate(date);
      setDateSeeded(true);
    });
    return () => { cancelled = true; };
  }, [selectedHotel]);

  useEffect(() => {
    if (!selectedHotel || !selectedDate || !dateSeeded) { setDayRow(null); return; }
    let cancelled = false;
    setLoadingDay(true);
    fetchDayReport(selectedHotel, selectedDate).then(row => {
      if (cancelled) return;
      setDayRow(row);
      setLoadingDay(false);
    });
    return () => { cancelled = true; };
  }, [selectedHotel, selectedDate, dateSeeded]);

  // ── Section 2: Period vs Period ──────────────────────────────────────────────
  // Default to the first half vs. second half of the current calendar month — a reasonable
  // starting point the user can freely change.
  const today = todayISO();
  const { year: curYear, month: curMonth } = dateParts(today);
  const daysInCurMonth = new Date(curYear, curMonth, 0).getDate();
  const midDay = Math.ceil(daysInCurMonth / 2);

  const [startA, setStartA] = useState(() => toISO(curYear, curMonth, 1));
  const [endA, setEndA] = useState(() => toISO(curYear, curMonth, midDay));
  const [startB, setStartB] = useState(() => toISO(curYear, curMonth, midDay + 1));
  const [endB, setEndB] = useState(() => toISO(curYear, curMonth, daysInCurMonth));

  const [totalsA, setTotalsA] = useState<PickupPeriodTotals | null>(null);
  const [totalsB, setTotalsB] = useState<PickupPeriodTotals | null>(null);
  const [loadingPeriods, setLoadingPeriods] = useState(false);

  const fetchPeriods = useCallback(async () => {
    if (!selectedHotel || !startA || !endA || !startB || !endB) return;
    setLoadingPeriods(true);
    try {
      const [a, b] = await Promise.all([
        fetchPickupPeriodTotals(selectedHotel, startA, endA),
        fetchPickupPeriodTotals(selectedHotel, startB, endB),
      ]);
      setTotalsA(a);
      setTotalsB(b);
    } finally {
      setLoadingPeriods(false);
    }
  }, [selectedHotel, startA, endA, startB, endB]);

  useEffect(() => { fetchPeriods(); }, [fetchPeriods]);

  // ── Render ───────────────────────────────────────────────────────────────────

  if (!selectedHotel) {
    return (
      <div
        className="flex flex-col items-center justify-center rounded-xl"
        style={{ minHeight: 300, background: "#ffffff", border: "1px solid #e5e7eb", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}
      >
        <BarChart3 size={32} color="#e5e7eb" strokeWidth={1.5} style={{ marginBottom: 12 }} />
        <div style={{ fontSize: 14, fontWeight: 600, color: "#9ca3af", marginBottom: 4 }}>Izaberite hotel</div>
        <div style={{ fontSize: 12, color: "#d1d5db" }}>Izaberite hotel iz bočne trake da vidite pickup analizu</div>
      </div>
    );
  }

  return (
    <>
      {/* Header */}
      <div className="mb-5">
        <div className="flex items-center gap-2 mb-1">
          <BarChart3 size={18} color="#C9A84C" strokeWidth={2.5} />
          <h1 style={{ fontSize: 20, fontWeight: 800, color: "#111827", letterSpacing: "-0.02em", margin: 0 }}>
            Pickup Analiza
          </h1>
        </div>
        <div style={{ fontSize: 12, color: "#9ca3af" }}>{selectedHotelName}</div>
      </div>

      {/* ── Section 1: Pickup vs Yesterday ─────────────────────────────────── */}
      <div
        className="rounded-xl mb-6"
        style={{ background: "#ffffff", border: "1px solid #e5e7eb", boxShadow: "0 1px 4px rgba(0,0,0,0.04)", overflow: "hidden" }}
      >
        <div
          className="flex items-center justify-between flex-wrap gap-3 px-5 py-4"
          style={{ borderBottom: "1px solid #f3f4f6" }}
        >
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Pickup u odnosu na juče
            </div>
            <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>
              Koliko se pomerilo od juče do danas, po izveštaju za izabrani datum
            </div>
          </div>
          <div className="flex items-center gap-2">
            <CalendarDays size={15} color="#C9A84C" />
            <input
              type="date"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              style={inputStyle()}
            />
          </div>
        </div>

        {loadingDay ? (
          <div className="flex items-center justify-center py-10">
            <div style={{ fontSize: 13, color: "#9ca3af" }}>Učitavanje…</div>
          </div>
        ) : !dayRow ? (
          <div className="flex items-center justify-center py-10">
            <div style={{ fontSize: 13, color: "#9ca3af" }}>Nema izveštaja za {formatDateSr(selectedDate)}.</div>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 420 }}>
              <thead>
                <tr style={{ background: "#f9fafb" }}>
                  <th style={{ padding: "10px 20px", textAlign: "left", fontSize: 10, fontWeight: 700, color: "#9ca3af", letterSpacing: "0.06em", textTransform: "uppercase", borderBottom: "1px solid #e5e7eb" }}>
                    Metrika
                  </th>
                  <th style={{ padding: "10px 20px", textAlign: "right", fontSize: 10, fontWeight: 700, color: "#9ca3af", letterSpacing: "0.06em", textTransform: "uppercase", borderBottom: "1px solid #e5e7eb" }}>
                    Pickup
                  </th>
                </tr>
              </thead>
              <tbody>
                {PICKUP_ROW_DEFS.map(rowDef => {
                  const value = dayPickupValue(dayRow, rowDef.key);
                  const isPos = value !== null && value > 0;
                  const isNeg = value !== null && value < 0;
                  const color = value === null ? "#d1d5db" : isPos ? "#16a34a" : isNeg ? "#dc2626" : "#6b7280";
                  return (
                    <tr key={rowDef.key} style={{ borderBottom: "1px solid #f3f4f6" }}>
                      <td style={{ padding: "12px 20px", fontSize: 13, fontWeight: 600, color: "#374151" }}>{rowDef.label}</td>
                      <td style={{ padding: "12px 20px", textAlign: "right" }}>
                        {value === null ? (
                          <span style={{ fontSize: 13, color: "#d1d5db" }}>nema podatka</span>
                        ) : (
                          <div className="flex items-center justify-end gap-1.5">
                            {isPos && <TrendingUp size={13} color={color} />}
                            {isNeg && <TrendingDown size={13} color={color} />}
                            {!isPos && !isNeg && <Minus size={13} color={color} />}
                            <span style={{ fontSize: 14, fontWeight: 700, color, fontVariantNumeric: "tabular-nums" }}>
                              {fmtSigned(value, rowDef)}
                            </span>
                          </div>
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

      {/* ── Section 2: Period vs Period ─────────────────────────────────────── */}
      <div
        className="rounded-xl mb-4"
        style={{ background: "#ffffff", border: "1px solid #e5e7eb", boxShadow: "0 1px 4px rgba(0,0,0,0.04)", overflow: "hidden" }}
      >
        <div className="px-5 py-4" style={{ borderBottom: "1px solid #f3f4f6" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Period vs Period
          </div>
          <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>
            Ukupan pickup u dva perioda — zbir dnevnih pomeranja, ne stanje na kraju perioda
          </div>
        </div>

        {/* Period pickers */}
        <div className="flex flex-col md:flex-row gap-4 p-5" style={{ borderBottom: "1px solid #f3f4f6" }}>
          <div className="flex-1 rounded-xl" style={{ border: "2px solid #3b82f630" }}>
            <div className="px-4 py-2.5 rounded-t-xl" style={{ background: "#3b82f60a", borderBottom: "1px solid #3b82f620" }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#3b82f6", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Period A
              </span>
            </div>
            <div className="flex items-center gap-2 p-4">
              <input type="date" value={startA} onChange={e => setStartA(e.target.value)} style={{ ...inputStyle(), flex: 1 }} />
              <span style={{ fontSize: 12, color: "#9ca3af" }}>—</span>
              <input type="date" value={endA} onChange={e => setEndA(e.target.value)} style={{ ...inputStyle(), flex: 1 }} />
            </div>
          </div>
          <div className="flex-1 rounded-xl" style={{ border: "2px solid #a855f730" }}>
            <div className="px-4 py-2.5 rounded-t-xl" style={{ background: "#a855f70a", borderBottom: "1px solid #a855f720" }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#a855f7", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Period B
              </span>
            </div>
            <div className="flex items-center gap-2 p-4">
              <input type="date" value={startB} onChange={e => setStartB(e.target.value)} style={{ ...inputStyle(), flex: 1 }} />
              <span style={{ fontSize: 12, color: "#9ca3af" }}>—</span>
              <input type="date" value={endB} onChange={e => setEndB(e.target.value)} style={{ ...inputStyle(), flex: 1 }} />
            </div>
          </div>
        </div>

        {loadingPeriods ? (
          <div className="flex items-center justify-center py-10">
            <div style={{ fontSize: 13, color: "#9ca3af" }}>Učitavanje…</div>
          </div>
        ) : !totalsA || !totalsB ? (
          <div className="flex items-center justify-center py-10">
            <div style={{ fontSize: 13, color: "#9ca3af" }}>Izaberite oba perioda da vidite poređenje.</div>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 620 }}>
              <thead>
                <tr style={{ background: "#f9fafb" }}>
                  <th style={{ padding: "10px 20px", textAlign: "left", fontSize: 10, fontWeight: 700, color: "#9ca3af", letterSpacing: "0.06em", textTransform: "uppercase", borderBottom: "1px solid #e5e7eb" }}>
                    Metrika
                  </th>
                  <th style={{ padding: "10px 16px", textAlign: "right", fontSize: 10, fontWeight: 700, color: "#3b82f6", letterSpacing: "0.06em", textTransform: "uppercase", borderBottom: "1px solid #e5e7eb" }}>
                    Period A
                  </th>
                  <th style={{ padding: "10px 16px", textAlign: "right", fontSize: 10, fontWeight: 700, color: "#a855f7", letterSpacing: "0.06em", textTransform: "uppercase", borderBottom: "1px solid #e5e7eb" }}>
                    Period B
                  </th>
                  <th style={{ padding: "10px 16px", textAlign: "right", fontSize: 10, fontWeight: 700, color: "#9ca3af", letterSpacing: "0.06em", textTransform: "uppercase", borderBottom: "1px solid #e5e7eb" }}>
                    Razlika
                  </th>
                </tr>
              </thead>
              <tbody>
                {PICKUP_ROW_DEFS.map(rowDef => {
                  const daysA = totalsA.daysWithData[rowDef.key];
                  const daysB = totalsB.daysWithData[rowDef.key];
                  const hasA = daysA > 0;
                  const hasB = daysB > 0;
                  const valA = totalsA.totals[rowDef.key];
                  const valB = totalsB.totals[rowDef.key];
                  const diff = hasA && hasB ? valA - valB : null;
                  const isPos = diff !== null && diff > 0;
                  const isNeg = diff !== null && diff < 0;
                  const diffColor = isPos ? "#16a34a" : isNeg ? "#dc2626" : "#6b7280";

                  return (
                    <tr key={rowDef.key} style={{ borderBottom: "1px solid #f3f4f6" }}>
                      <td style={{ padding: "12px 20px", fontSize: 13, fontWeight: 600, color: "#374151" }}>{rowDef.label}</td>
                      <td style={{ padding: "12px 16px", textAlign: "right" }}>
                        {hasA ? (
                          <div>
                            <span style={{ fontSize: 14, fontWeight: 700, color: "#111827", fontVariantNumeric: "tabular-nums" }}>
                              {fmtSigned(valA, rowDef)}
                            </span>
                            <div style={{ fontSize: 10, color: "#d1d5db" }}>{daysA} {daysA === 1 ? "dan" : "dana"} s podacima</div>
                          </div>
                        ) : (
                          <span style={{ fontSize: 13, color: "#d1d5db" }}>nema podataka</span>
                        )}
                      </td>
                      <td style={{ padding: "12px 16px", textAlign: "right" }}>
                        {hasB ? (
                          <div>
                            <span style={{ fontSize: 14, fontWeight: 700, color: "#111827", fontVariantNumeric: "tabular-nums" }}>
                              {fmtSigned(valB, rowDef)}
                            </span>
                            <div style={{ fontSize: 10, color: "#d1d5db" }}>{daysB} {daysB === 1 ? "dan" : "dana"} s podacima</div>
                          </div>
                        ) : (
                          <span style={{ fontSize: 13, color: "#d1d5db" }}>nema podataka</span>
                        )}
                      </td>
                      <td style={{ padding: "12px 16px", textAlign: "right" }}>
                        {diff === null ? (
                          <span style={{ fontSize: 12, color: "#d1d5db" }}>—</span>
                        ) : (
                          <div className="flex items-center justify-end gap-1.5">
                            {isPos && <TrendingUp size={13} color={diffColor} />}
                            {isNeg && <TrendingDown size={13} color={diffColor} />}
                            {!isPos && !isNeg && <Minus size={13} color={diffColor} />}
                            <span style={{ fontSize: 13, fontWeight: 700, color: diffColor, fontVariantNumeric: "tabular-nums" }}>
                              {fmtSigned(diff, rowDef)}
                            </span>
                          </div>
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

      {/* Footer note */}
      <div
        className="rounded-lg mb-2"
        style={{ padding: "10px 14px", background: "#f9fafb", border: "1px solid #f3f4f6" }}
      >
        <span style={{ fontSize: 11, color: "#9ca3af" }}>
          💡 Read-only pregled. Pickup se unosi na stranici Unos Podataka ili se uvozi iz Excel izveštaja.
        </span>
      </div>
    </>
  );
}
