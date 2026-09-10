# Prompt — Paket 03: Verlauf

```
Bau die Verlaufsseite der MyProSole-Web-App auf das neue Design um.

## Voraussetzung

Paket 00 (Fundament) muss abgenommen sein: .md-page-hero,
.md-list-item--tint-cyan und die min-height-Korrektur an .md-filter-row müssen
im gemeinsamen CSS stehen. Ist das nicht so: melde dich, fang nicht an.

## Lies zuerst

  myprosole_app/design/uebergabe/PROMPT-REGELN.md                  — Regeln für alle Pakete
  myprosole_app/design/uebergabe/03-verlauf/VERLAUF-DESIGN.md      — dieser Auftrag im Detail
  myprosole_app/design/uebergabe/00-fundament/FUNDAMENT-DESIGN.md  — Farben und Kopf

Vorlage:     myprosole_app/design/mockups-neue-farben/verlauf.html
Screenshots: myprosole_app/design/uebergabe/03-verlauf/screenshots/
Zieldatei:   myprosole_web/src/pages/History.tsx

## Auftrag

1. Der helle Kopf wird zum dunklen .md-page-hero mit Titel "Verlauf".
   Zwei der vier Kennzahlen wandern hinein: Distanz und Aktive Zeit.
   Routinen und Übungszeit bleiben als 2er-Raster darunter.

2. Kopf-Kennzahlen und Unterzeile ändern sich MIT DEM FILTER.
   Es gibt schon SECTION_TITLES und PERIOD_SUFFIX je Filter — daran anschließen.

3. Die Lauf-Zeilen bekommen .md-list-item--tint-cyan (Cyan = Basiswerte).
   AUSNAHME: Workout-Zeilen bleiben ungetönt und behalten ihre Icon-Kachel.
   Das ist Absicht — die Tönung sagt "Lauf", die Kachel sagt "Einheit".

## Die eine Entscheidung, die du NICHT selbst treffen darfst

Die echte Seite hat einen Lauf-Score: einen Ring mit Durchschnitt und je Lauf
ein Ampel-Abzeichen. Run.score existiert in der Datenbank.

Das Mockup zeigt ihn nicht — ich hatte ihn entfernt, weil er auf der
öffentlichen Vorschau nicht zu sehen war. Das war eine Beobachtung, keine
Entscheidung.

Abschnitt 4 der Design-Datei nennt drei Möglichkeiten. Frag mich, was gilt,
bevor du irgendetwas am Score anfasst. Entferne ihn NICHT einfach, weil das
Mockup ihn nicht zeigt.

## Bevor du Code schreibst

Melde dich mit:
  a) Tabelle: Anzeige-Element → Datenquelle
  b) deiner Frage zum Score (siehe oben)
  c) was der Kopf zeigt, wenn im Zeitraum nichts liegt — heute wird das
     Kennzahlen-Raster einfach ausgeblendet, aber der Kopf ist immer da
  d) ob der Filter-Knopf aus der alten Kopfleiste ersatzlos wegfällt

Dann warte auf meine Antwort.

## Was ich schon geprüft habe

Die Seite ist DATENTECHNISCH VOLLSTÄNDIG. Alles ist da:
  - timeFilter mit TIME_LABELS (Woche/Monat/Jahr/Alle) — passt schon aufs Mockup
  - totalRunDistanceKm, totalRunSeconds, completedWorkouts
  - durchschnittstempoText() aus lib/tempo für das Tempo je Zeile
  - LoadingSpinner und EmptyState für die leeren Zustände
Die Arbeit ist überwiegend gestalterisch.

## Farbregel für diese Seite

Strecke, Zeit und Tempo sind Basiswerte → Cyan (#209ACD).
Falls der Score bleibt: seine Ampelfarben brauchen einen zweiten Hinweis neben
der Farbe (die Zahl reicht), und ROT IST TABU — ein niedriger Score ist kein
technischer Fehler. Die Palette sieht dafür Bernstein-Töne vor.

## Falle

.md-filter-row braucht min-height: 38px. overflow-x: auto setzt sonst die
automatische Mindesthöhe des Flex-Kindes auf 0, und die Zeile fällt in der
Flex-Spalte auf 0 px zusammen. overflow-y: visible hilft NICHT — die
Spezifikation erlaubt keine gemischten Achsen und rechnet es auf auto zurück.

## Fertig heißt

Abnahmeliste in Abschnitt 6 der Design-Datei. Besonders:
Kopf-Kennzahlen ändern sich beim Filterwechsel, und die Score-Entscheidung ist
umgesetzt statt offen gelassen.
```
