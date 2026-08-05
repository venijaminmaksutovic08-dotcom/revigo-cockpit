-- The actual final total for the same stay month LAST year (e.g. August 2025's whole-month
-- result), captured from the Excel file's "Total Last Year" column alongside the current year's
-- on-books pace. Nullable, no default — unlike the sibling on-books columns (which default to 0
-- and rely on an app-wide "0 means not entered" convention), these are new enough that a genuine
-- NULL can just mean "not captured" outright, so the app never has to guess.
alter table onbooks_snapshots add column if not exists rooms_last_year numeric;
alter table onbooks_snapshots add column if not exists revenue_last_year numeric;
alter table onbooks_snapshots add column if not exists occupancy_last_year numeric;
