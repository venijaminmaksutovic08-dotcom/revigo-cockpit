import { DollarSign, Moon, BarChart2, Percent, TrendingUp } from "lucide-react";
import KPICard from "./components/KPICard";
import PriceTable from "./components/PriceTable";
import RightPanel from "./components/RightPanel";
import { kpiData, dailyData, priorityActions, revenueGapData } from "./data/hotelData";

const KPI_ICONS = [
  <DollarSign key="revenue" size={18} color="#C9A84C" strokeWidth={2.5} />,
  <Moon       key="nights"  size={18} color="#C9A84C" strokeWidth={2.5} />,
  <BarChart2  key="adr"     size={18} color="#C9A84C" strokeWidth={2.5} />,
  <Percent    key="occ"     size={18} color="#C9A84C" strokeWidth={2.5} />,
  <TrendingUp key="revpar"  size={18} color="#C9A84C" strokeWidth={2.5} />,
];

export default function DashboardPage() {
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
      </div>

      <div className="flex gap-3 mb-5">
        {kpiData.map((kpi, i) => (
          <KPICard key={kpi.label} data={kpi} icon={KPI_ICONS[i]} />
        ))}
      </div>

      <div className="flex gap-4 items-start">
        <div className="flex-1 min-w-0">
          <PriceTable data={dailyData} />
        </div>
        <RightPanel actions={priorityActions} revenueGap={revenueGapData} />
      </div>
    </>
  );
}
