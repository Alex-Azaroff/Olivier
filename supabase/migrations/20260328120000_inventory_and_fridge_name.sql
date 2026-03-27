-- Кладовая в облаке: строки inventory на холодильник (fridge_id).
-- Имя холодильника + флаг личной кладовой в fridge_groups.
-- После применения: Supabase → Database → Replication → включите realtime для таблицы inventory (или выполните ниже, если публикация доступна).

create extension if not exists "pgcrypto";

-- Поля группы: отображаемое имя и личная кладовая (один пользователь)
alter table public.fridge_groups
  add column if not exists name text default 'Кладовая';

alter table public.fridge_groups
  add column if not exists is_personal boolean not null default false;

create unique index if not exists fridge_groups_personal_owner_uidx
  on public.fridge_groups (created_by_telegram_id)
  where is_personal = true and created_by_telegram_id is not null;

create table if not exists public.inventory (
  id uuid primary key default gen_random_uuid(),
  fridge_id uuid not null references public.fridge_groups (id) on delete cascade,
  name text not null,
  category text default '🏷️ Прочее',
  measure text not null default 'шт.',
  quantity numeric not null default 1,
  expiry_date timestamptz,
  shelf_life int default 7,
  auto_filled boolean not null default false,
  created_by_telegram_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists inventory_fridge_id_idx on public.inventory (fridge_id);

alter table public.inventory enable row level security;

drop policy if exists "inventory_anon_all" on public.inventory;
create policy "inventory_anon_all" on public.inventory for all using (true) with check (true);

-- Realtime (может потребовать прав суперпользователя в облаке Supabase)
do $$
begin
  alter publication supabase_realtime add table public.inventory;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;
