-- ============================================================
-- 0039: Der Uebungskatalog wird geleert
-- ============================================================
-- Warum
-- -----
-- Der Katalog stammt aus einer freien Uebungsdatenbank (0015) und wurde nie
-- fuer MyProSole ausgewaehlt: 94 Uebungen, davon 17 mit der Einteilung
-- 'gym'. Nach dem Wegfall des Gym-Trainingsplans (0038) passt das nicht
-- mehr – die App soll Uebungen zeigen, fuer die niemand ins Studio muss.
--
-- Die Einteilung selbst war ausserdem unzuverlaessig. Beim Durchsehen der
-- 17 Gym-Uebungen brauchten neun tatsaechlich ein Geraet im Studio
-- (Langhantel, Kabelzug, Latzug, Flachbank); die uebrigen acht kamen mit
-- Kurzhanteln aus oder mit gar nichts. "Einbeiniges Wadenheben im Sitzen"
-- stand als 'gym' im Katalog und braucht einen Stuhl.
--
-- Einzelne Zeilen zu korrigieren hiesse, eine Auswahl zu flicken, die nie
-- getroffen wurde. Deshalb: leeren und spaeter bewusst befuellen.
--
-- Was geloescht wird
-- ------------------
--   exercises                 alle Zeilen
--   exercise_muscles          faellt mit (Fremdschluessel cascade)
--   exercise_equipment        faellt mit (Fremdschluessel cascade)
--   workout_log_exercises     alle Zeilen – siehe unten
--
-- Der Verweis von workout_log_exercises auf exercises steht auf RESTRICT.
-- Das ist richtig so: Es verhindert, dass beim Aufraeumen des Katalogs
-- stillschweigend jemandes Verlauf mitverschwindet. Hier wird die Sperre
-- bewusst aufgeloest, indem die Protokollzeilen zuerst geloescht werden.
--
-- Das ist vertretbar, weil der Bestand ausschliesslich aus Testlaeufen des
-- Entwicklers besteht (ausdruecklich bestaetigt am 19.08.2026). Bei echten
-- Nutzern waere dieser Weg falsch – dort muesste der Katalog eine Spalte
-- "sichtbar" bekommen und die alten Uebungen nur ausgeblendet werden,
-- damit der Verlauf lesbar bleibt.
--
-- Die Einheiten selbst (workout_logs) bleiben stehen. Sie verlieren ihre
-- Einzelheiten, nicht ihre Existenz: Wann trainiert wurde und ob es
-- zaehlte, steht weiterhin da.
--
-- Was bleibt
-- ----------
-- equipment und muscle_groups. Das sind keine Uebungen, sondern das
-- Vokabular, mit dem Uebungen beschrieben werden – Muskelgruppen und
-- Geraete. Sie werden gebraucht, sobald der Katalog neu befuellt wird, und
-- sie kosten nichts.
--
-- Folge in der App
-- ----------------
-- Die Uebungen-Seite und die Mikroroutine sind danach leer. Beide fangen
-- das ab: Die Mikroroutine sagt "Fuer die Routine sind noch keine Uebungen
-- hinterlegt" statt in einen leeren Ablauf zu laufen.
--
-- Zu den Seed-Migrationen
-- -----------------------
-- 0007 und 0015 legen den Katalog an. Sie werden nicht geaendert: Eine
-- Migration beschreibt, was zu ihrem Zeitpunkt geschah, und das nachtraeglich
-- umzuschreiben macht die Kette unlesbar. Ein Neuaufbau spielt sie ein und
-- diese Migration raeumt danach auf – ein paar Sekunden Umweg fuer eine
-- Reihenfolge, die der Wirklichkeit entspricht.
-- ============================================================

-- Zuerst die Sperre aufloesen, dann die Ziele. delete statt truncate:
-- truncate umgeht die Fremdschluessel nicht, sondern verlangt cascade – und
-- cascade nimmt still mit, was man nicht bedacht hat.
delete from public.workout_log_exercises;

-- exercise_muscles und exercise_equipment haengen mit cascade daran und
-- gehen von selbst mit.
delete from public.exercises;

comment on table public.exercises is
  'Uebungskatalog. Mit 0039 geleert: Der uebernommene Bestand aus einer '
  'freien Datenbank war nie fuer MyProSole ausgewaehlt und enthielt '
  'Studio-Uebungen. Wird bewusst neu befuellt – ohne Uebungen, fuer die man '
  'ins Studio muss.';
