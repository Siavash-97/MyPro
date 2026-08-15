-- ============================================================
-- 0024: Zykluskalender – eingetragen ueber Fragen
-- ============================================================
-- Wie die Daten hineinkommen
-- --------------------------
-- Nicht ueber ein Formular, sondern ueber eine Frage am Tag:
--
--   "Haben die Beschwerden angefangen?"   nein -> morgen nochmal fragen
--                                          ja  -> Beginn ist heute
--   fuenf Tage spaeter:
--   "Ist es vorbei?"                       nein -> morgen nochmal fragen
--                                          ja  -> Ende ist heute
--
-- Deshalb braucht es hier keine Zustandsspalte fuer "welche Frage ist
-- gerade dran". Das ergibt sich aus den Daten: Gibt es eine Periode ohne
-- Ende, ist die Ende-Frage dran; gibt es keine, die Beginn-Frage. Ein
-- zusaetzliches Feld koennte von den Daten abweichen – dieses nicht.
--
-- last_asked_on ist die einzige Ausnahme, und die ist noetig: Ohne sie
-- stuende dieselbe Frage nach einem "nein" sofort wieder da.
--
-- Was NICHT erhoben wird
-- ----------------------
-- Nur Beginn und Ende. Keine Symptome, keine Staerke, keine Stimmung –
-- so steht es im Entwurf, und dabei bleibt es. Was man nicht speichert,
-- kann auch nicht abfliessen.
--
-- Zyklusdaten sind Gesundheitsdaten nach Art. 9 DSGVO. Sie bekommen
-- deshalb einen eigenen Einwilligungsbereich, nicht den der Anamnese:
-- Wer in das eine einwilligt, hat damit nicht in das andere eingewilligt.
-- ============================================================

alter type public.art9_consent_scope add value if not exists 'cycle';


create table if not exists public.cycle_settings (
  user_id      uuid primary key references public.profiles (id) on delete cascade,
  -- regular: MyProSole sagt den naechsten Beginn voraus.
  -- irregular: keine Vorhersage. Gefragt wird trotzdem – fragen ist
  -- keine Vorhersage, und ohne Frage kaeme nie ein Eintrag zustande.
  mode         text not null default 'regular',
  average_days smallint not null default 28,
  -- Tag der letzten gestellten Frage. Verhindert, dass nach einem "nein"
  -- dieselbe Frage sofort wieder erscheint.
  last_asked_on date,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  constraint cycle_settings_mode_known check (mode in ('regular', 'irregular')),
  constraint cycle_settings_average_range check (average_days between 20 and 45)
);

alter table public.cycle_settings enable row level security;

-- Nur die eigene Zeile, in jede Richtung. Anders als beim Community-Profil
-- gibt es hier bewusst keine Leseregel fuer andere: Das sind
-- Gesundheitsdaten, die sieht ausser der Person niemand.
drop policy if exists cycle_settings_own on public.cycle_settings;
create policy cycle_settings_own
  on public.cycle_settings for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());


create table if not exists public.cycle_periods (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  started_on date not null,
  -- Offen, solange die Periode laeuft. Genau daran erkennt die App, dass
  -- die Ende-Frage dran ist.
  ended_on   date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint cycle_periods_order check (ended_on is null or ended_on >= started_on),
  constraint cycle_periods_user_start_uk unique (user_id, started_on)
);

create index if not exists cycle_periods_user_idx
  on public.cycle_periods (user_id, started_on desc);

-- Hoechstens eine offene Periode pro Person. Sonst waere nicht mehr
-- eindeutig, worauf sich die Frage "Ist es vorbei?" bezieht.
create unique index if not exists cycle_periods_one_open_per_user
  on public.cycle_periods (user_id)
  where ended_on is null;

alter table public.cycle_periods enable row level security;

drop policy if exists cycle_periods_own on public.cycle_periods;
create policy cycle_periods_own
  on public.cycle_periods for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());


drop trigger if exists set_updated_at on public.cycle_settings;
create trigger set_updated_at
  before update on public.cycle_settings
  for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at on public.cycle_periods;
create trigger set_updated_at
  before update on public.cycle_periods
  for each row execute function public.set_updated_at();


comment on table public.cycle_periods is
  'Beginn und Ende der Periode – sonst nichts. Gesundheitsdaten nach '
  'Art. 9 DSGVO, nur fuer die Person selbst lesbar.';
