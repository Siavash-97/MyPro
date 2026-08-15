# GPS-Genauigkeit: Regeln und wo wir stehen

Recherchiert am 15.08.2026 aus der veröffentlichten Praxis von
Lauf-Aufzeichnern und offenen Projekten. Jede Regel steht hier mit Quelle,
mit unserem Stand und mit dem Ort im Code.

Grundproblem: Rohe GPS-Punkte sind zu ungenau, um sie einfach aufzusummieren.
MapMyRun beziffert die Überschätzung ungefilterter Strecken auf 4–6 %,
gefiltert auf 2–3 % — auf einen Marathon gerechnet sind das mehrere Minuten
Unterschied.

---

## 1. Zwischengespeicherte Messungen verwerfen

**Regel.** Standorte, die älter als etwa 10 Sekunden sind, wegwerfen. Das
Gerät liefert manchmal einen Fix von vorhin, als der Empfang besser war. Bei
Laufgeschwindigkeit sind 10 Sekunden rund 40 Meter Fehler.

**Unser Stand.** Erfüllt seit 15.08.2026. `MAX_ALTER_MS = 10_000` in
[store/run.ts](myprosole_web/src/store/run.ts), geprüft gegen
`pos.timestamp`. Zusätzlich steht `maximumAge` in `watchPosition` jetzt auf
`0` statt auf 3000 — vorher hat die App also selbst um zwischengespeicherte
Werte gebeten.

**Nebenwirkung.** Mit `maximumAge: 0` kann der erste Fix länger dauern; Chrome
drosselt WLAN-Suchen. Unser `timeout` liegt bei 10 Sekunden, das ist
großzügig genug. Die Uhr läuft ohnehin ab Knopfdruck.

---

## 2. Ungenaue Messungen verwerfen

**Regel.** Negative Genauigkeitsangaben sind ungültig. Für Laufanwendungen
werden 30–50 m als Obergrenze empfohlen; 100 m reichen nur für Anwendungen
vom Typ Fahrdienst.

**Unser Stand.** Erfüllt und strenger: `MAX_ACCURACY_M = 25`. Negative Werte
werden seit 15.08.2026 ebenfalls abgewiesen.

**Offene Abwägung.** 25 m ist streng. In enger Bebauung könnten dadurch viele
Messungen wegfallen und die Strecke zu kurz werden. Falls dein nächster Lauf
draußen weniger Kilometer meldet als tatsächlich gelaufen, ist das die erste
Schraube — 35 oder 40 m wären noch im empfohlenen Rahmen.

---

## 3. Stillstand-Drift herausfiltern

**Regel.** Ein liegendes Gerät wandert. Abstände unterhalb weniger Meter sind
Rauschen, keine Bewegung.

**Unser Stand.** Erfüllt: `MIN_SEGMENT_KM = 0.005`, also 5 Meter. Verglichen
wird mit dem letzten **angenommenen** Punkt, damit langsames Gehen nicht
verschluckt wird. Der Punkt wird gar nicht erst aufgenommen, dadurch bleibt
auch die Karte ruhig.

---

## 4. Ortungssprünge herausfiltern

**Regel.** Offene Projekte prüfen über eine Höchstgeschwindigkeit
(`gps-track-filter` nutzt 110 km/h für Fahrzeuge). Eine feste Streckengrenze
allein taugt nicht: Sie schlägt bei langer Pause zwischen zwei Messungen
grundlos zu und lässt bei kurzer einen unmöglichen Satz durch.

**Unser Stand.** Seit 15.08.2026 über das Tempo: `MAX_TEMPO_MPS = 12.5`, also
45 km/h. Zum Vergleich: Der 100-Meter-Weltrekord entspricht rund 10,4 m/s im
Schnitt. Die alte Streckengrenze von 500 m bleibt als zweite Sicherung.

Ein Sprung wird zum neuen Bezugspunkt, seine Strecke zählt aber nicht.

---

## 5. Höhenmeter mit Schwelle statt roher Summe

**Regel.** Die Höhe ist die mit Abstand unzuverlässigste GPS-Angabe. Wer jede
positive Schwankung aufsummiert, bekommt ein Vielfaches des echten Anstiegs.
Offene Projekte arbeiten mit einer Mindeständerung von etwa 2 Metern
(`intminds/gps`: 2 m bei 60 m Fenster).

**Unser Stand.** War **verletzt**, seit 15.08.2026 erfüllt — in zwei
Schritten, denn der erste reichte nicht:

1. `MIN_HOEHENSCHRITT_M = 3`, verglichen mit der letzten **gezählten** Höhe,
   und der Bezug wandert nur bei einem echten Abstieg mit.
2. Davor wird über `HOEHEN_FENSTER = 5` Messungen gemittelt.

Warum beides nötig ist: Eine Schwelle allein hilft nur gegen Schwankungen,
die kleiner sind als die Schwelle. Echtes Höhenrauschen liegt aber eher bei
5 bis 10 Metern. Nachgemessen mit einem Auf und Ab von ±2 m auf platter
Strecke: **36 Höhenmeter** allein durch die Schwellenlösung, **0** nach dem
Mitteln. Erst glätten, dann vergleichen — so machen es die Fachprojekte auch.

**Preis der Glättung.** Ein Anstieg wird um etwa das halbe Fenster verzögert
erfasst. Bei einem gestellten Anstieg von 40 m kamen 32 heraus. Das ist ein
einmaliger Effekt am Ende des Laufs und fällt über eine echte Strecke kaum
ins Gewicht — deutlich weniger, als die Überschätzung vorher ausmachte.

**Wie groß der Fehler war.** OpenTracks meldete ohne Glättung 1316 Höhenmeter,
wo Strava 630 auswies — mehr als das Doppelte. Unsere bisherige Rechnung war
dieselbe wie die dortige.

Dieselbe Regel gilt für die Kilometer-Abschnitte, sonst meldet deren Summe
mehr Höhenmeter als der Lauf insgesamt.

---

## 6. Tempo erst ab einer Mindeststrecke zeigen

**Regel.** Ohne nennenswerte Strecke ist jedes Tempo geraten.

**Unser Stand.** Erfüllt: unter `MIN_PACE_DISTANCE_KM = 0.05` (50 m) zeigt die
App `--:--`.

---

## Bewusst nicht umgesetzt

**Kalman-Filter.** Der Standardvorschlag: die nächste Position vorhersagen und
Messungen verwerfen, die mehr als etwa 60 m davon abweichen. Fängt die
seltenen Fälle ab, in denen eine Messung genau aussieht und trotzdem falsch
liegt. Deutlich aufwendiger als alles oben, und die einfachen Schwellen
nehmen den Großteil des Rauschens bereits weg. Lohnt sich erst, wenn nach
echten Läufen noch Ausreißer auffallen.

**Anlaufphase.** Manche Anwendungen verwerfen die ersten Messungen nach dem
Start pauschal, weil sie am schlechtesten sind. Bei uns übernimmt das die
Genauigkeitsschwelle aus Punkt 2.

**Warnung aus der Praxis.** MapMyRun hat nach dem Verschärfen der Filter
Rückmeldungen bekommen, dass verwinkelte Strecken nun rund 10 % zu kurz
gemessen werden. Zu scharf filtern ist also auch ein Fehler — deshalb sind
unsere Schwellen bewusst am unteren Rand des Empfohlenen.

---

## Quellen

- [Make it even better than Nike+ — How to filter locations](https://medium.com/how-to-track-users-location-with-high-accuracy-ios/make-it-even-better-than-nike-how-to-filter-locations-tracking-highly-accurate-location-in-1c9d53d31d93)
- [Refining GPS for More Accurate Tracking (MapMyRun)](https://medium.com/ua-makers/refining-gps-for-more-accurate-tracking-585189c91238)
- [A Comprehensive Guide to Testing iOS GPS Accuracy (Freeletics)](https://freeletics.engineering/2019/06/03/ios_gps_testing.html)
- [Reduce GPS Data Error on Android with Kalman Filter](https://maddevs.io/blog/reduce-gps-data-error-on-android-with-kalman-filter-and-accelerometer/)
- [binateq/gps-track-filter](https://github.com/binateq/gps-track-filter)
- [intminds/gps](https://github.com/intminds/gps)
- [OpenTracks: GPS smoothing](https://github.com/OpenTracksApp/OpenTracks/issues/457)
- [MDN: Geolocation.watchPosition](https://developer.mozilla.org/en-US/docs/Web/API/Geolocation/watchPosition)

---

# Teil 2: Empfang — was drinnen passiert und was hilft

Recherchiert am 15.08.2026. Teil 1 oben behandelt die Rechenregeln, hier geht
es um das Signal selbst.

## Warum drinnen nichts geht

Ein Satellit sendet mit rund 20 Watt über etwa 20 000 Kilometer. Was unten
ankommt, ist extrem schwach und wird von Beton, Metall und dicken Wänden
verschluckt oder abgelenkt. Ohne freie Sicht auf mindestens vier Satelliten
gibt es keine Position. Das ist Physik und lässt sich mit keiner App umgehen.

Was das Handy stattdessen tut: Es schaltet auf WLAN-Netze und Funkzellen um
(auf Android heißt das *Fused Location Provider*). Das liefert typischerweise
**10 bis 30 Meter** Genauigkeit — brauchbar, um zu wissen, in welchem Gebäude
jemand ist, aber unbrauchbar, um eine Laufstrecke zu messen.

**Für uns heißt das:** Unsere Grenze von 25 Metern verwirft solche Messungen
größtenteils, und das ist richtig so. Drinnen lieber nichts aufzeichnen als
eine Strecke aus WLAN-Schätzungen zusammenzurechnen. Genau deshalb steht auf
dem Bildschirm jetzt „Kein GPS-Signal" mit Erklärung, statt still 0,0 km
anzuzeigen.

## Was der Läufer tun kann (Stravas eigene Hinweise)

- **Freie Sicht zum Himmel.** Das Handy hoch und frei tragen, nicht tief in
  der Hosentasche oder im Rucksack. Schon eine Tasche dämpft messbar.
- **Vor dem Start Empfang holen.** Ruhig stehen bleiben, bis die Anzeige gut
  ist. Selbst bei freiem Himmel dauert der erste Fix manchmal Minuten.
- **Mobile Daten und WLAN-Suche anlassen.** Das beschleunigt den ersten Fix
  deutlich, weil das Handy die Satellitenbahnen aus dem Netz lädt, statt sie
  vom Satelliten selbst abzuwarten.
- **Häuserschluchten und dichte Baumkronen meiden**, wo es geht. Dort wird
  das Signal von Wänden reflektiert und kommt auf Umwegen an.

Diese Hinweise gehören perspektivisch in die App — sinnvollerweise genau
dann, wenn die Anzeige längere Zeit schlecht bleibt.

## Was die Anzeige jetzt leistet

Die Kopfzeile zeigt während des Laufs die aktuelle Güte, etwa `GPS ±8 m`,
auch für verworfene Messungen. Vorbild ist Stravas Ring um die eigene
Position: je kleiner, desto besser. Ohne diese Rückmeldung wirkt Warten wie
Stillstand.

Grobe Einordnung: unter 10 Metern ist gut, 10 bis 25 Meter brauchbar,
darüber verwerfen wir.

## Wo die Grenze der Web-App liegt

Die Browser-Schnittstelle gibt uns fertige Positionen — welche Satelliten,
welches Frequenzband, ob GPS oder WLAN, sehen wir nicht und können es nicht
beeinflussen. Native Apps können mehr (Genauigkeitsklasse anfordern,
Sensorfusion beeinflussen). Das gehört zur Liste in
[zurueckgestellt.md](zurueckgestellt.md).

## Was eine Uhr besser kann

Moderne Sportuhren empfangen zwei Frequenzbänder gleichzeitig (L1 und L5).
Das L5-Band ist stärker und unempfindlicher gegen Reflexionen an Hauswänden.
Gemessene Unterschiede: Zweiband bleibt etwa **1 bis 2 Meter** neben der
echten Strecke, Einband weicht in schwierigem Gelände um **3 bis 5 Meter**
ab, in Extremfällen deutlich mehr. Bei den Höhenmetern halbierte sich der
Fehler von etwa ±5 auf unter ±2,4 Meter.

Praktisch heißt das: Wer genaue Daten will, läuft mit Uhr. Nur kommen wir an
deren Daten nicht heran, solange wir eine Web-App sind — Garmin und Polar
geben sie nicht per Bluetooth an fremde Apps, sondern nur über ihre Cloud.
Auch das steht in [zurueckgestellt.md](zurueckgestellt.md).

## Quellen (Teil 2)

- [Troubleshooting Android GPS Issues — Strava](https://support.strava.com/en-us/articles/15402062-troubleshooting-android-gps-issues)
- [Bad GPS Data — Strava](https://support.strava.com/hc/en-us/articles/216917707-Bad-GPS-Data)
- [Recording an Activity — Strava](https://support.strava.com/en-us/articles/15402137-recording-an-activity)
- [Why GNSS and GPS Do Not Function Properly Indoors — Sysnav](https://www.sysnav.fr/why-gnss-and-gps-do-not-function-properly-indoors/?lang=en)
- [Fused Location Provider API — Google](https://developers.google.com/location-context/fused-location-provider)
- [How to achieve 1-meter accuracy in Android — GPS World](https://www.gpsworld.com/how-to-achieve-1-meter-accuracy-in-android/)
- [Inherent Limitations of Smartphone GNSS Positioning](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC9788430/)
- [OpenTracks: GPS-Einstellungen](https://github.com/OpenTracksApp/OpenTracks/discussions/1870)
