-- Per-(hotel, stay date) cache of the competitor average price used by the Preporuka Cena
-- engine. avg_price_eur is nullable: a row with a null price means "we checked and found
-- nothing" (still worth caching, so a sparse date doesn't re-hit SerpAPI on every page load) —
-- distinct from no row at all, which means "never checked".
create table if not exists competitor_price_snapshots (
  id uuid default gen_random_uuid() primary key,
  hotel_id uuid not null references hotels(id) on delete cascade,
  snapshot_date date not null,
  avg_price_eur numeric,
  competitor_count integer not null default 0,
  source text not null default 'auto' check (source in ('auto', 'manual')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (hotel_id, snapshot_date)
);

create index if not exists competitor_price_snapshots_hotel_date_idx
  on competitor_price_snapshots (hotel_id, snapshot_date);

alter table competitor_price_snapshots enable row level security;

create policy "Allow anon all on competitor_price_snapshots" on competitor_price_snapshots
  for all to anon using (true) with check (true);
