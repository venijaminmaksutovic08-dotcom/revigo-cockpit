import { TrendingUp } from "lucide-react";
import EmptyPagePlaceholder from "../components/EmptyPagePlaceholder";

export default function PreporukaPage() {
  return (
    <EmptyPagePlaceholder
      icon={<TrendingUp size={28} color="#C9A84C" />}
      title="Preporuka Cena"
      description="Automatski generisane preporuke cena na osnovu tražnje, konkurencije i istorijskih podataka."
    />
  );
}
