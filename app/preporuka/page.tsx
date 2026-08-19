"use client";

import { Fragment, useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  TrendingUp, TrendingDown, Minus, Building2, RefreshCw, Check,
  AlertCircle, CalendarDays,
} from "lucide-react";
import { useHotel, MONTHS_SR, ROOM_TYPE_DEFS, type RoomTypeKey } from "../context/HotelContext";
import {
  fetchLatestReportSnapshot, fetchMonthlyTargetFor, fetchLatestOnBooksForMonth,
  todayISO, shiftDays, dateParts, toISO, yearMonthOf, formatDateSr,
  type ReportSnapshot, type MonthlyOnBooksPace,
} from "../lib/dashboardData";
import type { MonthlyTargetRow } from "../lib/supabaseClient";
import { getEurRsdRate } from "../lib/fxRate";
import {
  computeRecommendation, suggestedPrice, verdictLabel,
  type RecommendationInputs, type Verdict, type ConfidenceLabel,
} from "../lib/priceRecommendation";
import {
  computeHotelOccupancyForDate, computeHotelPickupPerDay, computeRoomTypeAdjustment,
  matchesArchiveRoomType, enforcePriceLadder, resolveTypeNudgePercent,
  type RoomTypeOnBooksRow, type LadderInput, type RoomTypeAdjustmentResult,
} from "../lib/roomTypeRecommendation";
import { fetchRoomTypeOnBooksForDate } from "../lib/roomTypeOnBooksData";
import {
  fetchCompetitorSnapshot, saveCompetitorSnapshot, type CompetitorSnapshotRow,
} from "../lib/competitorSnapshot";
import { classifyCompetitorLookupStatus, competitorEmptyStateMessage } from "../lib/competitorLookup";
import { fetchSavedCompetitorNames } from "../lib/savedCompetitors";
import { computeCompetitorAverage, outcomeSummary, type CompetitorAverageOutcome, type CompetitorEntry } from "../lib/competitorAveraging";
import { explainBaseRecommendation, explainRoomTypeAdjustment } from "../lib/recommendationExplain";
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

// Explains, per room type, why its verdict deviates from the hotel-wide base — or plainly says
// there's no per-type data for this date, never silently falling back without saying so.
function roomTypeReasonText(adjustment: RoomTypeAdjustmentResult, hotelOccPct: number | null, laddered: boolean): string | null {
  const parts: string[] = [];
  if (!adjustment.dataAvailable) {
    parts.push("Nema podataka po tipu sobe za ovaj datum");
  } else if (adjustment.direction === "hotter" || adjustment.direction === "colder") {
    const typeOcc = adjustment.occPct != null ? Math.round(adjustment.occPct) : null;
    const hotelOcc = hotelOccPct != null ? Math.round(hotelOccPct) : null;
    if (typeOcc != null && hotelOcc != null) {
      const dir = adjustment.direction === "hotter" ? "iznad proseka hotela" : "ispod proseka hotela";
      // "(ovaj datum)" once, covering both sides — this line is entirely about the selected stay
      // date, unlike the base card's "(mesečno)" occupancy figure above it.
      parts.push(`Popunjenost ${typeOcc}% vs ${hotelOcc}% hotel (ovaj datum) — ${dir}`);
    }
  }
  if (laddered) parts.push("cena ograničena da ne naruši poredak cena");
  return parts.length > 0 ? parts.join(" · ") : null;
}

const VERDICT_STYLES: Record<Verdict, { bg: string; border: string; color: string; icon: typeof TrendingUp }> = {
  RAISE: { bg: "rgba(217,119,6,0.08)", border: "rgba(217,119,6,0.3)", color: "#b45309", icon: TrendingUp },
  HOLD: { bg: "#f3f4f6", border: "#e5e7eb", color: "#6b7280", icon: Minus },
  LOWER: { bg: "rgba(59,130,246,0.08)", border: "rgba(59,130,246,0.3)", color: "#2563eb", icon: TrendingDown },
};

const CONFIDENCE_STYLES: Record<ConfidenceLabel, { bg: string; border: string; color: string }> = {
  visoka: { bg: "rgba(22,163,74,0.08)", border: "rgba(22,163,74,0.25)", color: "#16a34a" },
  srednja: { bg: "rgba(217,119,6,0.08)", border: "rgba(217,119,6,0.25)", color: "#b45309" },
  niska: { bg: "#f3f4f6", border: "#e5e7eb", color: "#6b7280" },
};

function fmtEur(n: number): string {
  return `${Math.round(n).toLocaleString("sr-RS")}€`;
}

// Shows exactly which hotels fed competitorAvgEur, and which were tried and excluded/unmatched —
// this number silently drove the recommendation for weeks (an unfiltered average of everything
// Google Hotels returns for the city); a bare hotel count is not enough to trust it again.
function CompetitorBreakdown({ outcome }: { outcome: CompetitorAverageOutcome }) {
  const rowStyle = { display: "flex", justifyContent: "space-between", gap: 8, padding: "2px 0" };
  if (outcome.method === "saved" || outcome.method === "saved_none_matched") {
    return (
      <details style={{ fontSize: 10.5, color: "#9ca3af", marginTop: 2 }}>
        <summary style={{ cursor: "pointer", userSelect: "none" }}>
          Sačuvani konkurenti ({outcome.matches.filter(m => m.matched).length}/{outcome.matches.length} pronađeno za ovaj datum)
        </summary>
        {outcome.matches.map(m => (
          <div key={m.savedName} style={rowStyle}>
            <span>{m.matched ? "✓" : "✗"} {m.savedName}</span>
            <span>{m.matched ? fmtEur(m.matched.priceExtracted as number) : "nije pronađen za ovaj datum"}</span>
          </div>
        ))}
      </details>
    );
  }
  const { comparable, excludedOutOfClassBand, excludedNoClass, excludedPriceBand } = outcome.comparability;
  const excludedTotal = excludedOutOfClassBand.length + excludedNoClass.length + excludedPriceBand.length;
  if (comparable.length === 0 && excludedTotal === 0) return null;
  return (
    <details style={{ fontSize: 10.5, color: "#9ca3af", marginTop: 2 }}>
      <summary style={{ cursor: "pointer", userSelect: "none" }}>
        {comparable.length} od {comparable.length + excludedTotal} hotela iz pretrage korišćeno u proseku
      </summary>
      {comparable.map(e => (
        <div key={e.name} style={rowStyle}>
          <span>✓ {e.name}</span>
          <span>{fmtEur(e.priceExtracted as number)}</span>
        </div>
      ))}
      {excludedOutOfClassBand.map(e => (
        <div key={e.name} style={rowStyle}>
          <span>✗ {e.name}</span>
          <span>van klase — {fmtEur(e.priceExtracted as number)}</span>
        </div>
      ))}
      {excludedNoClass.map(e => (
        <div key={e.name} style={rowStyle}>
          <span>✗ {e.name}</span>
          <span>nema podatak o klasi — {fmtEur(e.priceExtracted as number)}</span>
        </div>
      ))}
      {excludedPriceBand.map(e => (
        <div key={e.name} style={rowStyle}>
          <span>✗ {e.name}</span>
          <span>van cenovnog opsega — {fmtEur(e.priceExtracted as number)}</span>
        </div>
      ))}
    </details>
  );
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
  // Monthly on-books pace (rooms on the books for the whole stay month vs. target) — fetched
  // alongside the per-day snapshot and used ONLY as a fallback when that day has no on-books pace
  // of its own yet (a future date, before its month has started reporting daily actuals).
  const [monthlyPace, setMonthlyPace] = useState<MonthlyOnBooksPace | null>(null);
  const [loadingPace, setLoadingPace] = useState(false);

  useEffect(() => {
    if (!selectedHotel || !selectedDate) { setSnapshot(null); setMonthlyTarget(null); setMonthlyPace(null); return; }
    let cancelled = false;
    setLoadingPace(true);
    (async () => {
      const { year, month } = dateParts(selectedDate);
      const monthStart = toISO(year, month, 1);
      const [snap, target, monthPace] = await Promise.all([
        fetchLatestReportSnapshot(selectedHotel, monthStart, selectedDate),
        fetchMonthlyTargetFor(selectedHotel, yearMonthOf(selectedDate)),
        fetchLatestOnBooksForMonth(selectedHotel, month, year),
      ]);
      if (cancelled) return;
      setSnapshot(snap);
      setMonthlyTarget(target);
      setMonthlyPace(monthPace);
      setLoadingPace(false);
    })();
    return () => { cancelled = true; };
  }, [selectedHotel, selectedDate]);

  // ── Per-room-type on-books (room_type_daily_onbooks) for the exact stay date ───────────────
  // Replaces the monthly-pace fallback for the PER-TYPE view only — the hotel-wide base above keeps
  // using its own existing sources unchanged. Empty (never invented) when the archive has no row
  // for this stay date at all.
  const [roomTypeRows, setRoomTypeRows] = useState<RoomTypeOnBooksRow[]>([]);
  useEffect(() => {
    if (!selectedHotel || !selectedDate) { setRoomTypeRows([]); return; }
    let cancelled = false;
    fetchRoomTypeOnBooksForDate(selectedHotel, selectedDate).then(rows => { if (!cancelled) setRoomTypeRows(rows); });
    return () => { cancelled = true; };
  }, [selectedHotel, selectedDate]);

  const hotelOccForDate = useMemo(() => computeHotelOccupancyForDate(roomTypeRows), [roomTypeRows]);
  const hotelPickupPerDay = useMemo(() => computeHotelPickupPerDay(roomTypeRows), [roomTypeRows]);

  // ── Competitor prices — auto-pulled from the same SerpAPI feed as the Dashboard's competitor
  // section, but cached per (hotel, stay date) in Supabase so a date is only ever queried once:
  // on load, the cache is checked first; SerpAPI (credit-metered) is only hit when no cached row
  // exists yet for that date. "Osveži konkurenciju" forces a fresh pull and overwrites the cache. ─
  const [competitorSnapshot, setCompetitorSnapshot] = useState<CompetitorSnapshotRow | null>(null);
  const [competitorLoading, setCompetitorLoading] = useState(false);
  const [competitorChecked, setCompetitorChecked] = useState(false);
  const [competitorQuotaExceeded, setCompetitorQuotaExceeded] = useState(false);
  // Distinct from "checked, found nothing" — the lookup itself never ran to completion (missing
  // SERPAPI_KEY server-side, or an unexpected failure calling out). Same confidence-degrading effect
  // as any other missing competitorAvgEur (see priceRecommendation.ts — it doesn't need to know
  // WHY the signal is missing), but the UI must say plainly that this isn't a real "found nothing".
  const [competitorNotConfigured, setCompetitorNotConfigured] = useState(false);

  // Once a SerpAPI quota error is seen, stop hitting it again for the rest of the session — a
  // monthly quota won't renew mid-session, so every further attempt would just fail the same way.
  // A ref (not state) so the auto-fetch effect below always reads the latest value synchronously,
  // without needing to be re-triggered by a state change.
  const quotaBlockedRef = useRef(false);
  // Same idea for "not configured" — a missing key (or a first unexpected failure) isn't going to
  // fix itself mid-session either, so stop re-attempting on every date change once it's known.
  const notConfiguredBlockedRef = useRef(false);
  // NOT session-blocked, unlike the two above — whether a saved competitor matches is a per-date
  // question (a hotel might show up in Google's results for one date and not another), so every new
  // date deserves its own attempt.

  const competitorAvgEur = competitorSnapshot?.avg_price_eur ?? null;
  const competitorCount = competitorSnapshot?.competitor_count ?? 0;
  // WHICH hotels actually fed the average, and which were tried and excluded/unmatched — see
  // computeCompetitorAverage. Only populated by a fresh computation this session (auto-fetch on a
  // cache miss, or "Osveži konkurenciju"); a straight cache hit only has the aggregate stored in
  // competitor_price_snapshots, so this stays null then — see the render fallback note below for why
  // that's a known, called-out limitation rather than a silent gap.
  const [competitorBreakdown, setCompetitorBreakdown] = useState<CompetitorAverageOutcome | null>(null);

  type CompetitorFetchResult =
    | { failure: "quota_exceeded" | "not_configured" }
    | { failure: null; outcome: CompetitorAverageOutcome };

  // Runs the raw search, then decides which subset of results actually feeds the average:
  //   - saved competitors ("Sačuvani Konkurenti"), matched by name, if the hotel has any saved — see
  //     computeSavedCompetitorAverage in competitorMatching.ts;
  //   - otherwise a comparability filter, NOT a plain average of everything Google returns for the
  //     city — see competitorComparability.ts. Its primary rule (star-class band) needs to know our
  //     own hotel's star class, which `hotels` doesn't store yet, so it currently always falls back
  //     to a price-band filter around our own CLS price instead.
  const runCompetitorFetch = useCallback(async (
    dateForFetch: string, ownHotelName: string, hotelCity: string,
  ): Promise<CompetitorFetchResult> => {
    const checkin = dateForFetch;
    const checkout = shiftDays(dateForFetch, 1);
    const params = new URLSearchParams({ location: hotelCity, checkin, checkout, ownHotel: ownHotelName });
    const [res, rate, savedNames] = await Promise.all([
      fetch(`/api/competitors?${params}`),
      getEurRsdRate(),
      selectedHotel ? fetchSavedCompetitorNames(selectedHotel) : Promise.resolve([] as string[]),
    ]);
    const httpFailure = classifyCompetitorLookupStatus(res.status);
    if (httpFailure === "quota_exceeded" || httpFailure === "not_configured") return { failure: httpFailure };
    const data: CompetitorResult[] = res.ok ? await res.json() : [];
    // Convert RSD -> EUR up front so every downstream step (matching, comparability, averaging)
    // works in one consistent unit, matching ourRefPriceEur (hotel.priceCls, stored in EUR).
    const entries: CompetitorEntry[] = data.map(r => ({
      name: r.name,
      priceExtracted: r.priceExtracted != null ? r.priceExtracted / rate : null,
      hotelClass: r.hotelClass,
    }));
    const outcome = computeCompetitorAverage(savedNames, entries, /* ownHotelClassStars: */ null, hotel?.priceCls ?? null);
    return { failure: null, outcome };
  }, [selectedHotel, hotel?.priceCls]);

  useEffect(() => {
    if (!selectedHotel || !selectedDate || !city) {
      setCompetitorSnapshot(null);
      setCompetitorBreakdown(null);
      setCompetitorChecked(false);
      return;
    }
    let cancelled = false;
    setCompetitorChecked(false);
    setCompetitorLoading(true);
    (async () => {
      const cached = await fetchCompetitorSnapshot(selectedHotel, selectedDate);
      if (cancelled) return;
      if (cached) {
        setCompetitorSnapshot(cached);
        setCompetitorBreakdown(null); // cache hit — no fresh per-hotel breakdown this load
        setCompetitorChecked(true);
        setCompetitorLoading(false);
        return;
      }
      if (quotaBlockedRef.current || notConfiguredBlockedRef.current) {
        // Already known to be blocked this session (quota, or the lookup not being set up at all)
        // — go straight to the manual fallback instead of firing another request that will just
        // fail the same way.
        setCompetitorSnapshot(null);
        setCompetitorBreakdown(null);
        setCompetitorChecked(true);
        setCompetitorLoading(false);
        return;
      }
      const result = await runCompetitorFetch(selectedDate, hotel?.name ?? "", city);
      if (cancelled) return;
      if (result.failure) {
        if (result.failure === "quota_exceeded") { quotaBlockedRef.current = true; setCompetitorQuotaExceeded(true); }
        else { notConfiguredBlockedRef.current = true; setCompetitorNotConfigured(true); }
        setCompetitorSnapshot(null); // blocked, not checked — never cache a false "found nothing"
        setCompetitorBreakdown(null);
        setCompetitorChecked(true);
        setCompetitorLoading(false);
        return;
      }
      const { avgPrice, count } = outcomeSummary(result.outcome);
      const saved = await saveCompetitorSnapshot(selectedHotel, selectedDate, avgPrice, count, "auto");
      if (cancelled) return;
      setCompetitorSnapshot(saved);
      setCompetitorBreakdown(result.outcome);
      setCompetitorChecked(true);
      setCompetitorLoading(false);
    })();
    return () => { cancelled = true; };
  }, [selectedHotel, selectedDate, city, hotel?.name, runCompetitorFetch]);

  // Manual refresh — bypasses the cache and overwrites it with a fresh pull. Also respects the
  // session-wide blocks: once quota-exceeded or not-configured is known, this becomes a no-op
  // rather than another failed call.
  const refreshCompetitors = useCallback(async () => {
    if (!selectedHotel || !selectedDate || !city || competitorLoading || quotaBlockedRef.current || notConfiguredBlockedRef.current) return;
    setCompetitorLoading(true);
    try {
      const result = await runCompetitorFetch(selectedDate, hotel?.name ?? "", city);
      if (result.failure) {
        if (result.failure === "quota_exceeded") { quotaBlockedRef.current = true; setCompetitorQuotaExceeded(true); }
        else { notConfiguredBlockedRef.current = true; setCompetitorNotConfigured(true); }
        setCompetitorSnapshot(null);
        setCompetitorBreakdown(null);
        setCompetitorChecked(true);
        return;
      }
      const { avgPrice, count } = outcomeSummary(result.outcome);
      const saved = await saveCompetitorSnapshot(selectedHotel, selectedDate, avgPrice, count, "auto");
      setCompetitorSnapshot(saved);
      setCompetitorBreakdown(result.outcome);
      setCompetitorChecked(true);
    } finally {
      setCompetitorLoading(false);
    }
  }, [selectedHotel, selectedDate, city, competitorLoading, runCompetitorFetch, hotel?.name]);

  // Manual fallback — only surfaced when the auto pull found nothing for this date. A few typed
  // EUR prices feed competitorGap the same way an auto pull would, and overwrite the cached row.
  const [manualCompetitorInput, setManualCompetitorInput] = useState("");
  const [savingManualCompetitor, setSavingManualCompetitor] = useState(false);

  useEffect(() => { setManualCompetitorInput(""); }, [selectedHotel, selectedDate]);

  const saveManualCompetitorPrices = useCallback(async () => {
    if (!selectedHotel || !selectedDate || savingManualCompetitor) return;
    const prices = manualCompetitorInput
      .split(",")
      .map(s => Number(s.trim().replace(",", ".")))
      .filter(n => Number.isFinite(n) && n > 0);
    if (prices.length === 0) return;
    setSavingManualCompetitor(true);
    try {
      const avgEur = prices.reduce((sum, n) => sum + n, 0) / prices.length;
      const saved = await saveCompetitorSnapshot(selectedHotel, selectedDate, avgEur, prices.length, "manual");
      setCompetitorSnapshot(saved);
      setCompetitorBreakdown(null); // manually typed numbers have no per-hotel names to show
      setManualCompetitorInput("");
    } finally {
      setSavingManualCompetitor(false);
    }
  }, [selectedHotel, selectedDate, manualCompetitorInput, savingManualCompetitor]);

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

  // Per-day pace of exactly 0 means "no report for this date yet" (same 0-means-missing
  // convention as the rest of the app) — most relevant for future dates, which have no daily
  // pace at all until their month starts reporting actuals. When that's the case, fall back to
  // this month's on-books pace (rooms on the books for the whole month vs. target) instead.
  const dailyOccPct = snapshot && snapshot.popunjenost !== 0 ? snapshot.popunjenost : null;
  const monthlyOccPct = monthlyPace ? monthlyPace.occupancyOnbooks : null;
  const onBooksOccPct = dailyOccPct ?? monthlyOccPct;
  // BOTH sources above are whole-month figures as of the latest report — daily_reports.on_books_today
  // is a running month-to-date total, not a per-stay-date reading, and the "monthly pace" fallback is
  // explicitly month-level too. So this is true whenever a value is available at all, not only on the
  // fallback path — see RecommendationInputs for why that distinction used to be (silently) wrong.
  const onBooksOccPctIsMonthly = onBooksOccPct !== null;

  const onBooksNights = snapshot ? snapshot.brojNocenja : null;
  // Same-day-last-year of 0 means "not entered" — same convention used everywhere else in the app
  // (e.g. the On-Books YoY cards), since a real hotel practically never has a literal 0 on file.
  const sameDayLastYearNights = snapshot && snapshot.brojNocenjaLY !== 0 ? snapshot.brojNocenjaLY : null;
  const targetOccPct = monthlyTarget && monthlyTarget.occupancy_target !== 0 ? monthlyTarget.occupancy_target : null;
  const ourRefPriceEur = hotel?.priceCls ?? null;
  const isWeekend = isWeekendDate(selectedDate);
  const hasNearbyEvent = events.length > 0;
  const nearbyEventLabel = events[0] ? truncate(events[0].title, 40) : null;
  const monthLabel = MONTHS_SR[dateParts(selectedDate).month - 1].toLowerCase();

  const inputs: RecommendationInputs = useMemo(() => ({
    onBooksOccPct, onBooksOccPctIsMonthly, targetOccPct, onBooksNights, sameDayLastYearNights,
    competitorAvgEur, ourRefPriceEur, isWeekend, hasNearbyEvent, nearbyEventLabel, monthLabel,
  }), [onBooksOccPct, onBooksOccPctIsMonthly, targetOccPct, onBooksNights, sameDayLastYearNights, competitorAvgEur, ourRefPriceEur, isWeekend, hasNearbyEvent, nearbyEventLabel, monthLabel]);

  const recommendation = useMemo(() => computeRecommendation(inputs), [inputs]);

  // Per-type: match each configured price slot against whatever room_type codes the archive
  // actually has for this hotel (never assumed — see matchesArchiveRoomType), layer a ONE-notch
  // adjustment on top of the hotel-wide base verdict, price it with the SAME base nudge% (only the
  // verdict driving suggestedPrice's HOLD-means-no-change rule differs per type), then enforce the
  // hotel's own baseline price ordering across all types together.
  const suggestions = useMemo(() => {
    const withAdjustment = ROOM_TYPE_DEFS.map(def => {
      const current = hotel?.[HOTEL_PRICE_FIELD[def.key]] ?? null;
      const matchedRow = roomTypeRows.find(r => matchesArchiveRoomType(r.roomType, def.key, def.label)) ?? null;
      const adjustment = computeRoomTypeAdjustment(matchedRow, hotelOccForDate.occPct, hotelPickupPerDay, recommendation.verdict);
      const typeNudgePercent = resolveTypeNudgePercent(recommendation.verdict, recommendation.nudgePercent, adjustment.verdict);
      const rawSuggested = suggestedPrice(current, typeNudgePercent, adjustment.verdict);
      return { ...def, current, adjustment, rawSuggested, typeNudgePercent, roomsInventory: matchedRow?.roomsInventory ?? null };
    });

    const ladderInputs: LadderInput[] = withAdjustment.map(r => ({
      roomTypeKey: r.key, baselinePrice: r.current, suggestedPrice: r.rawSuggested,
    }));
    const ladderByKey = new Map(enforcePriceLadder(ladderInputs).map(r => [r.roomTypeKey, r]));
    const labelByKey = new Map(ROOM_TYPE_DEFS.map(d => [d.key, d.label]));

    return withAdjustment.map(r => {
      const ladder = ladderByKey.get(r.key);
      const clampedAgainstKey = ladder?.clampedAgainstKey ?? null;
      const clampedAgainstLabel = clampedAgainstKey != null ? labelByKey.get(clampedAgainstKey as RoomTypeKey) ?? clampedAgainstKey : null;
      const clampedAgainstPrice = clampedAgainstKey != null ? ladderByKey.get(clampedAgainstKey)?.finalPrice ?? null : null;
      return {
        ...r, suggested: ladder?.finalPrice ?? r.rawSuggested, laddered: ladder?.clamped ?? false,
        clampedAgainstLabel, clampedAgainstPrice,
      };
    });
  }, [hotel, roomTypeRows, hotelOccForDate.occPct, hotelPickupPerDay, recommendation.verdict, recommendation.nudgePercent]);

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

  // "Zašto?" — collapsed by default so the card stays scannable; the explanation text is derived
  // straight from `recommendation`/`suggestions` (see recommendationExplain.ts), never a second,
  // parallel computation that could drift from the actual verdict.
  const [baseExplainOpen, setBaseExplainOpen] = useState(false);
  const [expandedTypes, setExpandedTypes] = useState<Set<RoomTypeKey>>(new Set());
  const toggleTypeExplain = useCallback((key: RoomTypeKey) => {
    setExpandedTypes(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }, []);
  const baseExplanation = useMemo(() => explainBaseRecommendation(inputs, recommendation), [inputs, recommendation]);

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
        <div style={{ fontSize: 12, fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>
          Trenutne Cene po Noći (EUR)
        </div>
        <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 12 }}>
          Cene za 2 osobe · noćenje s doručkom (BB)
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
          onClick={refreshCompetitors}
          disabled={competitorLoading || !city || competitorQuotaExceeded || competitorNotConfigured}
          className="flex items-center gap-2"
          title={
            competitorQuotaExceeded ? "Mesečni limit SerpAPI pretraga je dostignut"
            : competitorNotConfigured ? "Provera cena konkurencije nije podešena"
            : undefined
          }
          style={{
            height: 34, paddingLeft: 14, paddingRight: 14, borderRadius: 7,
            border: "1px solid rgba(201,168,76,0.35)",
            background: competitorLoading || competitorQuotaExceeded || competitorNotConfigured ? "#f9fafb" : "rgba(201,168,76,0.06)",
            color: competitorQuotaExceeded || competitorNotConfigured ? "#d1d5db" : "#C9A84C", fontSize: 12, fontWeight: 600,
            cursor: competitorLoading || competitorQuotaExceeded || competitorNotConfigured ? "default" : "pointer",
          }}
        >
          <Building2 size={13} />
          <RefreshCw size={12} className={competitorLoading ? "animate-spin" : ""} />
          {competitorLoading ? "Proveravam..." : competitorQuotaExceeded ? "Limit dostignut" : competitorNotConfigured ? "Nije podešeno" : "Osveži konkurenciju"}
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
          <div className="flex items-center gap-2">
            <div
              className="rounded-lg"
              style={{ padding: "8px 16px", background: "#ffffff", border: `1px solid ${style.border}` }}
            >
              <div style={{ fontSize: 10, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em" }}>Preporuka</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: style.color }}>
                {recommendation.nudgePercent > 0 ? "+" : ""}{recommendation.nudgePercent}%
              </div>
            </div>
            <span
              className="rounded-full"
              style={{
                fontSize: 10, fontWeight: 700, padding: "4px 10px",
                background: CONFIDENCE_STYLES[recommendation.confidenceLabel].bg,
                color: CONFIDENCE_STYLES[recommendation.confidenceLabel].color,
                border: `1px solid ${CONFIDENCE_STYLES[recommendation.confidenceLabel].border}`,
              }}
              title={`${Math.round(recommendation.confidence * 100)}% signala dostupno${recommendation.nudgePercentRaw !== recommendation.nudgePercent ? ` · pre korekcije: ${recommendation.nudgePercentRaw > 0 ? "+" : ""}${recommendation.nudgePercentRaw}%` : ""}`}
            >
              Pouzdanost: {recommendation.confidenceLabel}
            </span>
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

        {/* Always visible (not behind "Zašto?") — the base/per-type scope gap is the single most
            confusing thing about this card, so it can't be one click away from invisible. Framed as
            a current limitation ("trenutno"), not a permanent design choice. */}
        <div className="flex items-start gap-1.5 mb-2" style={{ fontSize: 11, color: "#9ca3af" }}>
          <AlertCircle size={12} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>
            Napomena: osnovna preporuka trenutno koristi mesečni prosek (ista za ceo mesec) — preporuke po tipu sobe ispod su specifične za odabrani datum.
          </span>
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

        {/* "Zašto?" — full plain-language breakdown of the base verdict, collapsed by default */}
        <button
          onClick={() => setBaseExplainOpen(o => !o)}
          style={{
            marginTop: 8, height: 24, padding: "0 10px", borderRadius: 6,
            border: `1px solid ${style.border}`, background: "#ffffff",
            color: style.color, fontSize: 11, fontWeight: 600, cursor: "pointer",
          }}
        >
          {baseExplainOpen ? "Sakrij objašnjenje ▲" : "Zašto? ▾"}
        </button>
        {baseExplainOpen && (
          <div
            className="flex flex-col gap-3 mt-3"
            style={{ padding: "14px 16px", background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 10, fontSize: 12.5, color: "#374151" }}
          >
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>
                Signali
              </div>
              <div className="flex flex-col gap-1.5">
                {baseExplanation.signalLines.map((line, i) => <div key={i}>{line}</div>)}
              </div>
            </div>
            {baseExplanation.missingLines.length > 0 && (
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>
                  Nedostaje
                </div>
                <div className="flex flex-col gap-1.5" style={{ color: "#b45309" }}>
                  {baseExplanation.missingLines.map((line, i) => <div key={i}>{line}</div>)}
                </div>
              </div>
            )}
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>
                Zaključak
              </div>
              <div className="flex flex-col gap-1.5" style={{ fontWeight: 500 }}>
                {baseExplanation.verdictLines.map((line, i) => <div key={i}>{line}</div>)}
              </div>
            </div>
          </div>
        )}

        {!competitorChecked ? (
          <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 4 }}>
            {competitorLoading ? "Proveravam cene konkurencije…" : "Čekam datum i hotel da proverim konkurenciju."}
          </div>
        ) : competitorAvgEur != null ? (
          <div style={{ marginTop: 4 }}>
            <div style={{ fontSize: 11, color: "#9ca3af" }}>
              Prosek konkurencije: {fmtEur(competitorAvgEur)} (na osnovu {competitorCount} {competitorCount === 1 ? "hotela" : "hotela"}
              {competitorSnapshot?.source === "manual" ? ", ručno uneto" : ""})
            </div>
            {competitorBreakdown ? (
              <CompetitorBreakdown outcome={competitorBreakdown} />
            ) : (
              <div style={{ fontSize: 10.5, color: "#d1d5db", marginTop: 2 }}>
                Detalji po hotelu nisu dostupni za ovaj (keširani) prikaz — klikni &quot;Osveži konkurenciju&quot; za spisak.
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-2" style={{ marginTop: 4 }}>
            <div style={{ fontSize: 11, color: competitorQuotaExceeded || competitorNotConfigured ? "#b45309" : "#9ca3af" }}>
              {competitorEmptyStateMessage(
                competitorQuotaExceeded ? "quota_exceeded"
                  : competitorNotConfigured ? "not_configured"
                  : competitorBreakdown?.method === "saved_none_matched" ? "no_saved_match"
                  : null,
              )}
            </div>
            {competitorBreakdown?.method === "saved_none_matched" && <CompetitorBreakdown outcome={competitorBreakdown} />}
            <div className="flex items-center gap-2 flex-wrap">
              <input
                type="text"
                value={manualCompetitorInput}
                onChange={e => setManualCompetitorInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") saveManualCompetitorPrices(); }}
                placeholder="npr. 70, 65, 80 (EUR, odvojene zarezom)"
                style={{
                  height: 30, minWidth: 220, borderRadius: 6,
                  border: "1px solid #e5e7eb", paddingLeft: 8, paddingRight: 8,
                  fontSize: 11, color: "#111827", background: "#ffffff", outline: "none",
                }}
              />
              <button
                onClick={saveManualCompetitorPrices}
                disabled={savingManualCompetitor || !manualCompetitorInput.trim()}
                style={{
                  height: 30, paddingLeft: 10, paddingRight: 10, borderRadius: 6, border: "none",
                  background: !manualCompetitorInput.trim() ? "#f3f4f6" : "linear-gradient(135deg, #C9A84C 0%, #E8C96B 100%)",
                  color: !manualCompetitorInput.trim() ? "#9ca3af" : "#ffffff",
                  fontSize: 11, fontWeight: 600,
                  cursor: savingManualCompetitor || !manualCompetitorInput.trim() ? "default" : "pointer",
                }}
              >
                {savingManualCompetitor ? "…" : "Unesi ručno"}
              </button>
            </div>
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
              const typeStyle = VERDICT_STYLES[row.adjustment.verdict];
              const deviatesFromBase = row.adjustment.verdict !== recommendation.verdict;
              const reasonText = roomTypeReasonText(row.adjustment, hotelOccForDate.occPct, row.laddered);
              const typeExpanded = expandedTypes.has(row.key);
              const typeExplainLines = typeExpanded ? explainRoomTypeAdjustment({
                label: row.label, adjustment: row.adjustment, hotelOccPct: hotelOccForDate.occPct,
                roomsInventory: row.roomsInventory, baseVerdict: recommendation.verdict,
                typeNudgePercent: row.typeNudgePercent, suggested: row.suggested, laddered: row.laddered,
                clampedAgainstLabel: row.clampedAgainstLabel, clampedAgainstPrice: row.clampedAgainstPrice,
              }) : [];
              return (
                <Fragment key={row.key}>
                <tr style={{ borderBottom: typeExpanded ? "none" : "1px solid #f3f4f6" }}>
                  <td style={{ padding: "12px 20px", fontSize: 13, fontWeight: 600, color: "#374151" }}>
                    <div className="flex items-center gap-2">
                      <span>{row.label}</span>
                      {deviatesFromBase && (
                        <span
                          className="rounded-full"
                          style={{
                            fontSize: 9, fontWeight: 700, padding: "2px 7px",
                            background: typeStyle.bg, color: typeStyle.color, border: `1px solid ${typeStyle.border}`,
                          }}
                        >
                          {verdictLabel(row.adjustment.verdict)}
                        </span>
                      )}
                      <button
                        onClick={() => toggleTypeExplain(row.key)}
                        style={{
                          fontSize: 10, fontWeight: 600, color: "#9ca3af",
                          background: "none", border: "none", cursor: "pointer", padding: 0,
                        }}
                      >
                        {typeExpanded ? "Sakrij ▲" : "Zašto? ▾"}
                      </button>
                    </div>
                    {reasonText && (
                      <div style={{ fontSize: 10.5, fontWeight: 400, color: row.laddered ? "#b45309" : "#9ca3af", marginTop: 2 }}>
                        {reasonText}
                      </div>
                    )}
                  </td>
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
                {typeExpanded && (
                  <tr style={{ borderBottom: "1px solid #f3f4f6" }}>
                    <td colSpan={4} style={{ padding: "0 20px 14px 20px" }}>
                      <div
                        className="flex flex-col gap-1.5"
                        style={{ padding: "12px 14px", background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 8, fontSize: 12, color: "#374151" }}
                      >
                        {typeExplainLines.map((line, i) => <div key={i}>{line}</div>)}
                      </div>
                    </td>
                  </tr>
                )}
                </Fragment>
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
