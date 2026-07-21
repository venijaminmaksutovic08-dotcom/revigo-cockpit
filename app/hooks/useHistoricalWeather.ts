"use client";

import { useEffect, useState } from "react";
import { resolveCoords } from "./useWeatherForecast";

export interface HistoricalWeatherSummary {
  avgTempMax: number;
  avgTempMin: number;
  totalPrecipitation: number;
  badWeatherDays: number;
  dominantEmoji: string;
  dominantLabel: string;
}

export type HistoricalWeatherStatus = "idle" | "loading" | "ok" | "error";

function weatherInfo(code: number): { emoji: string; label: string } {
  if (code <= 1)                return { emoji: "☀️",  label: "Sunčano" };
  if (code <= 3)                return { emoji: "⛅",  label: "Oblačno" };
  if (code >= 45 && code <= 48) return { emoji: "🌫️", label: "Magla" };
  if (code >= 51 && code <= 67) return { emoji: "🌧️", label: "Kiša" };
  if (code >= 71 && code <= 77) return { emoji: "❄️",  label: "Sneg" };
  if (code >= 80 && code <= 82) return { emoji: "🌦️", label: "Pljuskovi" };
  if (code >= 85 && code <= 86) return { emoji: "🌨️", label: "Snežni pljuskovi" };
  if (code >= 95)               return { emoji: "⛈️",  label: "Grmljavina" };
  return { emoji: "🌡️", label: "Promenljivo" };
}

// Summarizes actual historical daily weather (Open-Meteo Archive API) over a date range into a
// single at-a-glance reading — a full day-by-day grid doesn't fit for a whole month, so this
// mirrors useWeatherForecast's per-day fields but pre-aggregated (avg temps, total precipitation,
// most frequent condition) for the same emoji + temp + precipitation format the forecast uses.
export function useHistoricalWeather(
  city: string,
  startISO: string,
  endISO: string
): { status: HistoricalWeatherStatus; summary: HistoricalWeatherSummary | null; locLabel: string } {
  const [status, setStatus] = useState<HistoricalWeatherStatus>("idle");
  const [summary, setSummary] = useState<HistoricalWeatherSummary | null>(null);
  const [locLabel, setLocLabel] = useState("");

  useEffect(() => {
    if (!city || !startISO || !endISO) { setStatus("idle"); setSummary(null); return; }

    const { lat, lon, label } = resolveCoords(city);
    setLocLabel(label);
    setStatus("loading");
    let cancelled = false;

    (async () => {
      try {
        const url =
          `https://archive-api.open-meteo.com/v1/archive` +
          `?latitude=${lat}&longitude=${lon}` +
          `&start_date=${startISO}&end_date=${endISO}` +
          `&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weathercode` +
          `&timezone=Europe%2FBelgrade`;

        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json() as {
          daily: {
            time: string[];
            temperature_2m_max: number[];
            temperature_2m_min: number[];
            precipitation_sum: number[];
            weathercode: number[];
          };
        };
        if (cancelled) return;

        const n = json.daily.time.length;
        if (n === 0) { setSummary(null); setStatus("ok"); return; }

        let sumMax = 0, sumMin = 0, sumPrecip = 0, badDays = 0;
        const codeCounts: Record<number, number> = {};
        for (let i = 0; i < n; i++) {
          sumMax += json.daily.temperature_2m_max[i];
          sumMin += json.daily.temperature_2m_min[i];
          const precip = json.daily.precipitation_sum[i];
          sumPrecip += precip;
          const code = json.daily.weathercode[i];
          codeCounts[code] = (codeCounts[code] ?? 0) + 1;
          if (precip > 5 || code >= 80) badDays++;
        }
        const dominantCode = Number(
          Object.entries(codeCounts).sort((a, b) => b[1] - a[1])[0][0]
        );
        const { emoji, label: codeLabel } = weatherInfo(dominantCode);

        setSummary({
          avgTempMax: Math.round(sumMax / n),
          avgTempMin: Math.round(sumMin / n),
          totalPrecipitation: Math.round(sumPrecip * 10) / 10,
          badWeatherDays: badDays,
          dominantEmoji: emoji,
          dominantLabel: codeLabel,
        });
        setStatus("ok");
      } catch {
        if (!cancelled) setStatus("error");
      }
    })();

    return () => { cancelled = true; };
  }, [city, startISO, endISO]);

  return { status, summary, locLabel };
}
