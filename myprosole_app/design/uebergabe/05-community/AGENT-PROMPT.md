# Prompt — Paket 05: Community

```
Bau die drei Community-Reiter der MyProSole-Web-App auf das neue Design um.

## Voraussetzung

Paket 00 (Fundament) muss abgenommen sein: .md-page-hero,
.md-list-item--tint-indigo und .md-card--tint-indigo müssen im gemeinsamen CSS
stehen. Ist das nicht so: melde dich, fang nicht an.

## Lies zuerst

  myprosole_app/design/uebergabe/PROMPT-REGELN.md                     — Regeln für alle Pakete
  myprosole_app/design/uebergabe/05-community/COMMUNITY-DESIGN.md     — dieser Auftrag im Detail
  myprosole_app/design/uebergabe/00-fundament/FUNDAMENT-DESIGN.md     — Farben und Kopf

Vorlagen:    mockups-neue-farben/community.html
             mockups-neue-farben/community-zusammenlauf.html
             mockups-neue-farben/community-gruppen.html
Screenshots: myprosole_app/design/uebergabe/05-community/screenshots/
Zieldateien: myprosole_web/src/pages/Community.tsx
             myprosole_web/src/pages/CommunityMeetups.tsx
             myprosole_web/src/pages/CommunityGroups.tsx

## Auftrag

1. Alle drei Seiten bekommen denselben dunklen Kopf: Titel "Community",
   Unterzeile "Läufe teilen, ZusammenLauf finden, Fragen stellen".
   Nur der aktive Reiter unterscheidet sie — es ist eine Fläche mit drei
   Ansichten, nicht drei Seiten.

2. <CommunityTabs /> wandert IN den Kopf, als letztes Kind. Die Komponente
   selbst bleibt unverändert, sie muss nur an die neue Stelle.

3. Tönungen:
   - Feed-Beiträge: KEINE Tönung. Ein Feed aus vielen Karten wird mit farbigem
     Balken links unruhig.
   - Personen-Zeilen (ZusammenLauf): .md-list-item--tint-indigo
   - Gruppen-Karten: .md-card--tint-indigo (mehrzeilig, deshalb Karte)

## WICHTIG: das Mockup zeigt zu wenige Reaktionen

Die echte Seite hat DREI Reaktionen je Beitrag: Like, Kommentar und
Goldmedaille. Das Mockup zeigt nur Like und Kommentar.

Die Medaille BLEIBT. Sie ist im Entwurf untergegangen, nicht gestrichen. Der
Code sagt, sie soll später Vergünstigungen auslösen und ist deshalb bewusst vom
Like getrennt — es darf nichts mitgezählt werden, was keine Medaille ist.

Klär mit mir: Wo sitzt sie in der neuen Zeile, und wirkt ihr Gold auf dunklem
Grund noch richtig?

## Ebenfalls nicht aus dem Mockup übernehmen

Die echte Gruppen-Seite gliedert in "Meine Gruppen" und "Gruppen entdecken".
Das Mockup zeigt nur "Beliebte Gruppen in deiner Nähe". Beide Abschnitte
behalten.

## Datenschutz — nicht aufweichen

Der ZusammenLauf-Reiter zeigt bewusst nur Vorname, ungefähre Distanz und
gemeinsame Zeiten. Kein genauer Standort, keine Nachnamen, kein Chat vor einer
bestätigten Anfrage. Der Hinweis oben auf der Seite sagt das zu. Diese
Zurückhaltung bleibt, auch nicht "nur für die Optik" ändern.

Alle Namen in den Screenshots sind erfunden — Jana, Tobias, "Frühaufsteher
München". Das ist Absicht: die echte Vorschau zeigte den Namen und das Foto
einer echten Person. In Entwürfen und Testdaten stehen keine echten
Personendaten. Halt dich daran.

## Bevor du Code schreibst

Melde dich mit:
  a) Tabelle: Anzeige-Element → Datenquelle
  b) deiner Frage zur Goldmedaille
  c) den offenen Punkten aus Abschnitt 5 der Design-Datei, besonders:
     - trägt ein Beitrag den verknüpften Lauf (die km/min/Tempo-Zeile)?
     - woher kommt das "42 km/Wo"-Abzeichen, und ist es freiwillig sichtbar?
     - gibt es an einer Gruppe ein Kategorie-Feld (Locker/Tempo/Marathon),
       oder sind die Filter-Chips im Mockup erfunden?
  d) den leeren Zuständen

Dann warte auf meine Antwort.

## Was ich schon geprüft habe

  - CommunityTabs rendert bereits .md-segmented mit aktivem Reiter aus dem Pfad
  - useFeed() hat posts, fetchPosts, bildAdresse, FeedPost, FeedComment
  - Community.tsx trennt schon sauber zwischen leerem Feed und Ladefehler
    (eigener Block mit --md-error-container) — gutes Muster, beibehalten
  - MeldenBlatt, AktionsBlatt, useSnackbar sind vorhanden

## Fertig heißt

Abnahmeliste in Abschnitt 6 der Design-Datei. Besonders:
Die Goldmedaille ist noch da, Beiträge sind ungetönt, und der
Datenschutz-Hinweis steht unverändert.
```
