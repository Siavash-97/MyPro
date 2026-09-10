# Prompt — Paket 02: Training

```
Bau die Trainingsseite der MyProSole-Web-App auf das neue Design um.

## Voraussetzung

Paket 00 (Fundament) muss abgenommen sein. Der dunkle Seitenkopf
(.md-page-hero) und die Klasse .md-list-item--tint-indigo müssen bereits im
gemeinsamen CSS stehen. Ist das nicht so: melde dich, fang nicht an.

## Lies zuerst

  myprosole_app/design/uebergabe/PROMPT-REGELN.md                    — Regeln für alle Pakete
  myprosole_app/design/uebergabe/02-training/TRAINING-DESIGN.md      — dieser Auftrag im Detail
  myprosole_app/design/uebergabe/00-fundament/FUNDAMENT-DESIGN.md    — Farben und Kopf

Vorlage:     myprosole_app/design/mockups-neue-farben/uebungen.html
Screenshots: myprosole_app/design/uebergabe/02-training/screenshots/
Zieldatei:   myprosole_web/src/pages/Training.tsx

Öffne uebungen.html im Browser und miss mit den DevTools nach, statt Werte aus
den Screenshots zu schätzen.

## Auftrag

1. Der helle Kopf wird zum dunklen .md-page-hero mit Titel "Training",
   Unterzeile und drei Kennzahlen. Alle drei Zahlen RECHNEN, nicht eintippen.

2. Die Übungs-Zeilen in der Aufklapp-Liste bekommen .md-list-item--tint-indigo
   (Indigo-Tönung mit Balken links).

3. Sonst bleibt der Aufbau, wie er ist.

## WICHTIG: das Mockup zeigt weniger als die Seite kann

Die echte Seite zeigt oberhalb des Katalogs drei Blöcke, aber nur wenn ein
Laufplan existiert ({planExists && …}):
  - "Diese Woche" mit Fortschrittsbalken
  - "Heute" mit Starten-Knopf
  - "Nächste Tage" mit Plan-bearbeiten-Link

Im Mockup fehlen sie, weil ich gegen eine Vorschau ohne Laufplan abgeglichen
habe. Das ist KEIN Auftrag, sie zu entfernen. Sie bleiben und bekommen nur die
neue Optik. Prüf sie MIT angelegtem Laufplan — sonst siehst du sie gar nicht.

## Bevor du Code schreibst

Melde dich mit:
  a) Tabelle: Anzeige-Element → Datenquelle (Datei, Store, Feldname)
  b) den offenen Punkten aus Abschnitt 4 der Design-Datei, je mit Vorschlag —
     besonders: gibt es je Kategorie einen Beschreibungstext in der Datenbank?
  c) den leeren Zuständen (Katalog lädt / Katalog leer / kein Laufplan)

Dann warte auf meine Antwort.

## Was ich schon geprüft habe

Die Seite hat ihre Daten bereits vollständig:
  - useExercises().groups und .uebungenDerGruppe() für Kategorien und Übungen
  - vorgabeText() aus lib/labels für "3 × 12 Wiederholungen"
  - useWorkout().mikroroutinenDieseWoche für "Übungen diese Woche"
  - useRunningPlan() + lib/runningPlan für die Wochenplan-Blöcke
Die Aufklapp-Liste (.md-analysis-section) und die Einlagen-Werbung
(.md-insole-promo) sind schon gebaut. Die Arbeit ist überwiegend gestalterisch.

## Farbregel für diese Seite

Übungen sind "Marke und neutrale Inhalte" → Indigo (#585B97).
NICHT Cyan (das sind Basiswerte wie Tempo und Strecke).
NICHT Violett (das ist ausschließlich die Einlagen-Analyse) — auch nicht in der
Einlagen-Werbung, dort wird sie nur beworben, nicht gezeigt.

## Fertig heißt

Abnahmeliste in Abschnitt 5 der Design-Datei. Besonders:
Die Wochenplan-Blöcke sind noch da und sehen mit angelegtem Plan richtig aus.
```
