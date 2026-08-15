-- ============================================================
-- 0026: Beitrag bearbeiten (mehrere Bilder), Kommentare
--       beantworten und liken
-- ============================================================

-- Mehrere Bilder pro Beitrag ------------------------------------
-- Bisher stand ein einzelner Pfad in community_posts.image_path. Fuer
-- "mehr Bilder hinzufuegen" braucht es eine eigene Tabelle: Eine Spalte
-- kann nur ein Bild halten, und eine Liste in einer Spalte waere eine
-- Liste, die niemand einzeln loeschen kann.

create table if not exists public.community_post_images (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references public.community_posts (id) on delete cascade,
  -- Doppelt gefuehrt, obwohl es ueber den Beitrag herleitbar waere: Die
  -- Zeilenregel braucht den Eigentuemer direkt in der Zeile, sonst muesste
  -- jede Pruefung erst den Beitrag nachschlagen.
  user_id    uuid not null references public.profiles (id) on delete cascade,
  path       text not null,
  position   smallint not null default 0,
  created_at timestamptz not null default now(),

  constraint community_post_images_path_not_blank check (btrim(path) <> ''),
  constraint community_post_images_position_range check (position between 0 and 9),
  constraint community_post_images_post_position_uk unique (post_id, position)
);

create index if not exists community_post_images_post_idx
  on public.community_post_images (post_id, position);

alter table public.community_post_images enable row level security;

drop policy if exists community_post_images_select_all on public.community_post_images;
create policy community_post_images_select_all
  on public.community_post_images for select to authenticated using (true);

drop policy if exists community_post_images_insert_own on public.community_post_images;
create policy community_post_images_insert_own
  on public.community_post_images for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists community_post_images_delete_own on public.community_post_images;
create policy community_post_images_delete_own
  on public.community_post_images for delete to authenticated
  using (user_id = auth.uid());


-- Die schon vorhandenen Bilder in die neue Tabelle uebernehmen. Ohne
-- diesen Schritt verschwaende jeder bisherige Beitrag sein Bild, sobald
-- die App nur noch die neue Tabelle liest.
insert into public.community_post_images (post_id, user_id, path, position)
select p.id, p.user_id, p.image_path, 0
from public.community_posts p
where p.image_path is not null
on conflict (post_id, position) do nothing;

comment on column public.community_posts.image_path is
  'Nicht mehr benutzt. Die Bilder stehen seit 0026 in '
  'community_post_images. Die Spalte bleibt, damit aeltere Beitraege '
  'nichts verlieren, falls die Uebernahme oben je wiederholt werden muss.';


-- Die Regel "ein Beitrag darf nicht leer sein" laesst sich so nicht mehr
-- in der Zeile pruefen: Die Bilder entstehen erst nach dem Beitrag, in
-- einer anderen Tabelle. Eine Zeilenregel kann davon nichts wissen.
--
-- Bewusste Entscheidung gegen einen Ausloeser (trigger): Der muesste
-- aufgeschoben pruefen, waere schwer zu lesen und wuerde jede Einfuegung
-- verlangsamen. Stattdessen sorgt die App dafuer, dass Text oder Bild da
-- ist – und die Laengenregel bleibt in der Datenbank, weil die sich
-- sehr wohl in der Zeile pruefen laesst.
alter table public.community_posts
  drop constraint if exists community_posts_not_empty;


-- Kommentare beantworten ----------------------------------------
-- Eine Ebene tief, wie bei Instagram: Antworten haengen an einem
-- Hauptkommentar. Eine Antwort auf eine Antwort haengt am selben
-- Hauptkommentar – sonst entstuenden Baeume, die auf einem Telefon nicht
-- mehr lesbar sind.

alter table public.community_post_comments
  add column if not exists parent_id uuid
  references public.community_post_comments (id) on delete cascade;

create index if not exists community_post_comments_parent_idx
  on public.community_post_comments (parent_id);


-- Kommentare liken ----------------------------------------------

create table if not exists public.community_comment_likes (
  comment_id uuid not null references public.community_post_comments (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),

  primary key (comment_id, user_id)
);

alter table public.community_comment_likes enable row level security;

drop policy if exists community_comment_likes_select_all on public.community_comment_likes;
create policy community_comment_likes_select_all
  on public.community_comment_likes for select to authenticated using (true);

drop policy if exists community_comment_likes_insert_own on public.community_comment_likes;
create policy community_comment_likes_insert_own
  on public.community_comment_likes for insert to authenticated
  with check (user_id = auth.uid());

-- Kein update: Ein Like hat nichts zu aendern. Man setzt es oder nimmt es
-- zurueck.
drop policy if exists community_comment_likes_delete_own on public.community_comment_likes;
create policy community_comment_likes_delete_own
  on public.community_comment_likes for delete to authenticated
  using (user_id = auth.uid());
