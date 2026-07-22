"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Scale, TrendingUp, TrendingDown, Minus, Loader2,
  FileText, Calendar, CloudSun,
} from "lucide-react";
import { useHotel, MONTHS_SR, type RowKey } from "../context/HotelContext";
import { supabase } from "../lib/supabaseClient";
import { useWeatherForecast } from "../hooks/useWeatherForecast";
import { useHistoricalWeather } from "../hooks/useHistoricalWeather";
import { fetchLatestReportSnapshot, formatDateSr, shiftYears } from "../lib/dashboardData";

// ── Constants ──────────────────────────────────────────────────────────────────

const NOW       = new Date();
const CUR_YEAR  = NOW.getFullYear();
const CUR_MONTH = NOW.getMonth() + 1;

const YEARS = Array.from({ length: 6 }, (_, i) => CUR_YEAR - 3 + i); // CY-3 … CY+2

const ROW_META: { key: RowKey; label: string; isPercent: boolean; prefix?: string; suffix?: string }[] = [
  { key: "brojNocenja",  label: "Broj Noćenja",   isPercent: false },
  { key: "ukupanPrihod", label: "Ukupan Prihod",  isPercent: false, suffix: " RSD" },
  { key: "adr",          label: "ADR",             isPercent: false, suffix: " RSD" },
  { key: "popunjenost",  label: "Popunjenost",     isPercent: true,  suffix: "%" },
  { key: "revpar",       label: "RevPAR",          isPercent: false, suffix: " RSD" },
];

// ── Types ─────────────────────────────────────────────────────────────────────

interface PeriodKpis { brojNocenja: number; ukupanPrihod: number; adr: number; popunjenost: number; revpar: number }
interface EventItem  { title: string; url: string; domain: string }

interface PeriodData {
  kpis:           PeriodKpis | null;
  reportDate:     string | null;
  notes:          string | null;
  events:         EventItem[];
  // True when kpis came from the primary period's own "same day last year" on-books figure
  // (a pace snapshot as of one specific date) rather than this period's own real daily_reports
  // rows — the UI must label this distinctly, since it is NOT last year's final month total.
  isPaceFallback: boolean;
}

// ── Formatting ─────────────────────────────────────────────────────────────────

function fmtVal(val: number, key: RowKey): string {
  if (key === "popunjenost")
    return `${(Math.round(val * 10) / 10).toLocaleString("sr-RS")}%`;
  if (key === "ukupanPrihod" || key === "adr" || key === "revpar")
    return `${Math.round(val).toLocaleString("sr-RS")} RSD`;
  return Math.round(val).toLocaleString("sr-RS");
}

function fmtPct(pct: number): string {
  const s = (Math.round(pct * 10) / 10).toLocaleString("sr-RS");
  return pct > 0 ? `+${s}%` : `${s}%`;
}

function periodLabel(month: number, year: number): string {
  return `${MONTHS_SR[month - 1]} ${year}`;
}

function isCurrentMonth(year: number, month: number): boolean {
  return year === CUR_YEAR && month === CUR_MONTH;
}

// Strictly before the current calendar month — the only range the Archive API has data for.
function isPastMonth(year: number, month: number): boolean {
  return year < CUR_YEAR || (year === CUR_YEAR && month < CUR_MONTH);
}

function monthDateRange(year: number, month: number): { start: string; end: string } {
  const pad = (n: number) => String(n).padStart(2, "0");
  const ym  = `${year}-${pad(month)}`;
  return { start: `${ym}-01`, end: `${ym}-${pad(new Date(year, month, 0).getDate())}` };
}

// ── Fetch period data ──────────────────────────────────────────────────────────

async function fetchPeriodData(
  hotelId:  string,
  hotelCity: string,
  year:     number,
  month:    number,
): Promise<PeriodData> {
  const { start, end } = monthDateRange(year, month);
  const ym = `${year}-${String(month).padStart(2, "0")}`;

  const [snapshot, targetRes] = await Promise.all([
    fetchLatestReportSnapshot(hotelId, start, end),
    supabase
      .from("monthly_targets")
      .select("notes")
      .eq("hotel_id", hotelId)
      .eq("year_month", ym)
      .maybeSingle(),
  ]);

  const notes = targetRes.data?.notes ?? null;

  // Events (fire-and-forget, ignore errors)
  let events: EventItem[] = [];
  try {
    const params = new URLSearchParams({ location: hotelCity, month: String(month), year: String(year) });
    const res = await fetch(`/api/events?${params}`);
    if (res.ok) events = await res.json();
  } catch { /* no events */ }

  return {
    kpis: snapshot
      ? { brojNocenja: snapshot.brojNocenja, ukupanPrihod: snapshot.ukupanPrihod, adr: snapshot.adr, popunjenost: snapshot.popunjenost, revpar: snapshot.revpar }
      : null,
    reportDate: snapshot?.reportDate ?? null,
    notes,
    events,
    isPaceFallback: false,
  };
}

// ── Period Selector ────────────────────────────────────────────────────────────

interface SelectorProps {
  label:    string;
  color:    string;
  hotels:   { id: string; name: string }[];
  hotelId:  string;
  month:    number;
  year:     number;
  onHotel:  (id: string) => void;
  onMonth:  (m: number) => void;
  onYear:   (y: number) => void;
}

function PeriodSelector({ label, color, hotels, hotelId, month, year, onHotel, onMonth, onYear }: SelectorProps) {
  const selectStyle = {
    width: "100%", height: 36, borderRadius: 7,
    border: "1px solid #e5e7eb", paddingLeft: 10, paddingRight: 10,
    fontSize: 13, color: "#111827", background: "#fafafa",
    outline: "none", cursor: "pointer",
    appearance: "none" as const,
  };

  return (
    <div
      className="flex-1 rounded-xl"
      style={{ background: "#ffffff", border: `2px solid ${color}30`, boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}
    >
      <div
        className="px-4 py-3 rounded-t-xl"
        style={{ background: `${color}0a`, borderBottom: `1px solid ${color}20` }}
      >
        <div style={{ fontSize: 12, fontWeight: 700, color, textTransform: "uppercase", letterSpacing: "0.06em" }}>
          {label}
        </div>
      </div>
      <div className="flex flex-col gap-2 p-4">
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#9ca3af", marginBottom: 5 }}>Hotel</div>
          <select value={hotelId} onChange={e => onHotel(e.target.value)} style={selectStyle}>
            <option value="">— Izaberi hotel —</option>
            {hotels.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
          </select>
        </div>
        <div className="flex gap-2">
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "#9ca3af", marginBottom: 5 }}>Mesec</div>
            <select value={month} onChange={e => onMonth(Number(e.target.value))} style={selectStyle}>
              {MONTHS_SR.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "#9ca3af", marginBottom: 5 }}>Godina</div>
            <select value={year} onChange={e => onYear(Number(e.target.value))} style={selectStyle}>
              {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Context card ───────────────────────────────────────────────────────────────

interface ContextCardProps {
  color:            string;
  label:            string;
  data:             PeriodData | null;
  year:             number;
  month:            number;
  weatherDays:      ReturnType<typeof useWeatherForecast>["days"];
  weatherStatus:    ReturnType<typeof useWeatherForecast>["status"];
  historicalSummary: ReturnType<typeof useHistoricalWeather>["summary"];
  historicalStatus:  ReturnType<typeof useHistoricalWeather>["status"];
}

function ContextCard({ color, label, data, year, month, weatherDays, weatherStatus, historicalSummary, historicalStatus }: ContextCardProps) {
  const showForecast = isCurrentMonth(year, month);
  const showHistorical = isPastMonth(year, month);
  const badWeather  = weatherDays.filter(d => d.precipitation > 5 || d.weatherCode >= 80);

  return (
    <div
      className="flex-1 rounded-xl"
      style={{ background: "#ffffff", border: `1.5px solid ${color}25`, overflow: "hidden" }}
    >
      <div
        className="px-4 py-3"
        style={{ background: `${color}08`, borderBottom: `1px solid ${color}15` }}
      >
        <div style={{ fontSize: 12, fontWeight: 700, color, textTransform: "uppercase", letterSpacing: "0.06em" }}>
          {label}
        </div>
      </div>
      <div className="flex flex-col gap-4 p-4">
        {/* Notes */}
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <FileText size={13} color="#9ca3af" />
            <span style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Manager Notes
            </span>
          </div>
          {data?.notes ? (
            <div
              className="rounded-lg"
              style={{ padding: "8px 12px", background: "#f9fafb", border: "1px solid #e5e7eb", fontSize: 12, color: "#374151", lineHeight: 1.6 }}
            >
              {data.notes}
            </div>
          ) : (
            <div style={{ fontSize: 12, color: "#d1d5db", fontStyle: "italic" }}>Nema beleški za ovaj period</div>
          )}
        </div>

        {/* Events */}
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <Calendar size={13} color="#9ca3af" />
            <span style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Lokalni Događaji
            </span>
          </div>
          {!data ? (
            <div style={{ fontSize: 12, color: "#d1d5db" }}>—</div>
          ) : data.events.length === 0 ? (
            <div style={{ fontSize: 12, color: "#d1d5db", fontStyle: "italic" }}>Nema pronađenih događaja</div>
          ) : (
            <div className="flex flex-col gap-1.5">
              {data.events.slice(0, 3).map((ev, i) => (
                <a
                  key={i}
                  href={ev.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ fontSize: 12, color: "#374151", textDecoration: "none", display: "block" }}
                >
                  <div
                    className="rounded-lg"
                    style={{ padding: "6px 10px", background: "#f9fafb", border: "1px solid #e5e7eb" }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = color + "55"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "#e5e7eb"; }}
                  >
                    <div style={{ fontSize: 12, fontWeight: 600, color: "#111827", lineHeight: 1.4 }}>{ev.title}</div>
                    <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 2 }}>{ev.domain}</div>
                  </div>
                </a>
              ))}
              {data.events.length > 3 && (
                <div style={{ fontSize: 11, color: "#9ca3af" }}>+{data.events.length - 3} još događaja</div>
              )}
            </div>
          )}
        </div>

        {/* Weather */}
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <CloudSun size={13} color="#9ca3af" />
            <span style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Vremenske Prilike
            </span>
          </div>
          {showForecast ? (
            weatherStatus === "loading" ? (
              <div style={{ fontSize: 12, color: "#d1d5db" }}>Učitavanje…</div>
            ) : weatherStatus === "error" ? (
              <div style={{ fontSize: 12, color: "#d1d5db" }}>Nije moguće učitati prognozu</div>
            ) : badWeather.length > 0 ? (
              <div style={{ fontSize: 12, color: "#92400e", lineHeight: 1.6 }}>
                🌧️ {badWeather.length} {badWeather.length === 1 ? "dan" : "dana"} s lošim vremenom u narednih 7 dana
                {" "}({badWeather.map(d => d.dayLabel).join(", ")})
              </div>
            ) : (
              <div style={{ fontSize: 12, color: "#166534", lineHeight: 1.6 }}>
                ☀️ Dobro vreme predviđeno za narednih 7 dana
              </div>
            )
          ) : showHistorical ? (
            historicalStatus === "loading" ? (
              <div style={{ fontSize: 12, color: "#d1d5db" }}>Učitavanje istorijskih podataka…</div>
            ) : historicalStatus === "error" ? (
              <div style={{ fontSize: 12, color: "#d1d5db" }}>Nije moguće učitati istorijske podatke</div>
            ) : historicalSummary ? (
              <div style={{ fontSize: 12, color: historicalSummary.badWeatherDays > 0 ? "#92400e" : "#166534", lineHeight: 1.6 }}>
                {historicalSummary.dominantEmoji} Prosečno {historicalSummary.avgTempMax}° / {historicalSummary.avgTempMin}°
                {" "}· {historicalSummary.totalPrecipitation}mm padavina ukupno
                {historicalSummary.badWeatherDays > 0 && ` · ${historicalSummary.badWeatherDays} ${historicalSummary.badWeatherDays === 1 ? "dan" : "dana"} s lošim vremenom`}
              </div>
            ) : (
              <div style={{ fontSize: 12, color: "#d1d5db", fontStyle: "italic" }}>Nema istorijskih podataka</div>
            )
          ) : (
            <div style={{ fontSize: 12, color: "#d1d5db", fontStyle: "italic", lineHeight: 1.5 }}>
              Vremenski podaci nisu dostupni za buduće periode — koristite Manager Notes za kontekst
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function PoredjenjaPage() {
  const { hotels, selectedHotel } = useHotel();

  // ── Period A state ──────────────────────────────────────────────────────────
  const [hotelA,  setHotelA]  = useState("");
  const [monthA,  setMonthA]  = useState(CUR_MONTH);
  const [yearA,   setYearA]   = useState(CUR_YEAR);
  const [dataA,   setDataA]   = useState<PeriodData | null>(null);
  const [loadingA, setLoadingA] = useState(false);

  // ── Period B state ──────────────────────────────────────────────────────────
  const [hotelB,  setHotelB]  = useState("");
  const [monthB,  setMonthB]  = useState(CUR_MONTH);
  const [yearB,   setYearB]   = useState(CUR_YEAR - 1);
  const [dataB,   setDataB]   = useState<PeriodData | null>(null);
  const [loadingB, setLoadingB] = useState(false);

  // Seed hotel A/B from global context once hotels load
  useEffect(() => {
    if (selectedHotel && !hotelA) setHotelA(selectedHotel);
    if (selectedHotel && !hotelB) setHotelB(selectedHotel);
  }, [selectedHotel]); // eslint-disable-line

  // ── Weather hooks (always called unconditionally) ───────────────────────────
  const cityA = hotels.find(h => h.id === hotelA)?.city ?? "";
  const cityB = hotels.find(h => h.id === hotelB)?.city ?? "";
  const weatherA = useWeatherForecast(cityA);
  const weatherB = useWeatherForecast(cityB);

  // Historical weather only applies to months strictly before the current one — the Archive API
  // has no data for the current/future months, so pass empty range args to keep the hook idle.
  const rangeA = isPastMonth(yearA, monthA) ? monthDateRange(yearA, monthA) : null;
  const rangeB = isPastMonth(yearB, monthB) ? monthDateRange(yearB, monthB) : null;
  const historicalA = useHistoricalWeather(cityA, rangeA?.start ?? "", rangeA?.end ?? "");
  const historicalB = useHistoricalWeather(cityB, rangeB?.start ?? "", rangeB?.end ?? "");

  // ── Fetch Period A ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!hotelA) { setDataA(null); return; }
    let cancelled = false;
    setLoadingA(true);
    fetchPeriodData(hotelA, cityA, yearA, monthA)
      .then(d => { if (!cancelled) setDataA(d); })
      .catch(() => { if (!cancelled) setDataA(null); })
      .finally(() => { if (!cancelled) setLoadingA(false); });
    return () => { cancelled = true; };
  }, [hotelA, cityA, yearA, monthA]);

  // ── Fetch Period B ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!hotelB) { setDataB(null); return; }
    let cancelled = false;
    setLoadingB(true);

    // Same-hotel, exact-prior-year comparison (the page's default/typical use) falls back to the
    // primary period's own "same_day_last_year" figure when Period B has no real rows of its own —
    // that comparison-year row may genuinely not exist yet even though this year's data does. This
    // is a single pace snapshot (on-books as of one specific date last year), the same source and
    // semantics as the Dashboard's On-Books YoY card — never a sum across days (see Fix history:
    // that field is itself a running monthly total per row, so summing it double-counts).
    const isDirectYoY = hotelB === hotelA && yearB === yearA - 1 && monthB === monthA;

    (async () => {
      const d = await fetchPeriodData(hotelB, cityB, yearB, monthB);
      if (cancelled) return;

      if (d.kpis === null && isDirectYoY) {
        const { start, end } = monthDateRange(yearA, monthA);
        const snap = await fetchLatestReportSnapshot(hotelA, start, end);
        if (cancelled) return;
        if (snap) {
          setDataB({
            ...d,
            kpis: {
              brojNocenja: snap.brojNocenjaLY,
              ukupanPrihod: snap.ukupanPrihodLY,
              adr: snap.adrLY,
              popunjenost: snap.popunjenostLY,
              revpar: snap.revparLY,
            },
            // The LY figure is "as of" the equivalent date one year earlier than the primary
            // period's own latest report date.
            reportDate: shiftYears(snap.reportDate, -1),
            isPaceFallback: true,
          });
          setLoadingB(false);
          return;
        }
      }

      setDataB(d);
      setLoadingB(false);
    })().catch(() => { if (!cancelled) { setDataB(null); setLoadingB(false); } });

    return () => { cancelled = true; };
  }, [hotelB, cityB, yearB, monthB, hotelA, yearA, monthA]);

  // ── Insight text ────────────────────────────────────────────────────────────
  const insight = useMemo<string | null>(() => {
    if (!dataA?.kpis || !dataB?.kpis) return null;
    const kA = dataA.kpis, kB = dataB.kpis;
    const parts: string[] = [];

    if (kA.brojNocenja !== 0 && kB.brojNocenja !== 0) {
      const pct = ((kA.brojNocenja - kB.brojNocenja) / kB.brojNocenja) * 100;
      const dir = pct >= 0 ? "više" : "manje";
      parts.push(`Period A je imao ${Math.abs(Math.round(pct * 10) / 10).toLocaleString("sr-RS")}% ${dir} noćenja`);
    }
    if (kA.adr !== 0 && kB.adr !== 0) {
      const pct = ((kA.adr - kB.adr) / kB.adr) * 100;
      const dir = pct >= 0 ? "viši" : "niži";
      parts.push(`uz ${Math.abs(Math.round(pct * 10) / 10).toLocaleString("sr-RS")}% ${dir} ADR`);
    }

    let text = parts.join(" ") || "Periodi imaju različite performanse.";
    text += ".";

    if (dataA.notes) {
      const snippet = dataA.notes.length > 80 ? dataA.notes.slice(0, 80) + "…" : dataA.notes;
      text += ` Manager je zabeležio za Period A: "${snippet}"`;
    }
    if (dataA.events.length > 0) {
      text += ` ${dataA.events.length} ${dataA.events.length === 1 ? "događaj" : "događaja"} u Periodu A je moglo uticati na performanse.`;
    }
    if (dataB.events.length > 0 && dataB.events.length !== dataA.events.length) {
      text += ` Period B je imao ${dataB.events.length} ${dataB.events.length === 1 ? "događaj" : "događaja"}.`;
    }

    return text;
  }, [dataA, dataB]);

  const canCompare = Boolean(hotelA && hotelB && dataA && dataB);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Scale size={18} color="#C9A84C" strokeWidth={2.5} />
            <h1 style={{ fontSize: 20, fontWeight: 800, color: "#111827", letterSpacing: "-0.02em", margin: 0 }}>
              Poređenje Perioda
            </h1>
          </div>
          <div style={{ fontSize: 12, color: "#9ca3af" }}>
            Uporedite performanse između dva perioda
          </div>
        </div>
      </div>

      {/* Period selectors */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <PeriodSelector
          label="Period A"
          color="#3b82f6"
          hotels={hotels}
          hotelId={hotelA}
          month={monthA}
          year={yearA}
          onHotel={setHotelA}
          onMonth={setMonthA}
          onYear={setYearA}
        />

        {/* VS divider */}
        <div className="flex items-center justify-center" style={{ flexShrink: 0 }}>
          <div
            className="flex items-center justify-center rounded-full"
            style={{ width: 36, height: 36, background: "#f3f4f6", border: "2px solid #e5e7eb" }}
          >
            <span style={{ fontSize: 10, fontWeight: 800, color: "#9ca3af", letterSpacing: "0.04em" }}>VS</span>
          </div>
        </div>

        <PeriodSelector
          label="Period B"
          color="#a855f7"
          hotels={hotels}
          hotelId={hotelB}
          month={monthB}
          year={yearB}
          onHotel={setHotelB}
          onMonth={setMonthB}
          onYear={setYearB}
        />
      </div>

      {/* Comparison table */}
      <div
        className="rounded-xl mb-5"
        style={{ background: "#ffffff", border: "1px solid #e5e7eb", boxShadow: "0 1px 4px rgba(0,0,0,0.04)", overflow: "hidden" }}
      >
        <div
          className="flex items-center justify-between px-5 py-3"
          style={{ borderBottom: "1px solid #f3f4f6" }}
        >
          <div style={{ fontSize: 12, fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Tabela Poređenja
          </div>
          {(loadingA || loadingB) && <Loader2 size={14} color="#9ca3af" className="animate-spin" />}
        </div>

        {!hotelA || !hotelB ? (
          <div className="flex items-center justify-center py-12">
            <div style={{ fontSize: 13, color: "#9ca3af" }}>Odaberite oba perioda iznad da vidite poređenje</div>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 500 }}>
              <thead>
                <tr style={{ background: "#f9fafb" }}>
                  <th style={{ padding: "10px 20px", textAlign: "left", fontSize: 10, fontWeight: 700, color: "#9ca3af", letterSpacing: "0.06em", textTransform: "uppercase", borderBottom: "1px solid #e5e7eb", minWidth: 140 }}>
                    Metrika
                  </th>
                  <th style={{ padding: "10px 16px", textAlign: "right", fontSize: 10, fontWeight: 700, color: "#3b82f6", letterSpacing: "0.06em", textTransform: "uppercase", borderBottom: "1px solid #e5e7eb" }}>
                    {periodLabel(monthA, yearA)}
                    {hotels.find(h => h.id === hotelA) && hotelA !== hotelB
                      ? ` · ${hotels.find(h => h.id === hotelA)!.name}`
                      : ""}
                  </th>
                  <th style={{ padding: "10px 16px", textAlign: "right", fontSize: 10, fontWeight: 700, color: "#a855f7", letterSpacing: "0.06em", textTransform: "uppercase", borderBottom: "1px solid #e5e7eb" }}>
                    <div>
                      {periodLabel(monthB, yearB)}
                      {hotels.find(h => h.id === hotelB) && hotelA !== hotelB
                        ? ` · ${hotels.find(h => h.id === hotelB)!.name}`
                        : ""}
                    </div>
                    {dataB?.isPaceFallback && (
                      <div
                        style={{
                          fontSize: 9, fontWeight: 700, color: "#92400e", textTransform: "none",
                          letterSpacing: 0, marginTop: 3, display: "inline-block",
                          background: "rgba(234,179,8,0.12)", border: "1px solid rgba(234,179,8,0.3)",
                          borderRadius: 4, padding: "2px 6px",
                        }}
                      >
                        📌 na isti dan lani · on-books
                      </div>
                    )}
                  </th>
                  <th style={{ padding: "10px 16px", textAlign: "right", fontSize: 10, fontWeight: 700, color: "#9ca3af", letterSpacing: "0.06em", textTransform: "uppercase", borderBottom: "1px solid #e5e7eb", minWidth: 160 }}>
                    Razlika
                  </th>
                </tr>
              </thead>
              <tbody>
                {ROW_META.map(({ key, label, isPercent }) => {
                  const vA = dataA?.kpis?.[key] ?? null;
                  const vB = dataB?.kpis?.[key] ?? null;
                  const loading = loadingA || loadingB;

                  const diff    = vA !== null && vB !== null ? vA - vB : null;
                  const pct     = diff !== null && vB !== null && vB !== 0 && !isPercent
                    ? (diff / Math.abs(vB)) * 100 : null;
                  const isPos   = diff !== null && diff > 0;
                  const isNeg   = diff !== null && diff < 0;
                  const diffColor = isPos ? "#16a34a" : isNeg ? "#dc2626" : "#6b7280";

                  return (
                    <tr key={key} style={{ borderBottom: "1px solid #f3f4f6" }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#fafafa"; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                    >
                      {/* Metric name */}
                      <td style={{ padding: "12px 20px", fontSize: 13, fontWeight: 600, color: "#374151" }}>
                        {label}
                      </td>

                      {/* Period A value */}
                      <td style={{ padding: "12px 16px", textAlign: "right", fontSize: 14, fontWeight: 700, color: loading ? "#d1d5db" : "#111827", fontVariantNumeric: "tabular-nums" }}>
                        {loading ? "—" : vA !== null ? fmtVal(vA, key) : "—"}
                      </td>

                      {/* Period B value */}
                      <td style={{ padding: "12px 16px", textAlign: "right", fontSize: 14, fontWeight: 700, color: loading ? "#d1d5db" : "#111827", fontVariantNumeric: "tabular-nums" }}>
                        {loading ? "—" : vB !== null ? fmtVal(vB, key) : "—"}
                      </td>

                      {/* Difference */}
                      <td style={{ padding: "12px 16px", textAlign: "right" }}>
                        {loading || diff === null ? (
                          <span style={{ fontSize: 12, color: "#d1d5db" }}>—</span>
                        ) : diff === 0 ? (
                          <div className="flex items-center justify-end gap-1">
                            <Minus size={12} color="#9ca3af" />
                            <span style={{ fontSize: 13, color: "#9ca3af" }}>Nema razlike</span>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-1.5">
                            {isPos
                              ? <TrendingUp  size={13} color={diffColor} />
                              : <TrendingDown size={13} color={diffColor} />}
                            <span style={{ fontSize: 13, fontWeight: 700, color: diffColor, fontVariantNumeric: "tabular-nums" }}>
                              {isPos ? "+" : ""}{fmtVal(diff, key)}
                            </span>
                            {pct !== null && (
                              <span
                                style={{
                                  fontSize: 11, fontWeight: 600, color: diffColor,
                                  background: isPos ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.08)",
                                  border: `1px solid ${isPos ? "rgba(34,197,94,0.2)" : "rgba(239,68,68,0.2)"}`,
                                  borderRadius: 4, padding: "1px 6px",
                                }}
                              >
                                {fmtPct(pct)}
                              </span>
                            )}
                            {isPercent && diff !== 0 && (
                              <span style={{ fontSize: 11, color: "#9ca3af" }}>pp</span>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {/* Latest report date row */}
              {(dataA || dataB) && (
                <tfoot>
                  <tr style={{ background: "#f9fafb" }}>
                    <td style={{ padding: "8px 20px", fontSize: 11, color: "#9ca3af", fontStyle: "italic" }}>
                      Poslednji izveštaj
                    </td>
                    <td style={{ padding: "8px 16px", textAlign: "right", fontSize: 11, color: "#9ca3af" }}>
                      {dataA?.reportDate ? formatDateSr(dataA.reportDate) : "—"}
                    </td>
                    <td style={{ padding: "8px 16px", textAlign: "right", fontSize: 11, color: "#9ca3af" }}>
                      {dataB?.reportDate ? formatDateSr(dataB.reportDate) : "—"}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </div>

      {/* Context section */}
      {canCompare && (
        <>
          <div
            className="flex flex-col md:flex-row gap-4 mb-5"
          >
            <ContextCard
              color="#3b82f6"
              label={`Kontekst — ${periodLabel(monthA, yearA)}`}
              data={dataA}
              year={yearA}
              month={monthA}
              weatherDays={weatherA.days}
              weatherStatus={weatherA.status}
              historicalSummary={historicalA.summary}
              historicalStatus={historicalA.status}
            />
            <ContextCard
              color="#a855f7"
              label={`Kontekst — ${periodLabel(monthB, yearB)}`}
              data={dataB}
              year={yearB}
              month={monthB}
              weatherDays={weatherB.days}
              weatherStatus={weatherB.status}
              historicalSummary={historicalB.summary}
              historicalStatus={historicalB.status}
            />
          </div>

          {/* Insight strip */}
          {insight && (
            <div
              className="flex items-start gap-3 rounded-xl mb-5"
              style={{ padding: "14px 18px", background: "rgba(201,168,76,0.06)", border: "1px solid rgba(201,168,76,0.25)" }}
            >
              <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>💡</span>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#92400e", marginBottom: 3, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Automatski uvid
                </div>
                <div style={{ fontSize: 13, color: "#374151", lineHeight: 1.7 }}>
                  {insight}
                </div>
              </div>
            </div>
          )}

          {/* Export hint */}
          <div style={{ textAlign: "center", padding: "8px 0 4px" }}>
            <span style={{ fontSize: 11, color: "#d1d5db" }}>
              Kopirajte podatke za izveštaj — Ctrl+A, Ctrl+C
            </span>
          </div>
        </>
      )}
    </>
  );
}
