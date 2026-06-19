import { BarChart3 } from "lucide-react";
import EmptyPagePlaceholder from "../components/EmptyPagePlaceholder";

export default function PickupPage() {
  return (
    <EmptyPagePlaceholder
      icon={<BarChart3 size={28} color="#C9A84C" />}
      title="Pickup Analiza"
      description="Analiza brzine rezervacija i pickup trendova za buduće datume."
    />
  );
}
