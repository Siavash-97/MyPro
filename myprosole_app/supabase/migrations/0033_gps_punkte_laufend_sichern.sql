-- ============================================================
-- 0033: GPS-Punkte laufend sichern statt einmal am Ende
-- ============================================================
-- Das Problem
-- -----------
-- Bisher wurde ein Lauf erst beim Beenden geschrieben – die Zeile in runs,
-- danach alle Punkte auf einmal. Waehrend des Laufs stand nichts in der
-- Datenbank. Geht der Akku leer, stuerzt die App ab oder beendet Android
-- sie im Hintergrund, ist der ganze Lauf weg.
--
-- Ab jetzt entsteht die Lauf-Zeile beim Start (status 'tracking' – dafuer
-- war der Status von Anfang an vorgesehen), und die Punkte gehen alle 30
-- Sekunden in Buendeln raus.
--
-- Warum eine Kennung vom Geraet
-- -----------------------------
-- Eine Uebertragung kann scheitern, nachdem die Datenbank sie schon
-- angenommen hat – schlechtes Netz, Zeitueberschreitung. Die App versucht
-- es dann erneut. Ohne Vorkehrung stuende alles zweimal da, und die
-- Strecke waere doppelt so lang.
--
-- Deshalb vergibt das Geraet je Punkt eine Kennung, und die Datenbank
-- weist Doppelte ab. Damit ist ein zweiter Versuch immer gefahrlos: Die App
-- muss nicht wissen, ob der erste angekommen ist – sie schickt einfach
-- nochmal.
--
-- Das ist der Unterschied zwischen "meistens richtig" und "richtig".
--
-- Warum nicht (run_id, recorded_at) als Schluessel
-- ------------------------------------------------
-- Zwei Punkte koennen denselben Zeitstempel tragen – manche Geraete liefern
-- mehrere Messungen pro Sekunde, und der Zeitstempel hat nur
-- Sekundenaufloesung. Dann waere ein echter Punkt faelschlich ein
-- Duplikat und wuerde verworfen. Eine eigene Kennung hat dieses Problem
-- nicht.
-- ============================================================

alter table public.run_points
  add column if not exists client_id uuid;

comment on column public.run_points.client_id is
  'Vom Geraet vergebene Kennung. Verhindert doppelte Punkte, wenn eine '
  'Uebertragung wiederholt wird, weil ihr Ergebnis unbekannt blieb.';

-- Teilweiser Index: Nur Zeilen mit Kennung sind betroffen. Bestandsdaten
-- aus der Zeit davor haben keine und bleiben unberuehrt.
create unique index if not exists run_points_client_id_uk
  on public.run_points (run_id, client_id)
  where client_id is not null;

-- Fuer das Nachladen der Strecke: Punkte eines Laufs in ihrer Reihenfolge.
create index if not exists run_points_run_recorded_idx
  on public.run_points (run_id, recorded_at);


-- Ein Lauf darf jetzt aktualisiert werden, nicht nur angelegt: Beim Start
-- entsteht die Zeile mit status 'tracking', beim Beenden bekommt sie ihre
-- Kennzahlen. Die Regel dafuer gibt es seit 0008; hier steht nur der
-- Hinweis, dass sie ab jetzt wirklich gebraucht wird.
comment on column public.runs.status is
  'tracking = laeuft gerade, die Zeile entsteht beim Start. completed = '
  'beendet, mit Kennzahlen. abandoned = abgebrochen. Ein Lauf, der lange in '
  'tracking haengt, ist ein Absturz oder leerer Akku – die Punkte bis dahin '
  'sind trotzdem gesichert.';
