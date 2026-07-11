"use client";

import { useEffect, useState } from "react";
import { DollarSign, Moon, BarChart2, Percent, TrendingUp, Target, FileSpreadsheet } from "lucide-react";
import KPICard from "./components/KPICard";
import PriceTable from "./components/PriceTable";
import RightPanel from "./components/RightPanel";
import DailyBriefing from "./components/DailyBriefing";
import DateSelectorBar, { type DashboardViewMode } from "./components/DateSelectorBar";
import OnBooksSection from "./components/OnBooksSection";
import ReportLog from "./components/ReportLog";
import PaceForecasting from "./components/PaceForecasting";
import ManagerNotes from "./components/ManagerNotes";
import WeatherWidget from "./components/WeatherWidget";
import EventsWidget from "./components/EventsWidget";
import CompetitorPrices from "./components/CompetitorPrices";
import MonthlyTargetsModal from "./components/MonthlyTargetsModal";
import ImportReportModal from "./components/ImportReportModal";
import { dailyData, priorityActions, revenueGapData } from "./data/hotelData";
import { useHotel, ROW_DEFS } from "./context/HotelContext";
import type { ParsedReportRow } from "./lib/reportImport";
import {
  todayISO, shiftYears, yearMonthOf, daysInMonthOf, dateParts, formatDateSr,
  fetchLatestReportDate, fetchDayReport, fetchMonthlyTargetFor, fetchPeriodAggregate,
  buildDayKpiData, type PeriodAggregate,
} from "./lib/dashboardData";
import type { DailyReportRow, MonthlyTargetRow } from "./lib/supabaseClient";

const KPI_ICON_BY_ROW: Record<string, React.ReactNode> = {
  brojNocenja:   <Moon       key="nights"  size={18} color="#C9A84C" strokeWidth={2.5} />,
  ukupanPrihod:  <DollarSign key="revenue" size={18} color="#C9A84C" strokeWidth={2.5} />,
  adr:           <BarChart2  key="adr"     size={18} color="#C9A84C" strokeWidth={2.5} />,
  popunjenost:   <Percent    key="occ"     size={18} color="#C9A84C" strokeWidth={2.5} />,
  revpar:        <TrendingUp key="revpar"  size={18} color="#C9A84C" strokeWidth={2.5} />,
};

const PERIOD_LABEL_BY_ROW: Record<string, string> = {
  brojNocenja:  "Noćenja (suma)",
  ukupanPrihod: "Prihod (suma)",
  adr:          "ADR (prosek)",
  popunjenost:  "Popunjenost (prosek)",
  revpar:       "RevPAR (prosek)",
};

function fmtRow(key: string, n: number): string {
  if (key === "popunjenost") return `${(Math.round(n * 10) / 10).toLocaleString("sr-RS")}%`;
  if (key === "brojNocenja") return Math.round(n).toLocaleString("sr-RS");
  return `${Math.round(n).toLocaleString("sr-RS")} RSD`;
}

function PeriodStatCard({ rowKey, value }: { rowKey: string; value: number }) {
  return (
    <div
      className="rounded-xl flex flex-col"
      style={{ background: "#ffffff", border: "1px solid #e5e7eb", boxShadow: "0 1px 4px rgba(0,0,0,0.04)", padding: "16px 18px", flex: 1, minWidth: 0 }}
    >
      <div className="flex items-center justify-between mb-3">
        <span style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", letterSpacing: "0.08em", textTransform: "uppercase" }}>
          {PERIOD_LABEL_BY_ROW[rowKey]}
        </span>
        <div
          className="rounded-xl flex items-center justify-center"
          style={{ width: 34, height: 34, background: "rgba(201,168,76,0.08)", border: "1px solid rgba(201,168,76,0.2)", flexShrink: 0 }}
        >
          {KPI_ICON_BY_ROW[rowKey]}
        </div>
      </div>
      <div style={{ fontSize: 26, fontWeight: 800, color: "#111827", letterSpacing: "-0.02em" }}>
        {fmtRow(rowKey, value)}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { selectedHotel, selectedHotelName, selectedPeriod, monthlyTarget, saveMonthlyTargets, saveEntryForDate } = useHotel();
  const canEnterData = Boolean(selectedHotel && selectedPeriod);
  const [showTargetsModal, setShowTargetsModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);

  // ── Dashboard's own date navigation — independent of the TopBar's month/period picker ──────
  const [mode, setMode]                 = useState<DashboardViewMode>("day");
  const [selectedDate, setSelectedDate] = useState<string>(todayISO());
  const [rangeStart, setRangeStart]     = useState<string>(todayISO());
  const [rangeEnd, setRangeEnd]         = useState<string>(todayISO());

  // Default to the most recently entered report whenever the hotel changes.
  useEffect(() => {
    if (!selectedHotel) return;
    let cancelled = false;
    fetchLatestReportDate(selectedHotel).then(latest => {
      if (cancelled) return;
      const d = latest ?? todayISO();
      setSelectedDate(d);
      setRangeStart(d);
      setRangeEnd(d);
      setMode("day");
    });
    return () => { cancelled = true; };
  }, [selectedHotel]);

  // ── Day mode: exact entered values for the selected date ───────────────────────────────────
  const [dayRow, setDayRow]                             = useState<DailyReportRow | null>(null);
  const [dayLastYearRow, setDayLastYearRow]              = useState<DailyReportRow | null>(null);
  const [dayMonthlyTarget, setDayMonthlyTarget]           = useState<MonthlyTargetRow | null>(null);
  const [dayLoading, setDayLoading]                       = useState(false);

  useEffect(() => {
    if (!selectedHotel || mode !== "day" || !selectedDate) return;
    let cancelled = false;
    setDayLoading(true);
    Promise.all([
      fetchDayReport(selectedHotel, selectedDate),
      fetchDayReport(selectedHotel, shiftYears(selectedDate, -1)),
      fetchMonthlyTargetFor(selectedHotel, yearMonthOf(selectedDate)),
    ]).then(([row, lastYearRow, target]) => {
      if (cancelled) return;
      setDayRow(row);
      setDayLastYearRow(lastYearRow);
      setDayMonthlyTarget(target);
      setDayLoading(false);
    });
    return () => { cancelled = true; };
  }, [selectedHotel, mode, selectedDate]);

  const dayKpiData = mode === "day"
    ? buildDayKpiData(dayRow, dayLastYearRow, dayMonthlyTarget, daysInMonthOf(selectedDate))
    : [];

  // ── Period mode: sum/average over a date range ──────────────────────────────────────────────
  const [periodAgg, setPeriodAgg]         = useState<PeriodAggregate | null>(null);
  const [periodLoading, setPeriodLoading] = useState(false);

  useEffect(() => {
    if (!selectedHotel || mode !== "period") return;
    let cancelled = false;
    setPeriodLoading(true);
    fetchPeriodAggregate(selectedHotel, rangeStart, rangeEnd).then(agg => {
      if (cancelled) return;
      setPeriodAgg(agg);
      setPeriodLoading(false);
    });
    return () => { cancelled = true; };
  }, [selectedHotel, mode, rangeStart, rangeEnd]);

  const asOfDate = mode === "day" ? selectedDate : rangeEnd;
  const logMonth = dateParts(asOfDate);

  return (
    <>
      <DailyBriefing />

      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: "#111827", letterSpacing: "-0.02em", margin: 0, lineHeight: 1.2 }}>
            Dashboard
          </h1>
          <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 3 }}>
            Pregled ključnih metrika i preporuka
          </div>
        </div>

        {canEnterData && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowImportModal(true)}
              style={{
                display: "flex", alignItems: "center", gap: 8,
                height: 38, paddingLeft: 16, paddingRight: 16,
                borderRadius: 8, border: "1px solid #e5e7eb",
                background: "#f9fafb",
                color: "#374151", fontSize: 13, fontWeight: 600, cursor: "pointer",
              }}
            >
              <FileSpreadsheet size={15} />
              Uvezi izveštaj
            </button>
            <button
              onClick={() => setShowTargetsModal(true)}
              style={{
                display: "flex", alignItems: "center", gap: 8,
                height: 38, paddingLeft: 16, paddingRight: 16,
                borderRadius: 8, border: "1px solid rgba(201,168,76,0.3)",
                background: "rgba(201,168,76,0.06)",
                color: "#C9A84C", fontSize: 13, fontWeight: 600, cursor: "pointer",
              }}
            >
              <Target size={15} />
              Postavi mesečne targete
            </button>
          </div>
        )}
      </div>

      {selectedHotel && (
        <DateSelectorBar
          mode={mode}
          selectedDate={selectedDate}
          rangeStart={rangeStart}
          rangeEnd={rangeEnd}
          onSelectDate={d => { setSelectedDate(d); setMode("day"); }}
          onSetMode={setMode}
          onSetRange={(s, e) => { setRangeStart(s); setRangeEnd(e); }}
        />
      )}

      {/* Actuals — snapshot for the selected date, or sum/average across the selected period */}
      {selectedHotel && mode === "day" && (
        <>
          <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 8, marginTop: -8 }}>
            Actuals — {formatDateSr(selectedDate)}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5" style={{ opacity: dayLoading ? 0.6 : 1, transition: "opacity 0.15s" }}>
            {dayKpiData.map((kpi, i) => {
              const rowKey = ROW_DEFS.find(r => r.label === kpi.label)?.key ?? "";
              return <KPICard key={kpi.label} data={kpi} icon={KPI_ICON_BY_ROW[rowKey]} index={i} />;
            })}
          </div>
        </>
      )}

      {selectedHotel && mode === "period" && (
        <>
          <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 8, marginTop: -8 }}>
            Actuals — {formatDateSr(rangeStart)} — {formatDateSr(rangeEnd)}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5" style={{ opacity: periodLoading ? 0.6 : 1, transition: "opacity 0.15s" }}>
            {periodAgg && (["brojNocenja", "ukupanPrihod", "adr", "popunjenost", "revpar"] as const).map(key => (
              <PeriodStatCard key={key} rowKey={key} value={periodAgg[key]} />
            ))}
          </div>
        </>
      )}

      {selectedHotel && <OnBooksSection hotelId={selectedHotel} asOfDate={asOfDate} />}

      {selectedHotel && (
        <ReportLog
          hotelId={selectedHotel}
          year={logMonth.year}
          month={logMonth.month}
          selectedDate={selectedDate}
          onSelectDate={d => { setSelectedDate(d); setMode("day"); }}
        />
      )}

      {canEnterData && <PaceForecasting />}
      {canEnterData && <ManagerNotes />}
      {selectedHotel && <WeatherWidget />}
      {canEnterData && <EventsWidget />}
      {selectedHotel && <CompetitorPrices />}

      <div className="flex flex-col md:flex-row gap-4 items-start">
        <div className="flex-1 min-w-0 w-full">
          <PriceTable data={dailyData} />
        </div>
        <RightPanel actions={priorityActions} revenueGap={revenueGapData} />
      </div>

      {showTargetsModal && (
        <MonthlyTargetsModal
          hotel={selectedHotelName}
          periodLabel={selectedPeriod}
          initialTargets={monthlyTarget}
          onSave={async input => {
            await saveMonthlyTargets(input);
            setShowTargetsModal(false);
          }}
          onClose={() => setShowTargetsModal(false)}
        />
      )}

      {showImportModal && (
        <ImportReportModal
          hotel={selectedHotelName}
          onConfirm={async (rows: ParsedReportRow[]) => {
            for (const row of rows) {
              await saveEntryForDate(row.dateISO, row.data);
            }
            setShowImportModal(false);
          }}
          onClose={() => setShowImportModal(false)}
        />
      )}
    </>
  );
}
