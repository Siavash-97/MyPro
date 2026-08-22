-- ============================================================
-- 0050: Die Eindeutigkeit der GPS-Punkte benutzbar machen
-- ============================================================
-- Das Problem
-- -----------
-- Seit 0033 sollte ein zweiter Uebertragungsversuch gefahrlos sein: Die
-- Datenbank weist Doppelte ab, die App muss nicht wissen, ob der erste
-- Versuch ankam. Der Index dafuer wurde angelegt - aber als TEILWEISER
-- Index:
--
--   create unique index run_points_client_id_uk
--     on public.run_points (run_id, client_id)
--     where client_id is not null;      <-- hier
--
-- PostgreSQL kann einen teilweisen Index fuer "on conflict" nur benutzen,
-- wenn dieselbe Bedingung in der Anweisung mitsteht. PostgREST schreibt
-- aber nur die Spalten hin. Ergebnis, gegen die Produktionsdatenbank
-- gemessen am 22.08.2026:
--
--   POST /rest/v1/run_points?on_conflict=run_id,client_id
--   -> 42P10  there is no unique or exclusion constraint matching
--             the ON CONFLICT specification
--
-- Das ist ein Planungsfehler: Er trifft JEDE Uebertragung, unabhaengig von
-- Netz, Anmeldung und Zeilenrechten. Seit 0033 ist damit kein einziger
-- GPS-Punkt angekommen. Auf dem Testgeraet lagen 581 Punkte aus vier
-- Laeufen im oertlichen Puffer, der aelteste ueber einen Tag alt. Die
-- Strecken waren auf jeder Detailseite leer ("Keine GPS-Daten"), waehrend
-- Strecke, Zeit und Splits richtig dastanden - die kommen aus anderen
-- Tabellen.
--
-- Warum es niemand gemerkt hat: Die App verschluckt den Fehler an beiden
-- Enden. Das wird im selben Zug behoben (punkteSenden.ts, run.ts).
--
-- Die Loesung
-- -----------
-- Denselben Index ohne Bedingung. Die Zusicherung bleibt dieselbe:
-- In einem eindeutigen Index sind NULL-Werte voneinander verschieden,
-- deshalb stossen Bestandszeilen ohne client_id (aus der Zeit vor 0033)
-- weiterhin nicht aneinander. Der Unterschied ist allein, dass "on
-- conflict (run_id, client_id)" den Index jetzt findet.
--
-- Der Preis ist ein etwas groesserer Index, weil er auch die Bestandszeilen
-- mitfuehrt. Das ist der ganze Unterschied - und er ist es wert.
--
-- Reihenfolge: erst den neuen Index anlegen, dann den alten wegnehmen.
-- Andersherum stuende die Tabelle kurz ohne Schutz gegen Doppelte da.
--
-- Sperre: "create unique index" haelt Schreibzugriffe auf run_points, bis
-- er fertig ist. Bei der heutigen Groesse sind das Sekundenbruchteile. Wenn
-- die Tabelle einmal gross ist, gehoert hier "concurrently" hin - das geht
-- dann aber nicht mehr in einer Transaktion und braucht einen eigenen Lauf.
-- ============================================================

create unique index if not exists run_points_run_client_uk
  on public.run_points (run_id, client_id);

comment on index public.run_points_run_client_uk is
  'Verhindert doppelte Punkte bei wiederholter Uebertragung. Bewusst NICHT '
  'teilweise: ein teilweiser Index ist fuer "on conflict" ohne dieselbe '
  'Bedingung unbrauchbar, und PostgREST schickt sie nicht mit. Siehe 0050.';

drop index if exists public.run_points_client_id_uk;

-- Keine Aenderung an den Zeilenrechten: Dieselbe Tabelle, dieselben Regeln
-- aus 0008. Der Fehler sass im Plan, nicht in der Berechtigung.
