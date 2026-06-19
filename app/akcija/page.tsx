import { Zap } from "lucide-react";
import EmptyPagePlaceholder from "../components/EmptyPagePlaceholder";

export default function AkcijaPage() {
  return (
    <EmptyPagePlaceholder
      icon={<Zap size={28} color="#C9A84C" />}
      title="Centar Akcija"
      description="Prioritetne akcije za optimizaciju prihoda — filtrirano po hitnosti i potencijalnom uticaju."
    />
  );
}
