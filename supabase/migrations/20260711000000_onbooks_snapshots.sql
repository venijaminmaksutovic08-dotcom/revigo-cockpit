create table if not exists onbooks_snapshots (
  id uuid default gen_random_uuid() primary key,
  hotel_id uuid references hotels(id) on delete cascade,
  snapshot_date date not null,
  stay_month integer not null,
  stay_year integer not null,
  rooms_onbooks integer default 0,
  revenue_onbooks numeric default 0,
  occupancy_onbooks numeric default 0,
  notes text,
  created_at timestamptz default now(),
  unique(hotel_id, snapshot_date, stay_month, stay_year)
);

create index if not exists onbooks_snapshots_hotel_id_idx on onbooks_snapshots (hotel_id);

alter table onbooks_snapshots enable row level security;
create policy "Allow anon all on onbooks_snapshots" on onbooks_snapshots
  for all to anon using (true) with check (true);
