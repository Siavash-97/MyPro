-- ============================================================
-- 0038: Der Gym-Trainingsplan faellt weg
-- ============================================================
-- Warum
-- -----
-- Produktentscheidung vom 19.08.2026: Der Kern von MyProSole sind die
-- Einlagen und die Ganganalyse. Der Gym-Trainingsplan – eigene Plaene
-- anlegen, Uebungen mit Saetzen, Wiederholungen, Gewicht und Pause
-- zusammenstellen, Einheiten durchfuehren und protokollieren – gehoert
-- nicht dazu. Er lag hinter einem unbeschrifteten Hantel-Knopf oben rechts
-- auf der Uebungen-Seite und verschwindet vollstaendig.
--
-- Was NICHT faellt, obwohl es danach aussieht
-- -------------------------------------------
-- workout_logs und workout_log_exercises bleiben.
--
-- Sie heissen so, weil sie fuer das Gym gebaut wurden, aber die
-- Mikroroutine schreibt genauso hinein – dafuer hat die Tabelle seit 0030
-- die Spalte `source` mit den Werten 'gym' und 'mikroroutine'. Wuerde man
-- sie mitloeschen, braeche vier Mal etwas, das mit dem Gym nichts zu tun
-- hat:
--
--   - Die Mikroroutine koennte nicht mehr festhalten, was gemacht wurde
--   - Auf der Uebungen-Seite fiele die Zaehlung "Routinen diese Woche" weg
--   - Im Verlauf fehlten die Eintraege
--   - Bei den Uebungen fiele die Markierung weg, welche schon gemacht sind
--
-- Aus workout_logs wird damit das, was es faktisch ohnehin schon ist: ein
-- Protokoll der Mikroroutine.
--
-- Auch nicht betroffen: exercises, equipment, muscle_groups und die beiden
-- Zuordnungstabellen. Der Uebungskatalog bleibt vollstaendig – die
-- Uebungen-Seite und die Mikroroutine leben davon.
--
-- Und `exercises.modality` behaelt den Wert 'gym'. Der beschreibt die
-- Uebung selbst ("braucht Geraete"), nicht das geloeschte Feature. Zwei
-- verschiedene Dinge, die zufaellig gleich heissen.
--
-- Was unwiderruflich verlorengeht
-- -------------------------------
-- Alle angelegten Trainingsplaene samt ihren Uebungen und Geraeten. Das ist
-- der ausdrueckliche Wunsch; es gibt keinen Weg zurueck ausser einer
-- Sicherung der Datenbank.
--
-- Die bereits protokollierten Gym-Einheiten in workout_logs bleiben
-- dagegen stehen. Sie verlieren nur ihren Verweis auf den Plan. Eine
-- Einheit, die stattgefunden hat, hat stattgefunden – sie nachtraeglich
-- aus dem Verlauf zu tilgen waere eine Geschichtsfaelschung, und der
-- Verlauf ist das Gedaechtnis des Nutzers, nicht unseres.
--
-- Zur Regel "erst erweitern, nie wegnehmen"
-- -----------------------------------------
-- Diese Migration bricht sie bewusst. Eine aeltere App-Fassung auf einem
-- Telefon ruft die Gym-Seiten weiter auf und bekommt dort Fehler. Das ist
-- hier vertretbar, weil es genau einen Nutzer gibt und er die APK ohnehin
-- neu baut. Bei echten Nutzern muesste stattdessen zuerst die neue Fassung
-- ausgeliefert und erst danach geloescht werden.
-- ============================================================

-- Zuerst der Verweis, dann die Ziele. Andersherum muesste man mit cascade
-- arbeiten, und cascade nimmt still mit, was man nicht bedacht hat.
alter table public.workout_logs
  drop column if exists gym_plan_id;

drop table if exists public.gym_plan_equipment;
drop table if exists public.gym_plan_exercises;
drop table if exists public.gym_plans;

-- Der Vorgabewert zeigte auf das, was es nicht mehr gibt. Die App setzt
-- die Quelle ohnehin ausdruecklich; der Vorgabewert soll trotzdem stimmen,
-- damit er niemanden in die Irre fuehrt.
alter table public.workout_logs
  alter column source set default 'mikroroutine';

-- Der Aufzaehlungswert 'gym' bleibt bestehen. Zwei Gruende: Bereits
-- protokollierte Einheiten tragen ihn, und PostgreSQL kann einen Wert aus
-- einem Aufzaehlungstyp nicht entfernen, ohne den Typ neu zu bauen und
-- jede Spalte umzuhaengen. Der Aufwand stuende in keinem Verhaeltnis.
comment on type public.workout_source is
  'Woher eine protokollierte Einheit stammt. ''mikroroutine'' ist seit 0038 '
  'die einzige Quelle, die neu entsteht; ''gym'' bleibt fuer Eintraege aus '
  'der Zeit vor dem Wegfall des Gym-Trainingsplans.';

comment on table public.workout_logs is
  'Protokoll der durchgefuehrten Mikroroutinen. Bis 0038 auch der '
  'Gym-Einheiten – jene Eintraege bleiben erhalten, ihr Plan nicht.';
