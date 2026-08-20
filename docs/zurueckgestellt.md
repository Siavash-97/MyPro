# Zurückgestellt — kommt, wenn die App fertig ist

Punkte, die bewusst **nicht** in der Web-App gebaut werden, weil der Browser
sie nicht kann. Sie gehen nicht verloren: Sobald es die native App gibt
(oder eine Hülle wie Capacitor), wird diese Liste abgearbeitet.

Jeder Punkt sagt: was fehlt, warum es im Web nicht geht, was heute stattdessen
passiert, und was zu tun ist, wenn es soweit ist.

Stand: 15.08.2026

---

## 1. Bluetooth: Smartwatch und Einlagen verbinden

**Was fehlt.** Im Entwurf gibt es im Profil und im Live-Tracking je einen
Knopf zum Verbinden. Er soll die Geräteauswahl öffnen und danach Herzfrequenz
bzw. Einlagendaten live anzeigen.

**Warum es im Web nicht geht.** Eine Web-App kann die Bluetooth-Einstellungen
des Handys nicht öffnen — kein Browser erlaubt das. Es gibt zwar *Web
Bluetooth*, aber nur in Chrome unter Android und Desktop; auf dem iPhone
existiert es überhaupt nicht. Und für Smartwatches hilft es ohnehin nicht:
Garmin, Polar & Co. geben ihre Daten nicht per Bluetooth an eine fremde App,
sondern nur über ihre Cloud (Garmin Connect, Strava, Health Connect).

**Überholt am 20.08.2026.** Der Absatz unten galt für die reine Web-App. Seit
es die APK gibt, ist Bluetooth gebaut: Suchen, Verbinden, Herzfrequenz und
Akkustand über die genormten Dienste. Was weiterhin **nicht** geht, ist das
Auslesen der Uhrsensoren — dafür bräuchte es eine App auf der Uhr. Die
Begründung und der Weg stattdessen stehen in
[sensoren-woher-die-daten-kommen.md](sensoren-woher-die-daten-kommen.md).

**Was damals passierte.** Beide Knöpfe sind da und sichtbar, wie im Entwurf.
Ein Tipp darauf zeigt einen kurzen Hinweis („kommt noch"). Der Knopf
reagiert also, er verspricht nur nichts, was er nicht halten kann.

**Was zu tun ist.**
- *Einlagen:* In der nativen App direkt über Bluetooth koppeln. Der
  Bildschirm [InsoleConnect.tsx](myprosole_web/src/pages/InsoleConnect.tsx)
  steht schon und muss nur echte Geräte statt der Beispielliste bekommen.
  Hängt an der Hardware — siehe die geplante Sensor-Architektur.
- *Smartwatch:* Nicht über Bluetooth, sondern über einen Anbieter. Ein Weg
  (z. B. Strava oder Health Connect) reicht für den Anfang und deckt die
  meisten Uhren ab. Das ist ein eigenes Vorhaben mit Anmeldung beim
  Anbieter, OAuth und Datenschutz-Abklärung, kein Nebenbei-Punkt.

---

## 2. Aufzeichnung im Hintergrund

**Was fehlt.** Wer während des Laufs das Handy sperrt, eine Nachricht
beantwortet oder Musik umstellt, soll weiterlaufen können — die Aufzeichnung
läuft im Hintergrund weiter.

**Warum es im Web nicht geht.** Sobald die Seite nicht mehr sichtbar ist,
hält der Browser GPS und Zeitgeber an. Er tut das absichtlich, zum Schutz des
Akkus, und es lässt sich nicht abschalten. Eine Aufzeichnung, die scheinbar
weiterläuft, würde in Wahrheit Lücken sammeln oder ganz stehenbleiben — und
am Ende eine Strecke anzeigen, die nie stattgefunden hat. Auch eine
Rückfrage beim Verlassen ist nicht möglich: Eigene Dialoge sind dort
verboten.

**Was heute passiert.** Entschieden am 15.08.2026: Verlässt jemand die App,
wird der Lauf **beendet und gespeichert** — derselbe Weg wie beim
Stop-Knopf, nur ohne Rückfrage. War er zu kurz (unter 0,1 km oder unter
60 Sekunden), wird nichts gespeichert. Ein Hinweis auf dem Bildschirm sagt
das vorher an. Ehrlich und ohne Überraschung, aber eben eine Einschränkung.

**Was zu tun ist.** In der nativen App echte Hintergrund-Ortung einbauen
(Android: Vordergrund-Dienst mit Benachrichtigung; iOS:
`UIBackgroundModes: location`). Dann kann die geplante Rückfrage kommen —
„Tracking fortsetzen" oder „Tracking beenden" —, denn dann stimmt sie auch.
Ein erster Anlauf dafür wurde in `9aa2a24` wieder zurückgebaut, weil er
diese Grenze nur kaschiert hätte.

---

## 3. Was sonst noch wartet

Kein Plattformproblem, nur noch nicht dran — der Vollständigkeit halber:

- Sieben Detailseiten der Community warten auf ihre Tabellen in der
  Datenbank.
- `einlage.html`, `confirm-email.html` und `share-export.html` sind noch
  nicht als eigene Seiten gebaut.

Alles Weitere steht in [umsetzung-offene-punkte.md](umsetzung-offene-punkte.md).
