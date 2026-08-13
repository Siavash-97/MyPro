-- ============================================================
-- Migration 0009: Herzfrequenz-Felder fuer Smartwatch-Anbindung
-- ============================================================
-- Erweitert run_points um heart_rate_bpm (einzelne GPS-Punkte)
-- und runs um Herzfrequenz-Aggregatfelder. Vorbereitung fuer die
-- Web Bluetooth API Integration mit Heart Rate Service (0x180D).
--
-- Normalform: 3NF. Herzfrequenz haengt direkt vom Messpunkt (run_points)
-- bzw. vom aggregierten Lauf (runs) ab – keine transitiven Abhaengigkeiten.
--
-- Datenschutz (DSGVO):
--   Herzfrequenz ist ein biometrisches Datum (Art. 9). Die bestehenden
--   owner-only RLS-Policies auf runs und run_points schuetzen den Zugriff.
--   art9_consents mit scope 'training_diary' oder 'all' deckt diese Daten ab.
-- ============================================================

-- ── run_points: Herzfrequenz pro GPS-Punkt ─────────────────
alter table public.run_points
  add column if not exists heart_rate_bpm smallint;

comment on column public.run_points.heart_rate_bpm is
  'Herzfrequenz in Schlaegen pro Minute zum Zeitpunkt des GPS-Punkts. '
  'Quelle: Bluetooth Heart Rate Service (0x180D). '
  'Art. 9 biometrisches Datum. NULL wenn kein Geraet verbunden.';

-- ── runs: Aggregierte Herzfrequenz-Werte ───────────────────
alter table public.runs
  add column if not exists avg_heart_rate_bpm smallint;

alter table public.runs
  add column if not exists max_heart_rate_bpm smallint;

comment on column public.runs.avg_heart_rate_bpm is
  'Durchschnittliche Herzfrequenz ueber den gesamten Lauf. '
  'Berechnet beim Abschluss aus run_points.heart_rate_bpm.';
comment on column public.runs.max_heart_rate_bpm is
  'Maximale Herzfrequenz waehrend des Laufs. '
  'Berechnet beim Abschluss aus run_points.heart_rate_bpm.';

-- Constraints: Herzfrequenz in physiologisch sinnvollem Bereich
do $$ begin
  alter table public.run_points
    add constraint run_points_hr_range
    check (heart_rate_bpm is null or (heart_rate_bpm >= 30 and heart_rate_bpm <= 250));
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table public.runs
    add constraint runs_avg_hr_range
    check (avg_heart_rate_bpm is null or (avg_heart_rate_bpm >= 30 and avg_heart_rate_bpm <= 250));
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table public.runs
    add constraint runs_max_hr_range
    check (max_heart_rate_bpm is null or (max_heart_rate_bpm >= 30 and max_heart_rate_bpm <= 250));
exception when duplicate_object then null;
end $$;
