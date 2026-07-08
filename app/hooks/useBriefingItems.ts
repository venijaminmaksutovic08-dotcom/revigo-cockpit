"use client";

import { useEffect, useState, useMemo } from "react";
import { useHotel, dateToISO, MONTHS_SR } from "../context/HotelContext";
import { supabase } from "../lib/supabaseClient";

export type ActionSeverity = "red" | "yellow" | "green";

export interface ActionItem {
  id: string;
  severity: ActionSeverity;
  emoji: string;
  message: string;
  detail?: string;
  actionLabel?: string;
  actionHref?: string;
}

function isoDate(d: Date): string {
  return dateToISO(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

const YESTERDAY = (() => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d;
})();

const YESTERDAY_ISO   = isoDate(YESTERDAY);
const YESTERDAY_LABEL = YESTERDAY.toLocaleDateString("sr-RS", { day: "numeric", month: "long" });

export function useBriefingItems() {
  const {
    hotels, selectedHotel,
    monthInfo, monthEntries,
    paceForecast, monthlyTarget, monthProgress,
    kpiData,
  } = useHotel();

  const hotel = hotels.find(h => h.id === selectedHotel) ?? null;
  const city  = hotel?.city ?? "";

  // ── 1. Yesterday missing check ────────────────────────────────────────────────
  const [yesterdayInDb, setYesterdayInDb] = useState<boolean | null>(null);

  const yesterdayInMonthEntries = Boolean(
    monthInfo &&
    YESTERDAY_ISO >= monthInfo.startDate &&
    YESTERDAY_ISO <= monthInfo.endDate &&
    monthEntries[YESTERDAY_ISO]
  );

  useEffect(() => {
    if (!selectedHotel) { setYesterdayInDb(null); return; }
    if (yesterdayInMonthEntries) { setYesterdayInDb(true); return; }

    supabase
      .from("daily_reports")
      .select("id")
      .eq("hotel_id", selectedHotel)
      .eq("report_date", YESTERDAY_ISO)
      .maybeSingle()
      .then(({ data }) => setYesterdayInDb(Boolean(data)));
  }, [selectedHotel, yesterdayInMonthEntries]);

  const yesterdayMissing = yesterdayInDb === false;

  // ── 2. Events count ───────────────────────────────────────────────────────────
  const [eventCount, setEventCount] = useState<number | null>(null);

  useEffect(() => {
    if (!selectedHotel || !monthInfo || !city) { setEventCount(null); return; }
    let cancelled = false;
    const params = new URLSearchParams({
      location: city,
      month:    String(monthInfo.month),
      year:     String(monthInfo.year),
    });
    fetch(`/api/events?${params}`)
      .then(r => r.ok ? r.json() : [])
      .then((data: unknown[]) => { if (!cancelled) setEventCount(data.length); })
      .catch(() => { if (!cancelled) setEventCount(null); });
    return () => { cancelled = true; };
  }, [selectedHotel, city, monthInfo]);

  // ── Assemble action items ─────────────────────────────────────────────────────
  const items = useMemo<ActionItem[]>(() => {
    if (!selectedHotel) return [];

    const result: ActionItem[] = [];

    // 1. Missing yesterday
    if (yesterdayMissing) {
      result.push({
        id:          "missing-report",
        severity:    "red",
        emoji:       "⚠️",
        message:     `Nisi unio izveštaj za ${YESTERDAY_LABEL}`,
        detail:      "Dnevni izveštaj je osnova za sve analize. Unesi ga što pre.",
        actionLabel: "Unesi sada",
        actionHref:  "/unos",
      });
    }

    // 2. Pace alerts
    if (paceForecast?.available) {
      const offTrack = paceForecast.items.filter(i => i.status === "off_track");
      const atRisk   = paceForecast.items.filter(i => i.status === "at_risk");

      for (const item of offTrack.slice(0, 2)) {
        result.push({
          id:       `pace-red-${item.label}`,
          severity: "red",
          emoji:    "📉",
          message:  `${item.label} kritično kasni — projekcija ${item.projectedPct}% targeta`,
          detail:   `Trenutno: ${item.mtdFormatted} • Projekcija: ${item.projectedFormatted} • Target: ${item.targetFormatted}`,
        });
      }
      for (const item of atRisk.slice(0, 1)) {
        result.push({
          id:       `pace-yellow-${item.label}`,
          severity: "yellow",
          emoji:    "📊",
          message:  `${item.label} na granici — projekcija ${item.projectedPct}% targeta`,
          detail:   `Trenutno: ${item.mtdFormatted} • Projekcija: ${item.projectedFormatted} • Target: ${item.targetFormatted}`,
        });
      }
    }

    // 3. Local events
    if (eventCount !== null && eventCount > 0 && monthInfo) {
      result.push({
        id:          "events",
        severity:    "green",
        emoji:       "🎉",
        message:     `${eventCount} ${eventCount === 1 ? "događaj" : "događaja"} ovog meseca — proveri cene`,
        detail:      "Lokalni događaji mogu povećati potražnju. Prilagodi cene da iskoristiš maksimum.",
        actionLabel: "Vidi događaje",
        actionHref:  "/",
      });
    }

    // 4. Monthly target reminders
    if (monthInfo) {
      const now = new Date();
      const isCurrentMonth = now.getFullYear() === monthInfo.year && now.getMonth() + 1 === monthInfo.month;
      if (isCurrentMonth) {
        if (!monthlyTarget) {
          result.push({
            id:          "set-targets",
            severity:    "yellow",
            emoji:       "📋",
            message:     `Mesečni targeti nisu postavljeni`,
            detail:      "Bez targeta nema praćenja napretka — postavi ih odmah.",
            actionLabel: "Postavi targete",
            actionHref:  "/",
          });
        }

        if (monthProgress && monthProgress.daysRemaining <= 7 && monthProgress.daysRemaining > 0 && monthlyTarget) {
          const revenueKPI = kpiData.find(k => k.label === "Ukupan Prihod");
          const revenueGap = revenueKPI && monthlyTarget.revenue_target > 0
            ? monthlyTarget.revenue_target - revenueKPI.rawValue
            : 0;
          if (revenueGap > 0) {
            result.push({
              id:       "end-of-month",
              severity: "yellow",
              emoji:    "📅",
              message:  `${monthProgress.daysRemaining} dana do kraja — još ${Math.round(revenueGap).toLocaleString("sr-RS")} RSD do targeta`,
              detail:   "Kratko vreme do kraja meseca — analiziraj yield opcije.",
            });
          }
        }
      }
    }

    return result
      .sort((a, b) => {
        const order: Record<ActionSeverity, number> = { red: 0, yellow: 1, green: 2 };
        return order[a.severity] - order[b.severity];
      })
      .slice(0, 5);
  }, [
    selectedHotel, yesterdayMissing,
    paceForecast, eventCount,
    monthInfo, monthlyTarget, monthProgress, kpiData,
  ]);

  return { items, ready: true };
}
