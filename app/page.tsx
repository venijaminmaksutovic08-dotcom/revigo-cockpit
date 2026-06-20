"use client";

import { useState } from "react";
import { DollarSign, Moon, BarChart2, Percent, TrendingUp, ClipboardList } from "lucide-react";
import KPICard from "./components/KPICard";
import PriceTable from "./components/PriceTable";
import RightPanel from "./components/RightPanel";
import DataEntryModal from "./components/DataEntryModal";
import { dailyData, priorityActions, revenueGapData } from "./data/hotelData";
import { useHotel, ROW_DEFS } from "./context/HotelContext";

const KPI_ICON_BY_ROW: Record<string, React.ReactNode> = {
  brojNocenja:   <Moon       key="nights"  size={18} color="#C9A84C" strokeWidth={2.5} />,
  ukupanPrihod:  <DollarSign key="revenue" size={18} color="#C9A84C" strokeWidth={2.5} />,
  adr:           <BarChart2  key="adr"     size={18} color="#C9A84C" strokeWidth={2.5} />,
  popunjenost:   <Percent    key="occ"     size={18} color="#C9A84C" strokeWidth={2.5} />,
  revpar:        <TrendingUp key="revpar"  size={18} color="#C9A84C" strokeWidth={2.5} />,
};

export default function DashboardPage() {
  const { selectedHotel, selectedPeriod, currentEntry, saveEntry, kpiData } = useHotel();
  const [showEntryModal, setShowEntryModal] = useState(false);
  const canEnterData = Boolean(selectedHotel && selectedPeriod);

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
          <button
            onClick={() => setShowEntryModal(true)}
            style={{
              display: "flex", alignItems: "center", gap: 8,
              height: 38, paddingLeft: 16, paddingRight: 16,
              borderRadius: 8, border: "none",
              background: "linear-gradient(135deg, #C9A84C 0%, #E8C96B 100%)",
              color: "#ffffff", fontSize: 13, fontWeight: 600, cursor: "pointer",
              boxShadow: "0 2px 8px rgba(201,168,76,0.3)",
            }}
          >
            <ClipboardList size={15} />
            Unesi podatke
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
        {kpiData.map(kpi => {
          const rowKey = ROW_DEFS.find(r => r.label === kpi.label)?.key ?? "";
          return <KPICard key={kpi.label} data={kpi} icon={KPI_ICON_BY_ROW[rowKey]} />;
        })}
      </div>

      <div className="flex flex-col md:flex-row gap-4 items-start">
        <div className="flex-1 min-w-0 w-full">
          <PriceTable data={dailyData} />
        </div>
        <RightPanel actions={priorityActions} revenueGap={revenueGapData} />
      </div>

      {showEntryModal && (
        <DataEntryModal
          hotel={selectedHotel}
          period={selectedPeriod}
          initialData={currentEntry}
          onSave={data => {
            saveEntry(data);
            setShowEntryModal(false);
          }}
          onClose={() => setShowEntryModal(false)}
        />
      )}
    </>
  );
}
