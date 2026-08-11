import { supabase, isMissingColumnError } from "./supabaseClient";
import type { ParsedMonthMetrics } from "./dailyReportExcelParse";

// Keeps a complete, queryable record of every uploaded daily report — the raw file plus the FULL
// parse result (every month, every sub-field), independent of which specific fields today's
// features happen to read. This is meant to be a GUARANTEED safety net, not a best-effort nicety —
// a miss here is invisible until someone needs the archive and it isn't there (see the 10-avgust
// incident: on-books saved fine, but the file and the parsed_data row were both silently absent).
// So: never let a failure here block the actual import (daily_reports/onbooks_snapshots), but
// never let it disappear without a trace either — every caller must inspect the returned result
// and surface a warning when either half didn't make it.
//
// Triggered once per file SELECTION (see archiveReportImport below), not once per successful save
// — a file that fails to parse at all previously left nothing archived, which is exactly the case
// most in need of the raw file + error message for diagnosis (see the 10-avgust incident again:
// the fact that a failed attempt leaves no trace is the same class of gap, just at the other end).

const BUCKET = "daily-reports";

function storagePath(hotelId: string, dateISO: string): string {
  return `${hotelId}/${dateISO}.xlsx`;
}

// Uploads the original file, keyed by hotel + the attempted report date — a re-attempt for the
// same date overwrites the previous file, matching how every other table here already treats
// "latest import wins". Returns the storage path on success, or null if the upload failed for any
// reason (bucket not migrated in yet, transient network error) — logged, not thrown, so the caller
// can still attempt saveReportImportArchive below rather than losing the parse outcome too.
export async function archiveReportFile(hotelId: string, dateISO: string, file: File): Promise<string | null> {
  const path = storagePath(hotelId, dateISO);
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: true });
  if (error) {
    console.error("Failed to archive report file (bucket not set up yet?) — import continues without it:", error.message);
    return null;
  }
  return path;
}

// Saves a record of one import ATTEMPT for one report date — the full parse result on success
// (every month, every sub-field), or just the error on failure (parsed_data null, parse_ok false).
// filePath is whatever archiveReportFile returned (null if that step was skipped or failed — still
// worth recording the outcome on its own; the two halves are intentionally independent). Returns
// whether the row was written, so the caller can warn instead of silently losing it. Tolerates the
// parse_ok/parse_error migration not being applied yet, same pattern as upsertOnBooksSnapshotRows
// in supabaseClient.ts — retries once without those two fields rather than losing the row entirely.
export async function saveReportImportArchive(
  hotelId: string,
  dateISO: string,
  months: ParsedMonthMetrics[],
  originalFilename: string | null,
  filePath: string | null,
  parseError: string | null,
): Promise<boolean> {
  const payload: Record<string, unknown> = {
    hotel_id: hotelId,
    report_date: dateISO,
    parsed_data: months.length > 0 ? months : null,
    original_filename: originalFilename,
    file_path: filePath,
    parse_ok: parseError === null,
    parse_error: parseError,
  };
  const first = await supabase.from("report_imports").upsert(payload, { onConflict: "hotel_id,report_date" });
  if (!first.error) return true;
  if (!isMissingColumnError(first.error)) {
    console.error("Failed to save report import archive (migration not applied yet?) — import continues without it:", first.error.message);
    return false;
  }
  console.error("report_imports parse-status columns unavailable (run the latest migration?) — retrying without them:", first.error.message);
  const { parse_ok: _parseOk, parse_error: _parseErrorField, ...withoutStatus } = payload;
  const second = await supabase.from("report_imports").upsert(withoutStatus, { onConflict: "hotel_id,report_date" });
  if (second.error) {
    console.error("Failed to save report import archive (migration not applied yet?) — import continues without it:", second.error.message);
    return false;
  }
  return true;
}

export interface ArchiveOutcome {
  fileArchived: boolean;
  dataArchived: boolean;
}

// Archives one import attempt: the raw file plus a report_imports row describing what happened —
// called once per file SELECTION, regardless of whether it went on to parse successfully, so a
// failed import still leaves the file + the error behind. Never throws — both steps are already
// individually best-effort — but always returns what actually happened, so callers can surface a
// visible warning rather than let a miss go unnoticed. parseError is null for a successful parse
// (months then carries the full result) or the parser's error message for a failed one (months is
// then []).
export async function archiveReportImport(
  hotelId: string,
  dateISO: string,
  file: File | null,
  months: ParsedMonthMetrics[],
  parseError: string | null,
): Promise<ArchiveOutcome> {
  const filePath = file ? await archiveReportFile(hotelId, dateISO, file) : null;
  const dataArchived = await saveReportImportArchive(hotelId, dateISO, months, file?.name ?? null, filePath, parseError);
  return { fileArchived: filePath !== null, dataArchived };
}

// Shared wording for the visible warning every import UI shows when archiving didn't fully
// succeed — null when both halves made it, so callers can just do `if (msg) show(msg)`. Deliberately
// silent on whether the IMPORT itself succeeded (archiving now runs at file-selection time, before
// any save has happened) — this is purely about whether the safety-net copy was kept.
export function describeArchiveMiss(outcome: ArchiveOutcome): string | null {
  if (outcome.fileArchived && outcome.dataArchived) return null;
  if (!outcome.fileArchived && !outcome.dataArchived) {
    return "Arhiviranje fajla nije uspelo — ni fajl ni podaci o uvozu nisu sačuvani u arhivi.";
  }
  if (!outcome.dataArchived) {
    return "Arhiviranje nije potpuno uspelo — podaci o uvozu nisu sačuvani u arhivi (fajl jeste sačuvan).";
  }
  return "Arhiviranje nije potpuno uspelo — originalni fajl nije sačuvan u arhivi (podaci o uvozu jesu sačuvani).";
}
