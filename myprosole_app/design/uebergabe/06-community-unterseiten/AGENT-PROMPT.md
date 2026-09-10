# Prompt — Paket 06: Community-Unterseiten

```
Bau die sieben Community-Unterseiten der MyProSole-Web-App auf das neue Design
um — EINE NACH DER ANDEREN.

## Voraussetzung

Paket 00 (Fundament) UND Paket 05 (Community) müssen abgenommen sein.
Der schmale Kopf .md-page-hero--compact und die Tönungsklassen müssen im
gemeinsamen CSS stehen. Ist das nicht so: melde dich, fang nicht an.

## Lies zuerst

  myprosole_app/design/uebergabe/PROMPT-REGELN.md                            — Regeln für alle Pakete
  myprosole_app/design/uebergabe/06-community-unterseiten/UNTERSEITEN-DESIGN.md
  myprosole_app/design/uebergabe/00-fundament/FUNDAMENT-DESIGN.md            — Farben und Kopf

Vorlagen und Screenshots: siehe Abschnitt 1 der Design-Datei.

## Deine erste Aufgabe ist NICHT bauen

Für vier der sieben Entwürfe ist die Zieldatei nicht eindeutig. Es gibt in
myprosole_web/src/pages/ zusätzlich GroupJoin.tsx und CommunityChats.tsx, und
manche Entwürfe sind in der App vielleicht als Dialog statt als eigene Seite
umgesetzt.

Ordne zuerst zu: welcher Entwurf gehört zu welcher Datei (oder zu welchem
Dialog)? Leg mir die Zuordnung vor, bevor du irgendetwas änderst.

## Dann: eine Seite nach der anderen

Nicht alle sieben in einem Rutsch. Bei sieben gleichzeitig geänderten Dateien
ist ein Fehler schwer zuzuordnen. Vorgeschlagene Reihenfolge (einfach →
schwierig) steht in Abschnitt 5 der Design-Datei:

  1. Meine Gruppen        5. Neuer Beitrag
  2. Gruppe erstellen     6. Community-Profil
  3. ZusammenLauf-Filter  7. Beitrag
  4. Gruppe Detail

Jede Seite einzeln abnehmen lassen.

## Der gemeinsame Baustein

Alle sieben tragen denselben schmalen Kopf: Zurück-Pfeil und Titel in einer
Zeile, kein Wortmark, keine Kennzahlen.

Wohin der Zurück-Pfeil führt, ist zu klären: Im Mockup ist ein fester Pfad
verdrahtet. In der App ist oft der Browser-Verlauf richtiger — aber nicht, wenn
man die Seite direkt aufruft. Nicht raten, kurz melden.

## Regeln für die Bausteine

  Listen von Personen/Gruppen  → .md-list-item--tint-indigo bzw.
                                 .md-card--tint-indigo
  Beiträge und Kommentare      → KEINE Tönung, wie im Feed
  Formulare                    → .md-form-section mit unsichtbarer <legend>
                                 plus sichtbarem <p class="md-form-section__title">
  Filter-Chips                 → .md-filter-row braucht min-height: 38px

## Zwei Seiten mit Eigenheiten

Beitrag: benutzt .device-frame--app-shell — Originalbeitrag oben fest, Antworten
scrollen dazwischen, Eingabezeile unten am Rand. Diese Aufteilung IST der Zweck
der Seite. Muss erhalten bleiben.

Community-Profil: zeigt, was ANDERE von einem sehen. Was hier steht, ist
öffentlich. Vor jeder Änderung an sichtbaren Feldern nachfragen.

## Bevor du mit einer Seite anfängst

Melde dich mit:
  a) der Zuordnung Entwurf → Zieldatei (einmalig, für alle sieben)
  b) je Seite: Tabelle Anzeige-Element → Datenquelle
  c) den offenen Punkten aus Abschnitt 4 der Design-Datei, besonders:
     - welche Felder sind beim ZusammenLauf-Filter wirklich speicherbar?
     - wird "Diese Woche gemeinsam gelaufen" gerechnet oder ist es erfunden?
     - welche Felder sind beim Gruppe-Erstellen Pflicht, gibt es Moderation?

## Vorhandene Stores

  store/groups.ts             Gruppen, Mitglieder, Beitritt
  store/zusammenlauf.ts       Verabredungen, Anfragen
  store/feed.ts               Beiträge, Kommentare, Reaktionen
  store/communityProfile.ts   öffentliches Profil
  store/chats.ts              Direktnachrichten
  store/einwilligung.ts       Sichtbarkeits-Einwilligung

## Datenschutz

Alle Namen und Zahlen in den Screenshots sind erfunden. In Entwürfen und
Testdaten stehen keine echten Personendaten.

## Fertig heißt (je Seite)

Abnahmeliste in Abschnitt 6 der Design-Datei.
```
