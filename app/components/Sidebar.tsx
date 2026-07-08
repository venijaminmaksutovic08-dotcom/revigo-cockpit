"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  PenLine,
  Scale,
  CalendarDays,
  TrendingUp,
  Activity,
  Zap,
  FileText,
  ChevronRight,
  Hotel,
  Trash2,
} from "lucide-react";
import { useHotel, type SavedHotel } from "../context/HotelContext";
import ConfirmDialog from "./ConfirmDialog";

interface NavItem {
  label:     string;
  icon:      React.ElementType;
  href:      string;
  iconColor: string;
}

const navItems: NavItem[] = [
  { label: "Dashboard",         icon: BarChart3,    href: "/",           iconColor: "#F59E0B" },
  { label: "Unos Podataka",     icon: PenLine,      href: "/unos",       iconColor: "#10B981" },
  { label: "Poređenje Perioda", icon: Scale,        href: "/poredjenje", iconColor: "#3B82F6" },
  { label: "Mesečni Pregled",   icon: CalendarDays, href: "/mesecni",    iconColor: "#8B5CF6" },
  { label: "Preporuka Cena",    icon: TrendingUp,   href: "/preporuka",  iconColor: "#F59E0B" },
  { label: "Pickup Analiza",    icon: Activity,     href: "/pickup",     iconColor: "#06B6D4" },
  { label: "Centar Akcija",     icon: Zap,          href: "/akcija",     iconColor: "#F97316" },
  { label: "Izveštaji",         icon: FileText,     href: "/izvestaji",  iconColor: "rgba(255,255,255,0.35)" },
];

interface SidebarProps {
  mobileOpen: boolean;
  onClose:    () => void;
}

export default function Sidebar({ mobileOpen, onClose }: SidebarProps) {
  const pathname   = usePathname();
  const { hotels, selectedHotel, setSelectedHotel, deleteHotel } = useHotel();
  const [pendingDelete,   setPendingDelete]   = useState<SavedHotel | null>(null);
  const [hoveredHotelId, setHoveredHotelId]  = useState<string | null>(null);

  return (
    <aside
      className={`fixed md:static inset-y-0 left-0 z-40 flex flex-col h-full transition-transform duration-200 ease-in-out md:translate-x-0 ${
        mobileOpen ? "translate-x-0" : "-translate-x-full"
      }`}
      style={{ width: 240, minWidth: 240, background: "#0F172A", flexShrink: 0 }}
    >
      {/* Logo */}
      <div
        className="flex items-center gap-3 px-5"
        style={{ height: 64, borderBottom: "1px solid rgba(255,255,255,0.06)", flexShrink: 0 }}
      >
        <div
          className="flex items-center justify-center rounded-lg"
          style={{ width: 36, height: 36, background: "linear-gradient(135deg, #F59E0B 0%, #FBBF24 100%)", flexShrink: 0 }}
        >
          <Hotel size={18} color="#ffffff" strokeWidth={2.5} />
        </div>
        <div>
          <div style={{ fontSize: 15, fontWeight: 800, color: "#ffffff", letterSpacing: "-0.01em", lineHeight: 1.1 }}>
            Revigo
          </div>
          <div style={{ fontSize: 9, color: "#F59E0B", fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase" }}>
            Cockpit
          </div>
        </div>
      </div>

      {/* Nav label */}
      <div
        className="px-5 pt-6 pb-2"
        style={{ fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.3)", letterSpacing: "0.12em", textTransform: "uppercase" }}
      >
        Navigacija
      </div>

      {/* Nav items */}
      <nav className="flex flex-col gap-0.5 px-3">
        {navItems.map(({ label, icon: Icon, href, iconColor }) => {
          const isActive = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              onClick={onClose}
              className="flex items-center gap-3 w-full rounded-lg no-underline"
              style={{
                height: 40,
                paddingLeft: isActive ? 12 : 12,
                paddingRight: 12,
                borderLeft: isActive ? "3px solid #F59E0B" : "3px solid transparent",
                background: isActive ? "rgba(245,158,11,0.1)" : "transparent",
                textDecoration: "none",
                transition: "background 0.15s, border-color 0.15s",
              }}
              onMouseEnter={e => {
                if (!isActive) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.05)";
              }}
              onMouseLeave={e => {
                if (!isActive) (e.currentTarget as HTMLElement).style.background = "transparent";
              }}
            >
              <Icon
                size={16}
                color={isActive ? "#F59E0B" : iconColor}
                strokeWidth={isActive ? 2.5 : 2}
                style={{ flexShrink: 0 }}
              />
              <span
                style={{
                  fontSize: 13,
                  fontWeight: isActive ? 700 : 500,
                  color: isActive ? "#F59E0B" : "rgba(255,255,255,0.8)",
                  flex: 1,
                  letterSpacing: isActive ? "-0.01em" : "normal",
                }}
              >
                {label}
              </span>
              {isActive && <ChevronRight size={12} color="#F59E0B" />}
            </Link>
          );
        })}
      </nav>

      {/* Naši hoteli */}
      <div className="flex flex-col flex-1 min-h-0 px-3 pt-6">
        <div
          className="px-2 pb-2"
          style={{ fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.3)", letterSpacing: "0.12em", textTransform: "uppercase" }}
        >
          Naši hoteli
        </div>
        <div className="flex flex-col gap-0.5 overflow-y-auto">
          {hotels.length === 0 ? (
            <div className="px-2 py-1" style={{ fontSize: 12, color: "rgba(255,255,255,0.3)" }}>
              Nema dodanih hotela
            </div>
          ) : (
            hotels.map(h => {
              const isSelected = h.id === selectedHotel;
              return (
                <div
                  key={h.id}
                  onClick={() => { setSelectedHotel(h.id); onClose(); }}
                  className="flex items-center gap-2 w-full rounded-lg"
                  style={{
                    minHeight: 46,
                    paddingLeft: 12,
                    paddingRight: 8,
                    paddingTop: 6,
                    paddingBottom: 6,
                    cursor: "pointer",
                    background: isSelected ? "rgba(245,158,11,0.12)" : "transparent",
                    borderLeft: isSelected ? "3px solid #F59E0B" : "3px solid transparent",
                    transition: "background 0.15s",
                  }}
                  onMouseEnter={e => {
                    if (!isSelected) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.05)";
                    setHoveredHotelId(h.id);
                  }}
                  onMouseLeave={e => {
                    if (!isSelected) (e.currentTarget as HTMLElement).style.background = "transparent";
                    setHoveredHotelId(null);
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: isSelected ? 700 : 500,
                        color: isSelected ? "#F59E0B" : "rgba(255,255,255,0.85)",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {h.name}
                    </div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 1 }}>{h.city}</div>
                  </div>
                  <button
                    onClick={e => { e.stopPropagation(); setPendingDelete(h); }}
                    className="flex items-center justify-center rounded-md"
                    style={{
                      width: 24, height: 24, background: "transparent", border: "none",
                      cursor: "pointer", flexShrink: 0,
                      opacity: hoveredHotelId === h.id ? 1 : 0,
                      transition: "opacity 0.15s",
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(220,38,38,0.2)"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                    title="Obriši hotel"
                  >
                    <Trash2 size={13} color="#ef4444" />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="px-5 py-4" style={{ borderTop: "1px solid rgba(255,255,255,0.06)", flexShrink: 0 }}>
        <div className="flex items-center gap-2">
          <div
            className="rounded-full flex items-center justify-center text-xs font-bold"
            style={{
              width: 30, height: 30,
              background: "linear-gradient(135deg, #F59E0B 0%, #FBBF24 100%)",
              color: "#ffffff", fontSize: 11, fontWeight: 800, flexShrink: 0,
            }}
          >
            RM
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.85)" }}>Revenue Manager</div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)" }}>Admin pristup</div>
          </div>
        </div>
      </div>

      {pendingDelete && (
        <ConfirmDialog
          message={`Da li ste sigurni da želite da obrišete hotel ${pendingDelete.name}? Ova akcija se ne može poništiti.`}
          onConfirm={() => { deleteHotel(pendingDelete.id); setPendingDelete(null); }}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </aside>
  );
}
