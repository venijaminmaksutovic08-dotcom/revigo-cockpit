"use client";

import { useState, useEffect } from "react";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";
import HotelModal from "./HotelModal";

const PERIODS = [
  "Januar 2026", "Februar 2026", "Mart 2026",    "April 2026",
  "Maj 2026",    "Jun 2026",     "Jul 2026",      "Avgust 2026",
  "Septembar 2026", "Oktobar 2026", "Novembar 2026", "Decembar 2026",
];

interface SavedHotel {
  name: string;
  rooms: number;
  city: string;
}

const STORAGE_KEY = "revigo_hotels";

export default function DashboardShell({ children }: { children: React.ReactNode }) {
  const [hotels, setHotels] = useState<SavedHotel[]>([]);
  const [selectedHotel, setSelectedHotel] = useState("");
  const [selectedPeriod, setSelectedPeriod] = useState("");
  const [showModal, setShowModal] = useState(false);

  // Load hotels from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed: SavedHotel[] = JSON.parse(stored);
        setHotels(parsed);
        if (parsed.length > 0) setSelectedHotel(parsed[0].name);
      }
    } catch {
      // ignore parse errors
    }
  }, []);

  function handleAddHotel(hotel: SavedHotel) {
    const updated = [...hotels, hotel];
    setHotels(updated);
    setSelectedHotel(hotel.name);
    setShowModal(false);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // ignore storage errors
    }
  }

  return (
    <div className="flex h-full" style={{ background: "#f9fafb", overflow: "hidden" }}>
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <TopBar
          hotel={selectedHotel}
          period={selectedPeriod}
          onHotelChange={setSelectedHotel}
          onPeriodChange={setSelectedPeriod}
          hotels={hotels.map(h => h.name)}
          periods={PERIODS}
          onAddHotel={() => setShowModal(true)}
        />
        <main className="flex-1 overflow-y-auto" style={{ padding: "24px", background: "#f9fafb" }}>
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
