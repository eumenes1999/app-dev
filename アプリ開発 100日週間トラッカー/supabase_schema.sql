-- Supabaseダッシュボード > SQL Editor > New query に貼り付けて実行してください。
-- 家計簿アプリと同じSupabaseプロジェクトにテーブルを追加するだけでOKです。

create table if not exists public.habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null,
  completed_dates date[] not null default '{}',
  created_at timestamptz not null default now()
);

-- スキップ機能（既存テーブルに対する追記マイグレーション。新規作成時も既存テーブルへの追加時もそのまま実行可）
alter table public.habits add column if not exists skipped_dates date[] not null default '{}';

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

-- 習慣ごとのメモ（1日1件）。習慣本体が削除されても消えない、独立した保管庫として設計。
-- habit_titleを書いた時点の名前でスナップショットしておくので、習慣が消えてもメモ側で何のメモか分かる。
create table if not exists public.habit_memos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  habit_id uuid references public.habits(id) on delete set null,
  habit_title text not null,
  date date not null,
  content text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 同じ習慣×同じ日でのメモ重複を防ぐ（upsertの衝突キーに使う）。
-- Postgresの通常のunique indexはNULL同士を重複とみなさないため、
-- habit_id が null（習慣削除後）のオーファン行同士が衝突することはない。
-- ("where habit_id is not null" を付けた部分indexだとON CONFLICTが効かないため、あえて付けない)
create unique index if not exists habit_memos_habit_date_uidx
  on public.habit_memos (habit_id, date);

alter table public.habit_memos enable row level security;

create policy "select own habit memos"
  on public.habit_memos for select
  using (auth.uid() = user_id);

create policy "insert own habit memos"
  on public.habit_memos for insert
  with check (auth.uid() = user_id);

create policy "update own habit memos"
  on public.habit_memos for update
  using (auth.uid() = user_id);

-- 意図的に削除ポリシーは用意しない。メモは書いたら消えない保管庫にするため。
