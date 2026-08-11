-- Tracks whether a given import attempt's file actually parsed. Previously a failed parse (bad
-- file, sheet not recognized) left NOTHING archived — no file, no record — which is exactly the
-- case most in need of the raw file + error message for diagnosis. Defaults true / null so every
-- existing row (all from successful imports) reads correctly without a backfill.
alter table report_imports add column if not exists parse_ok boolean not null default true;
alter table report_imports add column if not exists parse_error text;

-- A failed attempt has no parsed data at all — nullable now instead of implicitly required.
alter table report_imports alter column parsed_data drop not null;
