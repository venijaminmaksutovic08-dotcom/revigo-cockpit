"use client";

import { useEffect, useState } from "react";
import { BookMarked, TrendingUp, TrendingDown } from "lucide-react";
import {
  formatDateSr,
  fetchOnBooksForDate,
  fetchOnBooksLastYear,
  fetchLatestMonthSnapshot,
  getOnBooksStayMonths,
  getCurrentMonthDef,
  toISO,
  dateParts,
  shiftYears,
  type OnBooksMonthInput,
  type StayMonthDef,
  type CurrentMonthSnapshot,
} from "../lib/dashboardData";
import type { OnBooksSnapshotRow } from "../lib/supabaseClient";

interface OnBooksSectionProps {
  hotelId: string;
  asOfDate: string;
  refreshKey?: number;
}

function fmtInt(n: number): string { return Math.round(n).toLocaleString("sr-RS"); }
function fmtRSD(n: number): string { return `${Math.round(n).toLocaleString("sr-RS")} RSD`; }
function fmtPct(n: number): string { return `${(Math.round(n * 10) / 10).toLocaleString("sr-RS")}%`; }

interface MonthCardData {
  def: StayMonthDef;
  current: Pick<OnBooksMonthInput, "roomsOnbooks" | "revenueOnbooks" | "occupancyOnbooks">;
  lastYear: Pick<OnBooksSnapshotRow, "rooms_onbooks" | "revenue_onbooks" | "occupancy_onbooks"> | null;
}

function DeltaLine({ label, current, lastYear, formatter }: { label: string; current: number; lastYear: number | null; formatter: (n: number) => string }) {
  if (lastYear === null || lastYear === 0) {
    return (
      <div className="flex items-center justify-between">
        <span style={{ fontSize: 11, color: "#9ca3af" }}>{label}</span>
        <span style={{ fontSize: 11, color: "#d1d5db" }}>—</span>
      </div>
    );
  }
  const diff = current - lastYear;
  const pct = Math.round((diff / Math.abs(lastYear)) * 1000) / 10;
  const color = diff > 0 ? "#16a34a" : diff < 0 ? "#dc2626" : "#9ca3af";
  return (
    <div className="flex items-center justify-between">
      <span style={{ fontSize: 11, color: "#9ca3af" }}>{label}</span>
      <span className="flex items-center gap-1" style={{ fontSize: 11, fontWeight: 700, color }}>
        {diff > 0 ? <TrendingUp size={11} /> : diff < 0 ? <TrendingDown size={11} /> : null}
        {diff >= 0 ? "+" : ""}{formatter(diff)} ({pct >= 0 ? "+" : ""}{pct}%)
      </span>
    </div>
  );
}

function MonthCard({ data, asOfDate, subtitle }: { data: MonthCardData; asOfDate: string; subtitle?: string }) {
  const { def, current, lastYear } = data;
  return (
    <div
      className="rounded-xl flex-1"
      style={{ background: "#ffffff", border: "1px solid #e5e7eb", boxShadow: "0 1px 4px rgba(0,0,0,0.04)", padding: "16px 18px", minWidth: 0 }}
    >
      <div style={{ fontSize: 14, fontWeight: 800, color: "#111827", marginBottom: 2 }}>{def.label}</div>
      <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 12 }}>
        {subtitle ?? `On-Books na dan ${formatDateSr(asOfDate)}`}
      </div>

      <div className="flex flex-col gap-2" style={{ marginBottom: 12 }}>
        <div className="flex items-center justify-between">
          <span style={{ fontSize: 12, color: "#6b7280" }}>Rezervisana noćenja</span>
          <span style={{ fontSize: 15, fontWeight: 700, color: "#111827" }}>{fmtInt(current.roomsOnbooks)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span style={{ fontSize: 12, color: "#6b7280" }}>On-books prihod</span>
          <span style={{ fontSize: 15, fontWeight: 700, color: "#111827" }}>{fmtRSD(current.revenueOnbooks)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span style={{ fontSize: 12, color: "#6b7280" }}>On-books popunjenost</span>
          <span style={{ fontSize: 15, fontWeight: 700, color: "#111827" }}>{fmtPct(current.occupancyOnbooks)}</span>
        </div>
      </div>

      <div className="flex flex-col gap-1.5" style={{ paddingTop: 10, borderTop: "1px solid #f3f4f6" }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 2 }}>
          vs isti datum lani
        </div>
        <DeltaLine label="Noćenja" current={current.roomsOnbooks} lastYear={lastYear?.rooms_onbooks ?? null} formatter={fmtInt} />
        <DeltaLine label="Prihod" current={current.revenueOnbooks} lastYear={lastYear?.revenue_onbooks ?? null} formatter={fmtRSD} />
        <DeltaLine label="Popunjenost" current={current.occupancyOnbooks} lastYear={lastYear?.occupancy_onbooks ?? null} formatter={fmtPct} />
      </div>
    </div>
  );
}

export default function OnBooksSection({ hotelId, asOfDate, refreshKey }: OnBooksSectionProps) {
  const [months, setMonths] = useState<MonthCardData[] | null>(null);
  const [currentSnapshot, setCurrentSnapshot] = useState<CurrentMonthSnapshot | null>(null);
  const [currentLastYearSnapshot, setCurrentLastYearSnapshot] = useState<CurrentMonthSnapshot | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!hotelId || !asOfDate) { setMonths(null); setCurrentSnapshot(null); setCurrentLastYearSnapshot(null); return; }
    let cancelled = false;
    setLoading(true);

    (async () => {
      const { year, month } = dateParts(asOfDate);
      const monthStart = toISO(year, month, 1);
      const lastYearAsOfDate = shiftYears(asOfDate, -1);
      const lastYearMonthStart = shiftYears(monthStart, -1);

      const [current, stayMonths, currentMonthSnap, currentMonthLastYearSnap] = await Promise.all([
        fetchOnBooksForDate(hotelId, asOfDate),
        Promise.resolve(getOnBooksStayMonths(asOfDate)),
        fetchLatestMonthSnapshot(hotelId, monthStart, asOfDate),
        fetchLatestMonthSnapshot(hotelId, lastYearMonthStart, lastYearAsOfDate),
      ]);
      const lastYearRows = await Promise.all(
        stayMonths.map(def => fetchOnBooksLastYear(hotelId, asOfDate, def.month, def.year))
      );
      if (cancelled) return;
      setMonths(stayMonths.map((def, i) => ({ def, current: current[i], lastYear: lastYearRows[i] })));
      setCurrentSnapshot(currentMonthSnap);
      setCurrentLastYearSnapshot(currentMonthLastYearSnap);
      setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [hotelId, asOfDate, refreshKey]);

  return (
    <div className="mb-5">
      <div className="flex items-center gap-2 mb-3">
        <BookMarked size={16} color="#C9A84C" />
        <div style={{ fontSize: 13, fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: "0.06em" }}>
          Ovaj mesec i buduće rezervacije
        </div>
      </div>

      {loading || !months || !currentSnapshot ? (
        <div
          className="rounded-xl flex items-center justify-center"
          style={{ minHeight: 100, background: "#ffffff", border: "1px solid #e5e7eb" }}
        >
          <span style={{ fontSize: 12, color: "#9ca3af" }}>Učitavanje…</span>
        </div>
      ) : (
        <div className="flex flex-col md:flex-row gap-4">
          <MonthCard
            data={{
              def: getCurrentMonthDef(asOfDate),
              current: {
                roomsOnbooks: currentSnapshot.roomsOnbooks,
                revenueOnbooks: currentSnapshot.revenueOnbooks,
                occupancyOnbooks: currentSnapshot.occupancyOnbooks,
              },
              lastYear: currentLastYearSnapshot?.reportDate
                ? {
                    rooms_onbooks: currentLastYearSnapshot.roomsOnbooks,
                    revenue_onbooks: currentLastYearSnapshot.revenueOnbooks,
                    occupancy_onbooks: currentLastYearSnapshot.occupancyOnbooks,
                  }
                : null,
            }}
            asOfDate={asOfDate}
            subtitle={currentSnapshot.reportDate ? `Actuals na dan ${formatDateSr(currentSnapshot.reportDate)}` : "Nema podataka"}
          />
          {months.map(m => <MonthCard key={`${m.def.year}-${m.def.month}`} data={m} asOfDate={asOfDate} />)}
        </div>
      )}
    </div>
  );
}
