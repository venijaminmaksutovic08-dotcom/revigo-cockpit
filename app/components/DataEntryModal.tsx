"use client";

import { useState } from "react";
import { X, ClipboardList } from "lucide-react";
import {
  ROW_DEFS,
  COLUMN_DEFS,
  type EntryData,
  type RowKey,
  type ColumnKey,
} from "../context/HotelContext";

interface DataEntryModalProps {
  hotel: string;
  period: string;
  initialData: EntryData;
  onSave: (data: EntryData) => void;
  onClose: () => void;
}

function cloneEntry(data: EntryData): EntryData {
  return Object.fromEntries(
    Object.entries(data).map(([rowKey, values]) => [rowKey, { ...values }])
  ) as EntryData;
}

function NumberCell({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <input
      type="number"
      value={value === 0 ? "" : value}
      placeholder="0"
      onChange={e => onChange(e.target.value === "" ? 0 : Number(e.target.value))}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={{
        width: "100%",
        height: 34,
        borderRadius: 6,
        border: `1px solid ${focused ? "#C9A84C" : "#e5e7eb"}`,
        boxShadow: focused ? "0 0 0 3px rgba(201,168,76,0.1)" : "none",
        paddingLeft: 10,
        paddingRight: 10,
        fontSize: 13,
        color: "#111827",
        background: "#ffffff",
        outline: "none",
        textAlign: "right",
        transition: "border-color 0.15s, box-shadow 0.15s",
      }}
    />
  );
}

function computeDerived(values: EntryData[RowKey]) {
  const pickup = values.naKnjigamaDanas - values.naKnjigamaJuce;
  const gap = values.naKnjigamaDanas - values.target;
  const ostvarenost = values.target !== 0 ? (values.naKnjigamaDanas / values.target) * 100 : 0;
  return { pickup, gap, ostvarenost };
}

export default function DataEntryModal({ hotel, period, initialData, onSave, onClose }: DataEntryModalProps) {
  const [data, setData] = useState<EntryData>(() => cloneEntry(initialData));

  function setCell(rowKey: RowKey, columnKey: ColumnKey, value: number) {
    setData(prev => ({
      ...prev,
      [rowKey]: { ...prev[rowKey], [columnKey]: value },
    }));
  }

  function handleSave() {
    onSave(data);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(17,24,39,0.4)", backdropFilter: "blur(3px)" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="rounded-2xl"
        style={{
          width: "min(96vw, 1180px)",
          maxHeight: "90vh",
          background: "#ffffff",
          border: "1px solid #e5e7eb",
          boxShadow: "0 24px 64px rgba(0,0,0,0.12)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4" style={{ borderBottom: "1px solid #f3f4f6", flexShrink: 0 }}>
          <div className="flex items-center gap-3">
            <div
              className="rounded-xl flex items-center justify-center"
              style={{ width: 40, height: 40, background: "rgba(201,168,76,0.08)", border: "1px solid rgba(201,168,76,0.2)" }}
            >
              <ClipboardList size={20} color="#C9A84C" />
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#111827" }}>Unos dnevnih podataka</div>
              <div style={{ fontSize: 12, color: "#9ca3af" }}>{hotel} &middot; {period}</div>
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

        {/* Table */}
        <div className="px-6 py-5" style={{ overflow: "auto", flex: 1 }}>
          <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0 }}>
            <thead>
              <tr>
                <th
                  style={{
                    textAlign: "left", fontSize: 11, fontWeight: 600, color: "#9ca3af",
                    letterSpacing: "0.04em", textTransform: "uppercase",
                    padding: "0 10px 10px 0", position: "sticky", left: 0, background: "#ffffff", minWidth: 160,
                  }}
                >
                  Metrika
                </th>
                {COLUMN_DEFS.map(col => (
                  <th
                    key={col.key}
                    style={{
                      textAlign: "right", fontSize: 11, fontWeight: 600, color: "#9ca3af",
                      letterSpacing: "0.04em", textTransform: "uppercase",
                      padding: "0 10px 10px", minWidth: 130,
                    }}
                  >
                    {col.label}
                  </th>
                ))}
                <th style={{ textAlign: "right", fontSize: 11, fontWeight: 600, color: "#6b7280", padding: "0 10px 10px", minWidth: 110 }}>Pickup</th>
                <th style={{ textAlign: "right", fontSize: 11, fontWeight: 600, color: "#6b7280", padding: "0 10px 10px", minWidth: 110 }}>Gap do targeta</th>
                <th style={{ textAlign: "right", fontSize: 11, fontWeight: 600, color: "#6b7280", padding: "0 10px 10px", minWidth: 110 }}>Ostvarenost %</th>
              </tr>
            </thead>
            <tbody>
              {ROW_DEFS.map(rowDef => {
                const values = data[rowDef.key];
                const { pickup, gap, ostvarenost } = computeDerived(values);
                const isAboveTarget = ostvarenost >= 100;
                return (
                  <tr key={rowDef.key} style={{ borderTop: "1px solid #f3f4f6" }}>
                    <td
                      style={{
                        padding: "10px 10px 10px 0", fontSize: 13, fontWeight: 600, color: "#111827",
                        position: "sticky", left: 0, background: "#ffffff",
                      }}
                    >
                      {rowDef.label}
                    </td>
                    {COLUMN_DEFS.map(col => (
                      <td key={col.key} style={{ padding: "6px 10px" }}>
                        <NumberCell
                          value={values[col.key]}
                          onChange={v => setCell(rowDef.key, col.key, v)}
                        />
                      </td>
                    ))}
                    <td style={{ padding: "10px", textAlign: "right", fontSize: 13, fontWeight: 600, color: pickup >= 0 ? "#16a34a" : "#dc2626" }}>
                      {pickup >= 0 ? "+" : ""}{pickup.toLocaleString("sr-RS")}
                    </td>
                    <td style={{ padding: "10px", textAlign: "right", fontSize: 13, fontWeight: 600, color: gap >= 0 ? "#16a34a" : "#dc2626" }}>
                      {gap >= 0 ? "+" : ""}{gap.toLocaleString("sr-RS")}
                    </td>
                    <td style={{ padding: "10px", textAlign: "right", fontSize: 13, fontWeight: 700, color: isAboveTarget ? "#16a34a" : "#dc2626" }}>
                      {values.target !== 0 ? `${Math.round(ostvarenost * 10) / 10}%` : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 pb-5 pt-1" style={{ flexShrink: 0, borderTop: "1px solid #f3f4f6" }}>
          <button
            onClick={onClose}
            style={{ height: 38, paddingLeft: 16, paddingRight: 16, borderRadius: 8, border: "1px solid #e5e7eb", background: "#f9fafb", color: "#374151", fontSize: 13, fontWeight: 500, cursor: "pointer" }}
          >
            Otkaži
          </button>
          <button
            onClick={handleSave}
            style={{ height: 38, paddingLeft: 20, paddingRight: 20, borderRadius: 8, border: "none", background: "linear-gradient(135deg, #C9A84C 0%, #E8C96B 100%)", color: "#ffffff", fontSize: 13, fontWeight: 600, cursor: "pointer", boxShadow: "0 2px 8px rgba(201,168,76,0.3)" }}
          >
            Sačuvaj podatke
          </button>
        </div>
      </div>
    </div>
  );
}
