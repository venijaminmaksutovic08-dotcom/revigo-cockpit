import { Calendar } from "lucide-react";
import EmptyPagePlaceholder from "../components/EmptyPagePlaceholder";

export default function KalendarPage() {
  return (
    <EmptyPagePlaceholder
      icon={<Calendar size={28} color="#C9A84C" />}
      title="Kalendar Prihoda"
      description="Vizuelni kalendarski prikaz prihoda, popunjenosti i cena po danima."
    />
  );
}
