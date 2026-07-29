"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  TrendingUp, TrendingDown, Minus, Building2, RefreshCw, Check,
  AlertCircle, CalendarDays,
} from "lucide-react";
import { useHotel, MONTHS_SR, ROOM_TYPE_DEFS, type RoomTypeKey } from "../context/HotelContext";
import {
  fetchLatestReportSnapshot, fetchMonthlyTargetFor,
  todayISO, shiftDays, dateParts, toISO, yearMonthOf, formatDateSr,
  type ReportSnapshot,
} from "../lib/dashboardData";
import type { MonthlyTargetRow } from "../lib/supabaseClient";
import { getEurRsdRate } from "../lib/fxRate";
import {
  computeRecommendation, suggestedPrice, verdictLabel,
  type RecommendationInputs, type Verdict,
} from "../lib/priceRecommendation";
import type { CompetitorResult } from "../api/competitors/route";
import type { EventResult } from "../api/events/route";

// ── Local helpers ────────────────────────────────────────────────────────────

const HOTEL_PRICE_FIELD: Record<RoomTypeKey, "priceCls" | "priceDplx" | "priceSuperior" | "priceKing"> = {
  cls: "priceCls",
  dplx: "priceDplx",
  superior: "priceSuperior",
  king: "priceKing",
};

function isWeekendDate(dateISO: string): boolean {
  const day = new Date(`${dateISO}T00:00:00`).getDay();
  return day === 0 || day === 6;
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

const VERDICT_STYLES: Record<Verdict, { bg: string; border: string; color: string; icon: typeof TrendingUp }> = {
  RAISE: { bg: "rgba(217,119,6,0.08)", border: "rgba(217,119,6,0.3)", color: "#b45309", icon: TrendingUp },
  HOLD: { bg: "#f3f4f6", border: "#e5e7eb", color: "#6b7280", icon: Minus },
  LOWER: { bg: "rgba(59,130,246,0.08)", border: "rgba(59,130,246,0.3)", color: "#2563eb", icon: TrendingDown },
};

function fmtEur(n: number): string {
  return `${Math.round(n).toLocaleString("sr-RS")}€`;
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function PreporukaPage() {
  const { hotels, selectedHotel, selectedHotelName, updateRoomPrices } = useHotel();
  const hotel = hotels.find(h => h.id === selectedHotel) ?? null;
  const city = hotel?.city ?? "";

  // ── Section 1: editable baseline prices ────────────────────────────────────
  function priceInputsFromHotel(): Record<RoomTypeKey, string> {
    return {
      cls: hotel?.priceCls != null ? String(hotel.priceCls) : "",
      dplx: hotel?.priceDplx != null ? String(hotel.priceDplx) : "",
      superior: hotel?.priceSuperior != null ? String(hotel.priceSuperior) : "",
      king: hotel?.priceKing != null ? String(hotel.priceKing) : "",
    };
  }

  // Lazy initializer covers the common case where HotelContext's hotel list is already loaded
  // (e.g. navigating here from the Dashboard) so prices are known on the very first render —
  // the effect below only needs to handle the hotel/prices arriving or changing *after* mount.
  const [priceInputs, setPriceInputs] = useState<Record<RoomTypeKey, string>>(priceInputsFromHotel);
  const [savingPrices, setSavingPrices] = useState(false);

  useEffect(() => {
    setPriceInputs(priceInputsFromHotel());
  }, [hotel?.id, hotel?.priceCls, hotel?.priceDplx, hotel?.priceSuperior, hotel?.priceKing]);

  const saveAllPrices = useCallback(async () => {
    if (!selectedHotel || savingPrices) return;
    const parsed: Partial<Record<RoomTypeKey, number>> = {};
    for (const def of ROOM_TYPE_DEFS) {
      const raw = priceInputs[def.key];
      const n = Number(raw);
      if (raw.trim() && !Number.isNaN(n) && n >= 0) parsed[def.key] = n;
    }
    if (Object.keys(parsed).length === 0) return;
    setSavingPrices(true);
    try {
      await updateRoomPrices(selectedHotel, parsed);
    } finally {
      setSavingPrices(false);
    }
  }, [selectedHotel, savingPrices, priceInputs, updateRoomPrices]);

  // ── Section 2: which day the recommendation is for ─────────────────────────
  const [selectedDate, setSelectedDate] = useState(() => shiftDays(todayISO(), 1)); // default: tomorrow

  // ── On-books pace + target (same source as Dashboard/poredjenje) ───────────
  const [snapshot, setSnapshot] = useState<ReportSnapshot | null>(null);
  const [monthlyTarget, setMonthlyTarget] = useState<MonthlyTargetRow | null>(null);
  const [loadingPace, setLoadingPace] = useState(false);

  useEffect(() => {
    if (!selectedHotel || !selectedDate) { setSnapshot(null); setMonthlyTarget(null); return; }
    let cancelled = false;
    setLoadingPace(true);
    (async () => {
      const { year, month } = dateParts(selectedDate);
      const monthStart = toISO(year, month, 1);
      const [snap, target] = await Promise.all([
        fetchLatestReportSnapshot(selectedHotel, monthStart, selectedDate),
        fetchMonthlyTargetFor(selectedHotel, yearMonthOf(selectedDate)),
      ]);
      if (cancelled) return;
      setSnapshot(snap);
      setMonthlyTarget(target);
      setLoadingPace(false);
    })();
    return () => { cancelled = true; };
  }, [selectedHotel, selectedDate]);

  // ── Competitor prices (manual trigger — same SerpAPI feed as the Dashboard's
  // competitor section, which is credit-metered, so this never auto-fires) ───
  const [competitorAvgEur, setCompetitorAvgEur] = useState<number | null>(null);
  const [competitorCount, setCompetitorCount] = useState(0);
  const [competitorChecked, setCompetitorChecked] = useState(false);
  const [competitorLoading, setCompetitorLoading] = useState(false);

  useEffect(() => {
    setCompetitorAvgEur(null);
    setCompetitorCount(0);
    setCompetitorChecked(false);
  }, [selectedHotel, selectedDate]);

  const checkCompetitors = useCallback(async () => {
    if (!city || competitorLoading) return;
    setCompetitorLoading(true);
    try {
      const checkin = selectedDate;
      const checkout = shiftDays(selectedDate, 1);
      const params = new URLSearchParams({ location: city, checkin, checkout, ownHotel: hotel?.name ?? "" });
      const [res, rate] = await Promise.all([
        fetch(`/api/competitors?${params}`),
        getEurRsdRate(),
      ]);
      const data: CompetitorResult[] = res.ok ? await res.json() : [];
      const withPrice = data.filter((r): r is CompetitorResult & { priceExtracted: number } => r.priceExtracted != null);
      if (withPrice.length > 0) {
        const avgRsd = withPrice.reduce((sum, r) => sum + r.priceExtracted, 0) / withPrice.length;
        setCompetitorAvgEur(avgRsd / rate);
        setCompetitorCount(withPrice.length);
      } else {
        setCompetitorAvgEur(null);
        setCompetitorCount(0);
      }
      setCompetitorChecked(true);
    } finally {
      setCompetitorLoading(false);
    }
  }, [city, selectedDate, hotel?.name, competitorLoading]);

  // ── Events (auto — same SerpAPI-backed source as EventsWidget/poredjenje,
  // cached 1hr server-side, and scoped to a whole month like those callers) ──
  const [events, setEvents] = useState<EventResult[]>([]);

  useEffect(() => {
    if (!city || !selectedDate) { setEvents([]); return; }
    let cancelled = false;
    (async () => {
      try {
        const { year, month } = dateParts(selectedDate);
        const params = new URLSearchParams({ location: city, month: MONTHS_SR[month - 1].toLowerCase(), year: String(year) });
        const res = await fetch(`/api/events?${params}`);
        if (cancelled) return;
        setEvents(res.ok ? await res.json() : []);
      } catch {
        if (!cancelled) setEvents([]);
      }
    })();
    return () => { cancelled = true; };
  }, [city, selectedDate]);

  // ── Recommendation ──────────────────────────────────────────────────────────

  const onBooksOccPct = snapshot ? snapshot.popunjenost : null;
  const onBooksNights = snapshot ? snapshot.brojNocenja : null;
  // Same-day-last-year of 0 means "not entered" — same convention used everywhere else in the app
  // (e.g. the On-Books YoY cards), since a real hotel practically never has a literal 0 on file.
  const sameDayLastYearNights = snapshot && snapshot.brojNocenjaLY !== 0 ? snapshot.brojNocenjaLY : null;
  const targetOccPct = monthlyTarget && monthlyTarget.occupancy_target !== 0 ? monthlyTarget.occupancy_target : null;
  const ourRefPriceEur = hotel?.priceCls ?? null;
  const isWeekend = isWeekendDate(selectedDate);
  const hasNearbyEvent = events.length > 0;
  const nearbyEventLabel = events[0] ? truncate(events[0].title, 40) : null;

  const inputs: RecommendationInputs = useMemo(() => ({
    onBooksOccPct, targetOccPct, onBooksNights, sameDayLastYearNights,
    competitorAvgEur, ourRefPriceEur, isWeekend, hasNearbyEvent, nearbyEventLabel,
  }), [onBooksOccPct, targetOccPct, onBooksNights, sameDayLastYearNights, competitorAvgEur, ourRefPriceEur, isWeekend, hasNearbyEvent, nearbyEventLabel]);

  const recommendation = useMemo(() => computeRecommendation(inputs), [inputs]);

  const suggestions = ROOM_TYPE_DEFS.map(def => {
    const current = hotel?.[HOTEL_PRICE_FIELD[def.key]] ?? null;
    return { ...def, current, suggested: suggestedPrice(current, recommendation.nudgePercent) };
  });

  const [acceptingKey, setAcceptingKey] = useState<RoomTypeKey | null>(null);
  const acceptSuggestion = useCallback(async (key: RoomTypeKey, value: number) => {
    if (!selectedHotel || acceptingKey) return;
    setAcceptingKey(key);
    try {
      await updateRoomPrices(selectedHotel, { [key]: value });
    } finally {
      setAcceptingKey(null);
    }
  }, [selectedHotel, acceptingKey, updateRoomPrices]);

  const style = VERDICT_STYLES[recommendation.verdict];
  const VerdictIcon = style.icon;

  if (!selectedHotel) {
    return (
      <div
        className="flex flex-col items-center justify-center rounded-xl"
        style={{ minHeight: 300, background: "#ffffff", border: "1px solid #e5e7eb", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}
      >
        <TrendingUp size={32} color="#e5e7eb" strokeWidth={1.5} style={{ marginBottom: 12 }} />
        <div style={{ fontSize: 14, fontWeight: 600, color: "#9ca3af", marginBottom: 4 }}>Izaberite hotel</div>
        <div style={{ fontSize: 12, color: "#d1d5db" }}>Izaberite hotel iz bočne trake da vidite preporuku cena</div>
      </div>
    );
  }

  return (
    <>
      {/* Header */}
      <div className="mb-5">
        <div className="flex items-center gap-2 mb-1">
          <TrendingUp size={18} color="#C9A84C" strokeWidth={2.5} />
          <h1 style={{ fontSize: 20, fontWeight: 800, color: "#111827", letterSpacing: "-0.02em", margin: 0 }}>
            Preporuka Cena
          </h1>
        </div>
        <div style={{ fontSize: 12, color: "#9ca3af" }}>{selectedHotelName}</div>
      </div>

      {/* ── Section 1: baseline prices ─────────────────────────────────────── */}
      <div
        className="rounded-xl mb-5"
        style={{ background: "#ffffff", border: "1px solid #e5e7eb", boxShadow: "0 1px 4px rgba(0,0,0,0.04)", padding: "16px 18px" }}
      >
        <div style={{ fontSize: 12, fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>
          Trenutne Cene po Noći (EUR)
        </div>
        <div className="flex flex-wrap items-end gap-3">
          {ROOM_TYPE_DEFS.map(def => (
            <div key={def.key}>
              <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 4 }}>{def.label}</div>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min={0}
                  value={priceInputs[def.key]}
                  onChange={e => setPriceInputs(prev => ({ ...prev, [def.key]: e.target.value }))}
                  placeholder="—"
                  style={{
                    width: 90, height: 36, borderRadius: 7,
                    border: "1px solid #e5e7eb", paddingLeft: 10, paddingRight: 6,
                    fontSize: 13, color: "#111827", background: "#fafafa", outline: "none",
                  }}
                />
                <span style={{ fontSize: 12, color: "#9ca3af" }}>€</span>
              </div>
            </div>
          ))}
          <button
            onClick={saveAllPrices}
            disabled={savingPrices}
            className="flex items-center gap-1.5"
            style={{
              height: 36, paddingLeft: 14, paddingRight: 14, borderRadius: 7, border: "none",
              background: "linear-gradient(135deg, #C9A84C 0%, #E8C96B 100%)",
              color: "#ffffff", fontSize: 12, fontWeight: 600,
              cursor: savingPrices ? "default" : "pointer",
              opacity: savingPrices ? 0.7 : 1,
            }}
          >
            <Check size={13} />
            {savingPrices ? "Čuvanje..." : "Sačuvaj"}
          </button>
        </div>
      </div>

      {/* ── Section 2: day selector + competitor check ─────────────────────── */}
      <div
        className="rounded-xl mb-5 flex flex-wrap items-center justify-between gap-3"
        style={{ background: "#ffffff", border: "1px solid #e5e7eb", boxShadow: "0 1px 4px rgba(0,0,0,0.04)", padding: "14px 18px" }}
      >
        <div className="flex items-center gap-3">
          <CalendarDays size={16} color="#C9A84C" />
          <div>
            <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 3 }}>Preporuka za datum</div>
            <input
              type="date"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              style={{
                height: 34, borderRadius: 7, border: "1px solid #e5e7eb",
                paddingLeft: 10, paddingRight: 10, fontSize: 13, color: "#111827", background: "#fafafa", outline: "none",
              }}
            />
          </div>
        </div>
        <button
          onClick={checkCompetitors}
          disabled={competitorLoading || !city}
          className="flex items-center gap-2"
          style={{
            height: 34, paddingLeft: 14, paddingRight: 14, borderRadius: 7,
            border: "1px solid rgba(201,168,76,0.35)",
            background: competitorLoading ? "#f9fafb" : "rgba(201,168,76,0.06)",
            color: "#C9A84C", fontSize: 12, fontWeight: 600,
            cursor: competitorLoading ? "default" : "pointer",
          }}
        >
          <Building2 size={13} />
          <RefreshCw size={12} className={competitorLoading ? "animate-spin" : ""} />
          {competitorLoading ? "Proveravam..." : "Proveri konkurenciju"}
        </button>
      </div>

      {/* ── Verdict card ─────────────────────────────────────────────────────── */}
      <div
        className="rounded-xl mb-5"
        style={{ background: style.bg, border: `1.5px solid ${style.border}`, padding: "20px 22px" }}
      >
        <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
          <div className="flex items-center gap-3">
            <div
              className="rounded-xl flex items-center justify-center"
              style={{ width: 44, height: 44, background: "#ffffff", border: `1px solid ${style.border}`, flexShrink: 0 }}
            >
              <VerdictIcon size={22} color={style.color} />
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: style.color }}>
                {verdictLabel(recommendation.verdict)}
              </div>
              <div style={{ fontSize: 12, color: "#6b7280" }}>
                {formatDateSr(selectedDate)}{loadingPace ? " · učitavanje..." : ""}
              </div>
            </div>
          </div>
          <div
            className="rounded-lg"
            style={{ padding: "8px 16px", background: "#ffffff", border: `1px solid ${style.border}` }}
          >
            <div style={{ fontSize: 10, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em" }}>Preporuka</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: style.color }}>
              {recommendation.nudgePercent > 0 ? "+" : ""}{recommendation.nudgePercent}%
            </div>
          </div>
        </div>

        {/* Reason chips */}
        <div className="flex flex-wrap gap-2 mb-2">
          {recommendation.reasons.map((chip, i) => (
            <span
              key={i}
              className="rounded-full"
              style={{
                fontSize: 11, fontWeight: 600, padding: "5px 12px",
                background: chip.tone === "positive" ? "rgba(22,163,74,0.08)" : chip.tone === "negative" ? "rgba(220,38,38,0.08)" : "#f3f4f6",
                border: `1px solid ${chip.tone === "positive" ? "rgba(22,163,74,0.25)" : chip.tone === "negative" ? "rgba(220,38,38,0.25)" : "#e5e7eb"}`,
                color: chip.tone === "positive" ? "#16a34a" : chip.tone === "negative" ? "#dc2626" : "#6b7280",
              }}
            >
              {chip.text}
            </span>
          ))}
        </div>

        {/* Transparency note about missing signals */}
        {recommendation.missingSignals.length > 0 && (
          <div className="flex items-start gap-1.5 mt-2" style={{ fontSize: 11, color: "#9ca3af" }}>
            <AlertCircle size={12} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>
              Nedostaje: {recommendation.missingSignals.join(", ")}
              {recommendation.usedSignals.length > 0 && <> · Korišćeno: {recommendation.usedSignals.join(", ")}</>}
            </span>
          </div>
        )}
        {!competitorChecked ? (
          <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 4 }}>
            Klikni &quot;Proveri konkurenciju&quot; da uključiš cene konkurencije u preporuku.
          </div>
        ) : competitorAvgEur != null ? (
          <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 4 }}>
            Prosek konkurencije: {fmtEur(competitorAvgEur)} (na osnovu {competitorCount} {competitorCount === 1 ? "hotela" : "hotela"})
          </div>
        ) : (
          <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 4 }}>
            Nema dostupnih cena konkurencije za ovaj datum.
          </div>
        )}
      </div>

      {/* ── Table ────────────────────────────────────────────────────────────── */}
      <div
        className="rounded-xl mb-4"
        style={{ background: "#ffffff", border: "1px solid #e5e7eb", boxShadow: "0 1px 4px rgba(0,0,0,0.04)", overflow: "hidden" }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#f9fafb" }}>
              {["Tip sobe", "Trenutna", "Preporuka", ""].map((h, i) => (
                <th
                  key={h}
                  style={{
                    padding: "10px 20px", textAlign: i === 0 ? "left" : "right",
                    fontSize: 10, fontWeight: 700, color: "#9ca3af", letterSpacing: "0.06em",
                    textTransform: "uppercase", borderBottom: "1px solid #e5e7eb",
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {suggestions.map(row => {
              const diff = row.current != null && row.suggested != null ? row.suggested - row.current : null;
              return (
                <tr key={row.key} style={{ borderBottom: "1px solid #f3f4f6" }}>
                  <td style={{ padding: "12px 20px", fontSize: 13, fontWeight: 600, color: "#374151" }}>{row.label}</td>
                  <td style={{ padding: "12px 20px", textAlign: "right", fontSize: 13, color: "#111827", fontVariantNumeric: "tabular-nums" }}>
                    {row.current != null ? fmtEur(row.current) : "—"}
                  </td>
                  <td style={{ padding: "12px 20px", textAlign: "right" }}>
                    {row.suggested == null ? (
                      <span style={{ fontSize: 13, color: "#d1d5db" }}>nema podatka</span>
                    ) : (
                      <div className="flex items-center justify-end gap-1.5">
                        {diff !== null && diff > 0 && <TrendingUp size={13} color="#16a34a" />}
                        {diff !== null && diff < 0 && <TrendingDown size={13} color="#dc2626" />}
                        {diff !== null && diff === 0 && <Minus size={13} color="#9ca3af" />}
                        <span
                          style={{
                            fontSize: 14, fontWeight: 700, fontVariantNumeric: "tabular-nums",
                            color: diff === null ? "#111827" : diff > 0 ? "#16a34a" : diff < 0 ? "#dc2626" : "#111827",
                          }}
                        >
                          {fmtEur(row.suggested)}
                        </span>
                      </div>
                    )}
                  </td>
                  <td style={{ padding: "12px 20px", textAlign: "right" }}>
                    {row.suggested != null && row.current != null && row.suggested !== row.current && (
                      <button
                        onClick={() => acceptSuggestion(row.key, row.suggested as number)}
                        disabled={acceptingKey === row.key}
                        style={{
                          height: 28, paddingLeft: 10, paddingRight: 10, borderRadius: 6,
                          border: "1px solid rgba(201,168,76,0.3)", background: "rgba(201,168,76,0.06)",
                          color: "#C9A84C", fontSize: 11, fontWeight: 600,
                          cursor: acceptingKey === row.key ? "default" : "pointer",
                        }}
                      >
                        {acceptingKey === row.key ? "..." : "Prihvati"}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Footer disclaimer */}
      <div
        className="rounded-lg mb-2"
        style={{ padding: "10px 14px", background: "#f9fafb", border: "1px solid #f3f4f6" }}
      >
        <span style={{ fontSize: 11, color: "#9ca3af" }}>
          💡 Predlog — ti odlučuješ. Cene se ne menjaju automatski.
        </span>
      </div>
    </>
  );
}
