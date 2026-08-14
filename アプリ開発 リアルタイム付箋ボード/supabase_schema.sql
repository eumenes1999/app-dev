-- Supabaseダッシュボード > SQL Editor > New query に貼り付けて実行してください。
-- 他の練習アプリ(家計簿・100日週間トラッカー・MEO集客ダッシュボード)と同じSupabaseプロジェクトにテーブルを追加するだけでOKです。
-- 無料枠運用ルール(04_アプリ開発/CLAUDE.md参照)に従い、新規プロジェクトは作らない方針です。
--
-- 【他アプリとRLS方針が異なる点】habits/entries/meo_reportsは「auth.uid() = user_id」で
-- 自分のデータしか見えないプライベート分離だが、このsticky_notesは全員で同じボードを
-- 共同編集するのが目的のため、認証済み(匿名ログイン含む)であれば誰でも全ノートを
-- 閲覧・移動・編集・削除できる「共有ボード」型のポリシーにしている。

create table if not exists public.sticky_notes (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null default auth.uid() references auth.users(id) on delete cascade,
  text text not null default '',
  color text not null default 'yellow',
  x numeric not null default 50,   -- ボード内の横位置(%, 0〜100)
  y numeric not null default 50,   -- ボード内の縦位置(%, 0〜100)
  rotation numeric not null default 0, -- わずかな傾き(度)
  updated_at timestamptz not null default now()
);

alter table public.sticky_notes enable row level security;

create policy "select all sticky notes"
  on public.sticky_notes for select
  using (true);

create policy "insert sticky notes as authenticated"
  on public.sticky_notes for insert
  with check (auth.uid() is not null);

create policy "update any sticky note as authenticated"
  on public.sticky_notes for update
  using (auth.uid() is not null);

create policy "delete any sticky note as authenticated"
  on public.sticky_notes for delete
  using (auth.uid() is not null);

-- Realtime(Postgres Changes)購読を有効化する場合、Supabaseダッシュボード側の
-- Database > Replication で public.sticky_notes テーブルのRealtimeをONにしてください
-- (2024年以降のSupabaseプロジェクトはテーブル追加時にデフォルトでは購読対象外のことがあるため)。
