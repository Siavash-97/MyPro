-- ============================================================
-- 0019: Community-Feed – Beitraege, Likes, Kommentare, Goldmedaillen
-- ============================================================
-- Warum
-- -----
-- Der Feed zeigte bisher nur einen Hinweis. Diese Migration traegt die
-- Beitraege und die drei Reaktionen darauf.
--
-- Drei Reaktionen, drei Tabellen
-- ------------------------------
-- Like und Goldmedaille sind bewusst getrennt und nicht ein Feld mit einer
-- Art. Die Medaille soll spaeter Vergunstigungen ausloesen; wer sie zaehlt,
-- darf nicht versehentlich Likes mitzaehlen. Getrennte Tabellen machen das
-- unmoeglich statt nur unwahrscheinlich.
--
-- Beides ist auf einen Eintrag je Person und Beitrag begrenzt – der
-- zusammengesetzte Primaerschluessel erzwingt das, nicht die App.
--
-- Sichtbarkeit
-- ------------
-- Alle angemeldeten Nutzer sehen alle Beitraege. Aendern und loeschen darf
-- nur, wer sie geschrieben hat.
--
-- Bilder
-- ------
-- Liegen im Storage-Behaelter "community" unter <user_id>/<datei>. Der
-- Behaelter ist oeffentlich lesbar: Ein Feed-Bild ist ohnehin fuer alle
-- bestimmt, und signierte Adressen fuer jedes Bild waeren viel Aufwand fuer
-- wenig Gewinn. Hochladen und Loeschen darf nur, wem der Ordner gehoert.
-- ============================================================

create table if not exists public.community_posts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  body        text,
  -- Pfad im Storage-Behaelter, nicht die volle Adresse: Die kann sich
  -- aendern, der Pfad nicht.
  image_path  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  -- Ein Beitrag ohne Text und ohne Bild waere leer.
  constraint community_posts_not_empty
    check (btrim(coalesce(body, '')) <> '' or image_path is not null),
  constraint community_posts_body_length check (body is null or length(body) <= 2000)
);

create index if not exists community_posts_created_at_idx
  on public.community_posts (created_at desc);

create table if not exists public.community_post_likes (
  post_id    uuid not null references public.community_posts (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

comment on table public.community_post_likes is
  'Ein Like je Person und Beitrag – erzwungen durch den Primaerschluessel.';

create table if not exists public.community_post_awards (
  post_id    uuid not null references public.community_posts (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

comment on table public.community_post_awards is
  'Goldmedaillen. Getrennt von den Likes, weil sie spaeter Vergunstigungen '
  'ausloesen sollen und dabei nichts mitgezaehlt werden darf, was keine ist.';

create table if not exists public.community_post_comments (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references public.community_posts (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  body       text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint community_post_comments_not_blank check (btrim(body) <> ''),
  constraint community_post_comments_length check (length(body) <= 1000)
);

create index if not exists community_post_comments_post_idx
  on public.community_post_comments (post_id, created_at);

drop trigger if exists set_updated_at on public.community_posts;
create trigger set_updated_at before update on public.community_posts
  for each row execute function public.handle_updated_at();

drop trigger if exists set_updated_at on public.community_post_comments;
create trigger set_updated_at before update on public.community_post_comments
  for each row execute function public.handle_updated_at();


-- Zeilenrechte -------------------------------------------------
-- Muster ueberall gleich: lesen duerfen alle Angemeldeten, schreiben nur
-- fuer sich selbst, aendern und loeschen nur die eigenen Zeilen.

alter table public.community_posts enable row level security;
alter table public.community_post_likes enable row level security;
alter table public.community_post_awards enable row level security;
alter table public.community_post_comments enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array[
    'community_posts', 'community_post_likes',
    'community_post_awards', 'community_post_comments'
  ] loop
    execute format('drop policy if exists %I_select_all on public.%I', t, t);
    execute format(
      'create policy %I_select_all on public.%I for select to authenticated using (true)', t, t);

    execute format('drop policy if exists %I_insert_own on public.%I', t, t);
    execute format(
      'create policy %I_insert_own on public.%I for insert to authenticated '
      'with check (user_id = auth.uid())', t, t);

    execute format('drop policy if exists %I_update_own on public.%I', t, t);
    execute format(
      'create policy %I_update_own on public.%I for update to authenticated '
      'using (user_id = auth.uid()) with check (user_id = auth.uid())', t, t);

    execute format('drop policy if exists %I_delete_own on public.%I', t, t);
    execute format(
      'create policy %I_delete_own on public.%I for delete to authenticated '
      'using (user_id = auth.uid())', t, t);
  end loop;
end $$;


-- Bilderablage -------------------------------------------------

insert into storage.buckets (id, name, public)
values ('community', 'community', true)
on conflict (id) do nothing;

-- Lesen: fuer alle. Ein Feed-Bild ist ohnehin fuer alle bestimmt.
drop policy if exists community_images_read on storage.objects;
create policy community_images_read
  on storage.objects for select
  using (bucket_id = 'community');

-- Hochladen und loeschen nur im eigenen Ordner. Der erste Pfadteil ist die
-- Nutzerkennung; so kann niemand fremde Bilder ueberschreiben.
drop policy if exists community_images_insert_own on storage.objects;
create policy community_images_insert_own
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'community'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists community_images_delete_own on storage.objects;
create policy community_images_delete_own
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'community'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
