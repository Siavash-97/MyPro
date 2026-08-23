# Die Karte, wie Strava sie hat

**Aufgenommen am 23.08.2026**, während des Feldtests, auf Wunsch des Nutzers:
*„ich will auch später bessere karte wie strava nutzen."*

## Zwei Dinge, die nicht verwechselt werden dürfen

Es gibt hier **einen Fehler** und **einen Wunsch**, und sie haben nichts
miteinander zu tun.

### 1. Der Fehler: Die Karte kommt gar nicht

Am 23.08.2026 zeigte die App während eines 26-minütigen Laufs **keine Karte**,
sondern dauerhaft die gezeichnete Ersatzfläche.

Am laufenden Gerät geprüft, einzeln ausgeschlossen:

| Verdacht | Befund |
|---|---|
| Schlüssel fehlt im Paket | nein — im installierten Bündel vorhanden |
| Kartendienst sperrt uns | nein — aus der App heraus: Stil **200**, Kachel **200** |
| Kein WebGL | nein — vorhanden |
| Kartenteil nicht geladen | nein — `Kacheln-*.js` kam in 132 ms |
| Keine Punkte | nein — der SVG-Pfad enthielt alle |

Übrig blieb genau eine Erklärung: **Die Karte hat aufgegeben und versucht es
nie wieder.**

Zwei Ursachen, die sich verstärken:

- `Kacheln.tsx` baut die Karte in einem `requestAnimationFrame`. **Das läuft
  nicht, während der Bildschirm aus ist.** Wer die App startet und das
  Telefon einsteckt, bekommt nie ein Einzelbild und damit nie eine Karte.
- Nach `AUFGEBEN_NACH_MS = 8000` ruft die Komponente `onFehler()`. In
  `RouteMap.tsx` setzt das ein `kartenFehler`, das **nie zurückgesetzt wird**.
  Ab da ist die Karte für den Rest des Laufs verloren, egal was danach
  passiert.

Das ist kein Qualitätsunterschied zu Strava. Es ist ein Ausschalter, der
einmal umgelegt wurde.

**Behoben am 23.08.2026** — siehe den Bug-Report zum selben Datum.

### 2. Der Wunsch: eine Karte, die sich so anfühlt wie Stravas

Das ist eine eigene Aufgabe und kommt **nach** dem Fehler, nicht statt seiner.
Erst muss überhaupt eine Karte zu sehen sein, bevor sich beurteilen lässt, wie
gut sie ist.

**Noch nicht recherchiert, ausdrücklich.** Alles Folgende sind Fragen, keine
Befunde — was Strava wirklich benutzt, ist nicht nachgesehen. Der Agent
`recherche` ist dafür fällig, bevor irgendetwas entschieden wird.

Offene Fragen, in der Reihenfolge, in der sie beantwortet werden sollten:

1. **Woran genau liegt „flüssig"?** An der Bildrate beim Schieben, an der
   Ladezeit der Kacheln, am Kartenstil, an der Linienführung der Route, oder
   an der Art, wie die Karte dem Läufer folgt? Ohne diese Antwort optimiert
   man das Falsche. Der Nutzer sollte dazu nebeneinander vergleichen.
2. **Vektorkacheln vorhalten?** Wer im Funkloch läuft, sieht bei uns nichts.
   Ein örtlicher Vorrat entlang der Strecke wäre möglich, kostet aber Platz
   und eine eigene Verwaltung.
3. **Kartenstil.** Wir benutzen `streets-v2-dark` von MapTiler. Es gibt
   Stile, die auf Aussenaktivität ausgelegt sind (Wege, Höhenlinien,
   Geländeschattierung). Das ist eine Einstellung, kein Umbau.
4. **Anbieterfrage.** MapTiler ist gesetzt und funktioniert. Ob ein Wechsel
   überhaupt etwas brächte, ist unbekannt — und ein Wechsel ist nicht billig
   zurückzunehmen. Nach der Projektregel „Recherche vor Festlegungen"
   gehört das dem Agenten `recherche`, nicht dem Gefühl.
5. **Kosten.** Der MapTiler-Schlüssel ist abrechnungsrelevant und liegt in
   einem öffentlichen Bündel. Ob er auf eine Domain beschränkt ist, ist
   **ungeprüft** — das steht nur im Konto des Anbieters. Vor einer
   Ausweitung der Kartennutzung gehört das nachgesehen.

## Was zuerst passieren muss

Der Fehler ist behoben, aber **am Gerät noch nicht bestätigt**: Es steht
aus, dass bei einem echten Lauf mit ausgeschaltetem Bildschirm eine Karte
erscheint. Erst danach lohnt es, über „besser" zu reden.
