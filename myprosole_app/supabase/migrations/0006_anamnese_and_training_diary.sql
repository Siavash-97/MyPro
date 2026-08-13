-- =============================================================================
-- 0006_anamnese_and_training_diary.sql
-- Feature: Anamnese (Fragebogen) + Lauf-Trainingstagebuch
--
-- Scope:
--   - art9_consents: DSGVO Art. 9 Einwilligungstracking für Gesundheitsdaten
--   - anamnese_sessions + anamnese_answers: strukturierte Fragebogenspeicherung
--     (EAV-Muster: jede Antwort = eine Zeile; Multi-Select = mehrere Zeilen)
--   - training_diary_entries: Lauf-Tagebucheinträge (Distanz, Dauer, Pace,
--     Befinden, Schmerz)
--   - training_diary_pain_locations: Junction für Schmerz-Körperstellen (3NF)
--
-- Normalform: 3NF. Schmerz-Körperstellen werden über eine Junction-Tabelle
-- abgebildet statt über Arrays, um nicht-atomare Werte zu vermeiden.
-- Anamnese-Antworten nutzen ein EAV-Muster (question_key + answer_value),
-- damit das Schema bei Fragebogen-Änderungen stabil bleibt und Multi-Select-
-- Fragen (z.B. andere-sportarten, schmerz-stelle) sauber normalisiert sind.
--
-- Wiederholbarkeit: Alle DDL-Anweisungen sind idempotent (IF NOT EXISTS /
-- DO-Blöcke mit Exception-Handling / DROP POLICY IF EXISTS + CREATE POLICY),
-- damit die Migration gemäß DEVELOPMENT_STANDARDS.md mehrfach ausführbar ist.
--
-- Ausnahmeverfahren (docs/DEVELOPMENT_STANDARDS.md):
--   Gleiche Basisannahmen wie 0005: profiles/runs existieren in `public`,
--   `profiles.id = auth.users.id`, `gen_random_uuid()` über pgcrypto,
--   RLS-Policies über `auth.uid()`, Trigger-Funktion `set_updated_at()`
--   bereits vorhanden (Supabase-Standard bzw. 0005).
--
-- Datenschutz (DSGVO):
--   Anamnese enthält Art. 9 Gesundheitsdaten (Schmerzen, Operationen, Gewicht).
--   Trainingstagebuch enthält Art. 9 Gesundheitsdaten (Schmerzprotokoll).
--   - art9_consents verfolgt Einwilligungen granular pro Scope.
--   - Alle personenbezogenen Tabellen: profiles(id) ON DELETE CASCADE
--     (Recht auf Löschung).
--   - RLS: strikt Owner-only (user_id = auth.uid()), kein service_role-Bypass.
--   - Datenminimierung: nur für den dokumentierten Zweck erforderliche Felder.
--   - Hinweis: Verschlüsselung at-rest wird durch Supabase (Postgres) auf
--     Volume-Ebene bereitgestellt. Spalten-Level-Verschlüsselung (pgcrypto
--     encrypt/decrypt) ist bewusst nicht implementiert, da sie Indexierung
--     verhindert und die Schlüsselverwaltung in SQL unsicher ist. Die
--     tatsächliche Verschlüsselungsstrategie wird im Rahmen des
--     Security-Reviews vor Go-Live festgelegt.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Extensions
-- -----------------------------------------------------------------------------
create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- Enum-Typen (idempotent via DO-Block)
-- -----------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'art9_consent_scope') then
    create type public.art9_consent_scope as enum (
      'anamnese',
      'training_diary',
      'all'
    );
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'anamnese_block') then
    create type public.anamnese_block as enum (
      'a',  -- Pflichtfragen
      'b'   -- freiwillige Zusatzfragen
    );
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'diary_feeling') then
    create type public.diary_feeling as enum (
      'gut',
      'okay',
      'schwer'
    );
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'body_location') then
    create type public.body_location as enum (
      'knie',
      'sprunggelenk',
      'schienbein',
      'achillessehne',
      'huefte',
      'ruecken',
      'wade',
      'fuss',
      'sonstiges'
    );
  end if;
end $$;

-- =============================================================================
-- art9_consents: DSGVO Art. 9 Einwilligungstracking
--
-- Jede Verarbeitung besonders sensibler Daten (Gesundheit, Biometrie) benötigt
-- eine nachweisbare Einwilligung. Diese Tabelle dokumentiert wann und wofür
-- eingewilligt wurde, und optional wann die Einwilligung widerrufen wurde.
-- =============================================================================
create table if not exists public.art9_consents (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles (id) on delete cascade,
  consent_scope public.art9_consent_scope not null,
  consented_at  timestamptz not null default now(),
  revoked_at    timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint art9_consents_revoked_after_consented
    check (revoked_at is null or revoked_at >= consented_at)
);

create index if not exists art9_consents_user_idx
  on public.art9_consents (user_id);
create index if not exists art9_consents_user_scope_idx
  on public.art9_consents (user_id, consent_scope);

comment on table public.art9_consents is
  'Nachweisbare DSGVO Art. 9 Einwilligungen für Verarbeitung besonders sensibler '
  'Gesundheitsdaten. Granular pro Scope (anamnese, training_diary, all). '
  'revoked_at != NULL bedeutet widerrufene Einwilligung.';

create or replace trigger art9_consents_set_updated_at
  before update on public.art9_consents
  for each row execute function public.set_updated_at();

-- =============================================================================
-- anamnese_sessions: Fragebogen-Sitzungen
--
-- Jede Ausfüllung des Fragebogens erzeugt eine Session. questionnaire_version
-- erlaubt spätere Schema-Evolution der Fragen, ohne historische Antworten zu
-- invalidieren.
-- =============================================================================
create table if not exists public.anamnese_sessions (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid not null references public.profiles (id) on delete cascade,
  questionnaire_version  smallint not null default 1,
  block                  public.anamnese_block not null,
  started_at             timestamptz not null default now(),
  completed_at           timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),

  constraint anamnese_sessions_completed_after_started
    check (completed_at is null or completed_at >= started_at)
);

create index if not exists anamnese_sessions_user_idx
  on public.anamnese_sessions (user_id);
create index if not exists anamnese_sessions_user_version_idx
  on public.anamnese_sessions (user_id, questionnaire_version);

comment on table public.anamnese_sessions is
  'Fragebogen-Sitzungen. Jede Ausfüllung (Block A oder B) erzeugt eine Session. '
  'questionnaire_version ermöglicht Fragebogen-Evolution ohne Datenverlust.';

create or replace trigger anamnese_sessions_set_updated_at
  before update on public.anamnese_sessions
  for each row execute function public.set_updated_at();

-- =============================================================================
-- anamnese_answers: EAV-Speicherung der Fragebogen-Antworten
--
-- EAV-Begründung: Der Fragebogen hat ~25 verschiedene Fragen mit
-- unterschiedlichen Datentypen (Radio, Stepper, Checkboxen, Freitext) und
-- konditionaler Logik. Ein starres Spalten-Schema wäre bei jeder
-- Fragebogen-Änderung eine Migration. Das EAV-Muster speichert flexibel
-- question_key + answer_value als Text; Typ-Interpretation erfolgt in der
-- Anwendungsschicht anhand der questionnaire_version.
-- Multi-Select-Fragen (z.B. andere-sportarten, schmerz-stelle) werden als
-- separate Zeilen mit demselben question_key gespeichert (3NF-konform).
-- =============================================================================
create table if not exists public.anamnese_answers (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references public.anamnese_sessions (id) on delete cascade,
  question_key  text not null,
  answer_value  text not null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint anamnese_answers_key_not_blank
    check (btrim(question_key) <> ''),
  constraint anamnese_answers_session_key_value_uk
    unique (session_id, question_key, answer_value)
);

create index if not exists anamnese_answers_session_idx
  on public.anamnese_answers (session_id);
create index if not exists anamnese_answers_key_idx
  on public.anamnese_answers (question_key);

comment on table public.anamnese_answers is
  'EAV-Speicherung der Anamnese-Antworten. question_key = Feld-ID aus dem '
  'Fragebogen (z.B. "ziel", "schmerzen", "groesse"). Multi-Select = mehrere '
  'Zeilen mit demselben question_key. Typ-Interpretation über questionnaire_version '
  'in der Anwendungsschicht.';

create or replace trigger anamnese_answers_set_updated_at
  before update on public.anamnese_answers
  for each row execute function public.set_updated_at();

-- =============================================================================
-- training_diary_entries: Lauf-Trainingstagebuch
--
-- Speichert einzelne Laufeinheiten mit Befinden und optionalem Schmerzprotokoll.
-- run_id ist als UUID-Referenz vorbereitet, aber ohne FK-Constraint, da die
-- runs-Tabelle aus einer früheren, nicht versionierten Migration stammt und
-- die Spaltenstruktur nicht verifiziert werden kann. Der FK wird in einer
-- Folgemigration nachgetragen, sobald das runs-Schema konsolidiert ist.
-- =============================================================================
create table if not exists public.training_diary_entries (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references public.profiles (id) on delete cascade,
  run_id            uuid,
  entry_date        date not null,
  distance_km       numeric(6,2),
  duration_minutes  numeric(6,1),
  pace              text,
  feeling           public.diary_feeling,
  has_pain          boolean not null default false,
  pain_onset_km     numeric(5,1),
  pain_description  text,
  sleep_hours       numeric(3,1),
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  constraint diary_entries_distance_positive
    check (distance_km is null or distance_km > 0),
  constraint diary_entries_duration_positive
    check (duration_minutes is null or duration_minutes > 0),
  constraint diary_entries_sleep_range
    check (sleep_hours is null or (sleep_hours >= 0 and sleep_hours <= 24)),
  constraint diary_entries_pain_description_length
    check (pain_description is null or length(pain_description) <= 120),
  constraint diary_entries_pain_onset_requires_pain
    check (pain_onset_km is null or has_pain = true),
  constraint diary_entries_pain_description_requires_pain
    check (pain_description is null or has_pain = true),
  constraint diary_entries_user_date_uk
    unique (user_id, entry_date, run_id)
);

create index if not exists diary_entries_user_idx
  on public.training_diary_entries (user_id);
create index if not exists diary_entries_user_date_idx
  on public.training_diary_entries (user_id, entry_date desc);
create index if not exists diary_entries_has_pain_idx
  on public.training_diary_entries (user_id, has_pain)
  where has_pain = true;

comment on table public.training_diary_entries is
  'Lauf-Trainingstagebuch. Jeder Eintrag = eine Laufeinheit mit Befinden und '
  'optionalem Schmerzprotokoll. run_id ohne FK (Folgemigration). has_pain ist '
  'ein Hard-Filter für die spätere Regel-Engine (E.5). Schmerzfelder sind '
  'DSGVO Art. 9 Gesundheitsdaten.';
comment on column public.training_diary_entries.pain_description is
  'Freitext max 120 Zeichen, nur bei has_pain = true. Art. 9 Gesundheitsdatum.';
comment on column public.training_diary_entries.run_id is
  'Referenz auf eine GPS-Laufeinheit. Ohne FK-Constraint bis runs-Schema '
  'konsolidiert ist (Folgemigration).';

create or replace trigger diary_entries_set_updated_at
  before update on public.training_diary_entries
  for each row execute function public.set_updated_at();

-- =============================================================================
-- training_diary_pain_locations: Junction für Schmerz-Körperstellen
--
-- 3NF-Begründung: Körperstellen sind eine Mehrfachauswahl (Multi-Checkbox).
-- Als Array in training_diary_entries wäre das nicht atomar (1NF-Verstoß)
-- und nicht referenziell prüfbar. Deshalb eigene Junction-Tabelle mit
-- body_location-Enum als Wertedomäne.
-- =============================================================================
create table if not exists public.training_diary_pain_locations (
  diary_entry_id  uuid not null references public.training_diary_entries (id) on delete cascade,
  location        public.body_location not null,
  created_at      timestamptz not null default now(),
  primary key (diary_entry_id, location)
);

create index if not exists diary_pain_locations_location_idx
  on public.training_diary_pain_locations (location);

comment on table public.training_diary_pain_locations is
  'Normalisierte n:m-Zuordnung Tagebucheintrag <-> Schmerz-Körperstelle. '
  'Art. 9 Gesundheitsdatum. DSGVO CASCADE über diary_entry -> profiles.';

-- =============================================================================
-- Row Level Security (RLS)
-- =============================================================================

-- --- art9_consents: Owner-only -----------------------------------------------

alter table public.art9_consents enable row level security;

drop policy if exists art9_consents_select_own on public.art9_consents;
create policy art9_consents_select_own
  on public.art9_consents
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists art9_consents_insert_own on public.art9_consents;
create policy art9_consents_insert_own
  on public.art9_consents
  for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists art9_consents_update_own on public.art9_consents;
create policy art9_consents_update_own
  on public.art9_consents
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists art9_consents_delete_own on public.art9_consents;
create policy art9_consents_delete_own
  on public.art9_consents
  for delete
  to authenticated
  using (user_id = auth.uid());

-- --- anamnese_sessions: Owner-only -------------------------------------------

alter table public.anamnese_sessions enable row level security;

drop policy if exists anamnese_sessions_select_own on public.anamnese_sessions;
create policy anamnese_sessions_select_own
  on public.anamnese_sessions
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists anamnese_sessions_insert_own on public.anamnese_sessions;
create policy anamnese_sessions_insert_own
  on public.anamnese_sessions
  for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists anamnese_sessions_update_own on public.anamnese_sessions;
create policy anamnese_sessions_update_own
  on public.anamnese_sessions
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists anamnese_sessions_delete_own on public.anamnese_sessions;
create policy anamnese_sessions_delete_own
  on public.anamnese_sessions
  for delete
  to authenticated
  using (user_id = auth.uid());

-- --- anamnese_answers: Owner-only über anamnese_sessions ---------------------

alter table public.anamnese_answers enable row level security;

drop policy if exists anamnese_answers_select_own on public.anamnese_answers;
create policy anamnese_answers_select_own
  on public.anamnese_answers
  for select
  to authenticated
  using (
    exists (
      select 1 from public.anamnese_sessions s
      where s.id = anamnese_answers.session_id
        and s.user_id = auth.uid()
    )
  );

drop policy if exists anamnese_answers_write_own on public.anamnese_answers;
create policy anamnese_answers_write_own
  on public.anamnese_answers
  for all
  to authenticated
  using (
    exists (
      select 1 from public.anamnese_sessions s
      where s.id = anamnese_answers.session_id
        and s.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.anamnese_sessions s
      where s.id = anamnese_answers.session_id
        and s.user_id = auth.uid()
    )
  );

-- --- training_diary_entries: Owner-only --------------------------------------

alter table public.training_diary_entries enable row level security;

drop policy if exists diary_entries_select_own on public.training_diary_entries;
create policy diary_entries_select_own
  on public.training_diary_entries
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists diary_entries_insert_own on public.training_diary_entries;
create policy diary_entries_insert_own
  on public.training_diary_entries
  for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists diary_entries_update_own on public.training_diary_entries;
create policy diary_entries_update_own
  on public.training_diary_entries
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists diary_entries_delete_own on public.training_diary_entries;
create policy diary_entries_delete_own
  on public.training_diary_entries
  for delete
  to authenticated
  using (user_id = auth.uid());

-- --- training_diary_pain_locations: Owner-only über diary_entries -------------

alter table public.training_diary_pain_locations enable row level security;

drop policy if exists diary_pain_locations_select_own on public.training_diary_pain_locations;
create policy diary_pain_locations_select_own
  on public.training_diary_pain_locations
  for select
  to authenticated
  using (
    exists (
      select 1 from public.training_diary_entries e
      where e.id = training_diary_pain_locations.diary_entry_id
        and e.user_id = auth.uid()
    )
  );

drop policy if exists diary_pain_locations_write_own on public.training_diary_pain_locations;
create policy diary_pain_locations_write_own
  on public.training_diary_pain_locations
  for all
  to authenticated
  using (
    exists (
      select 1 from public.training_diary_entries e
      where e.id = training_diary_pain_locations.diary_entry_id
        and e.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.training_diary_entries e
      where e.id = training_diary_pain_locations.diary_entry_id
        and e.user_id = auth.uid()
    )
  );
