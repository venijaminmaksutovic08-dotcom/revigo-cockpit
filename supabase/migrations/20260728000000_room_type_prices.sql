-- Per-room-type nightly prices (EUR), the baseline the Preporuka Cena page adjusts from.
alter table hotels add column if not exists price_cls numeric;
alter table hotels add column if not exists price_dplx numeric;
alter table hotels add column if not exists price_superior numeric;
alter table hotels add column if not exists price_king numeric;

-- Seed defaults for Queen of Zlatibor only — other hotels start unset until a manager enters them.
update hotels set
  price_cls = coalesce(price_cls, 100),
  price_dplx = coalesce(price_dplx, 100),
  price_superior = coalesce(price_superior, 130),
  price_king = coalesce(price_king, 160)
where name = 'Queen of Zlatibor';
