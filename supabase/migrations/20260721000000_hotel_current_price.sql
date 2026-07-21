-- Manager-entered "our own price" shown at the top of the competitor price list.
alter table hotels add column if not exists current_price numeric;
