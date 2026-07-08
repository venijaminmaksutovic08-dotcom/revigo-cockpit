"use client";

import { useEffect, useState, useCallback } from "react";
import { Building2, Plus, Trash2, RefreshCw, ExternalLink, Star } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { useHotel } from "../context/HotelContext";
import type { CompetitorResult } from "../api/competitors/route";

interface CompetitorRow {
  id: string;
  hotel_id: string;
  competitor_name: string;
  competitor_city: string;
}

// ── helpers ───────────────────────────────────────────────────────────────────

function getTomorrowDates(): { checkin: string; checkout: string } {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const checkin  = d.toISOString().slice(0, 10);
  d.setDate(d.getDate() + 1);
  const checkout = d.toISOString().slice(0, 10);
  return { checkin, checkout };
}

function formatCheckin(checkin: string): string {
  return new Date(`${checkin}T00:00:00`).toLocaleDateString("sr-RS", {
    day: "numeric", month: "long",
  });
}

// ── sub-components ────────────────────────────────────────────────────────────

function ResultCard({ r }: { r: CompetitorResult }) {
  return (
    <div
      className="flex items-start justify-between gap-3"
      style={{
        padding: "10px 12px",
        background: "#f9fafb",
        border: "1px solid #e5e7eb",
        borderRadius: 8,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#111827", marginBottom: 2 }}>
          {r.name}
        </div>
        <div className="flex flex-wrap items-center gap-2" style={{ marginTop: 3 }}>
          {r.hotelClass && (
            <span style={{ fontSize: 10, color: "#9ca3af" }}>{r.hotelClass}</span>
          )}
          {r.rating !== null && (
            <span className="flex items-center gap-0.5" style={{ fontSize: 11, color: "#6b7280" }}>
              <Star size={10} fill="#C9A84C" color="#C9A84C" />
              {r.rating.toFixed(1)}
              {r.reviews !== null && (
                <span style={{ color: "#9ca3af" }}>&nbsp;({r.reviews.toLocaleString()})</span>
              )}
            </span>
          )}
          {r.source && (
            <span style={{ fontSize: 10, color: "#9ca3af", background: "#f3f4f6", border: "1px solid #e5e7eb", borderRadius: 3, padding: "1px 5px" }}>
              {r.source}
            </span>
          )}
        </div>
      </div>
      <div className="flex flex-col items-end gap-1" style={{ flexShrink: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: "#111827" }}>{r.priceFormatted}</div>
        <div style={{ fontSize: 10, color: "#9ca3af" }}>/ noć</div>
        {r.link && (
          <a
            href={r.link}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1"
            style={{ fontSize: 11, color: "#C9A84C", fontWeight: 600, textDecoration: "none" }}
          >
            Otvori <ExternalLink size={10} />
          </a>
        )}
      </div>
    </div>
  );
}

// ── main component ────────────────────────────────────────────────────────────

export default function CompetitorPrices() {
  const { hotels, selectedHotel } = useHotel();
  const hotel = hotels.find(h => h.id === selectedHotel) ?? null;
  const city  = hotel?.city ?? "";

  // Saved competitors
  const [competitors, setCompetitors] = useState<CompetitorRow[]>([]);
  const [newName, setNewName]         = useState("");
  const [saving, setSaving]           = useState(false);

  // Market scan
  const [marketResults, setMarketResults]   = useState<CompetitorResult[]>([]);
  const [marketLoading, setMarketLoading]   = useState(false);
  const [marketCheckin, setMarketCheckin]   = useState("");

  // Per-competitor results: keyed by competitor id
  const [compResults, setCompResults] = useState<Record<string, CompetitorResult[]>>({});
  const [compLoading, setCompLoading] = useState<Record<string, boolean>>({});

  // Load saved competitors when hotel changes
  useEffect(() => {
    if (!selectedHotel) { setCompetitors([]); return; }
    supabase
      .from("competitors")
      .select("*")
      .eq("hotel_id", selectedHotel)
      .order("created_at", { ascending: true })
      .then(({ data }) => setCompetitors((data ?? []) as CompetitorRow[]));
    // Reset previous results when hotel changes
    setMarketResults([]);
    setCompResults({});
  }, [selectedHotel]);

  // ── Market scan ─────────────────────────────────────────────────────────────

  const runMarketScan = useCallback(async () => {
    if (!city || marketLoading) return;
    setMarketLoading(true);
    setMarketResults([]);
    const { checkin, checkout } = getTomorrowDates();
    setMarketCheckin(checkin);
    try {
      const params = new URLSearchParams({ location: city, checkin, checkout, ownHotel: hotel?.name ?? "" });
      const res  = await fetch(`/api/competitors?${params}`);
      const data = res.ok ? (await res.json() as CompetitorResult[]) : [];
      setMarketResults(data);
    } finally {
      setMarketLoading(false);
    }
  }, [city, marketLoading, hotel]);

  // ── Per-competitor lookup ────────────────────────────────────────────────────

  const checkCompetitor = useCallback(async (comp: CompetitorRow) => {
    if (compLoading[comp.id]) return;
    setCompLoading(prev => ({ ...prev, [comp.id]: true }));
    setCompResults(prev => ({ ...prev, [comp.id]: [] }));
    const { checkin, checkout } = getTomorrowDates();
    try {
      const params = new URLSearchParams({ location: comp.competitor_city, checkin, checkout, q: comp.competitor_name });
      const res  = await fetch(`/api/competitors?${params}`);
      const data = res.ok ? (await res.json() as CompetitorResult[]) : [];
      setCompResults(prev => ({ ...prev, [comp.id]: data }));
    } finally {
      setCompLoading(prev => ({ ...prev, [comp.id]: false }));
    }
  }, [compLoading]);

  // ── Competitor CRUD ─────────────────────────────────────────────────────────

  async function addCompetitor() {
    const name = newName.trim();
    if (!name || !selectedHotel || !city || saving) return;
    setSaving(true);
    const { data, error } = await supabase
      .from("competitors")
      .insert({ hotel_id: selectedHotel, competitor_name: name, competitor_city: city })
      .select("*")
      .single();
    if (!error && data) {
      setCompetitors(prev => [...prev, data as CompetitorRow]);
      setNewName("");
    }
    setSaving(false);
  }

  async function deleteCompetitor(id: string) {
    await supabase.from("competitors").delete().eq("id", id);
    setCompetitors(prev => prev.filter(c => c.id !== id));
    setCompResults(prev => { const n = { ...prev }; delete n[id]; return n; });
  }

  if (!city) return null;

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
            <Building2 size={18} color="#C9A84C" />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>Cene Konkurencije</div>
            <div style={{ fontSize: 11, color: "#9ca3af" }}>{city} · Google Hotels</div>
          </div>
        </div>
      </div>

      <div className="px-5 py-4 flex flex-col gap-5">

        {/* ── PART 1: Market scan ───────────────────────────────────────────── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div style={{ fontSize: 12, fontWeight: 600, color: "#374151", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Tržišni pregled
            </div>
            <button
              onClick={runMarketScan}
              disabled={marketLoading}
              className="flex items-center gap-2"
              style={{
                height: 32, paddingLeft: 14, paddingRight: 14, borderRadius: 7,
                border: "1px solid rgba(201,168,76,0.35)",
                background: marketLoading ? "#f9fafb" : "rgba(201,168,76,0.06)",
                color: "#C9A84C", fontSize: 12, fontWeight: 600,
                cursor: marketLoading ? "default" : "pointer",
              }}
            >
              <RefreshCw size={12} className={marketLoading ? "animate-spin" : ""} />
              {marketLoading ? "Pretražujem…" : "Proveri cene"}
            </button>
          </div>

          {marketResults.length > 0 && (
            <>
              <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 8 }}>
                Cene za {formatCheckin(marketCheckin)} — {city}
              </div>
              <div className="flex flex-col gap-2">
                {marketResults.map(r => <ResultCard key={r.name} r={r} />)}
              </div>
            </>
          )}

          {!marketLoading && marketResults.length === 0 && marketCheckin && (
            <div style={{ fontSize: 12, color: "#9ca3af", padding: "8px 0" }}>
              Nema dostupnih podataka za ovu lokaciju.
            </div>
          )}
        </div>

        {/* ── PART 2: Saved competitors ─────────────────────────────────────── */}
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#374151", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>
            Sačuvani Konkurenti
          </div>

          {/* Add form */}
          <div className="flex gap-2 mb-4">
            <input
              type="text"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") addCompetitor(); }}
              placeholder="Ime hotela konkurenta…"
              style={{
                flex: 1, height: 36, borderRadius: 7,
                border: "1px solid #e5e7eb", paddingLeft: 10, paddingRight: 10,
                fontSize: 13, color: "#111827", background: "#fafafa",
                outline: "none",
              }}
              onFocus={e => { e.currentTarget.style.borderColor = "#C9A84C"; }}
              onBlur={e => { e.currentTarget.style.borderColor = "#e5e7eb"; }}
            />
            <button
              onClick={addCompetitor}
              disabled={saving || !newName.trim()}
              className="flex items-center gap-1.5"
              style={{
                height: 36, paddingLeft: 14, paddingRight: 14, borderRadius: 7,
                border: "none",
                background: !newName.trim() ? "#f3f4f6" : "linear-gradient(135deg, #C9A84C 0%, #E8C96B 100%)",
                color: !newName.trim() ? "#9ca3af" : "#ffffff",
                fontSize: 12, fontWeight: 600,
                cursor: saving || !newName.trim() ? "default" : "pointer",
                boxShadow: newName.trim() ? "0 2px 6px rgba(201,168,76,0.25)" : "none",
              }}
            >
              <Plus size={13} />
              Sačuvaj
            </button>
          </div>

          {/* Saved list */}
          {competitors.length === 0 && (
            <div style={{ fontSize: 12, color: "#9ca3af" }}>
              Nema sačuvanih konkurenata. Dodajte naziv hotela iznad.
            </div>
          )}

          {competitors.map(comp => (
            <div key={comp.id} className="mb-3">
              {/* Row: name + buttons */}
              <div
                className="flex items-center gap-2"
                style={{
                  padding: "8px 10px",
                  background: "#f9fafb",
                  border: "1px solid #e5e7eb",
                  borderRadius: 8,
                  marginBottom: compResults[comp.id]?.length ? 6 : 0,
                }}
              >
                <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: "#111827" }}>
                  {comp.competitor_name}
                </span>
                <button
                  onClick={() => checkCompetitor(comp)}
                  disabled={compLoading[comp.id]}
                  className="flex items-center gap-1"
                  style={{
                    height: 28, paddingLeft: 10, paddingRight: 10, borderRadius: 6,
                    border: "1px solid rgba(201,168,76,0.3)",
                    background: "rgba(201,168,76,0.06)",
                    color: "#C9A84C", fontSize: 11, fontWeight: 600,
                    cursor: compLoading[comp.id] ? "default" : "pointer",
                  }}
                >
                  <RefreshCw size={10} className={compLoading[comp.id] ? "animate-spin" : ""} />
                  {compLoading[comp.id] ? "…" : "Cena"}
                </button>
                <button
                  onClick={() => deleteCompetitor(comp.id)}
                  style={{
                    width: 28, height: 28, borderRadius: 6,
                    border: "1px solid #fee2e2",
                    background: "#fff5f5",
                    color: "#dc2626",
                    cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                  }}
                >
                  <Trash2 size={11} />
                </button>
              </div>

              {/* Results for this competitor */}
              {compResults[comp.id]?.length > 0 && (
                <div className="flex flex-col gap-2 pl-2">
                  {compResults[comp.id].map(r => <ResultCard key={r.name} r={r} />)}
                </div>
              )}
              {!compLoading[comp.id] && compResults[comp.id]?.length === 0 && comp.id in compResults && (
                <div style={{ fontSize: 12, color: "#9ca3af", paddingLeft: 8, paddingTop: 4 }}>
                  Nije pronađen na Google Hotels za ovu lokaciju.
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Disclaimer */}
        <div
          className="rounded-lg"
          style={{ padding: "7px 11px", background: "#f9fafb", border: "1px solid #f3f4f6" }}
        >
          <span style={{ fontSize: 11, color: "#9ca3af" }}>
            ⚠️ Podaci su indikativni — proverite direktno na platformi pre donošenja odluka
          </span>
        </div>
      </div>
    </div>
  );
}
