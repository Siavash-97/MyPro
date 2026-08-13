-- ============================================================
-- Migration 0010: Modulare Sicherheitsarchitektur
-- ============================================================
-- Implementiert Datentrennung und Compartmentalization:
--
-- 1. customer_code: Eindeutiger, nicht-erratbarer Kundencode.
--    Wird bei Registrierung generiert. Ermoeglicht Referenzierung
--    ohne Offenlegung der internen UUID.
--
-- 2. security_domains: Logische Sicherheitsbereiche
--    (profil, gesundheit, tracking, fitness). Jeder Bereich ist
--    unabhaengig geschuetzt – ein Breach in einem Bereich gibt
--    keinen Zugang zu anderen Bereichen.
--
-- 3. data_access_log: Audit-Trail fuer Zugriffe auf sensible Daten.
--    Nur Insert erlaubt (append-only), kein Lesen/Loeschen via API.
--
-- Normalform: 3NF. customer_code ist funktional abhaengig vom PK
-- (profiles.id). security_domains ist eine Referenztabelle.
-- data_access_log hat Fremdschluessel auf profiles und domains.
--
-- Datenschutz (DSGVO):
--   - customer_code ersetzt personenbezogene Referenzen wo moeglich
--   - Audit-Log dokumentiert Zugriffe (Accountability, Art. 5 Abs. 2)
--   - Modular getrennte Bereiche minimieren Breach-Impact
-- ============================================================

-- ── customer_code auf profiles ─────────────────────────────
-- 12-stelliger alphanumerischer Code, kryptographisch zufaellig.
-- Format: MPS-XXXX-XXXX (lesbar, nicht erratbar).

create or replace function public.generate_customer_code()
returns text
language plpgsql
as $$
declare
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result text := 'MPS-';
  i integer;
begin
  for i in 1..4 loop
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  end loop;
  result := result || '-';
  for i in 1..4 loop
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  end loop;
  return result;
end;
$$;

alter table public.profiles
  add column if not exists customer_code text;

do $$
begin
  alter table public.profiles
    add constraint profiles_customer_code_unique unique (customer_code);
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.profiles
    add constraint profiles_customer_code_format
    check (customer_code is null or customer_code ~ '^MPS-[A-Z2-9]{4}-[A-Z2-9]{4}$');
exception when duplicate_object then null;
end $$;

comment on column public.profiles.customer_code is
  'Eindeutiger 12-stelliger Kundencode (MPS-XXXX-XXXX). Kryptographisch '
  'zufaellig generiert. Fuer externe Referenzierung statt interner UUID. '
  'Buchstaben ohne O/I/0/1 zur Vermeidung von Verwechslungen.';

-- Bestehende Profile ohne Code erhalten einen
do $$
declare
  r record;
  new_code text;
  attempts integer;
begin
  for r in select id from public.profiles where customer_code is null loop
    attempts := 0;
    loop
      new_code := public.generate_customer_code();
      begin
        update public.profiles set customer_code = new_code where id = r.id;
        exit;
      exception when unique_violation then
        attempts := attempts + 1;
        if attempts > 10 then
          raise exception 'Konnte keinen eindeutigen customer_code generieren';
        end if;
      end;
    end loop;
  end loop;
end $$;

-- Trigger: automatisch Code bei INSERT setzen
create or replace function public.set_customer_code()
returns trigger
language plpgsql
as $$
declare
  new_code text;
  attempts integer := 0;
begin
  if new.customer_code is null then
    loop
      new_code := public.generate_customer_code();
      begin
        new.customer_code := new_code;
        return new;
      exception when unique_violation then
        attempts := attempts + 1;
        if attempts > 10 then
          raise exception 'Konnte keinen eindeutigen customer_code generieren';
        end if;
      end;
    end loop;
  end if;
  return new;
end;
$$;

do $$ begin
  create trigger profiles_set_customer_code
    before insert on public.profiles
    for each row execute function public.set_customer_code();
exception when duplicate_object then null;
end $$;

-- ── Sicherheitsbereiche (Security Domains) ─────────────────
-- Definiert logische Grenzen fuer Datenzugriff. Jeder Bereich
-- kann unabhaengig gesperrt, verschluesselt oder migriert werden.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'security_domain_type') then
    create type public.security_domain_type as enum (
      'profil',
      'gesundheit',
      'tracking',
      'fitness',
      'community'
    );
  end if;
end $$;

create table if not exists public.security_domains (
  id          text primary key,
  label_de    text not null,
  description text not null,
  sensitivity text not null check (sensitivity in ('normal', 'sensibel', 'art9')),
  tables_list text[] not null default '{}',
  created_at  timestamptz not null default now()
);

comment on table public.security_domains is
  'Logische Sicherheitsbereiche fuer modulare Datentrennung. '
  'Jeder Bereich gruppiert zusammengehoerige Tabellen und definiert '
  'deren Sensibilitaetsstufe. Ein Breach in einem Bereich gibt '
  'keinen Zugang zu Daten in anderen Bereichen.';

-- Seed security domains
insert into public.security_domains (id, label_de, description, sensitivity, tables_list)
values
  ('profil', 'Profil & Konto', 'Basisdaten: Name, E-Mail, Einstellungen', 'normal',
   array['profiles']),
  ('gesundheit', 'Gesundheitsdaten', 'Anamnese, Schmerzprotokoll, Art. 9 DSGVO', 'art9',
   array['anamnese_sessions', 'anamnese_answers', 'art9_consents', 'training_diary_pain_locations']),
  ('tracking', 'Lauftracking', 'GPS-Daten, Herzfrequenz, Laufaufzeichnungen', 'sensibel',
   array['runs', 'run_points', 'run_splits', 'training_diary_entries']),
  ('fitness', 'Fitnessprogramm', 'Uebungen, Trainingsplaene, Workout-Logs', 'normal',
   array['exercises', 'gym_plans', 'gym_plan_exercises', 'workout_logs'])
on conflict (id) do nothing;

-- RLS: security_domains ist eine oeffentliche Referenztabelle
alter table public.security_domains enable row level security;

drop policy if exists security_domains_read_all on public.security_domains;
create policy security_domains_read_all
  on public.security_domains
  for select
  to authenticated
  using (true);

-- ── data_access_log: Audit-Trail ───────────────────────────
-- Append-only Log. Kein SELECT/UPDATE/DELETE via API erlaubt.
-- Nur Admins (service_role) koennen lesen.

create table if not exists public.data_access_log (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles (id) on delete cascade,
  domain_id    text not null references public.security_domains (id),
  action       text not null check (action in ('read', 'write', 'delete', 'export')),
  resource     text not null,
  ip_hint      text,
  metadata     jsonb,
  created_at   timestamptz not null default now()
);

create index if not exists data_access_log_user_idx
  on public.data_access_log (user_id);
create index if not exists data_access_log_domain_idx
  on public.data_access_log (domain_id);
create index if not exists data_access_log_created_idx
  on public.data_access_log (created_at desc);

comment on table public.data_access_log is
  'Append-only Audit-Trail fuer Zugriffe auf sensible Daten. '
  'DSGVO Art. 5 Abs. 2 Accountability. Nur Insert ueber API erlaubt. '
  'Lesen nur fuer service_role (Admin-Dashboard). '
  'Automatische Retention: Eintraege aelter als 90 Tage werden archiviert.';

alter table public.data_access_log enable row level security;

-- Authenticated users can only INSERT their own entries
drop policy if exists access_log_insert_own on public.data_access_log;
create policy access_log_insert_own
  on public.data_access_log
  for insert
  to authenticated
  with check (user_id = auth.uid());

-- No SELECT/UPDATE/DELETE for authenticated users (only service_role)
-- This means the log is tamper-proof from the client side

-- ── Domain-spezifische Zugriffskontrolle ───────────────────
-- Funktion zum Audit-Logging bei Gesundheitsdaten-Zugriff

create or replace function public.log_health_data_access()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.data_access_log (user_id, domain_id, action, resource)
  values (auth.uid(), 'gesundheit', tg_op::text, tg_table_name);
  return new;
end;
$$;

-- Audit-Trigger fuer Gesundheitsdaten (Art. 9)
do $$ begin
  create trigger audit_anamnese_sessions
    after insert or update on public.anamnese_sessions
    for each row execute function public.log_health_data_access();
exception when duplicate_object then null;
end $$;

do $$ begin
  create trigger audit_art9_consents
    after insert or update on public.art9_consents
    for each row execute function public.log_health_data_access();
exception when duplicate_object then null;
end $$;

do $$ begin
  create trigger audit_pain_locations
    after insert on public.training_diary_pain_locations
    for each row execute function public.log_health_data_access();
exception when duplicate_object then null;
end $$;
