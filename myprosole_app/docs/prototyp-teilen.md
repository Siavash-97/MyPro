# Den Prototyp zum Testen weitergeben

Ziel: Bekannte bekommen einen Link, tippen einmal auf „Zum Startbildschirm
hinzufügen" und bedienen den Entwurf danach wie eine App — eigenes Symbol,
kein Browser-Rahmen, funktioniert auch ohne Netz. Nichts, was sie dabei
eingeben, wird gespeichert.

## Was dafür gebaut ist

| Datei | Zweck |
| --- | --- |
| `design/manifest.webmanifest` | Name, Symbol, Startseite, Vollbild |
| `design/sw.js` | Offline-Betrieb |
| `design/scripts/prototype-app-shell.js` | meldet den Service Worker an |
| `design/icons/` | Platzhalter-Symbole, **noch kein echtes Logo** |

Der Einstieg ist `mockups/welcome.html`, nicht die Übersicht `index.html`.
Wer testet, soll die App sehen und nicht die Werkstatt.

## Datenhaltung

Es gibt keine. Der Prototyp legt Eingaben ausschließlich im Sitzungsspeicher
ab; der ist beim Schließen des Fensters weg. Der Service Worker speichert nur
Dateien des Entwurfs — HTML, Stylesheets, Symbole —, nichts, was jemand
eintippt. Ein Test prüft, dass die App-Hülle weder `localStorage` noch Cookies
noch `indexedDB` anfasst.

Damit fällt für die Testrunde keine Verarbeitung personenbezogener Daten an.
**Sobald ein Server mitschreibt, ändert sich das** und es braucht die
Einwilligung nach Art. 6 DSGVO sowie eine Datenschutzerklärung.

## Was noch fehlt

Der Prototyp muss unter **HTTPS** erreichbar sein. Ohne das meldet sich der
Service Worker nicht an — dann läuft alles, aber nur online und ohne
Installation. Der Vorschau-Server im WLAN (`http://…:8000`) ist genau dieser
Fall: gut zum Anschauen, nicht zum Weitergeben.

Die Wahl des Hosters ist offen und in der Besprechung festzuhalten. Wichtig
dabei: dieses Repository enthält Geschäftsplan und Trainingskonzept. Ein
Weg, der das gesamte Repository öffentlich macht, veröffentlicht auch die.
Sicherer ist, allein den Ordner `myprosole_app/design/` zu veröffentlichen.

## Grenzen, die man den Testenden sagen sollte

- **Android** schlägt die Installation von selbst vor. **iPhone** nicht: dort
  muss man im Teilen-Menü „Zum Home-Bildschirm" wählen. Safari ist Pflicht.
- Die Daten sind erfunden und überall gleich: 8,2 km, 48:20 min, 5:54 min/km.
  Es wird nichts gemessen und nichts gerechnet.
- Manche Wege sind Einbahnstraßen, weil sie im Entwurf nur einen Zustand
  zeigen. Zurück kommt man über die untere Leiste.
- Es ist ein Entwurf, kein Trainingsplan. Niemand sollte danach trainieren.

## Was eine Testrunde beantworten soll

Ohne Fragestellung kommt „sieht gut aus" zurück, und das hilft nicht. Sinnvoll
sind Aufgaben statt Meinungen, zum Beispiel:

1. Starte einen Lauf und trage danach ein, dass du Schmerzen hattest.
2. Finde heraus, was für dich diese Woche geplant ist.
3. Lege dir selbst einen Laufplan für die kommende Woche an.

Beobachten, wo jemand zögert. Die Stelle ist das Ergebnis, nicht das Urteil.
