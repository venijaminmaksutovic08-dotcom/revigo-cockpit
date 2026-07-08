"use client";

import { Fragment, useMemo, useState } from "react";
import {
  CalendarRange, DollarSign, Percent, Receipt, TrendingUp, Download,
} from "lucide-react";
import {
  useHotel,
  dateToISO,
  emptyEntryData,
  ROW_DEFS,
  type EntryData,
} from "../context/HotelContext";
import type { KPIStatus } from "../data/hotelData";
import DateActionModal from "../components/DateActionModal";
import DataEntryModal from "../components/DataEntryModal";
import ImportReportModal from "../components/ImportReportModal";
import type { ParsedReportRow } from "../lib/reportImport";

// ── Constants ──────────────────────────────────────────────────────────────────

const WEEKDAYS_SR = ["Pon", "Uto", "Sre", "Čet", "Pet", "Sub", "Ned"];
const MONTHS_LOWER = [
  "januar", "februar", "mart", "april", "maj", "jun",
  "jul", "avgust", "septembar", "oktobar", "novembar", "decembar",
];

const TODAY = new Date();

// ── Performance helpers ───────────────────────────────────────────────────────

type Perf = "above" | "near" | "below" | "none";

function perfFor(value: number, target: number): Perf {
  if (target <= 0) return value > 0 ? "above" : "none";
  if (value >= target) return "above";
  if (value >= target * 0.9) return "near";
  return "below";
}

const PERF_BG: Record<Perf, string> = {
  above: "rgba(34,197,94,0.05)",
  near: "rgba(234,179,8,0.05)",
  below: "rgba(239,68,68,0.05)",
  none: "transparent",
};

type RowStatus = "green" | "yellow" | "red" | "none";

function combinedStatus(revPerf: Perf, occPerf: Perf): RowStatus {
  const parts = [revPerf, occPerf].filter(p => p !== "none");
  if (parts.length === 0) return "none";
  if (parts.every(p => p === "above")) return "green";
  if (parts.every(p => p === "below")) return "red";
  return "yellow";
}

const STATUS_EMOJI: Record<RowStatus, string> = { green: "🟢", yellow: "🟡", red: "🔴", none: "—" };

const CARD_STATUS_COLOR: Record<KPIStatus, string> = {
  ahead: "#16a34a",
  onpace: "#d97706",
  behind: "#dc2626",
  empty: "#e5e7eb",
};

// ── Formatting ─────────────────────────────────────────────────────────────────

function fmtInt(n: number): string { return Math.round(n).toLocaleString("sr-RS"); }
function fmtRSD(n: number): string { return `${Math.round(n).toLocaleString("sr-RS")} RSD`; }
function fmtPct1(n: number): string { return `${(Math.round(n * 10) / 10).toLocaleString("sr-RS")}%`; }

function formatDateLabel(year: number, month: number, day: number): string {
  return new Date(year, month - 1, day).toLocaleDateString("sr-RS", { day: "numeric", month: "long", year: "numeric" });
}

// ── Day row model ──────────────────────────────────────────────────────────────

interface DayRow {
  day: number;
  dateISO: string;
  weekdayIdx: number;
  isWeekend: boolean;
  isToday: boolean;
  entry: EntryData | null;
  nocenja: number | null;
  prihod: number | null;
  adr: number | null;
  popunjenost: number | null;
  revpar: number | null;
  revTarget: number;
  occTarget: number;
  revPerf: Perf;
  occPerf: Perf;
  status: RowStatus;
}

// ── Summary card ───────────────────────────────────────────────────────────────

interface SummaryCardKpi {
  label: string;
  value: string;
  target: string;
  achievement: number;
  status: KPIStatus;
  yoyChangePct: number | null;
}

function SummaryCard({ kpi, icon }: { kpi: SummaryCardKpi; icon: React.ReactNode }) {
  const color = CARD_STATUS_COLOR[kpi.status];
  const isEmpty = kpi.status === "empty";
  return (
    <div
      className="rounded-xl flex flex-col"
      style={{
        background: "#ffffff",
        border: `1px solid ${color}40`,
        borderLeft: `3px solid ${color}`,
        boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
        padding: "16px 18px",
        flex: 1,
        minWidth: 0,
      }}
    >
      <div className="flex items-center justify-between mb-2">
        <span style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", letterSpacing: "0.08em", textTransform: "uppercase" }}>
          {kpi.label}
        </span>
        <div
          className="rounded-lg flex items-center justify-center"
          style={{ width: 28, height: 28, background: `${color}12`, border: `1px solid ${color}25`, flexShrink: 0 }}
        >
          {icon}
        </div>
      </div>
      <div style={{ fontSize: 22, fontWeight: 800, color: isEmpty ? "#d1d5db" : "#111827", letterSpacing: "-0.02em", marginBottom: 8, lineHeight: 1.1 }}>
        {kpi.value}
      </div>
      <div className="flex items-center justify-between" style={{ fontSize: 11 }}>
        <span style={{ color: "#9ca3af" }}>Target: {kpi.target}</span>
        <span style={{ fontWeight: 700, color: isEmpty ? "#d1d5db" : color }}>
          {isEmpty ? "—" : `${kpi.achievement}%`}
        </span>
      </div>
      <div style={{ fontSize: 11, marginTop: 4, color: kpi.yoyChangePct === null ? "#d1d5db" : kpi.yoyChangePct >= 0 ? "#16a34a" : "#dc2626" }}>
        {kpi.yoyChangePct === null ? "vs LG: —" : `${kpi.yoyChangePct >= 0 ? "▲" : "▼"} ${Math.abs(kpi.yoyChangePct)}% vs LG`}
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

type ModalMode = "action" | "manual" | "import" | null;

export default function MesecniPage() {
  const {
    selectedHotel,
    selectedHotelName,
    selectedPeriod,
    monthInfo,
    getEntryForDate,
    saveEntryForDate,
    monthlyTarget,
    kpiData,
  } = useHotel();

  const [openDay, setOpenDay] = useState<number | null>(null);
  const [mode, setMode] = useState<ModalMode>(null);

  const dayRows = useMemo<DayRow[]>(() => {
    if (!monthInfo) return [];
    const { year, month, daysInMonth } = monthInfo;
    const perDayRevenuePace = monthlyTarget ? monthlyTarget.revenue_target / daysInMonth : 0;
    const occTargetFlat = monthlyTarget?.occupancy_target ?? 0;

    return Array.from({ length: daysInMonth }, (_, i) => {
      const day = i + 1;
      const dateISO = dateToISO(year, month, day);
      const entry = getEntryForDate(dateISO);
      const weekdayIdx = (new Date(year, month - 1, day).getDay() + 6) % 7;
      const isWeekend = weekdayIdx >= 5;
      const isToday = TODAY.getFullYear() === year && TODAY.getMonth() + 1 === month && TODAY.getDate() === day;

      const nocenja = entry ? entry.brojNocenja.naKnjigamaDanas : null;
      const prihod = entry ? entry.ukupanPrihod.naKnjigamaDanas : null;
      const adr = entry ? entry.adr.naKnjigamaDanas : null;
      const popunjenost = entry ? entry.popunjenost.naKnjigamaDanas : null;
      const revpar = entry ? entry.revpar.naKnjigamaDanas : null;

      const revTarget = entry && entry.ukupanPrihod.target > 0 ? entry.ukupanPrihod.target : perDayRevenuePace;
      const occTarget = entry && entry.popunjenost.target > 0 ? entry.popunjenost.target : occTargetFlat;

      const revPerf: Perf = entry ? perfFor(prihod ?? 0, revTarget) : "none";
      const occPerf: Perf = entry ? perfFor(popunjenost ?? 0, occTarget) : "none";
      const status = entry ? combinedStatus(revPerf, occPerf) : "none";

      return {
        day, dateISO, weekdayIdx, isWeekend, isToday, entry,
        nocenja, prihod, adr, popunjenost, revpar,
        revTarget, occTarget, revPerf, occPerf, status,
      };
    });
  }, [monthInfo, monthlyTarget, getEntryForDate]);

  const weeks = useMemo(() => {
    const result: DayRow[][] = [];
    for (let i = 0; i < dayRows.length; i += 7) result.push(dayRows.slice(i, i + 7));
    return result;
  }, [dayRows]);

  // ── Summary cards (reuses HotelContext's MTD-aggregated kpiData) ────────────
  const summaryCards = useMemo(() => {
    const byKey = (key: string) => {
      const idx = ROW_DEFS.findIndex(r => r.key === key);
      return kpiData[idx] as SummaryCardKpi | undefined;
    };
    const specs: { key: string; label: string; icon: React.ReactNode }[] = [
      { key: "ukupanPrihod", label: "Ukupan Prihod", icon: <DollarSign size={14} color="#374151" /> },
      { key: "popunjenost", label: "Prosečna Popunjenost", icon: <Percent size={14} color="#374151" /> },
      { key: "adr", label: "Prosečan ADR", icon: <Receipt size={14} color="#374151" /> },
      { key: "revpar", label: "Prosečan RevPAR", icon: <TrendingUp size={14} color="#374151" /> },
    ];
    return specs
      .map(spec => ({ ...spec, kpi: byKey(spec.key) }))
      .filter((s): s is typeof s & { kpi: SummaryCardKpi } => Boolean(s.kpi));
  }, [kpiData]);

  // ── Modal wiring — identical pattern to DataEntryCalendar ───────────────────
  const openDate = openDay !== null && monthInfo ? dateToISO(monthInfo.year, monthInfo.month, openDay) : null;
  const openEntry = openDate ? getEntryForDate(openDate) : null;
  const dateLabel = openDay !== null && monthInfo ? formatDateLabel(monthInfo.year, monthInfo.month, openDay) : "";
  const hasExisting = openEntry !== null;

  function handleRowClick(day: number) {
    setOpenDay(day);
    setMode("action");
  }

  function closeAll() {
    setOpenDay(null);
    setMode(null);
  }

  // ── Export ────────────────────────────────────────────────────────────────
  function handleExport() {
    if (!monthInfo) return;
    const header = ["Datum", "Dan", "Noćenja", "Prihod", "ADR", "Popunjenost%", "RevPAR"];
    const lines = [header.join(",")];
    for (const row of dayRows) {
      lines.push([
        row.dateISO,
        WEEKDAYS_SR[row.weekdayIdx],
        row.nocenja !== null ? Math.round(row.nocenja) : "",
        row.prihod !== null ? Math.round(row.prihod) : "",
        row.adr !== null ? Math.round(row.adr) : "",
        row.popunjenost !== null ? Math.round(row.popunjenost * 10) / 10 : "",
        row.revpar !== null ? Math.round(row.revpar) : "",
      ].join(","));
    }
    const csv = "﻿" + lines.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const hotelSlug = (selectedHotelName || "hotel").replace(/\s+/g, "-").toLowerCase();
    a.download = `mesecni-pregled_${hotelSlug}_${monthInfo.year}-${String(monthInfo.month).padStart(2, "0")}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function rowBackground(row: DayRow, idx: number): string {
    if (row.isToday) return "rgba(201,168,76,0.08)";
    if (!row.entry) return "#f8f8f8";
    if (row.isWeekend) return idx % 2 === 0 ? "#f5f4fa" : "#f0eff7";
    return idx % 2 === 0 ? "#ffffff" : "#fafafa";
  }

  return (
    <>
      {/* Header */}
      <div className="flex items-start justify-between mb-5 flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <CalendarRange size={18} color="#C9A84C" strokeWidth={2.5} />
            <h1 style={{ fontSize: 20, fontWeight: 800, color: "#111827", letterSpacing: "-0.02em", margin: 0 }}>
              Mesečni Pregled
            </h1>
          </div>
          <div style={{ fontSize: 12, color: "#9ca3af" }}>
            {selectedHotelName && selectedPeriod
              ? `Detaljan pregled svih dana u mesecu — ${selectedHotelName} · ${selectedPeriod}`
              : "Detaljan pregled svih dana u mesecu"}
          </div>
        </div>

        {selectedHotel && monthInfo && dayRows.length > 0 && (
          <button
            onClick={handleExport}
            className="flex items-center gap-2 rounded-lg"
            style={{
              height: 38, paddingLeft: 16, paddingRight: 16, border: "none",
              background: "linear-gradient(135deg, #C9A84C 0%, #E8C96B 100%)",
              color: "#ffffff", fontSize: 13, fontWeight: 600, cursor: "pointer",
              boxShadow: "0 2px 8px rgba(201,168,76,0.3)",
            }}
          >
            <Download size={15} />
            Izvezi podatke
          </button>
        )}
      </div>

      {!selectedHotel || !monthInfo ? (
        <div
          className="flex flex-col items-center justify-center rounded-xl"
          style={{ minHeight: 300, background: "#ffffff", border: "1px solid #e5e7eb", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}
        >
          <CalendarRange size={32} color="#e5e7eb" strokeWidth={1.5} style={{ marginBottom: 12 }} />
          <div style={{ fontSize: 14, fontWeight: 600, color: "#9ca3af", marginBottom: 4 }}>Izaberite hotel</div>
          <div style={{ fontSize: 12, color: "#d1d5db" }}>Izaberite hotel iz bočne trake da vidite mesečni pregled</div>
        </div>
      ) : (
        <>
          {/* Summary cards */}
          {summaryCards.length > 0 && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              {summaryCards.map(({ key, label, icon, kpi }) => (
                <SummaryCard key={key} kpi={{ ...kpi, label }} icon={icon} />
              ))}
            </div>
          )}

          {/* Daily table with weekly summary rows */}
          <div
            className="rounded-xl mb-6"
            style={{ background: "#ffffff", border: "1px solid #e5e7eb", boxShadow: "0 1px 4px rgba(0,0,0,0.04)", overflow: "hidden" }}
          >
            <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: "1px solid #f3f4f6" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Dnevni Podaci — {selectedPeriod}
              </div>
              <div style={{ fontSize: 11, color: "#9ca3af" }}>Kliknite na dan za detalje</div>
            </div>

            <div style={{ maxHeight: 640, overflow: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 720 }}>
                <thead>
                  <tr style={{ background: "#f9fafb" }}>
                    {["DATUM", "DAN", "NOĆENJA", "PRIHOD", "ADR", "POPUNJENOST", "REVPAR", "STATUS"].map((h, i) => (
                      <th
                        key={h}
                        style={{
                          position: "sticky", top: 0, zIndex: 1,
                          padding: "10px 14px", textAlign: i === 0 || i === 1 ? "left" : "right",
                          fontSize: 10, fontWeight: 700, color: "#9ca3af", letterSpacing: "0.06em",
                          textTransform: "uppercase", borderBottom: "1px solid #e5e7eb", background: "#f9fafb",
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {weeks.map((week, wi) => {
                    const withData = week.filter(d => d.entry);
                    const revenueSum = withData.reduce((s, d) => s + (d.prihod ?? 0), 0);
                    const nocenjaSum = withData.reduce((s, d) => s + (d.nocenja ?? 0), 0);
                    const occAvg = withData.length > 0
                      ? withData.reduce((s, d) => s + (d.popunjenost ?? 0), 0) / withData.length
                      : 0;
                    const targetSum = week.reduce((s, d) => s + d.revTarget, 0);
                    const occTargetAvg = week.length > 0 ? week.reduce((s, d) => s + d.occTarget, 0) / week.length : 0;
                    const weekStatus: RowStatus = withData.length > 0
                      ? combinedStatus(perfFor(revenueSum, targetSum), perfFor(occAvg, occTargetAvg))
                      : "none";
                    const weekBg = weekStatus === "green" ? "rgba(34,197,94,0.07)"
                      : weekStatus === "yellow" ? "rgba(234,179,8,0.07)"
                      : weekStatus === "red" ? "rgba(239,68,68,0.07)"
                      : "#f3f4f6";
                    const first = week[0];
                    const last = week[week.length - 1];

                    return (
                      <Fragment key={wi}>
                        <tr>
                          <td colSpan={8} style={{ padding: "8px 14px", background: weekBg, borderTop: "1px solid #e5e7eb", borderBottom: "1px solid #e5e7eb" }}>
                            <span style={{ fontSize: 12, fontWeight: 700, color: "#374151" }}>
                              Sedmica {wi + 1} ({first.day}-{last.day} {MONTHS_LOWER[monthInfo.month - 1]}):
                            </span>{" "}
                            <span style={{ fontSize: 12, color: "#6b7280" }}>
                              Prihod: {fmtRSD(revenueSum)} | Noćenja: {fmtInt(nocenjaSum)} | Avg Popunjenost: {fmtPct1(occAvg)}
                            </span>
                          </td>
                        </tr>
                        {week.map((row, idx) => (
                          <tr
                            key={row.day}
                            onClick={() => handleRowClick(row.day)}
                            style={{ background: rowBackground(row, idx), cursor: "pointer", outline: row.isToday ? "1.5px solid rgba(201,168,76,0.4)" : "none", outlineOffset: "-1.5px" }}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.filter = "brightness(0.97)"; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.filter = "none"; }}
                          >
                            <td style={{ padding: "10px 14px", fontSize: 13, fontWeight: row.isToday ? 800 : 600, color: row.isToday ? "#C9A84C" : "#374151", borderBottom: "1px solid #f3f4f6" }}>
                              {row.day} {MONTHS_LOWER[monthInfo.month - 1]}
                            </td>
                            <td style={{ padding: "10px 14px", fontSize: 12, color: "#9ca3af", borderBottom: "1px solid #f3f4f6" }}>
                              {WEEKDAYS_SR[row.weekdayIdx]}
                            </td>
                            <td style={{ padding: "10px 14px", textAlign: "right", fontSize: 13, color: row.entry ? "#111827" : "#d1d5db", fontVariantNumeric: "tabular-nums", borderBottom: "1px solid #f3f4f6" }}>
                              {row.nocenja !== null ? fmtInt(row.nocenja) : "—"}
                            </td>
                            <td style={{ padding: "10px 14px", textAlign: "right", fontSize: 13, fontWeight: 600, color: row.entry ? "#111827" : "#d1d5db", background: PERF_BG[row.revPerf], fontVariantNumeric: "tabular-nums", borderBottom: "1px solid #f3f4f6" }}>
                              {row.prihod !== null ? fmtRSD(row.prihod) : "—"}
                            </td>
                            <td style={{ padding: "10px 14px", textAlign: "right", fontSize: 13, color: row.entry ? "#111827" : "#d1d5db", fontVariantNumeric: "tabular-nums", borderBottom: "1px solid #f3f4f6" }}>
                              {row.adr !== null ? fmtRSD(row.adr) : "—"}
                            </td>
                            <td style={{ padding: "10px 14px", textAlign: "right", fontSize: 13, fontWeight: 600, color: row.entry ? "#111827" : "#d1d5db", background: PERF_BG[row.occPerf], fontVariantNumeric: "tabular-nums", borderBottom: "1px solid #f3f4f6" }}>
                              {row.popunjenost !== null ? fmtPct1(row.popunjenost) : "—"}
                            </td>
                            <td style={{ padding: "10px 14px", textAlign: "right", fontSize: 13, color: row.entry ? "#111827" : "#d1d5db", fontVariantNumeric: "tabular-nums", borderBottom: "1px solid #f3f4f6" }}>
                              {row.revpar !== null ? fmtRSD(row.revpar) : "—"}
                            </td>
                            <td style={{ padding: "10px 14px", textAlign: "right", borderBottom: "1px solid #f3f4f6" }}>
                              {row.entry ? (
                                <span style={{ fontSize: 14 }}>{STATUS_EMOJI[row.status]}</span>
                              ) : (
                                <button
                                  className="rounded-lg"
                                  style={{
                                    padding: "4px 10px", fontSize: 11, fontWeight: 600, color: "#C9A84C",
                                    background: "rgba(201,168,76,0.08)", border: "1px solid rgba(201,168,76,0.25)", cursor: "pointer",
                                  }}
                                >
                                  Unesi
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ── Action chooser ─────────────────────────────────────────────────── */}
      {mode === "action" && openDay !== null && monthInfo && (
        <DateActionModal
          dateLabel={dateLabel}
          hotel={selectedHotelName}
          hasExistingEntry={hasExisting}
          onManual={() => setMode("manual")}
          onImport={() => setMode("import")}
          onClose={closeAll}
        />
      )}

      {/* ── Manual entry modal ─────────────────────────────────────────────── */}
      {mode === "manual" && openDay !== null && openDate && (
        <DataEntryModal
          hotel={selectedHotelName}
          dateLabel={dateLabel}
          initialData={openEntry ?? emptyEntryData()}
          onSave={async data => {
            await saveEntryForDate(openDate, data);
            closeAll();
          }}
          onClose={closeAll}
        />
      )}

      {/* ── Single-date import modal ───────────────────────────────────────── */}
      {mode === "import" && openDay !== null && openDate && (
        <ImportReportModal
          hotel={selectedHotelName}
          fixedDate={{ dateISO: openDate, dateLabel }}
          onConfirm={async (rows: ParsedReportRow[]) => {
            if (rows.length > 0) {
              await saveEntryForDate(openDate, rows[0].data);
            }
            closeAll();
          }}
          onClose={closeAll}
        />
      )}
    </>
  );
}
