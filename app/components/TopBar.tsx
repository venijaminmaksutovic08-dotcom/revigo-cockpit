"use client";

import { useState } from "react";
import { ChevronDown, Bell, RefreshCw, Plus, Trash2, Menu, CalendarDays } from "lucide-react";
import type { SavedHotel } from "../context/HotelContext";
import { useBriefingItems } from "../hooks/useBriefingItems";
import ConfirmDialog from "./ConfirmDialog";

// ── Hotel dropdown ─────────────────────────────────────────────────────────────

interface HotelDropdownProps {
  value:          string;
  hotels:         SavedHotel[];
  onChange:       (id: string) => void;
  onAddHotel:     () => void;
  onDeleteHotel:  (id: string) => void;
}

function HotelDropdown({ value, hotels, onChange, onAddHotel, onDeleteHotel }: HotelDropdownProps) {
  const [open, setOpen]                     = useState(false);
  const [pendingDelete, setPendingDelete]   = useState<SavedHotel | null>(null);
  const selectedHotel = hotels.find(h => h.id === value) ?? null;

  function select(id: string) { onChange(id); setOpen(false); }
  function openModal() { setOpen(false); onAddHotel(); }
  function handleDelete(e: React.MouseEvent, h: SavedHotel) { e.stopPropagation(); setPendingDelete(h); }

  return (
    <div className="relative">
      <div style={{ fontSize: 9, fontWeight: 700, color: "#9ca3af", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 3 }}>
        Hotel
      </div>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: "flex", alignItems: "center", gap: 10,
          minHeight: 44, paddingLeft: 12, paddingRight: 10, paddingTop: 4, paddingBottom: 4,
          background: "#f9fafb", border: "1px solid #e5e7eb",
          borderRadius: 10, cursor: "pointer", minWidth: 190,
          transition: "border-color 0.15s",
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "#d1d5db"; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "#e5e7eb"; }}
      >
        <div style={{ flex: 1, textAlign: "left" }}>
          {selectedHotel ? (
            <>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#111827", lineHeight: 1.2 }}>{selectedHotel.name}</div>
              <div style={{ fontSize: 11, color: "#9ca3af", lineHeight: 1.2 }}>{selectedHotel.city}</div>
            </>
          ) : (
            <span style={{ fontSize: 13, color: "#9ca3af" }}>Odaberite hotel</span>
          )}
        </div>
        <ChevronDown
          size={14} color="#9ca3af"
          style={{ transform: open ? "rotate(180deg)" : undefined, transition: "transform 0.15s", flexShrink: 0 }}
        />
      </button>

      {open && (
        <div
          style={{
            position: "absolute", top: "calc(100% + 4px)", left: 0, zIndex: 50,
            background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 12,
            boxShadow: "0 12px 32px rgba(0,0,0,0.1)", minWidth: 230, overflow: "hidden",
          }}
        >
          {hotels.length === 0 ? (
            <div style={{ padding: "10px 14px", fontSize: 12, color: "#9ca3af" }}>Nema dodanih hotela</div>
          ) : hotels.map(h => (
            <div
              key={h.id}
              onClick={() => select(h.id)}
              className="flex items-center"
              style={{
                paddingLeft: 14, paddingRight: 8, paddingTop: 8, paddingBottom: 8,
                fontSize: 13, fontWeight: h.id === value ? 700 : 400,
                color: h.id === value ? "#C9A84C" : "#374151",
                background: h.id === value ? "rgba(201,168,76,0.06)" : "transparent",
                cursor: "pointer", borderBottom: "1px solid #f9fafb",
              }}
              onMouseEnter={e => { if (h.id !== value) (e.currentTarget as HTMLElement).style.background = "#f9fafb"; }}
              onMouseLeave={e => { if (h.id !== value) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: h.id === value ? 700 : 500 }}>{h.name}</div>
                <div style={{ fontSize: 11, color: "#9ca3af" }}>{h.city}</div>
              </div>
              <button
                onClick={e => handleDelete(e, h)}
                className="flex items-center justify-center rounded-md"
                style={{ width: 26, height: 26, background: "transparent", border: "none", cursor: "pointer" }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(220,38,38,0.1)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
              >
                <Trash2 size={13} color="#dc2626" />
              </button>
            </div>
          ))}
          <div style={{ borderTop: "1px solid #f3f4f6" }}>
            <button
              onClick={openModal}
              style={{
                display: "flex", alignItems: "center", gap: 8, width: "100%",
                height: 40, paddingLeft: 14, paddingRight: 14,
                fontSize: 13, fontWeight: 600, color: "#C9A84C",
                background: "transparent", cursor: "pointer", border: "none",
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(201,168,76,0.04)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
            >
              <div style={{ width: 18, height: 18, borderRadius: 4, background: "rgba(201,168,76,0.12)", border: "1px solid rgba(201,168,76,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Plus size={11} color="#C9A84C" />
              </div>
              Dodaj novi hotel
            </button>
          </div>
        </div>
      )}

      {pendingDelete && (
        <ConfirmDialog
          message={`Da li ste sigurni da želite da obrišete hotel ${pendingDelete.name}? Ova akcija se ne može poništiti.`}
          onConfirm={() => { onDeleteHotel(pendingDelete.id); setPendingDelete(null); }}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </div>
  );
}

// ── Period dropdown ────────────────────────────────────────────────────────────

function PeriodDropdown({ value, periods, onChange }: { value: string; periods: string[]; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <div style={{ fontSize: 9, fontWeight: 700, color: "#9ca3af", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 3 }}>
        Period
      </div>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: "flex", alignItems: "center", gap: 8,
          height: 44, paddingLeft: 12, paddingRight: 10,
          background: "#f9fafb", border: "1px solid #e5e7eb",
          borderRadius: 10, cursor: "pointer", minWidth: 160,
          transition: "border-color 0.15s",
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "#d1d5db"; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "#e5e7eb"; }}
      >
        <CalendarDays size={14} color="#9ca3af" style={{ flexShrink: 0 }} />
        <span style={{ flex: 1, textAlign: "left", fontSize: 13, fontWeight: value ? 700 : 400, color: value ? "#111827" : "#9ca3af" }}>
          {value || "Odaberite period"}
        </span>
        <ChevronDown size={14} color="#9ca3af" style={{ transform: open ? "rotate(180deg)" : undefined, transition: "transform 0.15s", flexShrink: 0 }} />
      </button>

      {open && (
        <div
          style={{
            position: "absolute", top: "calc(100% + 4px)", left: 0, zIndex: 50,
            background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 12,
            boxShadow: "0 12px 32px rgba(0,0,0,0.1)", minWidth: 180, overflow: "hidden",
            maxHeight: 280, overflowY: "auto",
          }}
        >
          {periods.map(p => (
            <button
              key={p}
              onClick={() => { onChange(p); setOpen(false); }}
              style={{
                display: "flex", alignItems: "center", width: "100%",
                height: 36, paddingLeft: 14, paddingRight: 14,
                fontSize: 13, fontWeight: p === value ? 700 : 400,
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

// ── TopBar ─────────────────────────────────────────────────────────────────────

interface TopBarProps {
  hotel:          string;
  period:         string;
  onHotelChange:  (id: string) => void;
  onPeriodChange: (p: string) => void;
  hotels:         SavedHotel[];
  periods:        string[];
  onAddHotel:     () => void;
  onDeleteHotel:  (id: string) => void;
  onMenuClick:    () => void;
}

export default function TopBar({ hotel, period, onHotelChange, onPeriodChange, hotels, periods, onAddHotel, onDeleteHotel, onMenuClick }: TopBarProps) {
  const { items } = useBriefingItems();
  const hasAlert  = items.some(i => i.severity === "red" || i.severity === "yellow");

  return (
    <header
      className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 px-4 md:px-6 py-3"
      style={{ background: "#ffffff", borderBottom: "1px solid #e5e7eb", flexShrink: 0, minHeight: 72 }}
    >
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="md:hidden flex items-center justify-center rounded-lg"
          style={{ width: 36, height: 36, background: "#f9fafb", border: "1px solid #e5e7eb", cursor: "pointer", flexShrink: 0 }}
        >
          <Menu size={16} color="#374151" />
        </button>
        <div className="flex flex-col md:flex-row md:items-end gap-3 md:gap-4">
          <HotelDropdown
            value={hotel}
            hotels={hotels}
            onChange={onHotelChange}
            onAddHotel={onAddHotel}
            onDeleteHotel={onDeleteHotel}
          />
          <PeriodDropdown value={period} periods={periods} onChange={onPeriodChange} />
        </div>
      </div>

      <div className="flex items-center justify-end gap-2">
        <button
          style={{
            display: "flex", alignItems: "center", gap: 6,
            height: 36, paddingLeft: 14, paddingRight: 14,
            background: "#f9fafb", border: "1px solid #e5e7eb",
            borderRadius: 9, color: "#6b7280", fontSize: 12, fontWeight: 600, cursor: "pointer",
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#f3f4f6"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "#f9fafb"; }}
        >
          <RefreshCw size={13} />
          Osveži
        </button>

        {/* Bell with notification dot */}
        <button
          style={{
            position: "relative",
            display: "flex", alignItems: "center", justifyContent: "center",
            width: 36, height: 36, background: "#f9fafb", border: "1px solid #e5e7eb",
            borderRadius: 9, cursor: "pointer", flexShrink: 0,
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#f3f4f6"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "#f9fafb"; }}
          title="Briefing"
        >
          <Bell size={15} color={hasAlert ? "#111827" : "#6b7280"} />
          {hasAlert && (
            <div style={{
              position: "absolute", top: 7, right: 7,
              width: 7, height: 7, borderRadius: "50%",
              background: "#ef4444", border: "2px solid #ffffff",
            }} />
          )}
        </button>

        {/* User avatar */}
        <div
          className="flex items-center justify-center rounded-full"
          style={{ width: 36, height: 36, background: "linear-gradient(135deg, #C9A84C 0%, #F59E0B 100%)", flexShrink: 0 }}
        >
          <span style={{ fontSize: 11, fontWeight: 800, color: "#ffffff" }}>RM</span>
        </div>
      </div>
    </header>
  );
}
