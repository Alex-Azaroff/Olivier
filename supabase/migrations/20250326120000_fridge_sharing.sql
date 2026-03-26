-- Семейный / общий холодильник: один JSON state на группу, несколько telegram_user_id в группе.
-- Выполните в Supabase → SQL Editor (или через CLI), если таблиц ещё нет.

create extension if not exists "pgcrypto";

create table if not exists public.fridge_groups (
  id uuid primary key default gen_random_uuid(),
  invite_code text not null unique,
  created_by_telegram_id text,
  created_at timestamptz not null default now()
);

create table if not exists public.fridge_states (
  fridge_id uuid primary key references public.fridge_groups (id) on delete cascade,
  state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Один Telegram-пользователь может быть только в одной группе (один общий холодильник на аккаунт).
create table if not exists public.fridge_members (
  telegram_user_id text primary key,
  fridge_id uuid not null references public.fridge_groups (id) on delete cascade,
  joined_at timestamptz not null default now()
);

create index if not exists fridge_members_fridge_id_idx on public.fridge_members (fridge_id);

alter table public.fridge_groups enable row level security;
alter table public.fridge_states enable row level security;
alter table public.fridge_members enable row level security;

-- Важно: клиент использует anon key и id из Telegram WebApp без JWT (как для user_states).
drop policy if exists "fridge_groups_anon_all" on public.fridge_groups;
create policy "fridge_groups_anon_all" on public.fridge_groups for all using (true) with check (true);

drop policy if exists "fridge_states_anon_all" on public.fridge_states;
create policy "fridge_states_anon_all" on public.fridge_states for all using (true) with check (true);

drop policy if exists "fridge_members_anon_all" on public.fridge_members;
create policy "fridge_members_anon_all" on public.fridge_members for all using (true) with check (true);
