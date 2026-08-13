-- =============================================================================
-- 0005_exercises_and_gym_plans.sql
-- Feature: Übungskatalog (Exercises) + Gym-Trainingspläne + Workout-Protokolle
--
-- Scope:
--   - exercises, equipment, muscle_groups + Normalisierungs-Junctions
--   - gym_plans, gym_plan_exercises, gym_plan_equipment
--   - workout_logs, workout_log_exercises
--
-- Normalform: 3NF. Wiederholende/parallele Werte (Zielmuskeln, Equipment,
-- "Equipment-Kontext" eines Plans) werden ausschließlich über Junction-Tabellen
-- abgebildet statt über Arrays oder Text-Listen, um transitive/partielle
-- Abhängigkeiten und nicht-atomare Werte zu vermeiden.
--
-- Wiederholbarkeit: Alle DDL-Anweisungen sind idempotent (IF NOT EXISTS /
-- DO-Blöcke mit Exception-Handling / DROP POLICY IF EXISTS + CREATE POLICY),
-- damit die Migration gemäß DEVELOPMENT_STANDARDS.md mehrfach ausführbar ist.
--
-- Ausnahmeverfahren (docs/DEVELOPMENT_STANDARDS.md):
--   Im Repository existieren aktuell keine Migrationen 0001-0004 und kein
--   Supabase-Projekt für myprosole_app (bisher reiner Streamlit-Prototyp ohne
--   Backend-Anbindung). Diese Migration wurde daher unter der vom Auftrag
--   vorgegebenen Annahme erstellt, dass profiles/runs/... bereits in `public`
--   existieren, `profiles.id = auth.users.id` ist, `gen_random_uuid()` über
--   die Extension `pgcrypto` verfügbar ist und RLS-Policies `auth.uid()`
--   verwenden. Diese Annahmen sind Supabase-Standard, konnten aber nicht
--   gegen eine vorhandene 0001-0004-Migration verifiziert werden. Sollten die
--   echten Basismigrationen abweichende Konventionen nutzen (z.B. einen
--   anderen updated_at-Trigger-Namen), muss diese Datei entsprechend
--   angepasst werden, bevor sie produktiv angewendet wird.
--
-- Datenschutz (DSGVO): profiles(id) ON DELETE CASCADE auf gym_plans/
-- workout_logs stellt sicher, dass beim Löschen eines Nutzerkontos alle
-- zugehörigen Trainingspläne und Workout-Protokolle automatisch entfernt
-- werden (Recht auf Löschung). exercises/equipment/muscle_groups sind
-- anonyme Referenzdaten ohne Personenbezug. Zugriff auf gym_plans/
-- workout_logs ist per RLS strikt auf den jeweiligen Owner beschränkt
-- (Least Privilege).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Extensions
-- -----------------------------------------------------------------------------
create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- Enum-Typen (idempotent via DO-Block, da CREATE TYPE kein IF NOT EXISTS kennt)
-- -----------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'exercise_category') then
    create type public.exercise_category as enum (
      'strength',          -- Kraft
      'technique',         -- Technik
      'mobility',           -- Mobility / Beweglichkeit
      'injury_prevention'  -- Verletzungsprävention
    );
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'exercise_difficulty') then
    create type public.exercise_difficulty as enum (
      'beginner',
      'intermediate',
      'advanced'
    );
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'exercise_modality') then
    create type public.exercise_modality as enum (
      'gym',         -- benötigt Studio-/Kraftgeräte
      'bodyweight',  -- reines Körpergewicht
      'both'         -- in beiden Varianten ausführbar
    );
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'muscle_role') then
    create type public.muscle_role as enum (
      'primary',
      'secondary'
    );
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'workout_log_status') then
    create type public.workout_log_status as enum (
      'in_progress',  -- gestartet, noch nicht beendet (ended_at ist null)
      'completed',
      'abandoned'
    );
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- Trigger-Funktion für updated_at (idempotent via CREATE OR REPLACE)
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- =============================================================================
-- equipment: Referenzliste verfügbarer Trainingsgeräte (Seed-Daten)
-- =============================================================================
create table if not exists public.equipment (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,          -- stabiler, maschinenlesbarer Key, z.B. 'dumbbell'
  name_de     text not null unique,          -- z.B. 'Kurzhantel'
  name_en     text,                          -- z.B. 'Dumbbell'
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.equipment is
  'Referenzliste von Trainingsgeräten (Kurzhantel, Langhantel, Kabelzug, ...). '
  'Seed-Daten, read-only für normale Nutzer:innen.';
comment on column public.equipment.slug is
  'Stabiler, unveränderlicher Referenzschlüssel für Code/Seed-Skripte, unabhängig von Anzeige-Namen.';

create or replace trigger equipment_set_updated_at
  before update on public.equipment
  for each row execute function public.set_updated_at();

-- =============================================================================
-- muscle_groups: Referenzliste von Ziel-Muskelgruppen (Seed-Daten)
-- =============================================================================
create table if not exists public.muscle_groups (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,          -- z.B. 'chest'
  name_de     text not null unique,          -- z.B. 'Brust'
  name_en     text,                          -- z.B. 'Chest'
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.muscle_groups is
  'Referenzliste von Ziel-Muskelgruppen (Brust, Rücken, Beine, ...). '
  'Seed-Daten, read-only für normale Nutzer:innen.';

create or replace trigger muscle_groups_set_updated_at
  before update on public.muscle_groups
  for each row execute function public.set_updated_at();

-- =============================================================================
-- exercises: vordefinierte Übungen aus einer Open-Source-Übungsdatenbank
-- =============================================================================
create table if not exists public.exercises (
  id               uuid primary key default gen_random_uuid(),
  slug             text not null unique,

  name_de          text not null,
  name_en          text,
  description_de   text not null,           -- Anleitung/Instruktionen (deutsch, App-Primärsprache)
  description_en   text,

  category         public.exercise_category not null,
  difficulty       public.exercise_difficulty not null default 'beginner',
  modality         public.exercise_modality not null default 'both',

  image_url        text,
  video_url        text,

  -- Quellenangabe zur Lizenz-Compliance bei Übernahme aus Open-Source-DB
  source_name      text not null,           -- z.B. 'wger', 'free-exercise-db'
  source_url       text,
  source_license   text not null,           -- z.B. 'CC-BY-SA-4.0', 'ODbL-1.0'
  external_id      text,                    -- ID/Slug in der Quelldatenbank, für Re-Import/Update

  is_active        boolean not null default true,  -- Soft-Delete statt hartem DELETE (siehe unten)

  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  constraint exercises_name_de_not_blank check (btrim(name_de) <> ''),
  constraint exercises_description_de_not_blank check (btrim(description_de) <> '')
);

-- Verhindert Doppel-Import derselben Quell-Übung, erlaubt aber mehrere
-- exercises ohne external_id (rein manuell angelegte Übungen).
create unique index if not exists exercises_source_external_id_uidx
  on public.exercises (source_name, external_id)
  where external_id is not null;

create index if not exists exercises_category_idx     on public.exercises (category);
create index if not exists exercises_difficulty_idx    on public.exercises (difficulty);
create index if not exists exercises_modality_idx      on public.exercises (modality);
create index if not exists exercises_is_active_idx     on public.exercises (is_active);
create index if not exists exercises_category_active_idx
  on public.exercises (category, is_active);

comment on table public.exercises is
  'Vordefinierte Übungen aus einer Open-Source-Übungsdatenbank. Seed-/Referenzdaten, '
  'read-only für normale Nutzer:innen; Pflege erfolgt über Import-/Admin-Skripte mit '
  'service_role (umgeht RLS).';
comment on column public.exercises.is_active is
  'Soft-Delete-Flag: Übungen werden nie hart gelöscht, weil sie von gym_plan_exercises '
  'und workout_log_exercises referenziert werden (siehe FK ON DELETE RESTRICT dort). '
  'Entfernte/umbenannte Quell-Übungen werden stattdessen auf false gesetzt.';
comment on column public.exercises.source_license is
  'Lizenzangabe der Quelldatenbank zur Einhaltung der Attribution-Pflicht (z.B. CC-BY-SA).';

create or replace trigger exercises_set_updated_at
  before update on public.exercises
  for each row execute function public.set_updated_at();

-- =============================================================================
-- exercise_muscles: Junction exercise <-> muscle_groups (primary/secondary)
-- =============================================================================
create table if not exists public.exercise_muscles (
  exercise_id      uuid not null references public.exercises (id) on delete cascade,
  muscle_group_id  uuid not null references public.muscle_groups (id) on delete restrict,
  role             public.muscle_role not null default 'primary',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  primary key (exercise_id, muscle_group_id)
);

create index if not exists exercise_muscles_muscle_group_idx
  on public.exercise_muscles (muscle_group_id);
create index if not exists exercise_muscles_role_idx
  on public.exercise_muscles (exercise_id, role);

comment on table public.exercise_muscles is
  'Normalisierte n:m-Zuordnung Übung <-> Ziel-Muskelgruppe inkl. primary/secondary-Flag.';

create or replace trigger exercise_muscles_set_updated_at
  before update on public.exercise_muscles
  for each row execute function public.set_updated_at();

-- =============================================================================
-- exercise_equipment: Junction exercise <-> equipment
-- =============================================================================
create table if not exists public.exercise_equipment (
  exercise_id   uuid not null references public.exercises (id) on delete cascade,
  equipment_id  uuid not null references public.equipment (id) on delete restrict,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  primary key (exercise_id, equipment_id)
);

create index if not exists exercise_equipment_equipment_idx
  on public.exercise_equipment (equipment_id);

comment on table public.exercise_equipment is
  'Normalisierte n:m-Zuordnung Übung <-> benötigtes Equipment.';

create or replace trigger exercise_equipment_set_updated_at
  before update on public.exercise_equipment
  for each row execute function public.set_updated_at();

-- =============================================================================
-- gym_plans: von Nutzer:innen erstellte Trainingspläne
-- =============================================================================
create table if not exists public.gym_plans (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles (id) on delete cascade,
  name         text not null,
  description  text,
  is_active    boolean not null default true,  -- Archivieren statt Löschen
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  constraint gym_plans_name_not_blank check (btrim(name) <> '')
);

create index if not exists gym_plans_user_idx on public.gym_plans (user_id);
create index if not exists gym_plans_user_active_idx
  on public.gym_plans (user_id, is_active);

comment on table public.gym_plans is
  'Von Nutzer:innen erstellte Gym-Trainingspläne. RLS: nur Owner (user_id = auth.uid()) '
  'hat Zugriff.';

create or replace trigger gym_plans_set_updated_at
  before update on public.gym_plans
  for each row execute function public.set_updated_at();

-- =============================================================================
-- gym_plan_equipment: normalisierter "Equipment-Kontext" eines Plans
--
-- 3NF-Begründung: "Welches Equipment hat die Person zur Verfügung" ist eine
-- Mehrfachauswahl. Als Text-Liste/Array in gym_plans wäre das nicht atomar
-- (Verstoß gegen 1NF) und nicht referenziell zu `equipment` integer. Deshalb
-- eigene Junction-Tabelle statt eines Spaltenfelds auf gym_plans.
-- =============================================================================
create table if not exists public.gym_plan_equipment (
  gym_plan_id   uuid not null references public.gym_plans (id) on delete cascade,
  equipment_id  uuid not null references public.equipment (id) on delete restrict,
  created_at    timestamptz not null default now(),
  primary key (gym_plan_id, equipment_id)
);

create index if not exists gym_plan_equipment_equipment_idx
  on public.gym_plan_equipment (equipment_id);

comment on table public.gym_plan_equipment is
  'Normalisierter Equipment-Kontext eines Trainingsplans: welches Equipment der Person '
  'für diesen Plan zur Verfügung steht.';

-- =============================================================================
-- gym_plan_exercises: Übungen innerhalb eines Plans, inkl. Reihenfolge
-- =============================================================================
create table if not exists public.gym_plan_exercises (
  id                 uuid primary key default gen_random_uuid(),
  gym_plan_id        uuid not null references public.gym_plans (id) on delete cascade,
  exercise_id        uuid not null references public.exercises (id) on delete restrict,
  position           smallint not null,
  sets               smallint,
  reps               smallint,
  duration_seconds   integer,   -- für zeitbasierte Übungen wie Plank
  notes              text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  constraint gym_plan_exercises_position_positive check (position > 0),
  constraint gym_plan_exercises_sets_positive check (sets is null or sets > 0),
  constraint gym_plan_exercises_reps_positive check (reps is null or reps > 0),
  constraint gym_plan_exercises_duration_positive
    check (duration_seconds is null or duration_seconds > 0),
  constraint gym_plan_exercises_target_present
    check (sets is not null or duration_seconds is not null),
  constraint gym_plan_exercises_plan_position_uk unique (gym_plan_id, position)
);

create index if not exists gym_plan_exercises_plan_idx
  on public.gym_plan_exercises (gym_plan_id);
create index if not exists gym_plan_exercises_exercise_idx
  on public.gym_plan_exercises (exercise_id);

comment on table public.gym_plan_exercises is
  'Übungen eines Trainingsplans inkl. Position/Reihenfolge, Ziel-Sätzen/-Wiederholungen '
  'oder -Dauer (zeitbasierte Übungen) und Notizen.';
comment on constraint gym_plan_exercises_target_present on public.gym_plan_exercises is
  'Jede Planübung braucht mindestens ein Trainingsziel: Sätze (klassisch) oder Dauer '
  '(zeitbasiert, z.B. Plank).';

create or replace trigger gym_plan_exercises_set_updated_at
  before update on public.gym_plan_exercises
  for each row execute function public.set_updated_at();

-- =============================================================================
-- workout_logs: abgeschlossene bzw. laufende Trainingseinheiten
-- =============================================================================
create table if not exists public.workout_logs (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles (id) on delete cascade,
  gym_plan_id  uuid references public.gym_plans (id) on delete set null,  -- optional, ad-hoc möglich
  status       public.workout_log_status not null default 'in_progress',
  started_at   timestamptz not null default now(),
  ended_at     timestamptz,
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  constraint workout_logs_ended_after_started
    check (ended_at is null or ended_at >= started_at),
  constraint workout_logs_ended_requires_terminal_status
    check (ended_at is null or status in ('completed', 'abandoned'))
);

create index if not exists workout_logs_user_idx on public.workout_logs (user_id);
create index if not exists workout_logs_user_started_idx
  on public.workout_logs (user_id, started_at desc);
create index if not exists workout_logs_plan_idx on public.workout_logs (gym_plan_id);
create index if not exists workout_logs_status_idx on public.workout_logs (status);

comment on table public.workout_logs is
  'Trainingseinheiten (Sessions), optional an einen gym_plan gekoppelt. gym_plan_id ist '
  'ON DELETE SET NULL, damit historische Protokolle beim Löschen eines Plans erhalten '
  'bleiben. RLS: nur Owner (user_id = auth.uid()) hat Zugriff.';

create or replace trigger workout_logs_set_updated_at
  before update on public.workout_logs
  for each row execute function public.set_updated_at();

-- =============================================================================
-- workout_log_exercises: tatsächlich durchgeführte Übungen einer Session
-- =============================================================================
create table if not exists public.workout_log_exercises (
  id                uuid primary key default gen_random_uuid(),
  workout_log_id    uuid not null references public.workout_logs (id) on delete cascade,
  exercise_id       uuid not null references public.exercises (id) on delete restrict,
  position          smallint not null,
  actual_sets       smallint,
  actual_reps       smallint,
  weight_kg         numeric(6,2),
  duration_seconds  integer,
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  constraint workout_log_exercises_position_positive check (position > 0),
  constraint workout_log_exercises_sets_positive
    check (actual_sets is null or actual_sets > 0),
  constraint workout_log_exercises_reps_positive
    check (actual_reps is null or actual_reps > 0),
  constraint workout_log_exercises_weight_nonneg
    check (weight_kg is null or weight_kg >= 0),
  constraint workout_log_exercises_duration_positive
    check (duration_seconds is null or duration_seconds > 0),
  constraint workout_log_exercises_log_position_uk unique (workout_log_id, position)
);

create index if not exists workout_log_exercises_log_idx
  on public.workout_log_exercises (workout_log_id);
create index if not exists workout_log_exercises_exercise_idx
  on public.workout_log_exercises (exercise_id);

comment on table public.workout_log_exercises is
  'Tatsächlich durchgeführte Übungen einer Trainingseinheit inkl. erreichter Sätze/'
  'Wiederholungen/Gewicht/Dauer und Ausführungsreihenfolge. Eine Zeile je Übung pro '
  'Session (nicht je Einzelsatz) gemäß aktueller Anforderung; satzweise Protokollierung '
  'wäre eine spätere, separate Erweiterung (workout_log_sets) und wird hier bewusst '
  'nicht vorgebaut.';

create or replace trigger workout_log_exercises_set_updated_at
  before update on public.workout_log_exercises
  for each row execute function public.set_updated_at();

-- =============================================================================
-- Row-Level Security
-- =============================================================================

-- --- Referenzdaten: exercises, equipment, muscle_groups + Junctions --------
-- Read-only für alle eingeloggten Nutzer:innen. Schreibzugriffe erfolgen
-- ausschließlich über service_role (Import-/Admin-Skripte), die RLS umgeht;
-- es existieren daher bewusst keine INSERT/UPDATE/DELETE-Policies für
-- authenticated.

alter table public.equipment enable row level security;
drop policy if exists equipment_select_authenticated on public.equipment;
create policy equipment_select_authenticated
  on public.equipment
  for select
  to authenticated
  using (true);

alter table public.muscle_groups enable row level security;
drop policy if exists muscle_groups_select_authenticated on public.muscle_groups;
create policy muscle_groups_select_authenticated
  on public.muscle_groups
  for select
  to authenticated
  using (true);

alter table public.exercises enable row level security;
drop policy if exists exercises_select_authenticated on public.exercises;
create policy exercises_select_authenticated
  on public.exercises
  for select
  to authenticated
  using (true);

alter table public.exercise_muscles enable row level security;
drop policy if exists exercise_muscles_select_authenticated on public.exercise_muscles;
create policy exercise_muscles_select_authenticated
  on public.exercise_muscles
  for select
  to authenticated
  using (true);

alter table public.exercise_equipment enable row level security;
drop policy if exists exercise_equipment_select_authenticated on public.exercise_equipment;
create policy exercise_equipment_select_authenticated
  on public.exercise_equipment
  for select
  to authenticated
  using (true);

-- --- gym_plans: Owner-only -------------------------------------------------

alter table public.gym_plans enable row level security;

drop policy if exists gym_plans_select_own on public.gym_plans;
create policy gym_plans_select_own
  on public.gym_plans
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists gym_plans_insert_own on public.gym_plans;
create policy gym_plans_insert_own
  on public.gym_plans
  for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists gym_plans_update_own on public.gym_plans;
create policy gym_plans_update_own
  on public.gym_plans
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists gym_plans_delete_own on public.gym_plans;
create policy gym_plans_delete_own
  on public.gym_plans
  for delete
  to authenticated
  using (user_id = auth.uid());

-- --- gym_plan_equipment: Owner-only über gym_plans ------------------------

alter table public.gym_plan_equipment enable row level security;

drop policy if exists gym_plan_equipment_select_own on public.gym_plan_equipment;
create policy gym_plan_equipment_select_own
  on public.gym_plan_equipment
  for select
  to authenticated
  using (
    exists (
      select 1 from public.gym_plans gp
      where gp.id = gym_plan_equipment.gym_plan_id
        and gp.user_id = auth.uid()
    )
  );

drop policy if exists gym_plan_equipment_write_own on public.gym_plan_equipment;
create policy gym_plan_equipment_write_own
  on public.gym_plan_equipment
  for all
  to authenticated
  using (
    exists (
      select 1 from public.gym_plans gp
      where gp.id = gym_plan_equipment.gym_plan_id
        and gp.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.gym_plans gp
      where gp.id = gym_plan_equipment.gym_plan_id
        and gp.user_id = auth.uid()
    )
  );

-- --- gym_plan_exercises: Owner-only über gym_plans ------------------------

alter table public.gym_plan_exercises enable row level security;

drop policy if exists gym_plan_exercises_select_own on public.gym_plan_exercises;
create policy gym_plan_exercises_select_own
  on public.gym_plan_exercises
  for select
  to authenticated
  using (
    exists (
      select 1 from public.gym_plans gp
      where gp.id = gym_plan_exercises.gym_plan_id
        and gp.user_id = auth.uid()
    )
  );

drop policy if exists gym_plan_exercises_write_own on public.gym_plan_exercises;
create policy gym_plan_exercises_write_own
  on public.gym_plan_exercises
  for all
  to authenticated
  using (
    exists (
      select 1 from public.gym_plans gp
      where gp.id = gym_plan_exercises.gym_plan_id
        and gp.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.gym_plans gp
      where gp.id = gym_plan_exercises.gym_plan_id
        and gp.user_id = auth.uid()
    )
  );

-- --- workout_logs: Owner-only ----------------------------------------------

alter table public.workout_logs enable row level security;

drop policy if exists workout_logs_select_own on public.workout_logs;
create policy workout_logs_select_own
  on public.workout_logs
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists workout_logs_insert_own on public.workout_logs;
create policy workout_logs_insert_own
  on public.workout_logs
  for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists workout_logs_update_own on public.workout_logs;
create policy workout_logs_update_own
  on public.workout_logs
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists workout_logs_delete_own on public.workout_logs;
create policy workout_logs_delete_own
  on public.workout_logs
  for delete
  to authenticated
  using (user_id = auth.uid());

-- --- workout_log_exercises: Owner-only über workout_logs ------------------

alter table public.workout_log_exercises enable row level security;

drop policy if exists workout_log_exercises_select_own on public.workout_log_exercises;
create policy workout_log_exercises_select_own
  on public.workout_log_exercises
  for select
  to authenticated
  using (
    exists (
      select 1 from public.workout_logs wl
      where wl.id = workout_log_exercises.workout_log_id
        and wl.user_id = auth.uid()
    )
  );

drop policy if exists workout_log_exercises_write_own on public.workout_log_exercises;
create policy workout_log_exercises_write_own
  on public.workout_log_exercises
  for all
  to authenticated
  using (
    exists (
      select 1 from public.workout_logs wl
      where wl.id = workout_log_exercises.workout_log_id
        and wl.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.workout_logs wl
      where wl.id = workout_log_exercises.workout_log_id
        and wl.user_id = auth.uid()
    )
  );
