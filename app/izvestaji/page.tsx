import { FileText } from "lucide-react";
import EmptyPagePlaceholder from "../components/EmptyPagePlaceholder";

export default function IzvestajiPage() {
  return (
    <EmptyPagePlaceholder
      icon={<FileText size={28} color="#C9A84C" />}
      title="Izveštaji"
      description="Generisanje i preuzimanje izveštaja o performansama hotela za izabrane periode."
    />
  );
}
