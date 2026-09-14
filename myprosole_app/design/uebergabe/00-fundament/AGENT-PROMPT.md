# Prompt — Paket 00: Fundament

```
Bereite das gemeinsame CSS und die App-Hülle der MyProSole-Web-App auf das neue
Design vor. Dieses Paket baut KEINE Seite um.

## Lies zuerst

  myprosole_app/design/uebergabe/PROMPT-REGELN.md          — Regeln für alle Pakete
  myprosole_app/design/uebergabe/00-fundament/FUNDAMENT-DESIGN.md  — dieser Auftrag im Detail

Vorlage für das CSS:
  myprosole_app/design/design-system/components.css

Vorlage zum Anschauen (alle Screens nebeneinander, mit Hell/Dunkel-Schalter):
  myprosole_app/design/mockups-neue-farben/showcase.html

Der Ordner "mockups-neue-farben" ist die Vorlage. Der Ordner "mockups" daneben
trägt den alten Stand und ist NICHT gemeint.

## Auftrag

Drei Teile, in dieser Reihenfolge:

1. CSS-Blöcke übertragen
   Abschnitt 2 der Design-Datei listet auf, welche Klassen fehlen und welche
   bestehenden geändert werden. Überschreib die Datei NICHT — die beiden
   components.css sind Kopien mit Abweichungen. Übertrag die Blöcke einzeln.

2. App-Hülle umbauen
   Der dunkle Kopf ist randlos und muss ein Geschwister von
   <main className="md-page-stack"> werden, dort wo heute <TopAppBar /> steht.
   Jede Seite braucht einen anderen Kopf (groß / kompakt / schmal mit Pfeil).
   WIE du das löst, entscheidest du — aber leg mir den Plan vorher vor.
   Eine Lösung für alle Seiten, nicht pro Seite eine eigene.

3. Navigationsleiste
   Aktiver Eintrag in --md-primary. Sonst unverändert.

## Warum das ein eigenes Paket ist

Es berührt jede Seite der App. Danach kommt jede Seite einzeln dran, ohne die
anderen anzufassen. Wenn hier etwas schiefgeht, ist es überall schief — deshalb
nichts anderes nebenbei ändern.

## Bevor du Code schreibst

Melde dich mit:
  a) der Liste der CSS-Blöcke, die du übertragen willst, und wo du sie einfügst
  b) deinem Plan für die App-Hülle: wie meldet eine Seite ihren Kopf an?
  c) deinem Vorschlag zum Thema-Umschalter (Abschnitt 5 der Design-Datei):
     bleiben beide Schalter — im Kopf und im Profil — oder nur einer?
  d) den geteilten Klassen, die du änderst, und wo sie sonst benutzt werden

Dann warte auf meine Antwort.

## Was ich schon geprüft habe

- Das Farbsystem ist im Web-Projekt bereits vollständig vorhanden
  (index.css, Block [data-palette="setb"]) und in main.tsx aktiviert.
  Daran ist NICHTS zu tun.
- styles/components.css kennt .md-home-hero, .md-page-hero, .md-run-row und
  .md-exercise-row nicht — geprüft, 0 Treffer.
- lib/design.ts hat schon designLesen() und designUmschalten() für das Thema.
  Benutz das, bau keinen zweiten Weg.
- TopAppBar wird auch von Seiten AUSSERHALB der Hülle benutzt (Live-Tracking,
  Anamnese, Zusammenfassung). Nicht löschen.

## Nicht übernehmen

Die Mockups haben in den Profil-Einstellungen Paletten-Schalter ("Logo-Farben
(Violett)", "Vital"). Die waren nur für die Farbabstimmung da. Set B ist
entschieden — sie gehören nicht in die App.

## Fertig heißt

Die Abnahmeliste steht in Abschnitt 6 der Design-Datei. Kurz:
Die App sieht fast unverändert aus — nur der Kopf jeder Seite ist dunkel statt
hell, bleibt beim Scrollen oben stehen (am Telefon geprüft!), und die Seiten
außerhalb der Hülle sind unberührt.
```
