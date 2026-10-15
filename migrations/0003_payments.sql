alter table orders add column if not exists payment_id text;
create unique index if not exists orders_payment_id_idx on orders (payment_id) where payment_id is not null;
