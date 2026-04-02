-- One-time tokens for web login via Telegram bot deep link.
create table if not exists public.web_login_tokens (
  token text primary key,
  telegram_user_id text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  confirmed_at timestamptz,
  consumed_at timestamptz
);

create index if not exists web_login_tokens_expires_idx
  on public.web_login_tokens (expires_at);

create index if not exists web_login_tokens_tg_idx
  on public.web_login_tokens (telegram_user_id);

