"use client";

import { useRef, useState } from "react";
import { X, FileSpreadsheet, Upload, AlertCircle, CheckCircle2, CalendarClock, CalendarRange, Layers } from "lucide-react";
import { parseDailyReportExcel, type ParsedMonthMetrics } from "../lib/dailyReportExcelImport";
import { importOnBooksMonths, importActualsMonths } from "../lib/dashboardData";

interface ExcelImportModalProps {
  hotelId: string;
  hotelName: string;
  onImported: () => void;
  onClose: () => void;
}

type Step = "upload" | "selectMode" | "importing" | "done";
type ImportMode = "onbooks" | "actuals" | "all";

const MODE_OPTIONS: { mode: ImportMode; emoji: string; label: string; subtitle: string }[] = [
  { mode: "onbooks", emoji: "📊", label: "On-Books podatke", subtitle: "Buduće rezervacije (avgust, septembar...)" },
  { mode: "actuals", emoji: "📅", label: "Actuals (prošli meseci)", subtitle: "Stvarni rezultati (januar-jun...)" },
  { mode: "all", emoji: "✅", label: "Sve podatke", subtitle: "On-Books i Actuals zajedno" },
];

export default function ExcelImportModal({ hotelId, hotelName, onImported, onClose }: ExcelImportModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>("upload");
  const [fileName, setFileName] = useState("");
  const [months, setMonths] = useState<ParsedMonthMetrics[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);
  const [importingMode, setImportingMode] = useState<ImportMode | null>(null);
  const [resultCount, setResultCount] = useState(0);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setParsing(true);
    setError(null);

    let result;
    try {
      result = await parseDailyReportExcel(file);
    } catch {
      setParsing(false);
      setError("Došlo je do greške prilikom čitanja fajla. Pokušajte ponovo.");
      return;
    }
    setParsing(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    setMonths(result.months);
    setStep("selectMode");
  }

  async function handleSelectMode(mode: ImportMode) {
    setImportingMode(mode);
    setStep("importing");

    let count = 0;
    try {
      if (mode === "onbooks") {
        count = await importOnBooksMonths(hotelId, months);
      } else if (mode === "actuals") {
        count = await importActualsMonths(hotelId, months);
      } else {
        const [onBooksCount, actualsCount] = await Promise.all([
          importOnBooksMonths(hotelId, months),
          importActualsMonths(hotelId, months),
        ]);
        count = onBooksCount + actualsCount;
      }
      setResultCount(count);
      setStep("done");
      onImported();
    } catch {
      setError("Došlo je do greške prilikom uvoza podataka. Pokušajte ponovo.");
      setStep("selectMode");
    }
  }

  function resetToUpload() {
    setStep("upload");
    setMonths([]);
    setError(null);
    setFileName("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(17,24,39,0.4)", backdropFilter: "blur(3px)" }}
      onClick={e => { if (e.target === e.currentTarget && step !== "importing") onClose(); }}
    >
      <div
        className="w-screen h-screen md:w-[92vw] md:max-w-[640px] md:h-auto md:max-h-[88vh] rounded-none md:rounded-2xl flex flex-col"
        style={{ background: "#ffffff", border: "1px solid #e5e7eb", boxShadow: "0 24px 64px rgba(0,0,0,0.12)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4" style={{ borderBottom: "1px solid #f3f4f6", flexShrink: 0 }}>
          <div className="flex items-center gap-3">
            <div
              className="rounded-xl flex items-center justify-center"
              style={{ width: 40, height: 40, background: "rgba(201,168,76,0.08)", border: "1px solid rgba(201,168,76,0.2)" }}
            >
              <FileSpreadsheet size={20} color="#C9A84C" />
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#111827" }}>Uvezi izveštaj</div>
              <div style={{ fontSize: 12, color: "#9ca3af" }}>{hotelName}</div>
            </div>
          </div>
          {step !== "importing" && (
            <button
              onClick={onClose}
              className="flex items-center justify-center rounded-lg"
              style={{ width: 32, height: 32, background: "#f9fafb", border: "1px solid #e5e7eb", cursor: "pointer" }}
            >
              <X size={15} color="#6b7280" />
            </button>
          )}
        </div>

        {/* Body */}
        <div className="px-6 py-5 flex-1 overflow-y-auto" style={{ minHeight: 0 }}>
          {step === "upload" && (
            <div className="flex flex-col items-center justify-center" style={{ minHeight: 260 }}>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx"
                onChange={handleFileChange}
                style={{ display: "none" }}
              />
              <div
                className="rounded-xl flex items-center justify-center mb-4"
                style={{ width: 56, height: 56, background: "#f9fafb", border: "1px solid #e5e7eb" }}
              >
                <Upload size={24} color="#9ca3af" />
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#374151", marginBottom: 4 }}>
                {parsing ? "Učitavanje fajla..." : "Izaberite Excel (.xlsx) fajl"}
              </div>
              <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 16, textAlign: "center", maxWidth: 420 }}>
                Fajl treba da sadrži list &quot;Daily report&quot; sa mesečnim pregledom (Room Nights, Revenue, ADR, % Occ., RevPAR)
                i kolonama Total Last Year, Same Day Last Year, Today i Target.
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={parsing}
                style={{
                  height: 38, paddingLeft: 20, paddingRight: 20, borderRadius: 8,
                  border: "none",
                  background: "linear-gradient(135deg, #C9A84C 0%, #E8C96B 100%)",
                  color: "#ffffff", fontSize: 13, fontWeight: 600,
                  cursor: parsing ? "default" : "pointer",
                  boxShadow: "0 2px 8px rgba(201,168,76,0.3)",
                  opacity: parsing ? 0.7 : 1,
                }}
              >
                {parsing ? "Učitavanje..." : "Izaberi fajl"}
              </button>

              {error && (
                <div
                  className="flex items-start gap-2 rounded-lg mt-5"
                  style={{ padding: "10px 12px", background: "rgba(220,38,38,0.06)", border: "1px solid rgba(220,38,38,0.2)", maxWidth: 460 }}
                >
                  <AlertCircle size={15} color="#dc2626" style={{ flexShrink: 0, marginTop: 1 }} />
                  <span style={{ fontSize: 12, color: "#991b1b" }}>{error}</span>
                </div>
              )}
            </div>
          )}

          {step === "selectMode" && (
            <div className="flex flex-col gap-4">
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: "#111827", marginBottom: 4 }}>Fajl učitan uspešno</div>
                <div style={{ fontSize: 13, color: "#9ca3af" }}>{fileName} — Odaberite šta želite da uvezete</div>
              </div>

              {error && (
                <div
                  className="flex items-start gap-2 rounded-lg"
                  style={{ padding: "10px 12px", background: "rgba(220,38,38,0.06)", border: "1px solid rgba(220,38,38,0.2)" }}
                >
                  <AlertCircle size={15} color="#dc2626" style={{ flexShrink: 0, marginTop: 1 }} />
                  <span style={{ fontSize: 12, color: "#991b1b" }}>{error}</span>
                </div>
              )}

              <div className="flex flex-col gap-3">
                {MODE_OPTIONS.map(opt => (
                  <button
                    key={opt.mode}
                    onClick={() => handleSelectMode(opt.mode)}
                    className="flex items-center gap-3 text-left"
                    style={{
                      padding: "16px 18px", borderRadius: 12,
                      border: "1px solid #e5e7eb", background: "#f9fafb",
                      cursor: "pointer", transition: "border-color 0.15s, background 0.15s",
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = "#C9A84C"; e.currentTarget.style.background = "rgba(201,168,76,0.06)"; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = "#e5e7eb"; e.currentTarget.style.background = "#f9fafb"; }}
                  >
                    <span style={{ fontSize: 24, lineHeight: 1 }}>{opt.emoji}</span>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>{opt.label}</div>
                      <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 2 }}>{opt.subtitle}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === "importing" && (
            <div className="flex flex-col items-center justify-center" style={{ minHeight: 260 }}>
              <div
                className="rounded-xl flex items-center justify-center mb-4"
                style={{ width: 56, height: 56, background: "rgba(201,168,76,0.08)", border: "1px solid rgba(201,168,76,0.2)" }}
              >
                {importingMode === "onbooks" && <CalendarRange size={24} color="#C9A84C" />}
                {importingMode === "actuals" && <CalendarClock size={24} color="#C9A84C" />}
                {importingMode === "all" && <Layers size={24} color="#C9A84C" />}
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#374151" }}>Uvoz u toku...</div>
            </div>
          )}

          {step === "done" && (
            <div className="flex flex-col items-center justify-center" style={{ minHeight: 260 }}>
              <div
                className="rounded-xl flex items-center justify-center mb-4"
                style={{ width: 56, height: 56, background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)" }}
              >
                <CheckCircle2 size={26} color="#16a34a" />
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#111827", marginBottom: 4 }}>
                Uvoz završen — {resultCount} {resultCount === 1 ? "mesec" : "meseci"} uvezeno
              </div>
              <div style={{ fontSize: 12, color: "#9ca3af" }}>Podaci na dashboard-u su osveženi.</div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-end gap-3 px-6 pb-5 pt-1"
          style={{ flexShrink: 0, borderTop: "1px solid #f3f4f6" }}
        >
          {step === "selectMode" && (
            <button
              onClick={resetToUpload}
              style={{
                height: 38, paddingLeft: 16, paddingRight: 16, borderRadius: 8,
                border: "1px solid #e5e7eb", background: "#f9fafb",
                color: "#374151", fontSize: 13, fontWeight: 500, cursor: "pointer",
              }}
            >
              Izaberi drugi fajl
            </button>
          )}
          {step !== "importing" && (
            <button
              onClick={onClose}
              style={{
                height: 38, paddingLeft: 16, paddingRight: 16, borderRadius: 8,
                border: "1px solid #e5e7eb", background: "#f9fafb",
                color: "#374151", fontSize: 13, fontWeight: 500, cursor: "pointer",
              }}
            >
              {step === "done" ? "Zatvori" : "Otkaži"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
