# GPS: was wir tun und was die anderen tun

**Erstellt:** 21.08.2026

Die Frage war: **Welcher Anbieter liefert genauere Daten, was benutzt Strava,
und wie stehen wir daneben?**

Dieses Dokument beantwortet sie **nicht aus Blogartikeln**, sondern aus dem,
was auf dem Testgerät (Samsung Galaxy A56, Android 16) tatsächlich installiert
ist und dort deklariert steht.

---

## 1. Direkt am Gerät abgefragt

Auf dem Telefon liegen Strava, Komoot und Garmin Connect. Jede Android-App
muss deklarieren, welche Sensoren sie benutzen will — das ist Pflicht und
nachprüfbar.

```bash
adb shell dumpsys package com.strava | grep -i "location\|activity_recognition"
```

| Berechtigung | **MyProSole** | Strava | Komoot | Garmin |
|---|:---:|:---:|:---:|:---:|
| `ACCESS_FINE_LOCATION` | ✓ | ✓ | ✓ | ✓ |
| `FOREGROUND_SERVICE_LOCATION` | ✓ | ✓ | ✓ | — |
| `ACCESS_BACKGROUND_LOCATION` | **—** | **—** | ✓ | ✓ |
| `ACTIVITY_RECOGNITION` | **—** | **✓** | — | — |
| `FOREGROUND_SERVICE_CONNECTED_DEVICE` | — | — | — | ✓ |

**Der wichtigste Befund steht in Zeile drei:**

> **Strava verlangt keine Hintergrund-Ortung. Wir auch nicht.**

Das ist keine Sparsamkeit, sondern dieselbe Bauart: ein **Vordergrunddienst**
mit sichtbarer Benachrichtigung. Er darf orten, solange er läuft — und er läuft,
solange der Lauf läuft. Genau das haben wir gebaut. Wir sind hier nicht
hinterher, wir sind gleichauf.

Komoot und Garmin brauchen die Hintergrund-Ortung, weil sie etwas anderes tun:
Navigation, die auch ohne laufende Aufzeichnung ansagen muss, und eine
Uhr-Verbindung, die dauerhaft besteht.

**Der einzige echte Unterschied ist Zeile vier.** Dazu unten mehr.

---

## 2. Wie Strava rechnet — nach eigener Auskunft

Aus Stravas Hilfeseiten und ihrem Technik-Blog:

| | Strava | MyProSole |
|---|---|---|
| Strecke | **fast vollständig aus GPS-Koordinaten** | aus GPS-Koordinaten |
| Pace beim Hochladen | neu geglättet, **Fenster 10 bis 30 Sekunden** | — |
| Pace während des Laufs | geglättet | **Median über 5 Sekunden** |
| Bewegungserkennung | Schwelle 0,894 m/s („30-Minuten-Meile") | 0,9 m/s **plus gelernter Ruhepegel** |
| Beschleunigungssensor | **ja**, zur Erkennung von Laufbewegung (Auto-Pause) | nein |

**Bemerkenswert:** Unser Anzeigefenster ist mit fünf Sekunden **kürzer** als
Stravas zehn bis dreißig. Wir hängen also nicht hinterher — der Fehler vom
20.08. war, dass an dieser Stelle der **Schnitt des ganzen Laufs** stand statt
des Tempos im Moment. Die Größe war falsch, nicht die Glättung.

**Wo wir eine Idee weiter sind:** Stravas Bewegungsschwelle ist eine feste
Zahl für alle Geräte. Unser [Ruhepegel](../myprosole_web/src/lib/bewegung.ts)
lernt, wie viel Scheinbewegung **dieses eine Telefon** im Stillstand erzeugt,
und hebt die Schwelle entsprechend. Ein Gerät mit unruhigem Empfänger bekommt
eine höhere Schwelle als ein ruhiges.

---

## 3. Die Anbieter-Frage

„Anbieter" kann zweierlei heißen. Beides ist geklärt.

### 3.1 Wer den Ort liefert — auf dem Telefon

| | Was es ist | Genauigkeit | Preis |
|---|---|---|---|
| **`GPS_PROVIDER`** *(wir)* | roher Satellitenempfang über das Betriebssystem | die gemessene Wahrheit, aber kein Rückfall | frei |
| **Fused Location Provider** | Google mischt GPS, WLAN, Mobilfunk und Trägheitssensoren | robuster in Häuserschluchten, leitet Tempo teils **ab** statt es zu messen | frei, aber **Google Play Services nötig** |
| **Bezahlte SDKs** (z. B. transistorsoft) | fertiger Hintergrunddienst mit Fusion | vergleichbar mit Fused | **399 $** einmalig |

**Unsere Wahl ist begründet und dokumentiert** ([AufzeichnungsDienst.java:47](../myprosole_web/android/app/src/main/java/com/myprosole/app/aufzeichnung/AufzeichnungsDienst.java#L47)):
Die Bewegungserkennung hängt am **gemessenen Doppler-Tempo** — dem Wert, den
der Empfänger aus der Frequenzverschiebung der Satellitensignale gewinnt. Der
rohe Anbieter liefert ihn unvermischt. Nebeneffekt: keine Abhängigkeit von
Google-Diensten.

**Der offen benannte Preis:** kein Rückfall auf andere Quellen. Kein
GPS-Empfang, keine Messung.

### 3.2 Welche Satelliten das Gerät hört

Aus `dumpsys location` auf dem A56:

| Konstellation | Frequenz | Band |
|---|---|---|
| GPS | 1575,42 MHz | L1 |
| GLONASS | 1602 MHz | G1 |
| Galileo | 1575,42 MHz | E1 |
| BeiDou | 1561,098 MHz | B1I |
| QZSS | 1575,42 MHz | L1 |

```
Total number of L5 sv status messages processed: 0
```

> **Der A56 empfängt kein L5.** Fünf Konstellationen, alle im L1-Band.

Das ist die härteste Grenze im ganzen Vergleich — und sie liegt **nicht** bei
der Software. L5/E5a ist deutlich unempfindlicher gegen Reflexionen an
Häuserwänden, der Hauptfehlerquelle in der Stadt. Kein Anbieterwechsel und
keine Glättung holt zurück, was die Antenne nicht hört.

**Folge für Tests:** Ein Lauf auf diesem Telefon zeigt **nicht**, was
MyProSole auf einem Zweifrequenz-Gerät kann. Wenn wir Genauigkeit beurteilen,
gehört das Gerät dazugesagt.

---

## 4. Wo wir tatsächlich hinterherhinken

Ehrlich, in der Reihenfolge des Gewichts.

**1. Kein `ACTIVITY_RECOGNITION`.** Strava hat es, wir nicht. Damit erkennt
Strava aus dem Beschleunigungssensor, ob jemand *läuft*, und braucht dafür kein
GPS. Nutzen: schnellere und zuverlässigere Auto-Pause, besonders dort, wo GPS
schwach ist. Bei uns fällt genau dort die Erkennung aus.
→ Gehört in die [Rangfolge der Messquellen](messquellen.md).

**2. Kein Rückfall bei GPS-Ausfall.** Bewusst so entschieden, aber es bleibt
ein Nachteil. Tunnel, Tiefgarage, dichte Bebauung: Strava und Komoot haben
etwas, wir haben nichts.

**3. Höhenmeter aus der GPS-Höhe.** Die ungenaueste Größe, die GPS liefert.
Auf dem A56 gibt es keinen Luftdrucksensor, also bleibt es dabei — aber
künftig **mit Hinweis**, nicht stillschweigend.

**Und wo wir vorn liegen:** der gelernte Ruhepegel, die zweistufige Übergabe
(kein Datenverlust bei Absturz), und ein Anzeigefenster von fünf statt zehn
bis dreißig Sekunden.

---

## 5. Was daraus folgt

| | Maßnahme | Warum |
|---|---|---|
| **1** | **Erst messen.** `tempoGueteMps` auswerten, sobald ein echter Lauf vorliegt | Wir speichern die vom Gerät gemeldete Güte seit Tagen und haben sie nie angesehen. Ohne sie ist jede Anbieter-Debatte Meinung. |
| **2** | `ACTIVITY_RECOGNITION` als Quelle für Bewegungserkennung prüfen | Der einzige Punkt, an dem Strava technisch etwas hat, das wir nicht haben |
| 3 | Anbieterwechsel | **Nur mit Zahlen aus 1.** Die Entscheidung ist begründet getroffen; sie umzudrehen braucht Messwerte |
| — | Bezahltes SDK | Nicht nötig. Wir haben den Dienst selbst, und er kann mehr als das kostenlose Plugin |
