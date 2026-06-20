"use client";

import { useState } from "react";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";
import HotelModal from "./HotelModal";
import { HotelProvider, useHotel, type SavedHotel } from "../context/HotelContext";

const PERIODS = [
  "Januar 2026", "Februar 2026", "Mart 2026",    "April 2026",
  "Maj 2026",    "Jun 2026",     "Jul 2026",      "Avgust 2026",
  "Septembar 2026", "Oktobar 2026", "Novembar 2026", "Decembar 2026",
];

function DashboardShellInner({ children }: { children: React.ReactNode }) {
  const { hotels, selectedHotel, selectedPeriod, setSelectedHotel, setSelectedPeriod, addHotel, deleteHotel } = useHotel();
  const [showModal, setShowModal] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  function handleAddHotel(hotel: SavedHotel) {
    addHotel(hotel);
    setShowModal(false);
  }

  return (
    <div className="flex h-full" style={{ background: "#f9fafb", overflow: "hidden" }}>
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-30 md:hidden"
          style={{ background: "rgba(17,24,39,0.4)" }}
          onClick={() => setMobileMenuOpen(false)}
        />
      )}
      <Sidebar mobileOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <TopBar
          hotel={selectedHotel}
          period={selectedPeriod}
          onHotelChange={setSelectedHotel}
          onPeriodChange={setSelectedPeriod}
          hotels={hotels.map(h => h.name)}
          periods={PERIODS}
          onAddHotel={() => setShowModal(true)}
          onDeleteHotel={deleteHotel}
          onMenuClick={() => setMobileMenuOpen(o => !o)}
        />
        <main className="flex-1 overflow-y-auto p-4 md:p-6" style={{ background: "#f9fafb" }}>
          {children}
        </main>
      </div>

      {showModal && (
        <HotelModal
          onSave={handleAddHotel}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}

export default function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <HotelProvider>
      <DashboardShellInner>{children}</DashboardShellInner>
    </HotelProvider>
  );
}
