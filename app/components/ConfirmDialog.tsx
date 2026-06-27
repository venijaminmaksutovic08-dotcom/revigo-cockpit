"use client";

import { AlertTriangle } from "lucide-react";

interface ConfirmDialogProps {
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  message,
  confirmLabel = "Obriši",
  cancelLabel = "Otkaži",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center px-4"
      style={{ background: "rgba(17,24,39,0.4)", backdropFilter: "blur(3px)" }}
      onClick={e => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div
        className="rounded-2xl w-full"
        style={{ maxWidth: 400, background: "#ffffff", border: "1px solid #e5e7eb", boxShadow: "0 24px 64px rgba(0,0,0,0.12)" }}
      >
        <div className="px-6 pt-6 pb-2 flex flex-col items-center text-center">
          <div
            className="rounded-xl flex items-center justify-center mb-3"
            style={{ width: 44, height: 44, background: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.2)" }}
          >
            <AlertTriangle size={20} color="#dc2626" />
          </div>
          <div style={{ fontSize: 14, color: "#374151", lineHeight: 1.5 }}>{message}</div>
        </div>

        <div className="flex items-center justify-center gap-3 px-6 pb-6 pt-4">
          <button
            onClick={onCancel}
            style={{ height: 38, paddingLeft: 18, paddingRight: 18, borderRadius: 8, border: "1px solid #e5e7eb", background: "#f9fafb", color: "#374151", fontSize: 13, fontWeight: 500, cursor: "pointer" }}
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            style={{ height: 38, paddingLeft: 18, paddingRight: 18, borderRadius: 8, border: "none", background: "#dc2626", color: "#ffffff", fontSize: 13, fontWeight: 600, cursor: "pointer", boxShadow: "0 2px 8px rgba(220,38,38,0.3)" }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
