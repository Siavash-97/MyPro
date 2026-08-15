-- ============================================================
-- 0023: Community-Profil – Kurzbeschreibung, Fotos, Sportarten
-- ============================================================
-- Warum eine eigene Tabelle und nicht profiles
-- --------------------------------------------
-- In 0022 steht als Bedingung: In profiles darf nichts stehen, was nicht
-- jeder Angemeldete sehen darf. Das gilt hier weiter. Die Angaben aus dem
-- Community-Profil sind zwar oeffentlich gedacht, aber sie haben eine
-- eigene Regel – naemlich den Schalter "Kilometer & Rekord zeigen". Damit
-- gehoeren sie in eine eigene Tabelle mit eigenen Rechten, nicht in die
-- allgemeine Profiltabelle.
--
-- Kilometer und Rekord stehen bewusst NICHT in dieser Tabelle
-- -----------------------------------------------------------
-- Sie werden aus den Laeufen berechnet, und Laeufe sieht nur die Person
-- selbst. Zeilenrechte helfen hier nicht: Sobald man fremde Laeufe lesen
-- duerfte, saehe man auch jede einzelne Strecke, nicht nur die Summe.
--
-- Stattdessen gibt es eine Funktion, die die zwei Zahlen berechnet und
-- vorher prueft, ob die Person das ueberhaupt zeigen will. Die Funktion
-- laeuft mit erhoehten Rechten (security definer) und gibt nichts zurueck,
-- wenn der Schalter aus ist. Man kann sie also nicht dazu bringen, mehr zu
-- verraten als die zwei Zahlen – und die auch nur mit Einverstaendnis.
--
-- Fotos liegen im schon vorhandenen Behaelter community unter dem eigenen
-- Ordner; die Regeln dafuer stehen in 0019 und gelten unveraendert.
-- ============================================================

create table if not exists public.community_profiles (
  user_id       uuid primary key references public.profiles (id) on delete cascade,
  bio           text,
  -- Wie lange jemand laeuft. Jahre, nicht ein Datum: gefragt wird
  -- "Laeuft seit (Jahre)", und eine Jahreszahl verraet weniger.
  running_years smallint,
  -- Weitere Sportarten. Laufen ist die Hauptsportart und steht deshalb
  -- nicht mit drin – sonst muesste die App sie ueberall herausfiltern.
  sports        text[] not null default '{}',
  -- Aus, nicht an. Wer nichts einstellt, zeigt auch nichts.
  show_stats    boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint community_profiles_bio_length
    check (bio is null or char_length(bio) <= 300),
  constraint community_profiles_years_range
    check (running_years is null or running_years between 0 and 80),
  constraint community_profiles_sports_max
    check (array_length(sports, 1) is null or array_length(sports, 1) <= 12)
);

alter table public.community_profiles enable row level security;

-- Lesen darf jeder Angemeldete: Das ist der Zweck eines Community-Profils.
drop policy if exists community_profiles_select on public.community_profiles;
create policy community_profiles_select
  on public.community_profiles for select
  to authenticated
  using (true);

-- Schreiben nur das eigene.
drop policy if exists community_profiles_insert_own on public.community_profiles;
create policy community_profiles_insert_own
  on public.community_profiles for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists community_profiles_update_own on public.community_profiles;
create policy community_profiles_update_own
  on public.community_profiles for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists community_profiles_delete_own on public.community_profiles;
create policy community_profiles_delete_own
  on public.community_profiles for delete
  to authenticated
  using (user_id = auth.uid());


-- Fotos ----------------------------------------------------------
-- Hoechstens fuenf, wie im Entwurf. Die Grenze steht als Regel in der
-- Datenbank und nicht nur im Formular: Sonst haelt sie nur so lange, wie
-- niemand an der App vorbei schreibt.

create table if not exists public.community_profile_photos (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  -- Pfad im Behaelter community, nicht die volle Adresse: Ein Wechsel der
  -- Adresse macht sonst jede gespeicherte Zeile ungueltig.
  path       text not null,
  position   smallint not null default 0,
  created_at timestamptz not null default now(),

  constraint community_profile_photos_path_not_blank check (btrim(path) <> ''),
  constraint community_profile_photos_position_range check (position between 0 and 4),
  constraint community_profile_photos_user_position_uk unique (user_id, position)
);

create index if not exists community_profile_photos_user_idx
  on public.community_profile_photos (user_id, position);

alter table public.community_profile_photos enable row level security;

drop policy if exists community_profile_photos_select on public.community_profile_photos;
create policy community_profile_photos_select
  on public.community_profile_photos for select
  to authenticated
  using (true);

drop policy if exists community_profile_photos_insert_own on public.community_profile_photos;
create policy community_profile_photos_insert_own
  on public.community_profile_photos for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and (
      select count(*) from public.community_profile_photos p
      where p.user_id = auth.uid()
    ) < 5
  );

drop policy if exists community_profile_photos_delete_own on public.community_profile_photos;
create policy community_profile_photos_delete_own
  on public.community_profile_photos for delete
  to authenticated
  using (user_id = auth.uid());


-- Kilometer und Rekord -------------------------------------------
-- Gibt genau zwei Zahlen zurueck, und nur wenn der Schalter an ist. Sonst
-- eine leere Menge – die App zeigt dann gar nichts.
--
-- set search_path = '' und die voll ausgeschriebenen Namen: Sonst koennte
-- jemand mit einer eigenen Tabelle im Suchpfad steuern, welche Tabelle die
-- Funktion mit ihren erhoehten Rechten tatsaechlich liest.

create or replace function public.community_stats(ziel uuid)
returns table (kilometer numeric, laengster_lauf_km numeric)
language sql
stable
security definer
set search_path = ''
as $$
  select
    coalesce(sum(r.distance_km), 0)::numeric(10, 2),
    coalesce(max(r.distance_km), 0)::numeric(10, 2)
  from public.runs r
  where r.user_id = ziel
    and r.status = 'completed'
    and exists (
      select 1 from public.community_profiles cp
      where cp.user_id = ziel and cp.show_stats
    );
$$;

revoke all on function public.community_stats(uuid) from public;
grant execute on function public.community_stats(uuid) to authenticated;

comment on function public.community_stats(uuid) is
  'Gesamtkilometer und laengster Lauf einer Person – aber nur, wenn sie '
  'show_stats eingeschaltet hat. Einzelne Laeufe bleiben unsichtbar.';


drop trigger if exists set_updated_at on public.community_profiles;
create trigger set_updated_at
  before update on public.community_profiles
  for each row execute function public.set_updated_at();
