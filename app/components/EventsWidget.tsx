"use client";

import { useEffect, useState } from "react";
import { CalendarDays, ExternalLink } from "lucide-react";
import { useHotel, MONTHS_SR } from "../context/HotelContext";
import type { EventResult } from "../api/events/route";

function parsePeriod(period: string): { monthSr: string; year: string } | null {
  const [monthName, yearStr] = period.split(" ");
  const idx = MONTHS_SR.indexOf(monthName);
  if (idx === -1 || !yearStr) return null;
  // Lowercase Serbian month name for the search query
  return { monthSr: monthName.toLowerCase(), year: yearStr };
}

export default function EventsWidget() {
  const { hotels, selectedHotel, selectedPeriod } = useHotel();
  const hotel = hotels.find(h => h.id === selectedHotel) ?? null;
  const city  = hotel?.city ?? "";

  const [events, setEvents]     = useState<EventResult[]>([]);
  const [fetched, setFetched]   = useState(false); // has a fetch completed (success or empty)?

  useEffect(() => {
    if (!city || !selectedPeriod) { setEvents([]); setFetched(false); return; }

    const parsed = parsePeriod(selectedPeriod);
    if (!parsed) { setEvents([]); setFetched(false); return; }

    let cancelled = false;
    setFetched(false);

    (async () => {
      try {
        const params = new URLSearchParams({
          location: city,
          month: parsed.monthSr,
          year: parsed.year,
        });
        const res = await fetch(`/api/events?${params}`);
        if (cancelled) return;
        if (!res.ok) { setEvents([]); setFetched(true); return; }
        const data: EventResult[] = await res.json();
        setEvents(data);
      } catch {
        if (!cancelled) setEvents([]);
      } finally {
        if (!cancelled) setFetched(true);
      }
    })();

    return () => { cancelled = true; };
  }, [city, selectedPeriod]);

  // Hide entirely when: no hotel selected, no period, fetch not done yet, or no results
  if (!city || !selectedPeriod || !fetched || events.length === 0) return null;

  return (
    <div
      className="rounded-xl mb-5"
      style={{ background: "#ffffff", border: "1px solid #e5e7eb", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-5 pt-4 pb-3"
        style={{ borderBottom: "1px solid #f3f4f6" }}
      >
        <div className="flex items-center gap-3">
          <div
            className="rounded-xl flex items-center justify-center"
            style={{ width: 36, height: 36, background: "rgba(201,168,76,0.08)", border: "1px solid rgba(201,168,76,0.2)" }}
          >
            <CalendarDays size={18} color="#C9A84C" />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>Lokalni Događaji</div>
            <div style={{ fontSize: 11, color: "#9ca3af" }}>
              {city} · {selectedPeriod}
            </div>
          </div>
        </div>
      </div>

      {/* Event list */}
      <div className="px-5 py-3 flex flex-col" style={{ gap: 0 }}>
        {events.map((ev, i) => (
          <div
            key={ev.url}
            style={{
              paddingTop: 12,
              paddingBottom: 12,
              borderBottom: i < events.length - 1 ? "1px solid #f3f4f6" : "none",
            }}
          >
            {/* Title + source link */}
            <div className="flex items-start justify-between gap-3">
              <div style={{ fontSize: 13, fontWeight: 600, color: "#111827", lineHeight: 1.4, flex: 1 }}>
                {ev.title}
              </div>
              <a
                href={ev.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 flex-shrink-0"
                style={{ fontSize: 11, color: "#C9A84C", fontWeight: 600, textDecoration: "none", marginTop: 1 }}
              >
                Izvor
                <ExternalLink size={10} />
              </a>
            </div>

            {/* Date (when available) */}
            {ev.date && (
              <div style={{ fontSize: 11, color: "#6b7280", marginTop: 3 }}>{ev.date}</div>
            )}

            {/* Description */}
            <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4, lineHeight: 1.5 }}>
              {ev.description}
            </div>

            {/* Source domain badge */}
            <div style={{ marginTop: 5 }}>
              <span
                style={{
                  fontSize: 10, fontWeight: 500, color: "#9ca3af",
                  background: "#f9fafb", border: "1px solid #e5e7eb",
                  borderRadius: 4, padding: "2px 6px",
                }}
              >
                {ev.domain}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Disclaimer */}
      <div
        className="mx-5 mb-4 rounded-lg"
        style={{ padding: "7px 11px", background: "#f9fafb", border: "1px solid #f3f4f6" }}
      >
        <span style={{ fontSize: 11, color: "#9ca3af" }}>
          ⚠️ Podaci su automatski prikupljeni — uvek proverite tačnost pre donošenja odluka
        </span>
      </div>
    </div>
  );
}
