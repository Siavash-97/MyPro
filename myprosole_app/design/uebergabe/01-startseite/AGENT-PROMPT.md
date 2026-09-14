# Prompt für den Umsetzungs-Agenten

Kopiere den Block unten als Auftrag. Er ist bewusst so geschrieben, dass der
Agent **erst prüft, dann fragt, dann baut** — und nichts erfindet.

---

```
Baue die Startseite der MyProSole-Web-App auf das neue Design um.

## Vorlage

Die verbindliche Beschreibung steht in:
  myprosole_app/design/uebergabe-startseite/STARTSEITE-DESIGN.md

Dazu drei Screenshots im Unterordner screenshots/ und die lebende Vorlage:
  myprosole_app/design/mockups-neue-farben/home.html

Öffne home.html im Browser und miss Werte mit den DevTools nach, statt sie aus
den Screenshots zu schätzen. Der Ordner "mockups-neue-farben" ist die Vorlage —
der Ordner "mockups" daneben trägt den alten Stand und ist NICHT gemeint.

## Ziel

  myprosole_web/src/pages/Home.tsx  (React + Vite + Tailwind v4)

## Die wichtigste Regel: keine erfundenen Inhalte

Jede Zahl und jeder Text in den Screenshots ist ein Platzhalter — "31,6 km",
"79 %", "Gesund", "Regenerationslauf", "Hüftstabilität". Übernimm davon nichts.

Für JEDEN Wert, den die Seite anzeigt, gilt:

1. Finde heraus, woher er kommt. Sieh dir dazu wirklich an:
   - myprosole_web/src/pages/Home.tsx — was die Seite heute schon rechnet
   - myprosole_web/src/store/   — auth, run, runningPlan, exercises, anamnese
   - myprosole_web/src/types/index.ts — die Feldnamen der Datensätze
   - myprosole_web/src/lib/    — runningPlan.ts, tempo.ts, supabase.ts
   - die Supabase-Migrationen im Repo — welche Spalten es wirklich gibt

2. Verwende die vorhandene Quelle. Baue keinen zweiten Weg zu denselben Daten
   und keinen eigenen Supabase-Aufruf, wenn schon ein Store existiert.

3. Findest du keine Quelle: BAU NICHTS. Kein Platzhalter, kein fester Text,
   kein "TODO" im ausgelieferten Code. Sammle die Frage und leg sie mir vor.

Abschnitt 7 der Design-Datei listet auf, was ich beim Prüfen schon gefunden
habe und was offen ist. Nimm diese Liste als Startpunkt, nicht als Endstand —
prüf sie nach, sie kann sich geändert haben.

## Bevor du Code schreibst

Melde dich bei mir mit:

  a) einer Tabelle: Anzeige-Element → Datenquelle (Datei, Store, Feldname)
  b) der Liste der Punkte, für die du KEINE Quelle gefunden hast, jeweils mit
     deinem Vorschlag: Feld ergänzen? Element weglassen? anders lösen?
  c) den leeren Zuständen: was zeigt die Seite ohne Laufplan, ohne Läufe,
     ohne Übungen?
  d) deinem Plan für die App-Hülle (siehe unten)

Dann warte auf meine Antwort. Fang erst danach an zu bauen.

## Was ich schon weiß und du nicht neu herausfinden musst

- Der Hero ist randlos und muss AUSSERHALB von <main className="md-page-stack">
  liegen. AppShell.tsx rendert heute <TopAppBar /> darüber — auf der Startseite
  tritt der Hero an dessen Stelle. Das betrifft die Hülle, nicht nur Home.tsx.
  Sag mir, wie du das lösen willst, bevor du es tust.

- myprosole_web/src/styles/components.css kennt .md-home-hero, .md-run-row und
  .md-exercise-row noch nicht. Diese Blöcke müssen aus
  myprosole_app/design/design-system/components.css übernommen werden. Die
  beiden Dateien sind Kopien mit Abweichungen — übertrage die benötigten Blöcke
  einzeln, überschreib die Datei nicht.

- .md-exercise-row steht heute nur in einem <style>-Block in home.html. Beim
  Übernehmen gehört sie ins gemeinsame CSS.

## Regeln aus dem Projekt

Sie stehen vollständig in docs/DEVELOPMENT_STANDARDS.md. Diese hier sind für
diese Aufgabe entscheidend:

- Farben, Abstände und Schrift kommen aus dem Designsystem. Ein Wert direkt im
  Bauteil ist die Ausnahme und muss begründet sein. Die festen Markenfarben in
  Abschnitt 3 der Design-Datei sind so eine begründete Ausnahme.
- Die Farbbedeutung ist verbindlich: Cyan = Basiswerte (Tempo, Strecke, Zeit),
  Violett = ausschließlich Auswertungen aus den Sensoreinlagen, Indigo = Marke
  und neutrale Inhalte. Rot nie für einen körperlichen Befund.
- Jeder Flex- oder Grid-Container, der langen Inhalt aufnehmen kann, bekommt
  ausdrücklich min-width: 0.
- Änderst du eine geteilte Klasse aus dem Designsystem, prüf mit grep, wo sie
  sonst benutzt wird, und sieh dir die anderen Seiten an. Ein Fix, der nur an
  einer Seite geprüft wurde, hinterlässt denselben Fehler anderswo.
- Wiederholte Inline-Styles in drei oder mehr Dateien gehören in eine Klasse.

## Zwei Fallen, die mich Stunden gekostet haben

1. Der Ring: sein <svg> braucht width:100%; height:100%. Ohne diese Zeile
   rendert es in seiner Attributgröße statt in der des Behälters — der Ring
   sitzt versetzt und alles, was sich an ihm ausrichtet, landet daneben.

2. Das Designsystem setzt global svg { fill: currentColor }. Das überschreibt
   ein fill="none" im HTML, weil CSS ein Präsentationsattribut schlägt.
   Strich-Icons werden dadurch zu schwarzen Flächen. Nimm gefüllte Icons mit
   ausgesparter Kontur.

## Sicherheit

Es ist die echte App mit echten Nutzerdaten.

- Arbeite auf einem eigenen Branch, nicht auf main.
- Ändere nichts an Auth, an Datenbank-Schreibpfaden oder an Migrationen.
  Brauchst du ein neues Feld, sag es mir — leg es nicht selbst an.
- Fass keine Datei außerhalb der Startseite, der App-Hülle und der CSS-Blöcke
  an, die du dafür brauchst.

## Fertig heißt

- Die Seite sieht in beiden Themen wie die Screenshots aus, Umschalter geht.
- Kein Zahlenwert steht fest im Code.
- Leere Zustände sind gebaut, nicht nur bedacht.
- Kein horizontales Scrollen bei 320 px Breite.
- npm run lint und npm run test:unit laufen durch.
- Du zeigst mir hell und dunkel als Nachweis.
- Du sagst mir, welche geteilten Klassen du angefasst hast und wo sie sonst
  benutzt werden.
- Die offenen Punkte sind beantwortet, nicht geraten.
```

---

## Hinweise für dich (nicht Teil des Prompts)

**Warum der Agent erst fragen soll:** Die drei Lücken aus Abschnitt 7 —
Laufart („Regenerationslauf"), Status („Gesund") und die Auswahlregel für
„Meine Übungen" — sind Produktentscheidungen, keine technischen Details. Ein
Agent, der sie selbst beantwortet, baut ein Datenfeld, das nachher niemand
befüllt.

**Der größte Brocken** ist nicht die Startseite selbst, sondern dass der Hero
aus `.md-page-stack` heraus muss. Das berührt `AppShell.tsx` und damit alle
Seiten. Wenn das schiefgeht, ist es überall schief — deshalb steht im Prompt,
dass er dir den Plan dafür vorher zeigen soll.

**Reihenfolge, falls du es aufteilen willst:**
1. CSS-Blöcke übertragen und auf einer Testseite prüfen
2. App-Hülle umbauen (Hero statt TopAppBar), alle Seiten gegenprüfen
3. Startseite mit echten Daten füllen
4. Leere Zustände

Schritt 2 einzeln abnehmen, bevor Schritt 3 beginnt.
