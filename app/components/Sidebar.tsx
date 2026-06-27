"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  CalendarDays,
  TrendingUp,
  BarChart3,
  Zap,
  Calendar,
  FileText,
  ChevronRight,
  Hotel,
  Trash2,
} from "lucide-react";
import { useHotel } from "../context/HotelContext";

const navItems = [
  { label: "Dashboard",        icon: LayoutDashboard, href: "/"          },
  { label: "Mesečni Pregled",  icon: CalendarDays,    href: "/mesecni"   },
  { label: "Preporuka Cena",   icon: TrendingUp,      href: "/preporuka" },
  { label: "Pickup Analiza",   icon: BarChart3,        href: "/pickup"    },
  { label: "Centar Akcija",    icon: Zap,             href: "/akcija"    },
  { label: "Kalendar Prihoda", icon: Calendar,        href: "/kalendar"  },
  { label: "Izveštaji",        icon: FileText,        href: "/izvestaji" },
];

interface SidebarProps {
  mobileOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ mobileOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { hotels, selectedHotel, setSelectedHotel, deleteHotel } = useHotel();

  return (
    <aside
      className={`fixed md:static inset-y-0 left-0 z-40 flex flex-col h-full transition-transform duration-200 ease-in-out md:translate-x-0 ${
        mobileOpen ? "translate-x-0" : "-translate-x-full"
      }`}
      style={{
        width: 240,
        minWidth: 240,
        background: "#ffffff",
        borderRight: "1px solid #e5e7eb",
        flexShrink: 0,
      }}
    >
      {/* Logo */}
      <div
        className="flex items-center gap-3 px-5"
        style={{ height: 64, borderBottom: "1px solid #e5e7eb" }}
      >
        <div
          className="flex items-center justify-center rounded-lg"
          style={{
            width: 36,
            height: 36,
            background: "linear-gradient(135deg, #C9A84C 0%, #E8C96B 100%)",
          }}
        >
          <Hotel size={18} color="#ffffff" strokeWidth={2.5} />
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#111827", letterSpacing: "-0.01em" }}>
            Revigo
          </div>
          <div style={{ fontSize: 10, color: "#C9A84C", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" }}>
            Cockpit
          </div>
        </div>
      </div>

      {/* Nav label */}
      <div
        className="px-5 pt-6 pb-2"
        style={{ fontSize: 10, fontWeight: 600, color: "#9ca3af", letterSpacing: "0.1em", textTransform: "uppercase" }}
      >
        Navigacija
      </div>

      {/* Nav items */}
      <nav className="flex flex-col gap-0.5 px-3">
        {navItems.map(({ label, icon: Icon, href }) => {
          const isActive = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              onClick={onClose}
              className="flex items-center gap-3 w-full rounded-lg transition-all duration-150 no-underline"
              style={{
                height: 40,
                paddingLeft: isActive ? 14 : 16,
                paddingRight: 12,
                borderLeft: isActive ? "2px solid #C9A84C" : "2px solid transparent",
                background: isActive ? "rgba(201,168,76,0.08)" : "transparent",
                textDecoration: "none",
              }}
              onMouseEnter={e => {
                if (!isActive) (e.currentTarget as HTMLElement).style.background = "#f9fafb";
              }}
              onMouseLeave={e => {
                if (!isActive) (e.currentTarget as HTMLElement).style.background = "transparent";
              }}
            >
              <Icon
                size={16}
                color={isActive ? "#C9A84C" : "#9ca3af"}
                strokeWidth={isActive ? 2.5 : 2}
              />
              <span
                style={{
                  fontSize: 13,
                  fontWeight: isActive ? 600 : 500,
                  color: isActive ? "#111827" : "#6b7280",
                  flex: 1,
                }}
              >
                {label}
              </span>
              {isActive && <ChevronRight size={12} color="#C9A84C" />}
            </Link>
          );
        })}
      </nav>

      {/* Naši hoteli */}
      <div className="flex flex-col flex-1 min-h-0 px-3 pt-6">
        <div
          className="px-2 pb-2"
          style={{ fontSize: 10, fontWeight: 600, color: "#9ca3af", letterSpacing: "0.1em", textTransform: "uppercase" }}
        >
          Naši hoteli
        </div>
        <div className="flex flex-col gap-0.5 overflow-y-auto">
          {hotels.length === 0 ? (
            <div className="px-2 py-1" style={{ fontSize: 12, color: "#9ca3af" }}>
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
                    height: 44,
                    paddingLeft: 12,
                    paddingRight: 8,
                    cursor: "pointer",
                    background: isSelected ? "rgba(201,168,76,0.08)" : "transparent",
                    border: isSelected ? "1px solid rgba(201,168,76,0.2)" : "1px solid transparent",
                  }}
                  onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = "#f9fafb"; }}
                  onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: isSelected ? 600 : 500,
                        color: isSelected ? "#111827" : "#374151",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {h.name}
                    </div>
                    <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 1 }}>{h.city}</div>
                  </div>
                  <button
                    onClick={e => { e.stopPropagation(); deleteHotel(h.id); }}
                    className="flex items-center justify-center rounded-md"
                    style={{ width: 24, height: 24, background: "transparent", border: "none", cursor: "pointer", flexShrink: 0 }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(220,38,38,0.1)"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                    title="Obriši hotel"
                  >
                    <Trash2 size={13} color="#dc2626" />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="px-5 py-4" style={{ borderTop: "1px solid #e5e7eb" }}>
        <div className="flex items-center gap-2">
          <div
            className="rounded-full flex items-center justify-center text-xs font-bold"
            style={{
              width: 28,
              height: 28,
              background: "linear-gradient(135deg, #C9A84C 0%, #E8C96B 100%)",
              color: "#ffffff",
              fontSize: 11,
            }}
          >
            RM
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>Revenue Manager</div>
            <div style={{ fontSize: 10, color: "#9ca3af" }}>Admin pristup</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
