-- Supabaseダッシュボード > SQL Editor > New query に貼り付けて実行してください。
-- 家計簿アプリと同じSupabaseプロジェクトにテーブルを追加するだけでOKです。

create table if not exists public.habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null,
  completed_dates date[] not null default '{}',
  created_at timestamptz not null default now()
);

alter table public.habits enable row level security;

create policy "select own habits"
  on public.habits for select
  using (auth.uid() = user_id);

create policy "insert own habits"
  on public.habits for insert
  with check (auth.uid() = user_id);

create policy "update own habits"
  on public.habits for update
  using (auth.uid() = user_id);

create policy "delete own habits"
  on public.habits for delete
  using (auth.uid() = user_id);
