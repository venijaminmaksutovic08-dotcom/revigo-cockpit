"use client";

import { useState, useEffect, useRef } from "react";
import { NotebookPen } from "lucide-react";
import { useHotel } from "../context/HotelContext";

export default function ManagerNotes() {
  const { monthlyTarget, saveNotes, selectedHotel, selectedPeriod } = useHotel();
  const [text, setText] = useState(monthlyTarget?.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync local state when the target row changes (different hotel/period selected)
  useEffect(() => {
    setText(monthlyTarget?.notes ?? "");
  }, [monthlyTarget, selectedHotel, selectedPeriod]);

  async function handleBlur() {
    const current = monthlyTarget?.notes ?? null;
    if (text === (current ?? "")) return; // no change
    setSaving(true);
    await saveNotes(text);
    setSaving(false);
    setSaved(true);
    if (savedTimer.current) clearTimeout(savedTimer.current);
    savedTimer.current = setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="rounded-xl mb-5" style={{ background: "#ffffff", border: "1px solid #e5e7eb", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
      <div className="flex items-center justify-between px-5 pt-4 pb-3" style={{ borderBottom: "1px solid #f3f4f6" }}>
        <div className="flex items-center gap-3">
          <div
            className="rounded-xl flex items-center justify-center"
            style={{ width: 36, height: 36, background: "rgba(201,168,76,0.08)", border: "1px solid rgba(201,168,76,0.2)" }}
          >
            <NotebookPen size={18} color="#C9A84C" />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>Napomene revenue menadžera za ovaj period</div>
            <div style={{ fontSize: 11, color: "#9ca3af" }}>Kontekst koji matematika ne može da zna</div>
          </div>
        </div>
        <div style={{ fontSize: 11, color: saving ? "#9ca3af" : saved ? "#16a34a" : "transparent", transition: "color 0.2s" }}>
          {saving ? "Čuvanje..." : "Sačuvano ✓"}
        </div>
      </div>

      <div className="px-5 py-4">
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          onBlur={handleBlur}
          placeholder="Zlatibor Ultra Trail 12–13 jul, školski raspust, renovacija konkurencije, sajam u gradu..."
          rows={3}
          style={{
            width: "100%",
            borderRadius: 8,
            border: "1px solid #e5e7eb",
            padding: "10px 12px",
            fontSize: 13,
            color: "#111827",
            background: "#fafafa",
            resize: "vertical",
            outline: "none",
            lineHeight: 1.6,
            fontFamily: "inherit",
            transition: "border-color 0.15s",
          }}
          onFocus={e => { e.currentTarget.style.borderColor = "#C9A84C"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(201,168,76,0.1)"; }}
          onBlurCapture={e => { e.currentTarget.style.borderColor = "#e5e7eb"; e.currentTarget.style.boxShadow = "none"; }}
        />
        <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 6 }}>
          Automatski se čuva pri gubitku fokusa · Vidljivo samo za ovaj period
        </div>
      </div>
    </div>
  );
}
