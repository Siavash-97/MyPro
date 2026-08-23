-- ============================================================
-- 0051: Ein Urteil je Messpunkt
-- ============================================================
-- Das Problem
-- -----------
-- Ueber ein und dasselbe Segment zwischen zwei Messungen entschieden zwei
-- getrennte Waechter:
--
--   istOrtungssprung      entschied ueber die STRECKE
--   bewegungszeitAnteilS  entschied ueber die ZEIT
--
-- Sie waren nicht aufeinander abgestimmt. Fiel ein Segment durch den
-- Zeitwaechter (Luecke groesser als 15 Sekunden), blieb der Weg stehen und
-- die Zeit verschwand. Das Tempo wurde dadurch schneller, als je jemand
-- gelaufen ist.
--
-- Gemessen am 22.08.2026, unsere App und Strava gleichzeitig auf demselben
-- Telefon, dieselbe Aufzeichnung:
--
--   19 Segmente trugen 371 m Strecke bei und 0 Sekunden Zeit
--   1.516 Sekunden fielen ersatzlos weg
--   Tempo: 2:43 min/km, waehrend Strava 4:24 min/km meldete
--
-- Und schlimmer: Dieselbe Frage wurde ZWEIMAL beantwortet - einmal live
-- waehrend des Laufs, einmal beim Nachrechnen der Kilometer-Abschnitte. Am
-- 22.08. summierten sich die Abschnitte deshalb auf 5,2 km, waehrend
-- daneben "4,0 km" stand.
--
-- Was diese Spalte aendert
-- ------------------------
-- Das Urteil faellt ab jetzt EINMAL, beim Entstehen des Punktes, und wird
-- mitgespeichert. Wer spaeter nachrechnet, LIEST es, statt es neu zu
-- erfinden. Eine Regel kann nicht mehr an zwei Orten auseinanderlaufen,
-- weil es den zweiten Ort nicht mehr gibt.
--
--   'gezaehlt'  Strecke und Zeit zaehlen beide voll
--   'sprung'    Weg nachweislich nicht zurueckgelegt; beides faellt
--   'halt'      zu langsam fuer Bewegung; Strecke bleibt, Zeit bekommt
--               ihre belegbare Untergrenze (Strecke / 0,9 m/s)
--
-- Warum Text und nicht ein Bit
-- ----------------------------
-- "Zaehlt / zaehlt nicht" reicht nicht: Verworfenes soll dem Menschen
-- BERICHTET werden, und dafuer muss dastehen, warum. Ein Sprung ist ein
-- Verlust und gehoert gemeldet; ein Halt ist eine Feststellung und gehoert
-- gerade nicht gemeldet, sonst sieht jeder Ampelstopp wie ein Fehler aus.
--
-- Text und nicht ein Postgres-Enum, und der naheliegende Grund traegt
-- NICHT: "where urteil = 'sprung'" schreibt sich bei einem Enum genauso.
-- Der echte Handel ist Platz gegen Beweglichkeit:
--
--   Enum   4 Byte je Zeile, Tippfehler unmoeglich - aber ein Wert laesst
--          sich nicht entfernen und nicht ohne Umbau umbenennen
--   Text   rund 9 Byte je Zeile - dafuer ist jede Aenderung der Wertemenge
--          eine gewoehnliche Migration, und Rohdaten-Exporte bleiben lesbar
--
-- Bei den heutigen paar tausend Zeilen sind das etwa 2 Prozent dessen, was
-- ein Punkt samt Indizes ohnehin kostet. Beide Stile gibt es im Projekt
-- schon (0008 Enum, 0010 text mit check), es wird also keiner gebrochen.
-- Sollte die Tabelle je die geplanten Millionen Zeilen erreichen, ist das
-- der Punkt, an dem neu abzuwaegen waere.
--
-- Warum NULL erlaubt bleibt
-- -------------------------
-- Bestandspunkte haben kein Urteil, und sie bekommen auch keines. Ein
-- Vorgabewert 'gezaehlt' waere eine Luege in Spaltenform - er behauptete
-- ein Urteil, das nie gefaellt wurde. Genau diese Falle war am 22.08. bei
-- den Hoehenmetern aufgegangen: eine erfundene Zahl, die aussah wie eine
-- gemessene.
--
-- Nachtragen per SQL waere ebenfalls falsch: Die Regel braucht Abstand und
-- Zeit zum Vorgaengerpunkt, und das hier noch einmal auszuformulieren
-- hiesse, dieselbe Regel ein zweites Mal zu schreiben - der Fehler, den
-- diese Migration behebt.
--
-- NULL heisst also genau, was es heisst: Fuer diesen Punkt wissen wir es
-- nicht. Die Nachrechnung faellt fuer ihn auf die Geometrie zurueck.
--
-- Es gibt einen DRITTEN Fall, und der ist unangenehmer: Zwischen dem
-- Ausrollen der App und dem Einspielen dieser Migration weist PostgREST
-- jede Uebertragung mit `urteil` ab (PGRST204). `punkteSenden.ts` schickt
-- das Buendel dann ohne die Spalte - die Punkte sind gerettet, ihr Urteil
-- ist weg, obwohl es auf dem Geraet existierte. Und es bleibt weg: Der
-- Upsert laeuft mit `ignoreDuplicates`, also `on conflict do nothing`; eine
-- spaetere Uebertragung derselben Kennung ueberschreibt nichts.
--
-- Das ist hingenommen, nicht uebersehen. Der Ausweg waere ein Nachtragen
-- per SQL - und das hiesse, die Regel ein zweites Mal zu formulieren, also
-- genau den Fehler zu bauen, den diese Migration abschafft. Wer das Fenster
-- klein halten will, spielt die Migration VOR der App-Auslieferung ein.
--
-- Denormalisierung, ausdruecklich benannt: `urteil` ist ein gespeicherter
-- Ableitungswert aus dieser und der vorigen Zeile und damit ein Bruch mit
-- der dritten Normalform. Der Grund ist, dass er einfrieren SOLL - wird
-- eine der Schwellen je geaendert, behaelt ein alter Lauf sein damaliges
-- Urteil, statt still neu bewertet zu werden.
--
-- Rueckwaertsstrategie: `alter table public.run_points drop constraint if
-- exists run_points_urteil_bekannt;` und `alter table public.run_points
-- drop column if exists urteil;`. Es gehen dabei nur Urteile verloren, die
-- sich aus der Geometrie wieder ableiten lassen - keine Messwerte.
--
-- Groesse: Diese Spalte macht jede Zeile um rund 9 Byte groesser. Die
-- Aufbewahrungs- und Partitionierungsfrage fuer `run_points` steht noch aus
-- (siehe docs/bewertung-web-app-zu-echter-app.md); sie wird dadurch nicht
-- dringender, aber auch nicht kleiner.
--
-- Kein Sicherheits- oder Datenschutzbelang
-- ----------------------------------------
-- Die Spalte enthaelt kein personenbezogenes Datum, das nicht schon
-- danebenstuende: Sie ist eine Ableitung aus Ort und Zeit derselben Zeile.
-- Zeilenrechte, Aufbewahrung und Loeschwege bleiben unveraendert, weil sie
-- an der Tabelle haengen und nicht an der Spalte.
-- ============================================================

alter table public.run_points
  add column if not exists urteil text;

-- Die Menge bleibt geschlossen. Ein viertes Urteil kann nicht durch einen
-- Tippfehler in der App entstehen - es braucht eine Migration, und damit
-- eine Begruendung.
--
-- Nach dem Muster von 0044 und nicht nach dem von 0014: Eine Pruefung ueber
-- `pg_constraint where conname = ...` ist NICHT tabellengebunden. Derselbe
-- Name darf an einer anderen Tabelle liegen; dann findet die Pruefung ihn,
-- haelt die Bedingung fuer vorhanden und ueberspringt sie stillschweigend -
-- und `urteil` staende ungeschuetzt da. `drop ... if exists` gefolgt von
-- `add` ist tabellengebunden und stellt beim zweiten Lauf ausserdem die
-- AKTUELLE Fassung her, statt eine abweichende Altfassung stehenzulassen.
--
-- Der Name ist bewusst nicht `run_points_urteil_check`: Genau den vergibt
-- PostgreSQL selbst fuer einen unbenannten Spalten-Check auf `urteil`. Wer
-- spaeter `check (...)` direkt an der Spalte schreibt, kollidierte damit.
alter table public.run_points
  drop constraint if exists run_points_urteil_bekannt;

-- Zwei Schritte statt einem, und zwar wegen der SPERRE, nicht wegen der
-- Arbeit:
--
--   add constraint ... (sofort gueltig)  ACCESS EXCLUSIVE waehrend des
--                                        gesamten Durchlaufs durch den Bestand
--   add ... not valid                    ACCESS EXCLUSIVE, aber nur fuer eine
--                                        Katalogaenderung - Mikrosekunden
--   validate constraint                  SHARE UPDATE EXCLUSIVE; laufende
--                                        Uebertragungen laufen weiter
--
-- Bei den heutigen paar tausend Zeilen ist der Unterschied nicht messbar.
-- Bei den Millionen, die diese Tabelle erreichen soll, ist er der
-- Unterschied zwischen "niemand merkt es" und "alle Uebertragungen stauen
-- sich hinter dem ALTER". Dasselbe Muster wie 0044.
--
-- Validiert wird trotzdem sofort: Alle Bestandszeilen tragen NULL und
-- koennen die Bedingung gar nicht verletzen, der Durchlauf findet also
-- nichts. Eine dauerhaft als NOT VALID gefuehrte Bedingung waere eine
-- offene Frage im Katalog, die niemand mehr schliesst.
alter table public.run_points
  add constraint run_points_urteil_bekannt
  check (urteil is null or urteil in ('gezaehlt', 'sprung', 'halt'))
  not valid;

alter table public.run_points
  validate constraint run_points_urteil_bekannt;

comment on column public.run_points.urteil is
  'Was das Segment zum Vorgaengerpunkt beigetragen hat: gezaehlt (Strecke '
  'und Zeit voll), sprung (Ortungssprung, beides verworfen) oder halt '
  '(zu langsam; Strecke bleibt, Zeit auf Strecke/0,9 m/s begrenzt). '
  'Faellt einmal beim Entstehen des Punktes, damit spaeteres Nachrechnen '
  'das Urteil liest statt es neu zu bilden. NULL bei Bestandspunkten von '
  'vor dem 23.08.2026 und beim ersten Punkt eines Laufs - der hat keinen '
  'Vorgaenger.';

-- Kein Index. Die Spalte wird zusammen mit den Punkten eines Laufs gelesen,
-- und dafuer traegt idx_run_points_run_recorded. Ein eigener Index waere
-- Schreiblast ohne Leser.
