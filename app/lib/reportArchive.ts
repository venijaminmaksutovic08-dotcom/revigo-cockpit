import { supabase } from "./supabaseClient";
import type { ParsedMonthMetrics } from "./dailyReportExcelParse";

// Keeps a complete, queryable record of every uploaded daily report — the raw file plus the FULL
// parse result (every month, every sub-field), independent of which specific fields today's
// features happen to read. Both are best-effort: this is a purely additive audit trail that no
// existing feature depends on, so a failure here (bucket/table not migrated in yet, a transient
// error) is logged and swallowed rather than blocking the actual import (daily_reports/
// onbooks_snapshots), exactly like the pickup and last-year rollouts degrade gracefully.

const BUCKET = "daily-reports";

function storagePath(hotelId: string, dateISO: string): string {
  return `${hotelId}/${dateISO}.xlsx`;
}

// Uploads the original file, keyed by hotel + report date — a re-import for the same date
// overwrites the previous file, matching how every other table here already treats "latest
// import wins". Returns the storage path on success, or null if the upload failed for any reason.
export async function archiveReportFile(hotelId: string, dateISO: string, file: File): Promise<string | null> {
  const path = storagePath(hotelId, dateISO);
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: true });
  if (error) {
    console.error("Failed to archive report file (bucket not set up yet?) — import continues without it:", error.message);
    return null;
  }
  return path;
}

// Saves the FULL parse result (every month the file contained, every sub-field) for one report
// date — a richer record than daily_reports/onbooks_snapshots, which only ever keep the specific
// fields today's features use. filePath is whatever archiveReportFile returned (null if that step
// was skipped or failed — still worth recording the parsed data on its own).
export async function saveReportImportArchive(
  hotelId: string,
  dateISO: string,
  months: ParsedMonthMetrics[],
  originalFilename: string,
  filePath: string | null,
): Promise<void> {
  if (months.length === 0) return;
  const { error } = await supabase.from("report_imports").upsert(
    {
      hotel_id: hotelId,
      report_date: dateISO,
      parsed_data: months,
      original_filename: originalFilename,
      file_path: filePath,
    },
    { onConflict: "hotel_id,report_date" },
  );
  if (error) {
    console.error("Failed to save report import archive (migration not applied yet?) — import continues without it:", error.message);
  }
}

// Convenience wrapper for the common case: archive the file and the full parse together. Never
// throws — both steps are already individually best-effort.
export async function archiveReportImport(
  hotelId: string,
  dateISO: string,
  file: File,
  months: ParsedMonthMetrics[],
): Promise<void> {
  const filePath = await archiveReportFile(hotelId, dateISO, file);
  await saveReportImportArchive(hotelId, dateISO, months, file.name, filePath);
}
