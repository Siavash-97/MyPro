-- ============================================================
-- 0032: Beitraege in Gruppen
-- ============================================================
-- Warum keine zweite Tabelle
-- --------------------------
-- Ein Gruppenbeitrag ist dasselbe wie ein Feed-Beitrag: Text, Bilder,
-- Kommentare, Likes, Goldmedaillen. Eine eigene Tabelle haette all das
-- verdoppelt – vier weitere Tabellen, vier weitere Regelsaetze, und jede
-- kuenftige Aenderung an zwei Stellen.
--
-- Stattdessen bekommt community_posts eine optionale Zugehoerigkeit:
--
--   group_id is null  -> oeffentlicher Feed, wie bisher
--   group_id gesetzt  -> gehoert in diese Gruppe
--
-- Bilder, Kommentare und Reaktionen haengen am Beitrag und funktionieren
-- unveraendert weiter.
--
-- Die Sichtbarkeit, nach dem Vorbild von Strava
-- ---------------------------------------------
-- Bei Strava sind Clubbeitraege grundsaetzlich nur fuer Mitglieder sichtbar
-- – auch in oeffentlichen Clubs. "Oeffentlich" steuert dort nur, wer
-- beitreten darf, nicht wer mitlesen darf. Genau so hier: Die Gruppe bleibt
-- auffindbar, damit man eine Anfrage stellen kann; ihre Beitraege nicht.
--
-- Die Kind-Tabellen muessen mit
-- -----------------------------
-- Das ist die Stelle, an der es sonst leckt: community_post_images,
-- _comments, _likes, _awards und _comment_likes haben bisher
-- "using (true)" – jeder Angemeldete darf lesen. Fuer den oeffentlichen
-- Feed ist das richtig. Bei einem Gruppenbeitrag koennte ein Nichtmitglied
-- damit die Bilder und Kommentare lesen, obwohl der Beitrag selbst
-- verborgen ist.
--
-- Deshalb pruefen sie ab jetzt den Beitrag, zu dem sie gehoeren. Eine
-- Funktion dafuer, nicht fuenf gleiche Unterabfragen: So gibt es einen Ort,
-- an dem die Regel steht.
-- ============================================================

alter table public.community_posts
  add column if not exists group_id uuid
  references public.community_groups (id) on delete cascade;

create index if not exists community_posts_group_idx
  on public.community_posts (group_id, created_at desc);

comment on column public.community_posts.group_id is
  'Null = oeffentlicher Feed. Gesetzt = gehoert in diese Gruppe und ist nur '
  'fuer deren Mitglieder sichtbar.';


-- Darf der Anfragende diesen Beitrag sehen?
--
-- security definer, damit die Funktion die Zugehoerigkeit nachschlagen kann,
-- ohne dass dafuer eigene Leserechte auf community_posts noetig waeren –
-- sonst braeuchte man ein Recht, um zu pruefen, ob man ein Recht hat.
--
-- set search_path = '': Ohne festen Suchpfad koennte jemand mit einer
-- eigenen Tabelle steuern, welche Tabelle eine Funktion mit erhoehten
-- Rechten tatsaechlich liest.
create or replace function public.darf_beitrag_sehen(beitrag uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.community_posts p
    where p.id = beitrag
      and (p.group_id is null or public.is_group_member(p.group_id))
  );
$$;

revoke all on function public.darf_beitrag_sehen(uuid) from public;
grant execute on function public.darf_beitrag_sehen(uuid) to authenticated;


-- Beitraege selbst -----------------------------------------------
drop policy if exists community_posts_select_all on public.community_posts;
create policy community_posts_select_all
  on public.community_posts for select
  to authenticated
  using (group_id is null or public.is_group_member(group_id));

-- Schreiben in eine Gruppe nur als Mitglied. Ohne diese Bedingung koennte
-- jeder in jede Gruppe posten – lesen duerfte er es dann zwar selbst nicht
-- mehr, geschrieben waere es trotzdem.
drop policy if exists community_posts_insert_own on public.community_posts;
create policy community_posts_insert_own
  on public.community_posts for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and (group_id is null or public.is_group_member(group_id))
  );


-- Kind-Tabellen --------------------------------------------------
-- Sie erben die Sichtbarkeit ihres Beitrags, statt sie erneut zu formulieren.
do $$
declare
  t text;
begin
  foreach t in array array[
    'community_post_images', 'community_post_likes',
    'community_post_awards', 'community_post_comments'
  ] loop
    execute format('drop policy if exists %I_select_all on public.%I', t, t);
    execute format(
      'create policy %I_select_all on public.%I for select to authenticated '
      'using (public.darf_beitrag_sehen(post_id))', t, t);
  end loop;
end $$;

-- Kommentar-Likes haengen am Kommentar, nicht am Beitrag – ein Schritt mehr.
drop policy if exists community_comment_likes_select_all on public.community_comment_likes;
create policy community_comment_likes_select_all
  on public.community_comment_likes for select
  to authenticated
  using (
    exists (
      select 1 from public.community_post_comments c
      where c.id = comment_id and public.darf_beitrag_sehen(c.post_id)
    )
  );
