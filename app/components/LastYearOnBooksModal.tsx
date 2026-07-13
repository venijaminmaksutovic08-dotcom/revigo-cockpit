"use client";

import { useState } from "react";
import { X, History } from "lucide-react";
import { formatDateSr, saveOnBooksForDate, type StayMonthDef } from "../lib/dashboardData";

interface LastYearOnBooksModalProps {
  hotelId: string;
  asOfDate: string;
  lastYearAsOfDate: string;
  stayMonths: StayMonthDef[];
  onSaved: () => void;
  onClose: () => void;
}

interface RowState {
  roomsOnbooks: string;
  revenueOnbooks: string;
  occupancyOnbooks: string;
}

function emptyRow(): RowState {
  return { roomsOnbooks: "", revenueOnbooks: "", occupancyOnbooks: "" };
}

function NumberField({ value, onChange, suffix }: { value: string; onChange: (v: string) => void; suffix?: string }) {
  const [focused, setFocused] = useState(false);
  return (
    <div className="relative" style={{ flex: 1, minWidth: 0 }}>
      <input
        type="number"
        value={value}
        placeholder="0"
        onChange={e => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          width: "100%",
          height: 38,
          borderRadius: 8,
          border: `1px solid ${focused ? "#C9A84C" : "#e5e7eb"}`,
          boxShadow: focused ? "0 0 0 3px rgba(201,168,76,0.1)" : "none",
          paddingLeft: 10,
          paddingRight: suffix ? 26 : 10,
          fontSize: 13,
          color: "#111827",
          background: "#ffffff",
          outline: "none",
          textAlign: "right",
          transition: "border-color 0.15s, box-shadow 0.15s",
        }}
      />
      {suffix && (
        <span style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", fontSize: 12, color: "#9ca3af" }}>
          {suffix}
        </span>
      )}
    </div>
  );
}

export default function LastYearOnBooksModal({ hotelId, asOfDate, lastYearAsOfDate, stayMonths, onSaved, onClose }: LastYearOnBooksModalProps) {
  const [rows, setRows] = useState<RowState[]>(() => stayMonths.map(emptyRow));
  const [saving, setSaving] = useState(false);

  function setField(index: number, key: keyof RowState, value: string) {
    setRows(prev => prev.map((r, i) => (i === index ? { ...r, [key]: value } : r)));
  }

  async function handleSave() {
    setSaving(true);
    const entries = stayMonths.map((def, i) => ({
      stayMonth: def.month,
      stayYear: def.year - 1,
      roomsOnbooks: Number(rows[i].roomsOnbooks) || 0,
      revenueOnbooks: Number(rows[i].revenueOnbooks) || 0,
      occupancyOnbooks: Number(rows[i].occupancyOnbooks) || 0,
    }));
    await saveOnBooksForDate(hotelId, lastYearAsOfDate, entries);
    setSaving(false);
    onSaved();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(17,24,39,0.4)", backdropFilter: "blur(3px)" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-screen h-screen md:w-full md:h-auto md:max-w-[560px] rounded-none md:rounded-2xl flex flex-col"
        style={{ background: "#ffffff", border: "1px solid #e5e7eb", boxShadow: "0 24px 64px rgba(0,0,0,0.12)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4" style={{ borderBottom: "1px solid #f3f4f6", flexShrink: 0 }}>
          <div className="flex items-center gap-3">
            <div
              className="rounded-xl flex items-center justify-center"
              style={{ width: 40, height: 40, background: "rgba(201,168,76,0.08)", border: "1px solid rgba(201,168,76,0.2)" }}
            >
              <History size={20} color="#C9A84C" />
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#111827" }}>On-Books prošle godine — isti datum</div>
              <div style={{ fontSize: 12, color: "#9ca3af" }}>
                Unesite kakvo je stanje bilo {formatDateSr(lastYearAsOfDate)} ({formatDateSr(asOfDate)} prošle godine)
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex items-center justify-center rounded-lg transition-colors"
            style={{ width: 32, height: 32, background: "#f9fafb", border: "1px solid #e5e7eb", cursor: "pointer", flexShrink: 0 }}
          >
            <X size={15} color="#6b7280" />
          </button>
        </div>

        {/* Form */}
        <div className="px-6 py-5 flex flex-col gap-5 flex-1 md:flex-none overflow-y-auto">
          {stayMonths.map((def, i) => (
            <div key={`${def.year}-${def.month}`}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#111827", marginBottom: 8 }}>
                {def.label.replace(String(def.year), String(def.year - 1))}
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <div style={{ flex: "1 1 140px" }}>
                  <label style={{ display: "block", fontSize: 11, color: "#9ca3af", marginBottom: 4 }}>Noćenja LG</label>
                  <NumberField value={rows[i].roomsOnbooks} onChange={v => setField(i, "roomsOnbooks", v)} />
                </div>
                <div style={{ flex: "1 1 140px" }}>
                  <label style={{ display: "block", fontSize: 11, color: "#9ca3af", marginBottom: 4 }}>Prihod LG</label>
                  <NumberField value={rows[i].revenueOnbooks} onChange={v => setField(i, "revenueOnbooks", v)} suffix="RSD" />
                </div>
                <div style={{ flex: "1 1 100px" }}>
                  <label style={{ display: "block", fontSize: 11, color: "#9ca3af", marginBottom: 4 }}>Popunjenost LG</label>
                  <NumberField value={rows[i].occupancyOnbooks} onChange={v => setField(i, "occupancyOnbooks", v)} suffix="%" />
                </div>
              </div>
            </div>
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
            {saving ? "Čuvanje..." : "Sačuvaj"}
          </button>
        </div>
      </div>
    </div>
  );
}
