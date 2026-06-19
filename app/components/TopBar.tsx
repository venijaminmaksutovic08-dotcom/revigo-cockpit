"use client";

import { useState } from "react";
import { ChevronDown, Bell, RefreshCw, Plus } from "lucide-react";

interface HotelDropdownProps {
  value: string;
  hotels: string[];
  onChange: (v: string) => void;
  onAddHotel: () => void;
}

function HotelDropdown({ value, hotels, onChange, onAddHotel }: HotelDropdownProps) {
  const [open, setOpen] = useState(false);

  function select(name: string) {
    onChange(name);
    setOpen(false);
  }

  function openModal() {
    setOpen(false);
    onAddHotel();
  }

  return (
    <div className="relative">
      <div style={{ fontSize: 10, color: "#9ca3af", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 2 }}>
        Hotel
      </div>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: "flex", alignItems: "center", gap: 8,
          height: 34, paddingLeft: 12, paddingRight: 10,
          background: "#f9fafb", border: "1px solid #e5e7eb",
          borderRadius: 8, color: value ? "#111827" : "#9ca3af",
          fontSize: 13, fontWeight: value ? 500 : 400,
          cursor: "pointer", minWidth: 180,
        }}
      >
        <span style={{ flex: 1, textAlign: "left" }}>{value || "Odaberite hotel"}</span>
        <ChevronDown size={14} color="#9ca3af" style={{ transform: open ? "rotate(180deg)" : undefined, transition: "transform 0.15s", flexShrink: 0 }} />
      </button>

      {open && (
        <div
          style={{
            position: "absolute", top: "100%", left: 0, marginTop: 4, zIndex: 50,
            background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 10,
            boxShadow: "0 8px 24px rgba(0,0,0,0.08)", minWidth: 220, overflow: "hidden",
          }}
        >
          {hotels.length === 0 ? (
            <div style={{ padding: "10px 12px", fontSize: 12, color: "#9ca3af" }}>
              Nema dodanih hotela
            </div>
          ) : (
            hotels.map(name => (
              <button
                key={name}
                onClick={() => select(name)}
                style={{
                  display: "flex", alignItems: "center", width: "100%",
                  height: 36, paddingLeft: 12, paddingRight: 12,
                  fontSize: 13, fontWeight: name === value ? 600 : 400,
                  color: name === value ? "#C9A84C" : "#374151",
                  background: name === value ? "rgba(201,168,76,0.06)" : "transparent",
                  cursor: "pointer", border: "none",
                  borderBottom: "1px solid #f9fafb",
                }}
                onMouseEnter={e => { if (name !== value) (e.currentTarget as HTMLElement).style.background = "#f9fafb"; }}
                onMouseLeave={e => { if (name !== value) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
              >
                {name}
              </button>
            ))
          )}

          {/* Divider + Add option */}
          <div style={{ borderTop: "1px solid #f3f4f6" }}>
            <button
              onClick={openModal}
              style={{
                display: "flex", alignItems: "center", gap: 8, width: "100%",
                height: 38, paddingLeft: 12, paddingRight: 12,
                fontSize: 13, fontWeight: 600, color: "#C9A84C",
                background: "transparent", cursor: "pointer", border: "none",
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(201,168,76,0.04)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
            >
              <div
                style={{ width: 18, height: 18, borderRadius: 4, background: "rgba(201,168,76,0.12)", border: "1px solid rgba(201,168,76,0.2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
              >
                <Plus size={11} color="#C9A84C" />
              </div>
              Dodaj novi hotel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

interface PeriodDropdownProps {
  value: string;
  periods: string[];
  onChange: (v: string) => void;
}

function PeriodDropdown({ value, periods, onChange }: PeriodDropdownProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <div style={{ fontSize: 10, color: "#9ca3af", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 2 }}>
        Period
      </div>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: "flex", alignItems: "center", gap: 8,
          height: 34, paddingLeft: 12, paddingRight: 10,
          background: "#f9fafb", border: "1px solid #e5e7eb",
          borderRadius: 8, color: value ? "#111827" : "#9ca3af",
          fontSize: 13, fontWeight: value ? 500 : 400,
          cursor: "pointer", minWidth: 160,
        }}
      >
        <span style={{ flex: 1, textAlign: "left" }}>{value || "Odaberite period"}</span>
        <ChevronDown size={14} color="#9ca3af" style={{ transform: open ? "rotate(180deg)" : undefined, transition: "transform 0.15s", flexShrink: 0 }} />
      </button>

      {open && (
        <div
          style={{
            position: "absolute", top: "100%", left: 0, marginTop: 4, zIndex: 50,
            background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 10,
            boxShadow: "0 8px 24px rgba(0,0,0,0.08)", minWidth: 180, overflow: "hidden",
            maxHeight: 280, overflowY: "auto",
          }}
        >
          {periods.map(p => (
            <button
              key={p}
              onClick={() => { onChange(p); setOpen(false); }}
              style={{
                display: "flex", alignItems: "center", width: "100%",
                height: 36, paddingLeft: 12, paddingRight: 12,
                fontSize: 13, fontWeight: p === value ? 600 : 400,
                color: p === value ? "#C9A84C" : "#374151",
                background: p === value ? "rgba(201,168,76,0.06)" : "transparent",
                cursor: "pointer", border: "none",
              }}
              onMouseEnter={e => { if (p !== value) (e.currentTarget as HTMLElement).style.background = "#f9fafb"; }}
              onMouseLeave={e => { if (p !== value) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
            >
              {p}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

interface TopBarProps {
  hotel: string;
  period: string;
  onHotelChange: (h: string) => void;
  onPeriodChange: (p: string) => void;
  hotels: string[];
  periods: string[];
  onAddHotel: () => void;
}

export default function TopBar({ hotel, period, onHotelChange, onPeriodChange, hotels, periods, onAddHotel }: TopBarProps) {
  return (
    <header
      className="flex items-end justify-between px-6"
      style={{ height: 64, background: "#ffffff", borderBottom: "1px solid #e5e7eb", paddingBottom: 12, flexShrink: 0 }}
    >
      <div className="flex items-end gap-4">
        <HotelDropdown value={hotel} hotels={hotels} onChange={onHotelChange} onAddHotel={onAddHotel} />
        <PeriodDropdown value={period} periods={periods} onChange={onPeriodChange} />
      </div>

      <div className="flex items-end gap-2 pb-0.5">
        <button
          style={{ display: "flex", alignItems: "center", gap: 6, height: 34, paddingLeft: 12, paddingRight: 12, background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 8, color: "#6b7280", fontSize: 12, fontWeight: 500, cursor: "pointer" }}
        >
          <RefreshCw size={13} />
          Osveži
        </button>
        <button
          style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 34, height: 34, background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 8, cursor: "pointer" }}
        >
          <Bell size={15} color="#6b7280" />
        </button>
      </div>
    </header>
  );
}
