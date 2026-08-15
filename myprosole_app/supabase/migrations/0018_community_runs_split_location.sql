-- ============================================================
-- 0018: Treffpunkt trennen – Stadt oeffentlich, genauer Ort geschuetzt
-- ============================================================
-- Warum
-- -----
-- In 0017 war der Treffpunkt ein einziges Feld, das jeder angemeldete Nutzer
-- lesen konnte. Wer dort "Musterstrasse 12, Samstag 7 Uhr" eintrug, gab
-- damit ein Bewegungsmuster an Fremde preis – bei Menschen, die allein
-- laufen, ein echtes Risiko.
--
-- Neue Aufteilung
-- ---------------
-- community_runs.city                  Stadt oder Stadtteil. Oeffentlich.
-- community_run_meeting_points         Der genaue Treffpunkt. Geschuetzt.
--
-- Warum eine eigene Tabelle und keine zweite Spalte: Die Zeilenrechte von
-- Postgres wirken auf Zeilen, nicht auf einzelne Spalten. Eine Spalte
-- "meeting_point" in derselben Zeile waere fuer jeden lesbar, der die Zeile
-- lesen darf – und lesen duerfen sie alle. Nur eine getrennte Tabelle mit
-- eigenen Rechten schuetzt den Wert wirklich.
--
-- Wer den genauen Ort sieht
-- -------------------------
-- Vorerst nur, wer die Verabredung angelegt hat. Sobald es Anfragen und
-- Zusagen gibt, kommt die Regel fuer bestaetigte Teilnehmer hier dazu – die
-- Stelle ist unten markiert.
--
-- Bestandsdaten
-- -------------
-- Was bisher im Feld stand, wandert nach city. Das kann zu genau sein, wenn
-- schon jemand eine Adresse eingetragen hat; deshalb der Hinweis am Ende
-- dieser Datei zum Nachsehen.
-- ============================================================

alter table public.community_runs
  rename column location to city;

alter table public.community_runs
  rename constraint community_runs_location_not_blank to community_runs_city_not_blank;

comment on column public.community_runs.city is
  'Stadt oder Stadtteil. Fuer alle angemeldeten Nutzer sichtbar – bewusst '
  'ungenau. Der genaue Treffpunkt steht in community_run_meeting_points.';


create table if not exists public.community_run_meeting_points (
  run_id        uuid primary key
                references public.community_runs (id) on delete cascade,
  meeting_point text not null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint community_run_meeting_points_not_blank
    check (btrim(meeting_point) <> '')
);

comment on table public.community_run_meeting_points is
  'Genauer Treffpunkt einer Verabredung. Getrennt von community_runs, weil '
  'Zeilenrechte keine einzelnen Spalten schuetzen koennen.';

drop trigger if exists set_updated_at on public.community_run_meeting_points;
create trigger set_updated_at
  before update on public.community_run_meeting_points
  for each row execute function public.handle_updated_at();

alter table public.community_run_meeting_points enable row level security;

-- Lesen: vorerst nur der Ersteller.
-- SPAETER ERWEITERN: Sobald es Anfragen gibt, hier zusaetzlich erlauben, wer
-- eine bestaetigte Zusage fuer diesen Lauf hat.
drop policy if exists community_run_meeting_points_select_own
  on public.community_run_meeting_points;
create policy community_run_meeting_points_select_own
  on public.community_run_meeting_points for select
  to authenticated
  using (
    exists (
      select 1 from public.community_runs r
      where r.id = run_id and r.user_id = auth.uid()
    )
  );

drop policy if exists community_run_meeting_points_write_own
  on public.community_run_meeting_points;
create policy community_run_meeting_points_write_own
  on public.community_run_meeting_points for all
  to authenticated
  using (
    exists (
      select 1 from public.community_runs r
      where r.id = run_id and r.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.community_runs r
      where r.id = run_id and r.user_id = auth.uid()
    )
  );


-- ------------------------------------------------------------
-- Nach dem Einspielen pruefen
-- ------------------------------------------------------------
-- Falls schon Verabredungen eingetragen wurden, steht deren alter Text jetzt
-- in city und ist fuer alle sichtbar. Diese Abfrage zeigt Eintraege, die zu
-- genau sein koennten (Ziffern deuten auf eine Hausnummer hin):
--
--   select id, city from public.community_runs
--   where city ~ '[0-9]';
--
-- Was dort auftaucht, von Hand auf Stadt oder Stadtteil kuerzen.
