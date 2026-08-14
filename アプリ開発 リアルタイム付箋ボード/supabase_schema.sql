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

-- created_byはリクエストのpayloadで自由に書ける値なので、他人になりすましたinsertを
-- 防ぐため「auth.uid()と一致する場合のみ」を明示的にチェックする(デフォルト値任せにしない)
create policy "insert sticky notes as authenticated"
  on public.sticky_notes for insert
  with check (auth.uid() is not null and created_by = auth.uid());

create policy "update any sticky note as authenticated"
  on public.sticky_notes for update
  using (auth.uid() is not null);

create policy "delete any sticky note as authenticated"
  on public.sticky_notes for delete
  using (auth.uid() is not null);

-- 誰でも他人の付箋を編集できる共有ボード設計だが、「誰が書いたか」を示すcreated_by
-- 自体は更新時に書き換えられないようトリガーで固定する(なりすまし対策の一環)
create or replace function public.sticky_notes_lock_created_by()
returns trigger as $$
begin
  new.created_by := old.created_by;
  return new;
end;
$$ language plpgsql;

drop trigger if exists sticky_notes_lock_created_by_trigger on public.sticky_notes;
create trigger sticky_notes_lock_created_by_trigger
  before update on public.sticky_notes
  for each row execute function public.sticky_notes_lock_created_by();

-- Realtime(Postgres Changes)購読を有効化する場合、Supabaseダッシュボード側の
-- Database > Publications で public.sticky_notes テーブルの配信をONにしてください
-- (テーブル追加時にデフォルトでは配信対象外になっていることがあるため)。
