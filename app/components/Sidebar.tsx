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
} from "lucide-react";

const navItems = [
  { label: "Dashboard",        icon: LayoutDashboard, href: "/"          },
  { label: "Mesečni Pregled",  icon: CalendarDays,    href: "/mesecni"   },
  { label: "Preporuka Cena",   icon: TrendingUp,      href: "/preporuka" },
  { label: "Pickup Analiza",   icon: BarChart3,        href: "/pickup"    },
  { label: "Centar Akcija",    icon: Zap,             href: "/akcija"    },
  { label: "Kalendar Prihoda", icon: Calendar,        href: "/kalendar"  },
  { label: "Izveštaji",        icon: FileText,        href: "/izvestaji" },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside
      className="flex flex-col h-full"
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
      <nav className="flex flex-col gap-0.5 px-3 flex-1">
        {navItems.map(({ label, icon: Icon, href }) => {
          const isActive = pathname === href;
          return (
            <Link
              key={href}
              href={href}
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
