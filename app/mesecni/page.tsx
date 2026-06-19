import { CalendarDays } from "lucide-react";
import EmptyPagePlaceholder from "../components/EmptyPagePlaceholder";

export default function MesecniPage() {
  return (
    <EmptyPagePlaceholder
      icon={<CalendarDays size={28} color="#C9A84C" />}
      title="Mesečni Pregled"
      description="Pregled mesečnih prihoda, popunjenosti i performansi hotela po periodima."
    />
  );
}
