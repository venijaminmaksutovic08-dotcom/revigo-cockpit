-- Pickup column (Excel column H on the Daily report sheet) — how much moved since yesterday, as
-- reported directly by the file rather than computed, mirroring the other On-the-Books columns.
alter table daily_reports add column if not exists pickup jsonb not null default '{}'::jsonb;
