"use client";

import { useRef, useState } from "react";
import { X, FileSpreadsheet, Upload, AlertCircle, CalendarDays } from "lucide-react";
import { parseReportFile, type ParsedReportRow } from "../lib/reportImport";
import { parseDailyReportExcelForMonth } from "../lib/dailyReportExcelImport";
import { MONTHS_SR } from "../context/HotelContext";

function fmtInt(n: number): string { return Math.round(n).toLocaleString("sr-RS"); }
function fmtRSD(n: number): string { return `${Math.round(n).toLocaleString("sr-RS")} RSD`; }
function fmtPct1(n: number): string { return `${(Math.round(n * 10) / 10).toLocaleString("sr-RS")}%`; }

interface ImportReportModalProps {
  hotel: string;
  /**
   * When provided, the modal is in single-date mode:
   * the date is locked to this value and is never read from the imported file.
   * Only the first parsed row's data is used; any date information in the file
   * is ignored.
   */
  fixedDate?: { dateISO: string; dateLabel: string };
  onConfirm: (rows: ParsedReportRow[]) => Promise<void>;
  onClose: () => void;
}

type Step = "select" | "preview";

export default function ImportReportModal({ hotel, fixedDate, onConfirm, onClose }: ImportReportModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep]                       = useState<Step>("select");
  const [fileName, setFileName]               = useState("");
  const [rows, setRows]                       = useState<ParsedReportRow[]>([]);
  const [matchedHeaders, setMatchedHeaders]   = useState<string[]>([]);
  const [defaultedHeaders, setDefaultedHeaders] = useState<string[]>([]);
  const [unmatchedHeaders, setUnmatchedHeaders] = useState<string[]>([]);
  const [hadMultipleRows, setHadMultipleRows] = useState(false);
  const [error, setError]                     = useState<string | null>(null);
  const [parsing, setParsing]                 = useState(false);
  const [saving, setSaving]                   = useState(false);
  const [dragActive, setDragActive]           = useState(false);
  // Set when the wide "Daily report" monthly sheet was the source — the preview then shows the
  // simple single-metric summary card the format calls for, instead of the generic per-date table.
  const [wideMonthLabel, setWideMonthLabel]   = useState<string | null>(null);

  const isSingleDate = Boolean(fixedDate);

  async function processFile(file: File) {
    setFileName(file.name);
    setParsing(true);
    setError(null);
    setWideMonthLabel(null);

    // Single-date mode: this hotel's real export is the wide "Daily report" sheet (one section per
    // calendar month, no date column at all) — try that layout first and pull just the selected
    // date's month. Only fall back to the generic per-date parser below when the file isn't that
    // format (sheetFound === false); if it IS that format but something's wrong, surface the error
    // instead of silently trying — and likely failing — the generic parser.
    if (isSingleDate && fixedDate) {
      const monthNumber = Number(fixedDate.dateISO.slice(5, 7));
      const wide = await parseDailyReportExcelForMonth(file, monthNumber);
      if (wide.data) {
        setParsing(false);
        setHadMultipleRows(false);
        setRows([{ dateISO: fixedDate.dateISO, dateLabel: fixedDate.dateLabel, data: wide.data }]);
        setMatchedHeaders([]);
        setDefaultedHeaders([]);
        setUnmatchedHeaders([]);
        setWideMonthLabel(`${MONTHS_SR[monthNumber - 1]} ${fixedDate.dateISO.slice(0, 4)}`);
        setStep("preview");
        return;
      }
      if (wide.sheetFound) {
        setParsing(false);
        setError(wide.error);
        return;
      }
      // Not a "Daily report" workbook — fall through to the generic per-date parser.
    }

    const result = await parseReportFile(file);
    setParsing(false);

    if (result.error && result.rows.length === 0) {
      setError(result.error);
      return;
    }

    let finalRows = result.rows;

    // Single-date mode: override the parsed date with the calendar-selected date,
    // and use only the first row (the file's date is irrelevant).
    if (isSingleDate && fixedDate) {
      setHadMultipleRows(finalRows.length > 1);
      finalRows = finalRows.slice(0, 1).map(r => ({
        ...r,
        dateISO:   fixedDate.dateISO,
        dateLabel: fixedDate.dateLabel,
      }));
    } else {
      setHadMultipleRows(false);
    }

    setRows(finalRows);
    setMatchedHeaders(result.matchedHeaders);
    setDefaultedHeaders(result.defaultedColumnHeaders);
    setUnmatchedHeaders(result.unmatchedHeaders);
    setStep("preview");
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    processFile(file);
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragActive(false);
    if (parsing) return;
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  }

  function handleDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    if (!dragActive) setDragActive(true);
  }

  function handleDragLeave(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragActive(false);
  }

  async function handleConfirm() {
    setSaving(true);
    await onConfirm(rows);
    setSaving(false);
  }

  function resetToSelect() {
    setStep("select");
    setRows([]);
    setError(null);
    setHadMultipleRows(false);
    setWideMonthLabel(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(17,24,39,0.4)", backdropFilter: "blur(3px)" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-screen h-screen md:w-[92vw] md:max-w-[820px] md:h-auto md:max-h-[88vh] rounded-none md:rounded-2xl flex flex-col"
        style={{ background: "#ffffff", border: "1px solid #e5e7eb", boxShadow: "0 24px 64px rgba(0,0,0,0.12)" }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 pt-5 pb-4"
          style={{ borderBottom: "1px solid #f3f4f6", flexShrink: 0 }}
        >
          <div className="flex items-center gap-3">
            <div
              className="rounded-xl flex items-center justify-center"
              style={{ width: 40, height: 40, background: "rgba(201,168,76,0.08)", border: "1px solid rgba(201,168,76,0.2)" }}
            >
              <FileSpreadsheet size={20} color="#C9A84C" />
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#111827" }}>Uvezi izveštaj</div>
              <div style={{ fontSize: 12, color: "#9ca3af" }}>{hotel}</div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex items-center justify-center rounded-lg"
            style={{ width: 32, height: 32, background: "#f9fafb", border: "1px solid #e5e7eb", cursor: "pointer" }}
          >
            <X size={15} color="#6b7280" />
          </button>
        </div>

        {/* Fixed-date banner — shown in single-date mode */}
        {isSingleDate && fixedDate && (
          <div
            className="flex items-center gap-2 mx-6 mt-4 rounded-lg"
            style={{ padding: "10px 14px", background: "rgba(201,168,76,0.06)", border: "1px solid rgba(201,168,76,0.25)" }}
          >
            <CalendarDays size={15} color="#C9A84C" style={{ flexShrink: 0 }} />
            <div style={{ fontSize: 13, color: "#111827" }}>
              <strong>Uvoz izveštaja za: {fixedDate.dateLabel}</strong>
            </div>
            <div style={{ fontSize: 11, color: "#9ca3af", marginLeft: "auto" }}>
              Datum je zaključan
            </div>
          </div>
        )}

        {/* Body */}
        <div className="px-6 py-5 flex-1 overflow-y-auto" style={{ minHeight: 0 }}>
          {step === "select" && (
            <div className="flex flex-col items-center" style={{ minHeight: 260 }}>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileChange}
                style={{ display: "none" }}
              />
              <div
                onClick={() => !parsing && fileInputRef.current?.click()}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                className="flex flex-col items-center justify-center w-full rounded-2xl"
                style={{
                  minHeight: 260, padding: "32px 20px",
                  border: `2px dashed ${dragActive ? "#C9A84C" : "#d1d5db"}`,
                  background: dragActive ? "rgba(201,168,76,0.06)" : "#fafafa",
                  cursor: parsing ? "default" : "pointer",
                  transition: "border-color 0.15s, background 0.15s",
                }}
              >
                <div
                  className="rounded-xl flex items-center justify-center mb-4"
                  style={{ width: 64, height: 64, background: "rgba(201,168,76,0.08)", border: "1px solid rgba(201,168,76,0.2)" }}
                >
                  <Upload size={28} color="#C9A84C" />
                </div>
                <div style={{ fontSize: 16, fontWeight: 700, color: "#111827", marginBottom: 6 }}>
                  {parsing ? "Učitavanje fajla..." : "Prevucite fajl ovde ili kliknite da izaberete"}
                </div>
                <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 18, textAlign: "center", maxWidth: 440 }}>
                  {isSingleDate
                    ? "Podaci iz fajla biće uvezeni za odabrani datum. Datum u fajlu se ignoriše."
                    : "Fajl treba da sadrži kolonu sa datumom i kolone za Broj Noćenja, Ukupan Prihod, ADR, Popunjenost, RevPAR, Prošlu godinu, Isti dan prošle godine, Na knjigama juče/danas i Target."}
                </div>
                <button
                  onClick={e => { e.stopPropagation(); fileInputRef.current?.click(); }}
                  disabled={parsing}
                  style={{
                    height: 40, paddingLeft: 22, paddingRight: 22, borderRadius: 8,
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
                <div style={{ fontSize: 11, color: "#d1d5db", marginTop: 14 }}>
                  Podržani formati: .xlsx, .xls, .csv
                </div>
              </div>

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

          {step === "preview" && wideMonthLabel && rows.length > 0 && (
            <div className="flex flex-col gap-4">
              <div style={{ fontSize: 13, color: "#374151" }}>
                <strong>{fileName}</strong> — podaci pronađeni u listu &quot;Daily report&quot;.
              </div>

              <div
                className="rounded-2xl"
                style={{ border: "1.5px solid rgba(201,168,76,0.3)", background: "rgba(201,168,76,0.04)", padding: "20px 24px" }}
              >
                <div style={{ fontSize: 14, fontWeight: 700, color: "#92400e", marginBottom: 14 }}>
                  Pronađeni podaci za {wideMonthLabel}:
                </div>
                <div className="flex flex-col gap-2.5">
                  {[
                    { label: "Noćenja",     value: fmtInt(rows[0].data.brojNocenja.naKnjigamaDanas) },
                    { label: "Prihod",      value: fmtRSD(rows[0].data.ukupanPrihod.naKnjigamaDanas) },
                    { label: "ADR",         value: fmtRSD(rows[0].data.adr.naKnjigamaDanas) },
                    { label: "Popunjenost", value: fmtPct1(rows[0].data.popunjenost.naKnjigamaDanas) },
                    { label: "RevPAR",      value: fmtRSD(rows[0].data.revpar.naKnjigamaDanas) },
                  ].map(({ label, value }) => (
                    <div
                      key={label}
                      className="flex items-center justify-between"
                      style={{ padding: "6px 0", borderBottom: "1px solid rgba(201,168,76,0.15)" }}
                    >
                      <span style={{ fontSize: 13, color: "#6b7280" }}>{label}</span>
                      <span style={{ fontSize: 15, fontWeight: 700, color: "#111827" }}>{value}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ fontSize: 12, color: "#9ca3af" }}>
                Podaci će biti sačuvani za <strong>{fixedDate?.dateLabel}</strong>. Target vrednosti iz fajla biće postavljene kao mesečni target, ako još nije postavljen.
              </div>
            </div>
          )}

          {step === "preview" && !wideMonthLabel && (
            <div className="flex flex-col gap-4">
              {/* File summary */}
              <div style={{ fontSize: 13, color: "#374151" }}>
                <strong>{fileName}</strong>
                {isSingleDate
                  ? " — podaci će biti uvezeni za odabrani datum."
                  : ` — pronađeno ${rows.length} ${rows.length === 1 ? "dan" : "dana"} sa podacima.`}
              </div>

              {/* Single-date: warn if file had multiple rows */}
              {isSingleDate && hadMultipleRows && (
                <div
                  className="flex items-start gap-2 rounded-lg"
                  style={{ padding: "10px 12px", background: "rgba(234,179,8,0.06)", border: "1px solid rgba(234,179,8,0.2)" }}
                >
                  <AlertCircle size={15} color="#ca8a04" style={{ flexShrink: 0, marginTop: 1 }} />
                  <span style={{ fontSize: 12, color: "#92400e" }}>
                    Fajl sadrži više redova sa podacima. Biće uvežen samo <strong>prvi red</strong>, za datum {fixedDate?.dateLabel}.
                  </span>
                </div>
              )}

              {defaultedHeaders.length > 0 && (
                <div
                  className="rounded-lg"
                  style={{ padding: "10px 12px", background: "rgba(234,179,8,0.06)", border: "1px solid rgba(234,179,8,0.2)" }}
                >
                  <div style={{ fontSize: 12, color: "#92400e" }}>
                    Sledeće kolone su prepoznate delimično, pa su raspoređene po pretpostavci:{" "}
                    <strong>{defaultedHeaders.join(", ")}</strong>
                  </div>
                </div>
              )}

              {unmatchedHeaders.length > 0 && (
                <div
                  className="rounded-lg"
                  style={{ padding: "10px 12px", background: "#f9fafb", border: "1px solid #e5e7eb" }}
                >
                  <div style={{ fontSize: 12, color: "#6b7280" }}>
                    Nepoznate kolone (preskočene): <strong>{unmatchedHeaders.join(", ")}</strong>
                  </div>
                </div>
              )}

              <div style={{ overflowX: "auto", border: "1px solid #e5e7eb", borderRadius: 10 }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "#f9fafb" }}>
                      {["Datum", "Broj Noćenja", "Ukupan Prihod", "ADR", "Popunjenost %", "RevPAR"].map(h => (
                        <th
                          key={h}
                          style={{
                            padding: "8px 10px", textAlign: "left",
                            fontSize: 10, fontWeight: 600, color: "#9ca3af",
                            letterSpacing: "0.05em", textTransform: "uppercase",
                            whiteSpace: "nowrap", borderBottom: "1px solid #e5e7eb",
                          }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(row => (
                      <tr key={row.dateISO} style={{ borderBottom: "1px solid #f3f4f6" }}>
                        <td style={{ padding: "7px 10px", fontSize: 12, color: "#374151", whiteSpace: "nowrap", fontWeight: 600 }}>
                          {row.dateLabel}
                          {isSingleDate && (
                            <span style={{ marginLeft: 6, fontSize: 10, color: "#C9A84C", fontWeight: 500 }}>← zaključano</span>
                          )}
                        </td>
                        <td style={{ padding: "7px 10px", fontSize: 12, color: "#374151" }}>
                          {row.data.brojNocenja.naKnjigamaDanas.toLocaleString("sr-RS")}
                        </td>
                        <td style={{ padding: "7px 10px", fontSize: 12, color: "#374151" }}>
                          {Math.round(row.data.ukupanPrihod.naKnjigamaDanas).toLocaleString("sr-RS")} RSD
                        </td>
                        <td style={{ padding: "7px 10px", fontSize: 12, color: "#374151" }}>
                          {Math.round(row.data.adr.naKnjigamaDanas).toLocaleString("sr-RS")} RSD
                        </td>
                        <td style={{ padding: "7px 10px", fontSize: 12, color: "#374151" }}>
                          {row.data.popunjenost.naKnjigamaDanas.toLocaleString("sr-RS")}%
                        </td>
                        <td style={{ padding: "7px 10px", fontSize: 12, color: "#374151" }}>
                          {Math.round(row.data.revpar.naKnjigamaDanas).toLocaleString("sr-RS")} RSD
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-end gap-3 px-6 pb-5 pt-1"
          style={{ flexShrink: 0, borderTop: "1px solid #f3f4f6" }}
        >
          {step === "preview" && (
            <button
              onClick={resetToSelect}
              disabled={saving}
              style={{
                height: 38, paddingLeft: 16, paddingRight: 16, borderRadius: 8,
                border: "1px solid #e5e7eb", background: "#f9fafb",
                color: "#374151", fontSize: 13, fontWeight: 500,
                cursor: saving ? "default" : "pointer",
              }}
            >
              Izaberi drugi fajl
            </button>
          )}
          <button
            onClick={onClose}
            disabled={saving}
            style={{
              height: 38, paddingLeft: 16, paddingRight: 16, borderRadius: 8,
              border: "1px solid #e5e7eb", background: "#f9fafb",
              color: "#374151", fontSize: 13, fontWeight: 500,
              cursor: saving ? "default" : "pointer",
            }}
          >
            Otkaži
          </button>
          {step === "preview" && (
            <button
              onClick={handleConfirm}
              disabled={saving || rows.length === 0}
              style={{
                height: 38, paddingLeft: 20, paddingRight: 20, borderRadius: 8,
                border: "none",
                background: "linear-gradient(135deg, #C9A84C 0%, #E8C96B 100%)",
                color: "#ffffff", fontSize: 13, fontWeight: 600,
                cursor: saving ? "default" : "pointer",
                boxShadow: "0 2px 8px rgba(201,168,76,0.3)",
                opacity: saving ? 0.7 : 1,
              }}
            >
              {saving
                ? "Čuvanje..."
                : isSingleDate
                  ? `Sačuvaj za ${fixedDate?.dateLabel}`
                  : `Sačuvaj ${rows.length} ${rows.length === 1 ? "dan" : "dana"}`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
