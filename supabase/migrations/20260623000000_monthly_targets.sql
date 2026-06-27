-- Monthly KPI targets per hotel, compared against MTD actuals on the dashboard.

create table if not exists monthly_targets (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references hotels (id) on delete cascade,
  year_month text not null, -- e.g. "2026-06"
  revenue_target numeric not null default 0,
  room_nights_target numeric not null default 0,
  adr_target numeric not null default 0,
  occupancy_target numeric not null default 0,
  revpar_target numeric not null default 0,
  created_at timestamptz not null default now(),
  unique (hotel_id, year_month)
);

create index if not exists monthly_targets_hotel_id_idx on monthly_targets (hotel_id);

alter table monthly_targets enable row level security;

create policy "Allow anon all on monthly_targets" on monthly_targets
  for all to anon using (true) with check (true);
