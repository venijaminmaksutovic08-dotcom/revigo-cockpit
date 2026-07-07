create table if not exists competitors (
  id uuid default gen_random_uuid() primary key,
  hotel_id uuid references hotels(id) on delete cascade,
  competitor_name text not null,
  competitor_city text not null,
  created_at timestamptz not null default now()
);

create index if not exists competitors_hotel_id_idx on competitors (hotel_id);

alter table competitors enable row level security;

create policy "Allow anon all on competitors" on competitors
  for all to anon using (true) with check (true);
