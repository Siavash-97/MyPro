-- ============================================================
-- 0030: Die Mikroroutine hinterlaesst eine Spur
-- ============================================================
-- Warum
-- -----
-- Auf der Uebungen-Seite soll stehen, wie oft man die Uebungen in der Woche
-- gemacht hat. Das ging bisher nicht, weil nichts davon gespeichert wurde:
-- Der Abschluss der Mikroroutine landete in einem einzigen Eintrag im
-- Browserspeicher – "myprosole_routine_erledigt = 2026-08-17" – der beim
-- naechsten Mal ueberschrieben wird.
--
-- Damit liess sich genau eine Frage beantworten: "war ich heute schon
-- dran?". Dafuer war es auch gedacht. Eine Woche laesst sich daraus nicht
-- rekonstruieren, und mit einem neuen Telefon ist alles weg.
--
-- Warum keine neue Tabelle
-- ------------------------
-- workout_logs ist genau dafuer da: eine durchgefuehrte Uebungseinheit.
-- gym_plan_id ist dort seit 0005 ausdruecklich optional, mit dem Kommentar
-- "ad-hoc moeglich" – eine Mikroroutine ohne Plan ist dieser Fall.
--
-- Es fehlt nur die Unterscheidung. Ohne sie zaehlte die Wochenstatistik die
-- Gym-Einheiten mit, und die sind etwas anderes: dort wird eingetragen, was
-- man geschafft hat, hier wird angeleitet.
--
-- Der Status reicht fuer die Zaehlung
-- -----------------------------------
-- Eine abgebrochene Routine zaehlt voll, wenn mindestens die Haelfte der
-- Uebungen gemacht wurde – erledigte Uebungen mal zwei, mindestens die
-- Gesamtzahl. Dafuer braucht es keine eigene Spalte, denn den Status gibt
-- es schon:
--
--   Schwelle erreicht  -> completed  -> zaehlt
--   darunter           -> abandoned  -> zaehlt nicht, bleibt aber stehen
--
-- So bleibt sichtbar, dass jemand angefangen hat, ohne dass die Zahl sich
-- schoenrechnet. Die Statistik zaehlt die completed-Zeilen der Woche.
--
-- Bestandsdaten
-- -------------
-- Alle vorhandenen Zeilen bekommen 'gym'. Das stimmt: Bis heute hat nur die
-- Gym-Einheit hierher geschrieben.
--
-- Kein neuer Index. Die Abfrage filtert auf user_id und started_at, und
-- dafuer gibt es workout_logs_user_started_idx aus 0005. Ein zusaetzlicher
-- Index auf source waere bei ein paar Zeilen pro Person und Woche nur
-- Ballast.
-- ============================================================

do $$
begin
  if not exists (select 1 from pg_type where typname = 'workout_source') then
    create type public.workout_source as enum (
      'gym',           -- geführte Trainingseinheit aus einem Plan oder ad hoc
      'mikroroutine'   -- die kurze angeleitete Routine nach dem Lauf
    );
  end if;
end $$;

alter table public.workout_logs
  add column if not exists source public.workout_source not null default 'gym';

comment on column public.workout_logs.source is
  'Woher die Einheit stammt. gym = Trainingseinheit mit Eintragen von Saetzen '
  'und Gewicht, mikroroutine = die kurze angeleitete Routine. Die '
  'Wochenstatistik der Uebungen zaehlt nur die Mikroroutinen.';
