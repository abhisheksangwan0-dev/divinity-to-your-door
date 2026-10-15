alter table orders add column if not exists buyer_name text not null default '';
alter table orders add column if not exists email text not null default '';
alter table orders add column if not exists street text not null default '';
alter table orders add column if not exists city text not null default '';
alter table orders add column if not exists postal text not null default '';
alter table orders add column if not exists country text not null default '';
