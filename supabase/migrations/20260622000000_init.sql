-- Revigo Cockpit core schema: hotels and their daily KPI reports.

create table if not exists hotels (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  city text not null,
  rooms integer not null,
  created_at timestamptz not null default now()
);

create table if not exists daily_reports (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references hotels (id) on delete cascade,
  report_date date not null,
  last_year jsonb not null default '{}'::jsonb,
  same_day_last_year jsonb not null default '{}'::jsonb,
  on_books_yesterday jsonb not null default '{}'::jsonb,
  on_books_today jsonb not null default '{}'::jsonb,
  target jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (hotel_id, report_date)
);

create index if not exists daily_reports_hotel_id_idx on daily_reports (hotel_id);

-- RLS is enabled with permissive policies because the app has no
-- end-user auth yet and talks to Supabase with the public anon key.
alter table hotels enable row level security;
alter table daily_reports enable row level security;

create policy "Allow anon all on hotels" on hotels
  for all to anon using (true) with check (true);

create policy "Allow anon all on daily_reports" on daily_reports
  for all to anon using (true) with check (true);
