-- Supabaseダッシュボード > SQL Editor > New query に貼り付けて実行してください。
-- (Claude Codeからは直接SQLを流し込めないため、手動実行が必要です)

create table if not exists public.entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  date date not null,
  type text not null check (type in ('income', 'expense')),
  category text,
  amount numeric not null check (amount > 0),
  memo text,
  created_at timestamptz not null default now()
);

alter table public.entries enable row level security;

create policy "select own entries"
  on public.entries for select
  using (auth.uid() = user_id);

create policy "insert own entries"
  on public.entries for insert
  with check (auth.uid() = user_id);

create policy "delete own entries"
  on public.entries for delete
  using (auth.uid() = user_id);
