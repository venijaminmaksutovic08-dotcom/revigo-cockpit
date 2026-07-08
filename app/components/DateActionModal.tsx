"use client";

import { X, ClipboardList, FileSpreadsheet } from "lucide-react";

interface DateActionModalProps {
  dateLabel: string;
  hotel: string;
  hasExistingEntry: boolean;
  onManual: () => void;
  onImport: () => void;
  onClose: () => void;
}

export default function DateActionModal({
  dateLabel,
  hotel,
  hasExistingEntry,
  onManual,
  onImport,
  onClose,
}: DateActionModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center"
      style={{ background: "rgba(17,24,39,0.4)", backdropFilter: "blur(3px)" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full md:w-auto md:min-w-[420px] rounded-t-2xl md:rounded-2xl flex flex-col"
        style={{ background: "#ffffff", border: "1px solid #e5e7eb", boxShadow: "0 24px 64px rgba(0,0,0,0.14)" }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 pt-5 pb-4"
          style={{ borderBottom: "1px solid #f3f4f6" }}
        >
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#111827", letterSpacing: "-0.01em" }}>
              {dateLabel}
            </div>
            <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 2 }}>{hotel}</div>
          </div>
          <button
            onClick={onClose}
            className="flex items-center justify-center rounded-lg"
            style={{ width: 32, height: 32, background: "#f9fafb", border: "1px solid #e5e7eb", cursor: "pointer" }}
          >
            <X size={15} color="#6b7280" />
          </button>
        </div>

        {/* Options */}
        <div className="flex flex-col gap-3 p-5">
          {/* Option 1: Manual entry */}
          <button
            onClick={onManual}
            className="flex items-center gap-4 rounded-xl text-left w-full"
            style={{
              padding: "16px 18px",
              background: "rgba(201,168,76,0.05)",
              border: "1.5px solid rgba(201,168,76,0.3)",
              cursor: "pointer",
              transition: "background 0.15s",
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(201,168,76,0.1)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(201,168,76,0.05)"; }}
          >
            <div
              className="rounded-xl flex items-center justify-center"
              style={{ width: 44, height: 44, background: "rgba(201,168,76,0.12)", border: "1px solid rgba(201,168,76,0.25)", flexShrink: 0 }}
            >
              <ClipboardList size={20} color="#C9A84C" />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#111827", marginBottom: 2 }}>
                {hasExistingEntry ? "Izmeni izveštaj" : "Unesi ručno"}
              </div>
              <div style={{ fontSize: 12, color: "#6b7280" }}>
                {hasExistingEntry
                  ? "Otvori formu sa postojećim podacima"
                  : "Popuni formu ćeliju po ćeliju"}
              </div>
            </div>
          </button>

          {/* Option 2: Import */}
          <button
            onClick={onImport}
            className="flex items-center gap-4 rounded-xl text-left w-full"
            style={{
              padding: "16px 18px",
              background: "#f9fafb",
              border: "1.5px solid #e5e7eb",
              cursor: "pointer",
              transition: "background 0.15s",
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#f3f4f6"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "#f9fafb"; }}
          >
            <div
              className="rounded-xl flex items-center justify-center"
              style={{ width: 44, height: 44, background: "#f3f4f6", border: "1px solid #e5e7eb", flexShrink: 0 }}
            >
              <FileSpreadsheet size={20} color="#6b7280" />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#111827", marginBottom: 2 }}>
                {hasExistingEntry ? "Zameni uvoz" : "Uvezi izveštaj"}
              </div>
              <div style={{ fontSize: 12, color: "#6b7280" }}>
                Učitaj Excel ili CSV — datum je već postavljen
              </div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
