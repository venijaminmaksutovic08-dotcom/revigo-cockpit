"use client";

import { useEffect, useState } from "react";

export const CITY_COORDS: { keywords: string[]; lat: number; lon: number; label: string }[] = [
  { keywords: ["zlatibor"],             lat: 43.7322, lon: 19.7106, label: "Zlatibor" },
  { keywords: ["beograd", "belgrade"],  lat: 44.8176, lon: 20.4633, label: "Beograd" },
  { keywords: ["novi sad", "novisad"],  lat: 45.2671, lon: 19.8335, label: "Novi Sad" },
  { keywords: ["niš", "nis"],           lat: 43.3209, lon: 21.8954, label: "Niš" },
  { keywords: ["kragujevac"],           lat: 44.0128, lon: 20.9114, label: "Kragujevac" },
  { keywords: ["subotica"],             lat: 46.1006, lon: 19.6674, label: "Subotica" },
  { keywords: ["kopaonik"],             lat: 43.2783, lon: 20.8076, label: "Kopaonik" },
  { keywords: ["vrnjačka", "vrnjacka"], lat: 43.6222, lon: 20.8933, label: "Vrnjačka Banja" },
  { keywords: ["sokobanja", "soko"],    lat: 43.6440, lon: 21.8680, label: "Sokobanja" },
  { keywords: ["palić", "palic"],       lat: 46.1006, lon: 19.7564, label: "Palić" },
];

export function resolveCoords(city: string): { lat: number; lon: number; label: string } {
  const norm = city.toLowerCase().trim();
  for (const entry of CITY_COORDS) {
    if (entry.keywords.some(kw => norm.includes(kw))) {
      return { lat: entry.lat, lon: entry.lon, label: entry.label };
    }
  }
  return { lat: 44.8176, lon: 20.4633, label: city };
}

export const DAYS_SR = ["Ned", "Pon", "Uto", "Sre", "Čet", "Pet", "Sub"];

export interface DayForecast {
  date: string;
  dayLabel: string;
  tempMax: number;
  tempMin: number;
  precipitation: number;
  weatherCode: number;
}

export type WeatherStatus = "idle" | "loading" | "ok" | "error";

export function useWeatherForecast(city: string): { status: WeatherStatus; days: DayForecast[]; locLabel: string } {
  const [status, setStatus]     = useState<WeatherStatus>("idle");
  const [days, setDays]         = useState<DayForecast[]>([]);
  const [locLabel, setLocLabel] = useState("");

  useEffect(() => {
    if (!city) { setStatus("idle"); setDays([]); return; }

    const { lat, lon, label } = resolveCoords(city);
    setLocLabel(label);
    setStatus("loading");
    let cancelled = false;

    (async () => {
      try {
        const url =
          `https://api.open-meteo.com/v1/forecast` +
          `?latitude=${lat}&longitude=${lon}` +
          `&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weathercode` +
          `&timezone=Europe%2FBelgrade&forecast_days=7`;

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

        const parsed: DayForecast[] = json.daily.time.map((date, i) => ({
          date,
          dayLabel: DAYS_SR[new Date(`${date}T00:00:00`).getDay()],
          tempMax: Math.round(json.daily.temperature_2m_max[i]),
          tempMin: Math.round(json.daily.temperature_2m_min[i]),
          precipitation: Math.round(json.daily.precipitation_sum[i] * 10) / 10,
          weatherCode: json.daily.weathercode[i],
        }));

        setDays(parsed);
        setStatus("ok");
      } catch {
        if (!cancelled) setStatus("error");
      }
    })();

    return () => { cancelled = true; };
  }, [city]);

  return { status, days, locLabel };
}
