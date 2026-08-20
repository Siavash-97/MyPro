# Zurückgestellt — die Warteliste

**Stand 20.08.2026: Die Prämisse dieses Dokuments hat sich geändert.**

Ursprünglich stand hier, was der Browser nicht kann und was kommt, „sobald es
die native App gibt". Die gibt es seit der APK, und die Abschnitte 1 und 2
sind damit abgearbeitet oder überholt.

Geblieben ist eine Warteliste auf zwei Ebenen:

- **Abschnitt 3:** was noch nicht dran war, aber jederzeit gebaut werden kann
- **Abschnitt 4:** was auch die APK nicht kann, weil unsere Oberfläche in
  einem eingebauten Browser läuft — die Liste, an der eines Tages die
  Entscheidung über einen Wechsel zu React Native oder nativ hängt

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

---

## 4. Was auch die APK nicht kann — Stand 20.08.2026

Abschnitt 1 und 2 handelten davon, was der **Browser** nicht kann. Beides ist
mit der APK erledigt. Dieser Abschnitt ist die nächste Ebene: Dinge, die auch
in der App nicht gehen, **weil unsere Oberfläche in einem eingebauten Browser
läuft** (Capacitor/WebView).

Sie werden hier gesammelt, damit die Entscheidung über einen Wechsel zu React
Native oder nativ eines Tages an einer Liste getroffen wird und nicht an einem
Gefühl. Herleitung und Schwellenwerte:
[bauart-und-wachstum.md](bauart-und-wachstum.md).

### 4.1 Harte Wände — geht in einer WebView grundsätzlich nicht

**Wear OS und Apple Watch.** Es gibt auf einer Uhr keine WebView, die unsere
Oberfläche zeigen könnte. Das ist kein Aufwandsproblem, sondern ein
Nichtvorhandensein. Sobald eine Uhr-App verbindlich auf den Plan kommt, ist
Capacitor raus — das ist die einzige Kennzahl im Bericht, die allein reicht.

**Dauerbetrieb der Oberfläche im Hintergrund.** Chromium friert
Aufgabenschlangen nach fünf Minuten im Hintergrund ein. Alles, was dauerhaft
rechnen soll, muss in nativen Code — so wie die Aufzeichnung es bereits ist.

**Zertifikat-Pinning für unseren Hauptdatenkanal.** Ionics Lösung ist
kostenpflichtig, wird zum 31.12.2027 eingestellt und deckt `fetch` gar nicht
ab — und `supabase-js` benutzt `fetch`. Es ist offen, ob Androids
`network_security_config` hier greift; das ist ungeprüft.

### 4.2 Geht, aber nur mit eigenem nativen Code

Für jeden dieser Punkte gilt: machbar, aber wir bauen das Plugin selbst.
Bei React Native gäbe es dafür gepflegte Lösungen.

**Bluetooth im Hintergrund.** Dasselbe Fünf-Minuten-Problem wie beim GPS. Im
Fehlerbericht des Plugins steht wörtlich, dass Sensordatenerfassung im
Hintergrund „currently not possible" sei. **Das ist der nächste Schritt, und
er muss vor dem Einlagen-Prototyp kommen.**

**Health Connect** (Android) und **HealthKit** (iPhone). Das Capacitor-Paket
dafür hat 8 Sterne und seit zwei Jahren keinen Commit — faktisch verwaist. Für
React Native gibt es gepflegte Pakete; Runna benutzt eines davon.

**Hochfrequente Sensordaten.** Die Capacitor-Brücke trägt keine Binärdaten
(„on native we can only write strings" steht so im Quelltext des Plugins).
Jedes Paket wird in Hex umkodiert und durch JSON geschleust. Lösbar, indem die
Firmware bündelt und die Auswertung nativ läuft — aber es ist eine
Einschränkung, die man kennen muss, bevor die Firmware festgelegt wird.

### 4.3 Was wir bewusst nicht mehr bauen

**Rückfalllösungen für den Browser.** Die Web-App wird nicht mehr angeboten.
Der Browser dient der Entwicklung; dort darf Aufzeichnung ruhig aufhören,
wenn der Tab in den Hintergrund geht.

### 4.4 Die Regel, nach der wir bis dahin bauen

> **Fachlogik nach unten, Darstellung nach oben.**

Jedes Mal, wenn etwas aus der WebView in nativen Code wandert, passiert
zweierlei: Die App wird sofort besser, **und** der Anteil des Codes, der bei
einem späteren Wechsel neu zu schreiben wäre, sinkt. Heute sind 901 von 1206
nativen Zeilen frei von Capacitor-Bezug — sie liefen unverändert unter React
Native und unverändert nativ.

Am Ende ist die WebView nur noch Anzeige. Dann ist ein Wechsel entweder
billig oder unnötig. Beides ist ein gutes Ergebnis.

