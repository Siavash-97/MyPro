# Sensoren: woher die Daten kommen sollen

Entschieden am 20.08.2026. Anlass war die Frage, ob MyProSole die Sensoren
einer verbundenen Smartwatch auslesen kann — deren GPS, deren
Beschleunigungssensor.

Die kurze Antwort steht in einem Satz: **Eine Smartwatch ist kein Sensor, den
man ansteckt.** Der lange Weg dorthin und was stattdessen gilt, steht hier.

Verwandt: [gps-genauigkeit.md](gps-genauigkeit.md) (wie aus Messungen Tempo
wird), [zurueckgestellt.md](zurueckgestellt.md) (was der Browser nicht kann).

---

## 1. Warum die Frage überhaupt aufkam

Die GPS-Geschwindigkeit allein trägt nicht. Strava hat seine GPS-Autopause
fürs Laufen aufgegeben — sie pausierte beim Laufen und setzte im Stehen fort —
und erkennt Bewegung heute über den **Beschleunigungssensor**. Eine
unabhängige Messstudie kommt zum selben Schluss.

Daraus die naheliegende Überlegung: Wenn ein Bewegungssensor die Lösung ist
und eine Sportuhr ohnehin bessere Antennen, einen Höhenmesser und
Beschleunigungssensoren hat — warum dann nicht deren Sensoren nutzen, sobald
jemand eine Uhr verbindet?

Der Gedanke stimmt. Der Weg nicht.

---

## 2. Was mit einer Uhr geht und was nicht

### Live über Bluetooth: nur die Herzfrequenz

Genormte Bluetooth-Dienste geben Hersteller heraus, alles andere nicht. Für
uns heißt das in der Praxis: **Herzfrequenz (0x180D)** und **Akkustand
(0x180F)**. Das ist gebaut und funktioniert mit jedem Brustgurt und jeder Uhr
im Sendemodus.

Rohe Positionen oder Beschleunigungswerte sind darin nicht vorgesehen.

### Live an die Uhrsensoren: nur mit einer App auf der Uhr

Garmin bestätigt es für das eigene System: Connect-IQ-Apps **auf der Uhr**
haben Zugriff auf Sensoren und dürfen per Bluetooth zum Telefon senden. Ohne
App auf der Uhr gibt es diesen Zugriff nicht — und das gilt sinngemäß für
alle drei Systeme.

| Uhr | Was nötig wäre | Sprache | Vertrieb |
|---|---|---|---|
| Garmin | Connect-IQ-App auf der Uhr | Monkey C | Connect IQ Store |
| Samsung / Google | Wear-OS-App | Kotlin | eigener Play-Store-Eintrag |
| Apple Watch | watchOS-App, nur aus einer iOS-App heraus | Swift | App Store |

**Drei getrennte Apps, drei Sprachen, drei Store-Prüfungen**, jede dauerhaft
zu pflegen. Das ist nicht „schwierig" — das ist ein zweites Unternehmen neben
dem eigentlichen.

### Nach dem Lauf: alles, ohne eine Zeile auf der Uhr

Über **Health Connect** (Android) beziehungsweise **HealthKit** (iPhone)
kommen Strecke, Höhenmeter und Puls der Uhr in die App. Nicht live, aber
vollständig — und ohne App auf der Uhr.

Für den Zweck „genauere Strecke, weil die Uhr besseren Empfang hat" genügt
das: Man läuft mit Uhr, und danach steht der bessere Wert in MyProSole.

---

## 3. Der Beschleunigungssensor des Telefons

Verfügbar und nutzbar. Und beim Umbau auf Hintergrundaufzeichnung fällt er
fast umsonst ab: Damit die Aufzeichnung weiterläuft, wenn die App verlassen
wird, braucht es ohnehin einen Android-Dienst im Vordergrundbetrieb. Der darf
Sensoren lesen — GPS **und** Beschleunigung. Ohne diesen Dienst schläft
beides ein, sobald der Bildschirm ausgeht.

Genau diesen Weg ist Strava gegangen.

---

## 4. Der Punkt, der eigentlich zählt: wir bauen den Sensor selbst

Die Einlage sitzt **am Fuß**. Für Schritterkennung ist das der beste Ort —
besser als ein Handgelenk, besser als eine Hosentasche.

Und es gibt dafür einen Bluetooth-Standard: **Running Speed and Cadence,
0x1814**. Was ein Gerät darüber melden kann:

- Momentangeschwindigkeit
- Schrittfrequenz
- Schrittlänge
- zurückgelegte Strecke
- ein Bit **„geht oder läuft"**

Die letzte Zeile ist die bemerkenswerte: Das ist genau die
Bewegungserkennung, für die Strava den Beschleunigungssensor braucht — nur
kommt sie hier vom Fuß und ist damit sauberer als vom Handgelenk.

**Wenn die Einlage diesen Standard spricht, bekommt MyProSole Pace ohne GPS.**
Und weil es ein offener Standard ist, kann jede andere App sie ebenfalls
lesen. Das gibt der Einlage einen Wert, den ein eigenes, geschlossenes Format
nie hätte.

Das ist zugleich der Grund, warum in [store/bluetooth.ts](../myprosole_web/src/store/bluetooth.ts) kein „verbinde mit
der Einlage" steht: Solange die Firmware nicht existiert, wäre jedes Format
geraten. Das Gerüst — Suchen, Verbinden, Werte abonnieren — steht schon; es
kommt ein Dienst dazu, mehr nicht.

---

## 5. Die Reihenfolge

1. **Handy-Beschleunigung** — fällt beim Hintergrund-Umbau ohnehin ab
2. **Einlage mit 0x1814** — wenn die Firmware entsteht, ist das die
   Festlegung, die alles trägt
3. **Health Connect / HealthKit** — Uhrdaten nach dem Lauf, ohne App auf der
   Uhr
4. **App auf der Uhr** — erst, wenn es MyProSole als Unternehmen gibt

Punkt 4 ist nicht abgelehnt, sondern eingeordnet. Er kostet drei Apps und
bringt, was Punkt 3 zum großen Teil auch bringt.

---

## Quellen

- [Garmin Connect IQ SDK](https://developer.garmin.com/connect-iq/)
- [Garmin-Forum: Beschleunigungsdaten per BLE senden](https://forums.garmin.com/developer/connect-iq/f/app-ideas/312861/is-it-possible-to-broadcast-watch-accelerometer-data-to-an-app-i-make-on-either-my-phone-computer-in-real-time-using-either-ant-ble)
- [Bluetooth SIG: Running Speed and Cadence Service](https://www.bluetooth.com/specifications/specs/running-speed-and-cadence-service-1-0/)
- [Nordic: RSCS-Dokumentation mit Datenformat](https://developer.nordicsemi.com/nRF_Connect_SDK/doc/latest/nrf/libraries/bluetooth_services/services/rscs.html)
- [Strava Engineering: Improving Auto-Pause for Everyone](http://labs.strava.com/blog/improving-auto-pause-for-everyone/)
