-- ============================================================
-- 0017: Gemeinsame Laeufe (Zusammenlauf)
-- ============================================================
-- Warum
-- -----
-- "Lauf vorschlagen" zeigte bisher nur einen Hinweis. Diese Tabelle traegt
-- die Verabredungen.
--
-- Sichtbarkeit
-- ------------
-- Entschieden am 15.08.2026: Vorerst sehen ALLE angemeldeten Nutzer alle
-- Verabredungen. Ein Zuschnitt nach Stadt und Umkreis kommt spaeter.
--
-- Das ist bewusst so und hat eine Kehrseite, die hier festgehalten gehoert:
-- Ein Eintrag verraet Anzeigename, Treffpunkt und Uhrzeit an jeden
-- angemeldeten Nutzer. Wer allein laeuft, gibt damit ein Bewegungsmuster
-- preis. Deshalb ist der Treffpunkt ein freier Text und kein Standort aus dem
-- Geraet - so entscheidet jeder selbst, wie genau er wird. Und deshalb wird
-- der Anzeigename gezeigt, nie die E-Mail-Adresse.
--
-- Aendern und loeschen darf nur, wer den Eintrag angelegt hat.
--
-- Aufraeumen
-- ----------
-- Vergangene Verabredungen bleiben stehen; sie sind Teil des eigenen
-- Verlaufs und stoeren niemanden. Die App zeigt nur kuenftige an. Wird das
-- spaeter zu viel, kann ein Aufraeum-Skript alte Eintraege entfernen - dann
-- aber als bewusste Entscheidung, nicht automatisch.
-- ============================================================

do $$
begin
  if not exists (select 1 from pg_type where typname = 'community_run_pace') then
    create type public.community_run_pace as enum (
      'easy',      -- Lockerer Lauf
      'medium',    -- Mittleres Tempo
      'intense',   -- Intensiv
      'tempo',     -- Tempolauf
      'long_run',  -- Langer Lauf
      'trail'      -- Trail
    );
  end if;
end $$;

create table if not exists public.community_runs (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles (id) on delete cascade,

  -- Freier Text, kein Geraetestandort. Siehe Hinweis oben.
  location     text not null,
  starts_at    timestamptz not null,
  distance_km  numeric(4,1),
  pace         public.community_run_pace not null,
  note         text,

  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  constraint community_runs_location_not_blank check (btrim(location) <> ''),
  constraint community_runs_distance_range
    check (distance_km is null or (distance_km > 0 and distance_km <= 300)),
  constraint community_runs_note_length check (note is null or length(note) <= 500)
);

comment on table public.community_runs is
  'Verabredungen zum gemeinsamen Laufen. Fuer alle angemeldeten Nutzer '
  'sichtbar, aenderbar nur vom Ersteller.';

create index if not exists community_runs_starts_at_idx
  on public.community_runs (starts_at);
create index if not exists community_runs_user_id_idx
  on public.community_runs (user_id);

drop trigger if exists set_updated_at on public.community_runs;
create trigger set_updated_at
  before update on public.community_runs
  for each row execute function public.handle_updated_at();

alter table public.community_runs enable row level security;

-- Lesen: jeder Angemeldete. Das ist der Zweck der Funktion.
drop policy if exists community_runs_select_all on public.community_runs;
create policy community_runs_select_all
  on public.community_runs for select
  to authenticated
  using (true);

-- Anlegen: nur fuer sich selbst. Sonst koennte man Verabredungen in fremdem
-- Namen eintragen.
drop policy if exists community_runs_insert_own on public.community_runs;
create policy community_runs_insert_own
  on public.community_runs for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists community_runs_update_own on public.community_runs;
create policy community_runs_update_own
  on public.community_runs for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists community_runs_delete_own on public.community_runs;
create policy community_runs_delete_own
  on public.community_runs for delete
  to authenticated
  using (user_id = auth.uid());
