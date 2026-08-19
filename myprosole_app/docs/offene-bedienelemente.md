# Bedienelemente, die im Entwurf noch nicht angelegt sind

Stand: 12. August 2026. Ermittelt durch einen Prüflauf über die damals
23 Screens, nicht von Hand zusammengetragen. Die Community-Screens
(`community*.html`) sind seither dazugekommen und bislang nicht in
diesem Prüflauf; `profil.html` ist unten aktualisiert, weil die neuen
Zeilen `Community-Profil` und `Blockierte Nutzer:innen` denselben
Prüflauf ausgelöst haben, der auch die übrigen 9 Profil-Zeilen fand.
`gym-plan.html` ist am 19. August entfallen: Der Gym-Trainingsplan wurde
aus der App entfernt (Migration 0038). Seine neun offenen Stellen sind mit
ihm verschwunden – die Zahlen unten sind entsprechend von 36 auf 27
gesunken.

## Was beim Antippen passiert

Vorher passierte entweder nichts — dann hält man den Knopf für kaputt und
meldet einen Fehler, den es nicht gibt — oder die Seite lud sich neu, weil
`href=""` auf die eigene Adresse zeigt und wie ein Flackern aussieht.

Jetzt sagt der Entwurf es:

> Dieser Teil ist im Entwurf noch nicht angelegt.

Die Elemente **sehen unverändert aus**. Ein Entwurf voller ausgegrauter Knöpfe
zeigt nicht mehr, wie die App wirken soll, und darum geht es in dieser Phase.

Erkannt wird automatisch (`scripts/prototype-placeholder.js`). Die Regel:
**wer ein Bedienelement verdrahtet, gibt ihm ein `data`-Attribut** — so
arbeiten alle Prototyp-Skripte hier. Was weder Ziel noch Formular noch
`data`-Attribut hat, gilt als offen. Damit bekommt auch jeder künftige Knopf
die Behandlung, ohne dass jemand daran denken muss.

## Die 27 offenen Stellen

Sie zerfallen in zwei Gruppen — und die Unterscheidung entscheidet, wie teuer
das Nachziehen wird.

### A. Führt auf einen Screen, den es noch nicht gibt (15)

Hier fehlt ein ganzer Entwurf, nicht nur eine Verdrahtung.

| Screen | Element |
| --- | --- |
| einlage | Einlage kalibrieren · Verbindung trennen |
| login | Passwort vergessen? |
| profil | Upgrade · Mitgliedschaft · Zahlungsmethode · Rechnungen · Einlage kalibrieren · Batterie und Speicher · Smartwatch verbinden · Sprache · Datenschutz · Blockierte Nutzer:innen |
| share-export | Laufbild herunterladen |
| zyklus-kalender | Periode eintragen |

Auffällig: **zehn davon liegen im Profil**, eine davon neu durch die
Community-Anbindung (`Blockierte Nutzer:innen`; `Community-Profil` und
`Meine Gruppen` führen inzwischen auf echte Screens). Der Screen zeigt eine
vollständige Einstellungsliste, hinter der nichts liegt. Für eine Testrunde
ist das vertretbar, solange es benannt ist — aber es ist der größte weiße
Fleck.

`Passwort vergessen?` und `Datenschutz` sind gesondert zu betrachten: das eine
gehört zur Anmeldung, das andere ist rechtlich nicht verhandelbar, sobald die
App echte Daten verarbeitet.

### B. Sollte auf demselben Screen etwas tun (12)

Hier fehlt kein Entwurf, nur die Bewegung. Das ist billig nachzuziehen und
lohnt sich am ehesten dort, wo es die Wirkung der App ausmacht.

| Screen | Element | Was fehlt |
| --- | --- | --- |
| verlauf | Woche · Monat · Jahr · Alle | Umschalten des Zeitraums |
| verlauf | Filtern | Filterbereich |
| share-export | Story 9:16 · Post 1:1 | Format wechseln |
| chat | Anhängen · Sprachnachricht · Senden | Eingabe |
| live-tracking | Pausieren | Lauf anhalten |
| home | Benachrichtigungen | Liste |

**`Pausieren` im Live-Tracking ist der wichtigste Posten der Liste.** Wer
unterwegs an einer Ampel steht, erwartet, dass die Aufzeichnung anhält. Ein
Prototyp, der das nicht zeigt, lässt genau die Frage ungestellt, ob die
Pausenführung stimmt.

Die vier Zeitraum-Chips im Verlauf sind der zweite Kandidat: sie stehen
prominent oben und werden in einer Testrunde mit Sicherheit angetippt.

## Nicht auf der Liste

Sechs Elemente sahen im Prüflauf tot aus, sind es aber nicht: die drei
Stil-Chips im Social-Studio, die zwei Einwilligungsknöpfe in der
Laufanalyse und das Absenden im Social-Studio.

Das letzte war ein Fehler in meiner Erkennungsregel, den erst der
Klickflow-Test aufgedeckt hat: dort hängt die Verdrahtung am **Formular**,
nicht am Knopf. Die Regel fragt jetzt beides ab. Es ist die Sorte Fehler,
die eine automatische Erkennung mitbringt — sie kann Funktionierendes
abwürgen, und deshalb prüft ein Test ausdrücklich, dass „Laufen starten“
unberührt bleibt.
