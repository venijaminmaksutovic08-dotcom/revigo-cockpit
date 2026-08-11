"use client";

import { AlertTriangle, X } from "lucide-react";

// Surfaces an archiving miss (see reportArchive.ts) so it's never invisible — the actual import
// (daily_reports/onbooks_snapshots) already succeeded by the time this shows, so it's a dismissible
// heads-up rather than a blocking error.
export default function ArchiveWarningToast({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <div
      className="fixed z-[60] flex items-start gap-2 rounded-lg"
      style={{
        bottom: 20, right: 20, maxWidth: 380,
        padding: "12px 14px", background: "#ffffff",
        border: "1px solid rgba(220,38,38,0.3)", boxShadow: "0 12px 32px rgba(0,0,0,0.16)",
      }}
    >
      <AlertTriangle size={16} color="#dc2626" style={{ flexShrink: 0, marginTop: 1 }} />
      <div style={{ fontSize: 12.5, color: "#374151", flex: 1, lineHeight: 1.4 }}>{message}</div>
      <button
        onClick={onDismiss}
        className="flex items-center justify-center"
        style={{ background: "transparent", border: "none", cursor: "pointer", padding: 0, flexShrink: 0 }}
      >
        <X size={14} color="#9ca3af" />
      </button>
    </div>
  );
}
