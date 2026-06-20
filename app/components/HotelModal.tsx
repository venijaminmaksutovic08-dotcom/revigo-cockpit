"use client";

import { useState } from "react";
import { X, Hotel } from "lucide-react";

interface HotelModalProps {
  onSave: (hotel: { name: string; rooms: number; city: string }) => void;
  onClose: () => void;
}

interface FormData {
  name: string;
  rooms: string;
  city: string;
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  error,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  type?: string;
  error?: string;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <div>
      <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 6 }}>
        {label} <span style={{ color: "#C9A84C" }}>*</span>
      </label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        min={type === "number" ? 1 : undefined}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          width: "100%",
          height: 40,
          borderRadius: 8,
          border: `1px solid ${error ? "#dc2626" : focused ? "#C9A84C" : "#e5e7eb"}`,
          boxShadow: focused ? "0 0 0 3px rgba(201,168,76,0.1)" : "none",
          paddingLeft: 12,
          paddingRight: 12,
          fontSize: 13,
          color: "#111827",
          background: "#ffffff",
          outline: "none",
          transition: "border-color 0.15s, box-shadow 0.15s",
        }}
      />
      {error && (
        <div style={{ fontSize: 11, color: "#dc2626", marginTop: 4 }}>{error}</div>
      )}
    </div>
  );
}

export default function HotelModal({ onSave, onClose }: HotelModalProps) {
  const [form, setForm] = useState<FormData>({ name: "", rooms: "", city: "" });
  const [errors, setErrors] = useState<Partial<FormData>>({});

  function set(key: keyof FormData) {
    return (v: string) => {
      setForm(p => ({ ...p, [key]: v }));
      if (errors[key]) setErrors(p => ({ ...p, [key]: undefined }));
    };
  }

  function validate(): boolean {
    const e: Partial<FormData> = {};
    if (!form.name.trim()) e.name = "Unesite naziv hotela";
    const rooms = Number(form.rooms);
    if (!form.rooms || isNaN(rooms) || rooms < 1 || !Number.isInteger(rooms)) e.rooms = "Unesite ceo broj soba (minimum 1)";
    if (!form.city.trim()) e.city = "Unesite naziv grada";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleSave() {
    if (!validate()) return;
    onSave({ name: form.name.trim(), rooms: Number(form.rooms), city: form.city.trim() });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(17,24,39,0.4)", backdropFilter: "blur(3px)" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-screen h-screen md:w-full md:h-auto md:max-w-[440px] rounded-none md:rounded-2xl flex flex-col"
        style={{ background: "#ffffff", border: "1px solid #e5e7eb", boxShadow: "0 24px 64px rgba(0,0,0,0.12)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4" style={{ borderBottom: "1px solid #f3f4f6" }}>
          <div className="flex items-center gap-3">
            <div
              className="rounded-xl flex items-center justify-center"
              style={{ width: 40, height: 40, background: "rgba(201,168,76,0.08)", border: "1px solid rgba(201,168,76,0.2)" }}
            >
              <Hotel size={20} color="#C9A84C" />
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#111827" }}>Dodaj novi hotel</div>
              <div style={{ fontSize: 12, color: "#9ca3af" }}>Unesite osnovne informacije</div>
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
          <Field label="Naziv hotela" value={form.name} onChange={set("name")} placeholder="npr. Hotel Panorama Zlatibor" error={errors.name} />
          <Field label="Broj soba" value={form.rooms} onChange={set("rooms")} placeholder="npr. 30" type="number" error={errors.rooms} />
          <Field label="Grad" value={form.city} onChange={set("city")} placeholder="npr. Zlatibor" error={errors.city} />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 pb-5" style={{ flexShrink: 0 }}>
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
            Sačuvaj hotel
          </button>
        </div>
      </div>
    </div>
  );
}
