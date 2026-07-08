"use client";

import { CloudSun, AlertTriangle } from "lucide-react";
import { useHotel } from "../context/HotelContext";
import { useWeatherForecast } from "../hooks/useWeatherForecast";

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

export default function WeatherWidget() {
  const { hotels, selectedHotel } = useHotel();
  const hotel = hotels.find(h => h.id === selectedHotel) ?? null;
  const city  = hotel?.city ?? "";

  const { status, days, locLabel } = useWeatherForecast(city);

  if (!city || status === "idle") return null;

  const hasBadWeather = days.some(d => d.precipitation > 5 || d.weatherCode >= 80);

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
            <CloudSun size={18} color="#C9A84C" />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>Vremenska Prognoza</div>
            <div style={{ fontSize: 11, color: "#9ca3af" }}>
              {locLabel ? `${locLabel} · ` : ""}7 dana
            </div>
          </div>
        </div>
        <div style={{ fontSize: 11, color: "#9ca3af" }}>Open-Meteo</div>
      </div>

      {status === "loading" && (
        <div className="flex items-center justify-center py-8">
          <span style={{ fontSize: 12, color: "#9ca3af" }}>Učitavanje prognoze…</span>
        </div>
      )}

      {status === "error" && (
        <div className="flex items-center justify-center gap-2 py-8">
          <AlertTriangle size={14} color="#dc2626" />
          <span style={{ fontSize: 12, color: "#dc2626" }}>Nije moguće učitati vremensku prognozu.</span>
        </div>
      )}

      {status === "ok" && (
        <>
          <div className="grid grid-cols-7" style={{ padding: "12px 12px 8px" }}>
            {days.map((day, i) => {
              const { emoji, label } = weatherInfo(day.weatherCode);
              const isToday = i === 0;
              const isBad   = day.precipitation > 5 || day.weatherCode >= 80;

              return (
                <div
                  key={day.date}
                  className="flex flex-col items-center"
                  style={{
                    padding: "10px 4px",
                    borderRadius: 10,
                    background: isToday ? "rgba(201,168,76,0.06)" : isBad ? "rgba(239,68,68,0.04)" : "transparent",
                    border: isToday ? "1px solid rgba(201,168,76,0.2)" : "1px solid transparent",
                  }}
                >
                  <div style={{ fontSize: 11, fontWeight: isToday ? 700 : 500, color: isToday ? "#C9A84C" : "#9ca3af", marginBottom: 4 }}>
                    {isToday ? "Danas" : day.dayLabel}
                  </div>
                  <div style={{ fontSize: 22, lineHeight: 1, marginBottom: 4 }} title={label}>{emoji}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>{day.tempMax}°</div>
                  <div style={{ fontSize: 11, color: "#9ca3af" }}>{day.tempMin}°</div>
                  {day.precipitation > 0 && (
                    <div style={{ fontSize: 10, marginTop: 3, fontWeight: day.precipitation > 5 ? 600 : 400, color: day.precipitation > 5 ? "#2563eb" : "#9ca3af" }}>
                      {day.precipitation}mm
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {hasBadWeather && (
            <div
              className="flex items-start gap-2 mx-4 mb-4 rounded-lg"
              style={{ padding: "8px 12px", background: "rgba(234,179,8,0.06)", border: "1px solid rgba(234,179,8,0.2)" }}
            >
              <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>💡</span>
              <span style={{ fontSize: 12, color: "#92400e", lineHeight: 1.6 }}>
                Loše vreme može uticati na popunjenost — razmotriti prilagođavanje cena
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
