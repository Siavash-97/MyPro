# Gemeinsame Regeln für alle Pakete

Die Paket-Prompts verweisen auf diese Datei. Lies sie einmal, bevor du mit
einem Paket beginnst — sie gilt für jedes.

---

## 1. Keine erfundenen Inhalte

Jede Zahl und jeder Text in den Screenshots ist ein Platzhalter. „31,6 km",
„Gesund", „Regenerationslauf", „Jana", „Frühaufsteher München", „214 Mitglieder"
— nichts davon übernehmen.

Für **jeden** Wert, den eine Seite anzeigt:

1. **Finde die Quelle.** Sieh dir wirklich an:
   - die Zielseite in `myprosole_web/src/pages/` — was sie heute schon rechnet
   - `myprosole_web/src/store/` — die Zustands-Speicher
   - `myprosole_web/src/types/index.ts` — die Feldnamen der Datensätze
   - `myprosole_web/src/lib/` — die gemeinsamen Rechenregeln
   - die Supabase-Migrationen im Repo — welche Spalten es wirklich gibt

2. **Verwende die vorhandene Quelle.** Kein zweiter Weg zu denselben Daten,
   kein eigener Supabase-Aufruf, wenn schon ein Store existiert.

3. **Findest du keine Quelle: bau nichts.** Kein Platzhalter, kein fester Text,
   kein „TODO" im ausgelieferten Code. Sammle die Frage und leg sie vor.

Jede Design-Datei hat einen Abschnitt „Inhalte — was ist echt, was ist
Platzhalter" mit dem Stand meiner Prüfung. Nimm ihn als Startpunkt, nicht als
Endstand — prüf ihn nach, er kann veraltet sein.

## 2. Erst vorlegen, dann bauen

Bevor du Code schreibst, melde dich mit:

- **a)** einer Tabelle: Anzeige-Element → Datenquelle (Datei, Store, Feldname)
- **b)** der Liste der Punkte ohne Quelle, je mit deinem Vorschlag:
  Feld ergänzen? Element weglassen? anders lösen?
- **c)** den leeren Zuständen: was zeigt die Seite ohne Daten?
- **d)** jeder Änderung an einer **geteilten** Datei oder CSS-Klasse

Dann warte auf Antwort. Fang erst danach an.

## 3. Projektregeln

Vollständig in `docs/DEVELOPMENT_STANDARDS.md`. Diese hier sind entscheidend:

- **Das Designsystem ist die Quelle.** Farben, Abstände und Schrift kommen aus
  den Tokens. Ein Wert direkt im Bauteil ist die Ausnahme und muss begründet
  sein. Die festen Markenfarben (siehe Fundament-Paket) sind so eine begründete
  Ausnahme — sie ändern sich bewusst nicht mit dem Thema.

- **Die Farbbedeutung ist verbindlich:**
  - **Cyan** — Basiswerte: Tempo, Strecke, Zeit. Auch in der kostenlosen Version.
  - **Violett** — **ausschließlich** Auswertungen aus den Sensoreinlagen
    (Pronation, Kniehub, Spurbreite). Nie für Strecke oder Zeit.
  - **Indigo** — Marke und neutrale Inhalte: Übungen, Community.
  - **Rot** — nur technische Fehler, nie ein körperlicher Befund. Abweichungen
    heißen „auffällig" in Bernstein-Tönen.
  - Nie Farbe als einziges Signal: jeder farbcodierte Zustand braucht ein
    zweites Merkmal (Icon, Text).
  - Verteilung 60 / 30 / 10: nicht jede Liste braucht eine Tönung.

- **Defensive Größen.** Jeder Flex- oder Grid-Container, der langen oder nicht
  umbrechbaren Inhalt aufnehmen kann, bekommt ausdrücklich `min-width: 0`.
  Fehlt die Zeile, zieht der breiteste Inhalt später die ganze Seite in die
  Breite — unsichtbar, bis jemand einen langen Text einträgt.

- **Geteilte Klassen haben Reichweite.** Änderst du etwas aus dem Designsystem,
  prüf mit `grep` über alle Seiten, wo die Klasse sonst benutzt wird, und sieh
  dir die anderen an. Ein Fix, der nur an einer Seite geprüft wurde,
  hinterlässt denselben Fehler anderswo.

- **`<legend>` taugt nicht als sichtbarer Titel** — es sitzt laut Spezifikation
  auf der Rahmenlinie. Projektstandard ist `<legend class="md-visually-hidden">`
  plus ein sichtbares `<p class="md-form-section__title">`.

- **Wiederholte Inline-Styles sind versteckte Kopplung.** Dasselbe
  `style="…"`-Muster in drei oder mehr Dateien gehört in eine Klasse.

## 4. Zwei Fallen, die Stunden gekostet haben

**Der Fortschrittsring:** sein `<svg>` braucht `width:100%; height:100%`. Ohne
diese Zeile rendert es in seiner Attributgröße statt in der des Behälters —
der Ring sitzt versetzt, und alles, was sich an ihm ausrichtet, landet daneben.

**Gefüllte Icons statt Strich-Icons:** Das Designsystem setzt global
`svg { fill: currentColor }`. Das überschreibt ein `fill="none"` im HTML, weil
CSS ein Präsentationsattribut schlägt. Strich-Icons werden dadurch zu schwarzen
Flächen. Nimm gefüllte Icons mit ausgesparter Kontur.

## 5. Sicherheit

Es ist die echte App mit echten Nutzerdaten.

- Eigener Branch je Paket, nie auf `main`.
- Nichts an Auth, an Datenbank-Schreibpfaden oder an Migrationen ändern.
  Brauchst du ein neues Feld: melden, nicht selbst anlegen.
- Keine Datei außerhalb des Pakets anfassen.
- Beim Testen keine echten Nutzerdaten in Screenshots oder Logs übernehmen —
  die Mockups arbeiten bewusst mit erfundenen Namen.

## 6. Fertig heißt

- Sieht in **beiden** Themen wie die Screenshots aus, Umschalter funktioniert
- Kein fest verdrahteter Inhalt
- Leere Zustände gebaut, nicht nur bedacht
- Kein horizontales Scrollen bei 320 px Breite
- `npm run lint` und `npm run test:unit` laufen durch
- Nachweis gezeigt: hell und dunkel
- Genannt, welche geteilten Klassen angefasst wurden und wo sie sonst vorkommen
- Offene Punkte beantwortet, nicht geraten
