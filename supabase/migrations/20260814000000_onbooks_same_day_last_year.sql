-- The forward-looking "Same Day Last Year" pace figure for a stay month that hasn't happened yet
-- this year (e.g. September's own row, captured while August is still current, carries September
-- 2025's cumulative total as of the equivalent day-of-month). Distinct from rooms_last_year/etc
-- (the whole-month FINAL total) — this one moves day to day, and is the only way to reconstruct
-- last year's pickup for a stay month that daily_reports has no rows for yet (see
-- fetchOnBooksPickupFromSameDayLastYearTrail in app/lib/dashboardData.ts). Nullable, no default —
-- same "NULL means not captured" convention as onbooks_last_year (20260801000001).
alter table onbooks_snapshots add column if not exists rooms_same_day_last_year numeric;
alter table onbooks_snapshots add column if not exists revenue_same_day_last_year numeric;
alter table onbooks_snapshots add column if not exists occupancy_same_day_last_year numeric;
