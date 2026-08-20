# GPS-Genauigkeit: Regeln und wo wir stehen

Recherchiert am 15.08.2026 aus der veröffentlichten Praxis von
Lauf-Aufzeichnern und offenen Projekten. Jede Regel steht hier mit Quelle,
mit unserem Stand und mit dem Ort im Code.

Drei Teile:

- **Teil 1** — die Rechenregeln (unten)
- **Teil 2** — der Empfang: was drinnen passiert und was hilft
- **Teil 3** — die Geschwindigkeit: woher sie kommen muss (20.08.2026)

**Zwei Regeln in Teil 1 sind inzwischen widerlegt** — sie galten hier als
erfüllt und waren es nicht. Die Stellen tragen einen Hinweis und verweisen
auf Teil 3. Nachzurechnen mit
[scripts/gps_drift_messung.py](../scripts/gps_drift_messung.py).

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

**Korrektur 20.08.2026.** Diese Schwelle war nie das Mittel gegen Drift —
siehe Teil 3. OpenTracks arbeitet mit **50 m** und filtert Drift über die
Mindestdistanz. Unsere 25 m sind also nicht zu locker, sondern eher zu
streng, und sie haben das Stillstandsproblem nie gelöst.

**Offene Abwägung.** 25 m ist streng. In enger Bebauung könnten dadurch viele
Messungen wegfallen und die Strecke zu kurz werden. Falls dein nächster Lauf
draußen weniger Kilometer meldet als tatsächlich gelaufen, ist das die erste
Schraube — 35 oder 40 m wären noch im empfohlenen Rahmen.

---

## 3. Stillstand-Drift herausfiltern

**Regel.** Ein liegendes Gerät wandert. Abstände unterhalb weniger Meter sind
Rauschen, keine Bewegung.

**Unser Stand.** `MIN_SEGMENT_KM = 0.005`, also 5 Meter. Verglichen
wird mit dem letzten **angenommenen** Punkt, damit langsames Gehen nicht
verschluckt wird. Der Punkt wird gar nicht erst aufgenommen, dadurch bleibt
auch die Karte ruhig.

**Widerlegt am 20.08.2026.** Diese Regel galt hier als erfüllt. Sie ist es
nicht: Ein stillliegendes Telefon erzeugte in der Nachrechnung über 30
Minuten **7,3 Kilometer** und eine Pace von 4:06 min/km. Der Grund und die
Abhilfe stehen in Teil 3. Eine Mindestdistanz wirkt nur, solange sie größer
ist als das Rauschen — sie zu verdoppeln trägt nicht.

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

---

# Teil 3: Geschwindigkeit — woher sie kommen muss

Recherchiert und nachgerechnet am 20.08.2026, ausgelöst durch eine
Beobachtung am Gerät: **Die App zeigte Geschwindigkeit, obwohl niemand
gelaufen ist.**

Teil 1 behandelt die Rechenregeln, Teil 2 den Empfang. Hier geht es um die
Frage, die beide voraussetzen und keiner beantwortet: Woher weiß die App
überhaupt, wie schnell jemand ist?

---

## 1. Der Befund

Die vorhandene Filterkette aus [store/run.ts](../myprosole_web/src/store/run.ts)
wurde gegen ein stillliegendes Telefon gerechnet — Rauschen um einen festen
Punkt, eine Messung je Sekunde.

```
Telefon liegt STILL. 5 Minuten.

  Streuung  ~accuracy    Strecke   Pace?
       3 m        6 m     1143 m      JA      <- sehr guter Empfang
       5 m       10 m     1579 m      JA
       8 m       16 m     1151 m      JA
      12 m       24 m      701 m      JA

30 Minuten, Streuung 8 m:
  Strecke aus reinem Rauschen: 7,3 km
  Angezeigte Pace:             4:06 min/km
```

Bemerkenswert ist die erste Zeile: **Je besser der Empfang, desto mehr
erfundene Strecke.** Bei gutem Signal sind die Sprünge kleiner, also werden
weniger davon als Ortungssprung verworfen — und alle passieren die
Fünf-Meter-Schwelle.

### Warum eine größere Schwelle nicht reicht

Naheliegender erster Gedanke: Schwelle von 5 auf die üblichen 10 Meter
anheben. Nachgerechnet:

```
30 Minuten Stillstand, fälschlich entstandene Strecke:

 Streuung |  heute (5 m) |  OpenTracks (10 m) |  10 m + Doppler-Tor
------------------------------------------------------------------
      3 m |       6337 m |             1260 m |                 0 m
      5 m |       9363 m |             6059 m |                 0 m
      8 m |       7306 m |             7133 m |                 0 m
     12 m |       4101 m |             4510 m |                 0 m
```

Bei 8 m Streuung: 7133 statt 7306 Metern. **Eine Mindestdistanz wirkt nur,
solange das Rauschen kleiner ist als sie.** Darüber ist sie wirkungslos,
gleich wie man sie stellt.

**Grenze dieser Rechnung, ausdrücklich benannt.** Das Modell nimmt
unabhängiges Rauschen je Messung an. Echtes GPS wandert langsam;
aufeinanderfolgende Messungen hängen zusammen und liegen enger beieinander.
In der Praxis wirkt die Zehn-Meter-Schwelle deshalb besser als hier. Was das
Modell robust zeigt, ist etwas anderes: Die Wirkung einer Distanzschwelle
**hängt vom Rauschcharakter des Geräts ab**, die eines Geschwindigkeitstors
nicht.

---

## 2. Doppler statt Distanz durch Zeit

Ein GNSS-Empfänger kennt zwei Wege zur Geschwindigkeit. Der eine vergleicht
zwei Positionen und teilt durch die Zeit. Der andere misst die
Frequenzverschiebung der Satellitensignale — den Dopplereffekt — und leitet
daraus die eigene Bewegung ab, **ohne Positionen zu vergleichen**.

Die Android-Doku zu `Location.getSpeed()` sagt es selbst:

> *may be more accurate than would be obtained simply by calculating distance
> / time for sequential positions, such as if the Doppler measurements from
> GNSS satellites are taken into account.*

Inside GNSS beziffert den Unterschied: Positionsdifferenz erreicht **Meter
pro Sekunde**, Doppler **Zentimeter pro Sekunde** — Faktor 30 bis 100.

Der entscheidende Punkt für unser Problem: Im Stand ist die Positionsmethode
im Grunde nur Rauschen, während der Dopplerwert korrekt gegen Null geht.

### Was die Vorbilder tun

| Projekt | Quelle der Geschwindigkeit |
|---|---|
| **OpenTracks** | ausschließlich `location.getSpeed()`, **kein** Rückfall auf Distanz/Zeit |
| **RunnerUp** | `getSpeed()` als Standard; Distanz/Zeit nur als Notnagel, abschaltbar, Vorgabe aus |

RunnerUp macht die Abwägung im Code sichtbar
(`app/src/main/org/runnerup/tracker/Tracker.java`, Z. 664–671): Distanz/Zeit
greift nur, wenn `hasSpeed()` falsch ist, die Geschwindigkeit exakt 0.0 lautet
oder der Nutzer es ausdrücklich einstellt. Die Vorgabe dieses Schalters
(`pref_speed_from_gps_points`) ist **aus**.

### Und was OpenTracks wirklich gegen Drift tut

Nicht die Genauigkeitsschwelle — die steht dort bei großzügigen **50 m**.
Sondern die Quantisierung: Ein Punkt wird erst gespeichert, wenn er **10 m**
vom letzten gespeicherten entfernt ist, und Strecke wird nur zwischen
gespeicherten Punkten summiert
(`services/TrackRecordingManager.java`, `onNewTrackPoint`).

---

## 3. Die Werte und wo jeder herkommt

| Parameter | Wert | Herkunft |
|---|---|---|
| Geschwindigkeitsquelle | `coords.speed`, Distanz/Zeit nur als Notnagel | Android-Doku, OpenTracks, RunnerUp |
| Bewegungsschwelle | **0,9 m/s** (3,2 km/h, 18:38 min/km) | Strava dokumentiert: „30-minute mile pace" |
| Haltezeit bis „steht" | **10 s** | Strava-App und OpenTracks, unabhängig gleich |
| Wieder „läuft" | Schwelle überschritten **und** ≥ 10 m Abstand zum Stopppunkt | Strava-Technikblog |
| Mindestdistanz | **10 m** | OpenTracks-Vorgabe |
| Genauigkeitsgrenze | **50 m** | OpenTracks-Vorgabe |
| Segmentabbruch | **200 m** in einem Schritt → Lücke | OpenTracks-Vorgabe |
| Glättung der Anzeige | EMA, α ≈ 0,2 bei 1 Hz (τ ≈ 5 s) | RunnerUp nutzt 0,4; 0,2 ist Abwägung, kein Beleg |
| Anzeige bei Stillstand | `--:--` — nicht 0, nicht der letzte Wert | RunnerUp gibt `null`; OpenTracks friert ein und hat dafür Fehler #1995 offen |
| Anzeige bei altem Fix | `--:--` ab 15 s ohne Fix | RunnerUp `MAX_CURRENT_AGE = 15000` |

Beachtenswert: Die Genauigkeitsgrenze wird **lockerer**, nicht strenger. Sie
war nie das Mittel gegen Drift, und zu streng gestellt verwirft sie in enger
Bebauung gute Messungen.

---

## 4. Der Ruhepegel gehört gemessen, nicht geraten

Eine Messstudie an Android-Telefonen (ISPRS 2022) fand den Doppler-Restfehler
im Stand bei einem Huawei nova5 im **Zentimeter**-Bereich pro Sekunde, bei
einem Redmi K40 im **Dezimeter**-Bereich — bis 0,4 m/s. **Faktor zehn zwischen
zwei Mittelklassegeräten.**

Damit ist jede fest eingetragene Schwelle ein Kompromiss zwischen zwei
fremden Geräten. Bei 0,05 m/s Ruhepegel genügt die Schwelle allein; bei
0,4 m/s ist die Haltezeit zwingend.

**Deshalb misst die App den Wert selbst.** Niemand kann von außen wissen, wie
ruhig ein bestimmtes Telefon im Stand ist — und niemand soll es müssen.

### Wie das geht, ohne sich in den Schwanz zu beißen

Das Henne-Ei-Problem liegt auf der Hand: Um den Ruhepegel zu messen, muss man
wissen, dass gerade Ruhe ist — und genau das soll der Pegel erst
ermöglichen. Der Ausweg ist ein Stillstandsmerkmal, das **ohne**
Geschwindigkeit auskommt:

> **Nettoverschiebung statt Weglänge.** Über ein Fenster von 30 Sekunden wird
> nicht die Summe der Einzelabstände betrachtet, sondern der Abstand zwischen
> erstem und letztem Punkt. Wer steht, kommt trotz wanderndem Rauschen nicht
> vom Fleck: Die Nettoverschiebung bleibt klein, während die Weglänge
> beliebig wächst. Wer geht, hat nach 30 Sekunden rund 40 Meter zurückgelegt.

Das ist gegen Drift unempfindlich, weil Rauschen um einen festen Punkt
streut, statt sich in eine Richtung fortzusetzen.

Daraus das Verfahren:

1. **Stillstand erkennen** über die Nettoverschiebung (< 15 m in 30 s).
2. **Währenddessen `coords.speed` sammeln.** Diese Werte sind der Ruhepegel
   des Geräts — gemessen an genau diesem Telefon, unter genau diesem Himmel.
3. **95. Perzentil bilden**, sobald genug Werte da sind.
4. **Tor setzen** auf `max(0,9 m/s; Ruhepegel + Reserve)`. Der Strava-Wert
   bleibt Untergrenze: Er beschreibt nicht Rauschen, sondern die Frage, ab
   wann Bewegung als Bewegung zählt. Der gemessene Pegel darf das Tor also
   nur **anheben**, nie senken.
5. **Örtlich behalten.** Der Wert gehört zum Gerät, nicht zur Person. Er
   bleibt auf dem Telefon — was nicht gespeichert wird, kann nicht auslaufen.

Nebeneffekt, der es wert ist: Der Ruhepegel ist eine ehrliche Aussage über
die Güte des Geräts und lässt sich anzeigen, statt sie zu verschweigen.

---

## 5. Was uns als Web-App fehlt

Wir beziehen Positionen über `navigator.geolocation.watchPosition` im
WebView, nicht über ein natives Plugin. Zwei Werkzeuge der Vorbilder haben
wir damit nicht:

**`getSpeedAccuracyMetersPerSecond()`** — die Konfidenz zur Geschwindigkeit.
Das wäre das direkteste Tor gegen genau dieses Problem. Die
Browser-Schnittstelle kennt es nicht. (Bemerkenswert: Keines der untersuchten
Projekte nutzt es, obwohl alle es könnten.)

**`Location.distanceTo()`** — Abstand auf dem WGS84-Ellipsoid. Wir rechnen
stattdessen Haversine auf der Kugel. Nachgerechnet:

| Breite | Richtung | Abweichung | auf 10 km |
|---|---|---|---|
| 50° N | Ost–West | −0,308 % | −31 m |
| 50° N | Nord–Süd | −0,031 % | −3 m |
| 0° | Nord–Süd | +0,561 % | +56 m |

Der Betrag liegt unter dem GPS-Rauschen. Der Fallstrick ist, dass der Fehler
**richtungsabhängig und systematisch** ist: Er mittelt sich auf einer
Hin-und-Rück-Strecke nicht heraus. Ein Ost-West-Läufer in Deutschland bekommt
dauerhaft 0,3 % zu wenig.

Beides bekommen wir, sobald für die Hintergrundaufzeichnung ohnehin ein
natives Plugin nötig wird.

Dritter Punkt, der schon heute gilt: `Location.distanceTo()` ist **rein
zweidimensional**, und keines der Projekte addiert Höhendifferenzen in die
Streckenlänge. Richtig so — Höhenrauschen ist zwei- bis dreimal so groß wie
das horizontale und schlüge sonst direkt in die Distanz durch.

---

## 6. Der unbequeme Befund

**Strava hat GPS-Autopause fürs Laufen aufgegeben.** Aus dem eigenen
Technikblog:

> *We experimented with making it more sensitive to minor GPS movement, but
> that caused errors — it would sometime pause while running or **resume while
> standing still**.*

Bewegung wird dort heute über den **Beschleunigungssensor** erkannt. Eine
unabhängige Messstudie (MDPI Sensors 2023) kommt zum selben Schluss: Ihr
Zustandsautomat entscheidet über die Schrittkadenz aus dem
Beschleunigungssensor, nicht über GPS.

Dazu passt, was der Betreuer von OpenTracks über die eigene Stillstandslogik
sagt (Fehler #2043): *„Idle can also be triggered by low GPS reception."* Der
jüngste Commit dort dreht immer noch an diesem Zeitgeber.

**Was daraus folgt.** Die GPS-Schwellen sind die Sofortmaßnahme und lösen das
beobachtete Problem. Der ehrliche Endzustand ist der Beschleunigungssensor —
und der steht ohnehin auf dem Plan, weil die Einlage Sensordaten liefern
wird. Diese Stelle ist die einzige, an der alle Quellen übereinstimmen.

**Der Preis der Sofortmaßnahme, offen benannt:** Ein Tor mit 10 Sekunden
Haltezeit hängt beim Losgehen bis zu 10 Sekunden hinterher, und in engen
Straßen oder unter dichten Bäumen schaltet es fälschlich auf „steht". Das ist
kein hypothetisches Risiko, sondern in beiden Projekten belegt.

---

## 7. Übernehmbare Fundstellen

| Was | Wo |
|---|---|
| Genauigkeitstor, Anbieterwahl | OpenTracks `sensors/GpsManager.java`, `onLocationChanged` |
| Distanzquantisierung, Stillstandswächter | OpenTracks `services/TrackRecordingManager.java` |
| Bewegungszeit | OpenTracks `stats/TrackStatisticsUpdater.java` (mit Test) |
| Alle Schwellen an einer Stelle | OpenTracks `src/main/res/values/settings.xml` |
| Glättung und Verfall alter Fixes | RunnerUp `tracker/Tracker.java` Z. 81, 664–676, 890 |
| Autopause-Zustandsautomat | RunnerUp `workout/AutoPauseTrigger.java` |

**Lizenzen beachten.** OpenTracks steht unter Apache-2.0 — Code übernehmbar.
RunnerUp steht unter **GPL-3.0**: Zahlenwerte zu übernehmen ist
unproblematisch, Codezeilen ziehen Copyleft nach sich.

**Wichtig zur Herkunft:** `github.com/OpenTracksApp/OpenTracks` ist seit dem
24.08.2025 archiviert. Gepflegt wird auf **Codeberg** weiter.

---

## Quellen (Teil 3)

- [Android: Location.getSpeed()](https://developer.android.com/reference/android/location/Location)
- [Strava: Moving Time, Speed and Pace Calculations](https://support.strava.com/en-us/articles/15401804-moving-time-speed-and-pace-calculations)
- [Strava: Training Glossary for Running (30-Minuten-Meile)](https://support.strava.com/en-us/articles/15402097-strava-training-glossary-for-running)
- [Strava Engineering: Improving Auto-Pause for Everyone (2014)](http://labs.strava.com/blog/improving-auto-pause-for-everyone/)
- [Inside GNSS: How does a GNSS receiver estimate velocity? (2015)](https://insidegnss.com/how-does-a-gnss-receiver-estimate-velocity/)
- [ISPRS 2022: Doppler-Geschwindigkeit auf Android-Telefonen](https://isprs-archives.copernicus.org/articles/XLVI-3-W1-2022/89/2022/isprs-archives-XLVI-3-W1-2022-89-2022.pdf)
- [MDPI Sensors 23(5):2678 — Software Correction of Speed Measurement (2023)](https://www.mdpi.com/1424-8220/23/5/2678)
- [OpenTracks auf Codeberg (gepflegt)](https://codeberg.org/OpenTracksApp/OpenTracks)
- [OpenTracks #2043 — Idle durch schlechten Empfang](https://github.com/OpenTracksApp/OpenTracks/issues/2043)
- [OpenTracks #1995 — Werte über 0 bei erkanntem Stopp](https://github.com/OpenTracksApp/OpenTracks/issues/1995)
- [RunnerUp](https://github.com/jonasoreland/runnerup)
- [RunnerUp #257 — GPS-Glättung und die 10-Meter-Frage](https://github.com/jonasoreland/runnerup/issues/257)
