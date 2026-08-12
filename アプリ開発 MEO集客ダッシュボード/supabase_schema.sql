-- Supabaseダッシュボード > SQL Editor > New query に貼り付けて実行してください。
-- 他の練習アプリ(家計簿・100日週間トラッカー)と同じSupabaseプロジェクトにテーブルを追加するだけでOKです。
-- 無料枠運用ルール(04_アプリ開発/CLAUDE.md参照)に従い、新規プロジェクトは作らない方針です。

create table if not exists public.meo_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  month date not null, -- 対象月の1日で保存 (例: 2026-08-01)
  search_impressions int not null default 0,   -- 検索表示回数
  map_impressions int not null default 0,      -- マップ表示回数
  website_clicks int not null default 0,       -- ウェブサイトクリック数
  phone_taps int not null default 0,           -- 電話タップ数
  direction_requests int not null default 0,   -- ルート検索数(来店誘導)
  new_reviews int not null default 0,          -- クチコミ新規獲得数
  avg_rating numeric(2,1),                     -- 平均評価
  created_at timestamptz not null default now()
);

-- 同じユーザー・同じ月の重複入力を防ぐ(upsertの衝突キーにも使う)
create unique index if not exists meo_reports_user_month_uidx
  on public.meo_reports (user_id, month);

alter table public.meo_reports enable row level security;

create policy "select own meo reports"
  on public.meo_reports for select
  using (auth.uid() = user_id);

create policy "insert own meo reports"
  on public.meo_reports for insert
  with check (auth.uid() = user_id);

create policy "update own meo reports"
  on public.meo_reports for update
  using (auth.uid() = user_id);

create policy "delete own meo reports"
  on public.meo_reports for delete
  using (auth.uid() = user_id);
