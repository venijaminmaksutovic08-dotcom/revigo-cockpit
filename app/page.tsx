"use client";

import { useState } from "react";
import { DollarSign, Moon, BarChart2, Percent, TrendingUp, Target, FileSpreadsheet } from "lucide-react";
import KPICard from "./components/KPICard";
import PriceTable from "./components/PriceTable";
import RightPanel from "./components/RightPanel";
import DataEntryCalendar from "./components/DataEntryCalendar";
import MonthAtAGlance from "./components/MonthAtAGlance";
import MonthlyTargetsModal from "./components/MonthlyTargetsModal";
import ImportReportModal from "./components/ImportReportModal";
import { dailyData, priorityActions, revenueGapData } from "./data/hotelData";
import { useHotel, ROW_DEFS } from "./context/HotelContext";
import type { ParsedReportRow } from "./lib/reportImport";

const KPI_ICON_BY_ROW: Record<string, React.ReactNode> = {
  brojNocenja:   <Moon       key="nights"  size={18} color="#C9A84C" strokeWidth={2.5} />,
  ukupanPrihod:  <DollarSign key="revenue" size={18} color="#C9A84C" strokeWidth={2.5} />,
  adr:           <BarChart2  key="adr"     size={18} color="#C9A84C" strokeWidth={2.5} />,
  popunjenost:   <Percent    key="occ"     size={18} color="#C9A84C" strokeWidth={2.5} />,
  revpar:        <TrendingUp key="revpar"  size={18} color="#C9A84C" strokeWidth={2.5} />,
};

export default function DashboardPage() {
  const { selectedHotel, selectedHotelName, selectedPeriod, monthlyTarget, saveMonthlyTargets, saveEntryForDate, kpiData } = useHotel();
  const canEnterData = Boolean(selectedHotel && selectedPeriod);
  const [showTargetsModal, setShowTargetsModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);

  return (
    <>
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

      {canEnterData && <MonthAtAGlance />}

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
        {kpiData.map(kpi => {
          const rowKey = ROW_DEFS.find(r => r.label === kpi.label)?.key ?? "";
          return <KPICard key={kpi.label} data={kpi} icon={KPI_ICON_BY_ROW[rowKey]} />;
        })}
      </div>

      {canEnterData && <DataEntryCalendar />}

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
