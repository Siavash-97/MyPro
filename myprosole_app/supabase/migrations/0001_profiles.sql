-- =============================================================================
-- 0001_profiles.sql
-- Feature: Nutzerprofile (Basistabelle fuer alle weiteren Migrationen)
--
-- Scope:
--   - profiles: zentrale Nutzertabelle, 1:1-Verknuepfung mit auth.users
--   - set_updated_at() Trigger-Funktion (idempotent, wird von allen
--     Folge-Migrationen wiederverwendet)
--
-- Normalform: 3NF. Jede Spalte haengt direkt vom PK (id) ab; es existieren
-- keine transitiven oder partiellen Abhaengigkeiten.
--
-- Wiederholbarkeit: Alle DDL-Anweisungen sind idempotent (IF NOT EXISTS /
-- CREATE OR REPLACE / DROP POLICY IF EXISTS + CREATE POLICY), damit die
-- Migration gemaess DEVELOPMENT_STANDARDS.md mehrfach ausfuehrbar ist.
--
-- Datenschutz (DSGVO):
--   - Privacy by Design / Datenminimierung: nur fuer Phase 1 benoetigte
--     Felder (Anzeigename, Laufniveau, Wochenziel, Avatar).
--   - profiles.id = auth.users.id mit ON DELETE CASCADE stellt sicher,
--     dass beim Loeschen eines Supabase-Auth-Kontos das Profil automatisch
--     entfernt wird (Recht auf Loeschung).
--   - RLS: strikt Owner-only (auth.uid() = id). Kein Zugriff auf fremde
--     Profile ueber die API moeglich.
--   - Keine besonders sensiblen Daten (Art. 9) in dieser Tabelle.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Extensions
-- -----------------------------------------------------------------------------
create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- Trigger-Funktion fuer updated_at (idempotent via CREATE OR REPLACE)
--
-- Wird hier definiert, damit 0001 eigenstaendig ausfuehrbar ist. Spaetere
-- Migrationen (0005, 0006, ...) verwenden dieselbe Funktion wieder.
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
-- profiles: zentrale Nutzertabelle
--
-- PK = auth.users.id (UUID). Jeder Supabase-Auth-Nutzer erhaelt genau ein
-- Profil. Alle nutzerbezogenen Tabellen (gym_plans, workout_logs,
-- anamnese_sessions, training_diary_entries, ...) referenzieren
-- profiles(id) als FK.
-- =============================================================================
create table if not exists public.profiles (
  id              uuid primary key references auth.users (id) on delete cascade,

  display_name    text not null,
  running_level   text,
  weekly_goal_km  numeric(5,1),
  avatar_url      text,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  -- display_name: max 50 Zeichen, darf nicht leer sein
  constraint profiles_display_name_length
    check (char_length(btrim(display_name)) between 1 and 50),

  -- running_level: nur definierte Werte (Phase 1)
  constraint profiles_running_level_valid
    check (running_level is null or running_level in (
      'anfaenger', 'fortgeschritten', 'erfahren'
    )),

  -- weekly_goal_km: 0-500 km, sinnvoller Bereich fuer Wochenziele
  constraint profiles_weekly_goal_km_range
    check (weekly_goal_km is null or (weekly_goal_km >= 0 and weekly_goal_km <= 500))
);

comment on table public.profiles is
  'Zentrale Nutzertabelle, 1:1 mit auth.users verknuepft. PK = auth.users.id. '
  'Alle nutzerbezogenen Tabellen referenzieren profiles(id) als FK. '
  'Phase 1: minimaler Datensatz (Datenminimierung).';
comment on column public.profiles.id is
  'Supabase Auth User-ID. Identisch mit auth.users.id, ON DELETE CASCADE '
  'fuer automatische Profilloeschung bei Kontoentfernung.';
comment on column public.profiles.display_name is
  'Anzeigename, 1-50 Zeichen. Pflichtfeld.';
comment on column public.profiles.running_level is
  'Selbsteinschaetzung Laufniveau. Wird im Profil-Setup gesetzt. '
  'Erlaubte Werte: anfaenger, fortgeschritten, erfahren.';
comment on column public.profiles.weekly_goal_km is
  'Persoenliches Wochenziel in Kilometern (0-500). Optional.';
comment on column public.profiles.avatar_url is
  'URL zum Profilbild. Optional, keine DB-seitige URL-Validierung.';

-- -----------------------------------------------------------------------------
-- Index: created_at fuer Admin-Abfragen (Nutzer-Wachstum, Kohortenanalyse)
-- -----------------------------------------------------------------------------
create index if not exists profiles_created_at_idx
  on public.profiles (created_at);

-- -----------------------------------------------------------------------------
-- Trigger: updated_at automatisch setzen
-- -----------------------------------------------------------------------------
create or replace trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- =============================================================================
-- Row Level Security (RLS) – Owner-only
--
-- Jede:r Nutzer:in darf ausschliesslich das eigene Profil lesen, erstellen,
-- aendern und loeschen. Da profiles.id = auth.uid(), wird direkt auf id
-- geprueft (kein separates user_id-Feld noetig).
-- =============================================================================

alter table public.profiles enable row level security;

-- SELECT: nur eigenes Profil lesen
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own
  on public.profiles
  for select
  to authenticated
  using (id = auth.uid());

-- INSERT: nur eigenes Profil anlegen
drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own
  on public.profiles
  for insert
  to authenticated
  with check (id = auth.uid());

-- UPDATE: nur eigenes Profil aendern
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own
  on public.profiles
  for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- DELETE: nur eigenes Profil loeschen
drop policy if exists profiles_delete_own on public.profiles;
create policy profiles_delete_own
  on public.profiles
  for delete
  to authenticated
  using (id = auth.uid());
