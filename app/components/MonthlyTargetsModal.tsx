"use client";

import { useState } from "react";
import { X, Target } from "lucide-react";
import type { MonthlyTargetRow } from "../lib/supabaseClient";
import type { MonthlyTargetsInput } from "../context/HotelContext";

interface MonthlyTargetsModalProps {
  hotel: string;
  periodLabel: string;
  initialTargets: MonthlyTargetRow | null;
  onSave: (input: MonthlyTargetsInput) => Promise<void>;
  onClose: () => void;
}

interface FormState {
  revenueTarget: string;
  roomNightsTarget: string;
  adrTarget: string;
  occupancyTarget: string;
  revparTarget: string;
}

function toFormState(row: MonthlyTargetRow | null): FormState {
  return {
    revenueTarget: row?.revenue_target ? String(row.revenue_target) : "",
    roomNightsTarget: row?.room_nights_target ? String(row.room_nights_target) : "",
    adrTarget: row?.adr_target ? String(row.adr_target) : "",
    occupancyTarget: row?.occupancy_target ? String(row.occupancy_target) : "",
    revparTarget: row?.revpar_target ? String(row.revpar_target) : "",
  };
}

const FIELDS: { key: keyof FormState; label: string; suffix?: string }[] = [
  { key: "revenueTarget", label: "Revenue Target (RSD)" },
  { key: "roomNightsTarget", label: "Room Nights Target" },
  { key: "adrTarget", label: "ADR Target (RSD)" },
  { key: "occupancyTarget", label: "Occupancy % Target", suffix: "%" },
  { key: "revparTarget", label: "RevPAR Target (RSD)" },
];

function Field({
  label,
  value,
  onChange,
  suffix,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  suffix?: string;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <div>
      <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 6 }}>
        {label}
      </label>
      <div className="relative">
        <input
          type="number"
          value={value}
          placeholder="0"
          onChange={e => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{
            width: "100%",
            height: 40,
            borderRadius: 8,
            border: `1px solid ${focused ? "#C9A84C" : "#e5e7eb"}`,
            boxShadow: focused ? "0 0 0 3px rgba(201,168,76,0.1)" : "none",
            paddingLeft: 12,
            paddingRight: suffix ? 32 : 12,
            fontSize: 13,
            color: "#111827",
            background: "#ffffff",
            outline: "none",
            textAlign: "right",
            transition: "border-color 0.15s, box-shadow 0.15s",
          }}
        />
        {suffix && (
          <span style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", fontSize: 12, color: "#9ca3af" }}>
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}

export default function MonthlyTargetsModal({ hotel, periodLabel, initialTargets, onSave, onClose }: MonthlyTargetsModalProps) {
  const [form, setForm] = useState<FormState>(() => toFormState(initialTargets));
  const [saving, setSaving] = useState(false);

  function set(key: keyof FormState) {
    return (v: string) => setForm(prev => ({ ...prev, [key]: v }));
  }

  async function handleSave() {
    setSaving(true);
    await onSave({
      revenueTarget: Number(form.revenueTarget) || 0,
      roomNightsTarget: Number(form.roomNightsTarget) || 0,
      adrTarget: Number(form.adrTarget) || 0,
      occupancyTarget: Number(form.occupancyTarget) || 0,
      revparTarget: Number(form.revparTarget) || 0,
    });
    setSaving(false);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(17,24,39,0.4)", backdropFilter: "blur(3px)" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-screen h-screen md:w-full md:h-auto md:max-w-[480px] rounded-none md:rounded-2xl flex flex-col"
        style={{ background: "#ffffff", border: "1px solid #e5e7eb", boxShadow: "0 24px 64px rgba(0,0,0,0.12)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4" style={{ borderBottom: "1px solid #f3f4f6", flexShrink: 0 }}>
          <div className="flex items-center gap-3">
            <div
              className="rounded-xl flex items-center justify-center"
              style={{ width: 40, height: 40, background: "rgba(201,168,76,0.08)", border: "1px solid rgba(201,168,76,0.2)" }}
            >
              <Target size={20} color="#C9A84C" />
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#111827" }}>Postavi mesečne targete</div>
              <div style={{ fontSize: 12, color: "#9ca3af" }}>{hotel} &middot; {periodLabel}</div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex items-center justify-center rounded-lg transition-colors"
            style={{ width: 32, height: 32, background: "#f9fafb", border: "1px solid #e5e7eb", cursor: "pointer" }}
          >
            <X size={15} color="#6b7280" />
          </button>
        </div>

        {/* Form */}
        <div className="px-6 py-5 flex flex-col gap-4 flex-1 md:flex-none overflow-y-auto">
          {FIELDS.map(f => (
            <Field key={f.key} label={f.label} value={form[f.key]} onChange={set(f.key)} suffix={f.suffix} />
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 pb-5" style={{ flexShrink: 0 }}>
          <button
            onClick={onClose}
            disabled={saving}
            style={{ height: 38, paddingLeft: 16, paddingRight: 16, borderRadius: 8, border: "1px solid #e5e7eb", background: "#f9fafb", color: "#374151", fontSize: 13, fontWeight: 500, cursor: saving ? "default" : "pointer" }}
          >
            Otkaži
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{ height: 38, paddingLeft: 20, paddingRight: 20, borderRadius: 8, border: "none", background: "linear-gradient(135deg, #C9A84C 0%, #E8C96B 100%)", color: "#ffffff", fontSize: 13, fontWeight: 600, cursor: saving ? "default" : "pointer", boxShadow: "0 2px 8px rgba(201,168,76,0.3)", opacity: saving ? 0.7 : 1 }}
          >
            {saving ? "Čuvanje..." : "Sačuvaj targete"}
          </button>
        </div>
      </div>
    </div>
  );
}
