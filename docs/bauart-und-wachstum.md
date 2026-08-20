# Bauart und Wachstum — die Entscheidung

Recherchiert am 20.08.2026, ausgelöst durch die Frage: Bleiben wir bei
Capacitor, wechseln wir zu React Native, oder zu nativ?

Grundlage sind zwei Untersuchungen mit Primärquellen — Quellcode,
Entwicklerblogs, Stellenanzeigen, Fehlerberichte, offizielle Dokumentation.
Forenmeinungen sind durchgehend als solche gekennzeichnet und nirgends
tragend.

---

## 1. Der Befund, der alles andere ordnet

**Jede App mit eigener Sensorhardware ist nativ gebaut. Ohne Ausnahme.**

| App | Bauart | Beleg |
|---|---|---|
| Strava | nativ, Kotlin / Swift | eigener Entwicklerblog |
| Garmin Connect | nativ Kotlin, ausdrücklich „background processing, BT/BLE APIs" | Stellenanzeige |
| WHOOP | nativ, eigenes **Connectivity-Team je Plattform** | Stellenanzeige |
| Oura | nativ, Team **„Core Sensing"** | Stellenanzeige |
| Polar | nativ | Stellenanzeige |
| Komoot | nativ Kotlin + Compose | Entwicklerblog |
| Nike Run Club | nativ; schwerste Aufgabe laut Ausschreibung: „background workout reliability, sensor accuracy" | Stellenanzeige |
| adidas Running | nativ, Jetpack Compose | Android-Developers-Blog |
| Zwift | nativ + Kotlin Multiplatform | Stellenanzeige |
| **Runna** | **React Native** — aber **Apple Watch in SwiftUI** | Stellenanzeige |

Die Trennlinie verläuft nicht zwischen „Lauf-App" und „keine Lauf-App",
sondern zwischen **eigener Sensorhardware und keiner**. Runna ist die einzige
React-Native-App in der Liste — und die einzige ohne eigene Hardware.

**Capacitor kommt in dieser Kategorie in keiner einzigen Primärquelle vor.**

MyProSole steht mit der geplanten Einlage klar auf der Hardware-Seite. Das ist
das stärkste einzelne Argument gegen unsere heutige Bauart.

---

## 2. Die Fünf-Minuten-Wand ist keine Capacitor-Schwäche

Das ist der wichtigste technische Fund, und er entlastet unsere bisherige
Arbeit.

Die Ursache steht im Chromium-Projekt selbst:

> „All freezable task queues in blink scheduler **will be frozen** when a
> renderer has been in the background after **grace time of 5 minutes**, on
> Android."

Das ist eine Entscheidung der Browser-Maschine, nicht des Frameworks. Deshalb
wurde der Capacitor-Fehlerbericht dazu am 24.02.2026 als **„wird nicht
behoben"** geschlossen.

**Niemand kann das in einer WebView beheben.** Unser Vordergrunddienst war
kein Notbehelf um eine Framework-Schwäche herum — er war die einzig mögliche
Lösung. Bei React Native und Flutter tritt das Problem nicht auf, weil es dort
keine WebView gibt.

### Dieselbe Wand trifft als Nächstes die Einlage

Im Fehlerbericht des Bluetooth-Plugins steht es wörtlich: Für Anwendungen,
die „im Hintergrund verbunden bleiben müssen, um Sensordaten zu erfassen", sei
das **derzeit nicht möglich**. Das Symptom kennen wir bereits vom GPS: Kommt
die App zurück, werden alle gestauten Meldungen auf einmal ausgespuckt.

**Konkret:** Steckt jemand das Telefon während des Laufs in die Tasche, hört
die Einlagen-Aufzeichnung nach fünf Minuten auf — genau wie GPS es tat. Die
Lösung ist dieselbe: Empfang und Pufferung in den nativen Dienst, die WebView
bekommt nur aufbereitete Werte.

**Diese Arbeit fällt unabhängig von der Bauart-Entscheidung an.**

---

## 3. Was die Brücke wirklich kostet

Im Quelltext des Bluetooth-Plugins steht ein Kommentar, der alles erklärt:

> `// on native we can only write strings`

**Über die Capacitor-Brücke gehen keine Binärdaten.** Der Weg eines
Sensorpakets:

```
BLE-Bytes → Hex-String (44 Bytes werden 88 Zeichen)
          → JSObject → JSON-String → postMessage
          → JSON.parse → Hex zurück in Bytes
```

Zweimal umkodiert, einmal durch JSON.

**Gemessen** von einem Nutzer mit genau unserem Anwendungsfall: 0,5 MB durch
eine Notification-Kennzeichnung kosteten **22 Sekunden** in der
Umwandlungsfunktion. Nach der Verbesserung: 1,8 Sekunden. Diese Verbesserung
läuft in unserer Fassung 8.3.0 bereits.

**Der offene Fehler, der bleibt:** Bei schneller Folge von Meldungen kommt
N-mal derselbe letzte Wert an, die vorherigen sind weg. Der Betreuer hat ihn
als „wird nicht behoben" markiert — es sei ein Android-Problem, kein
Plugin-Problem. **Das ist Datenverlust, nicht Verzögerung.**

### Die Zahl, auf die es ankommt, ist nicht Hertz

Bei 22 Kanälen, 2 Bytes, 100 Hz, zwei Füßen sind es 8,8 kB/s. Für die
Funkstrecke ist das harmlos. **Teuer ist nicht die Datenmenge, sondern die
Zahl der Brückenübergänge.**

Die Antwort darauf ist bauartunabhängig und steht in der Fachliteratur zu
BLE-Sensorströmen: **Die Firmware bündelt.** 5 bis 10 Abtastungen je Meldung,
Ziel 20 bis 40 Rahmen je Sekunde statt 200 Einzelwerte. Das Anti-Muster heißt
dort wörtlich „one sample per notification at high Hz".

**Wenn die Firmware bündelt und die Schrittanalyse nativ läuft, ist die
Brücke nicht der Engpass.** Das ist die faire Version. Die unfaire wäre zu
behaupten, 200 Hz mache die WebView platt — das stimmt nur bei naivem Bau.

---

## 4. Unser Bestand in Zahlen

`myprosole_web/src`, 102 Dateien:

| Art | Zeilen | Bei einem Wechsel |
|---|---:|---|
| `.ts` — Speicher, Datenzugriff, Fachlogik | 6.366 | **fast vollständig übernehmbar** |
| `.tsx` — Komponenten | 12.452 | Logik bleibt, Markup nicht |
| `.css` | 3.252 | **vollständig verloren** |
| | **22.070** | |

Nativer Java-Code, 1.206 Zeilen:

| Datei | Zeilen | Capacitor-Bezug |
|---|---:|---|
| `AufzeichnungsDienst.java` | 662 | **0** |
| `PunkteSpeicher.java` | 239 | **0** |
| `AufzeichnungPlugin.java` | 249 | die Klebeschicht |
| `MainActivity.java` | 56 | Gerüst |

**Das ist die wichtigste Einzelzahl: 901 von 1.206 nativen Zeilen — 75 % —
haben null Capacitor-Bezug.** Der Dienst und der Puffer laufen unverändert
unter React Native und unverändert in einer nativen Kotlin-App. Nur die 249
Zeilen Klebeschicht wären neu zu schreiben. Ein Tag Arbeit, keine Woche.

**Unsere native Arbeit ist bei einem Wechsel nicht verloren.**

### Was definitiv verloren wäre

3.252 Zeilen CSS. React Native kennt keine Kaskade, keine Media Queries im
CSS-Sinn, kein `grid`, kein `position: sticky`. Die defensive Größenlogik, an
der wir gearbeitet haben, wäre neu zu bauen. Dazu die Navigation
(`react-router-dom` → `react-navigation`, anderes Modell), die Karte
(`maplibre-gl` ist WebGL im Browser) und jede DOM-Annahme.

### Dauer

Der einzige harte Anker: **200 Stunden** für eine App mittlerer Komplexität,
ein Entwickler — aus einem Erfahrungsbericht eines Ionic-nach-React-Native-
Wechsels. Unsere App ist größer, hat Bluetooth, Karten, einen eigenen Dienst.

Hochgerechnet **300 bis 600 Stunden**, bei 30 Wochenstunden **zweieinhalb bis
fünf Monate ohne neue Funktionen**. Das ist eine Hochrechnung von einem
einzigen Datenpunkt, keine Messung.

---

## 5. Sicherheit

### Was gut ist, und das überrascht

Unsere `capacitor.config.ts` enthält nur `appId`, `appName`, `webDir`. Kein
`server.url`, kein `allowNavigation`, kein `useLegacyBridge`. Damit ist die
Liste erlaubter Ursprünge genau ein Eintrag.

**Das ist die strengstmögliche Einstellung und genau das, was OWASP
empfiehlt.** Deren Leitfaden nennt den modernen, ursprungsbeschränkten
Nachrichtenweg ausdrücklich „Recommended: Yes, Security: Highest". Unsere
frühere Entscheidung gegen `server.url` — getroffen wegen Offline-GPS — war
nebenbei auch die sichere.

**Die Brücke ist bei uns nicht das schwache Glied.** Ein Wechsel würde daran
nichts verbessern.

### Was strukturell bleibt

OWASP sagt es differenziert: Brücken seien „not inherently unsafe", das
Risiko liege in der **Verbindung aus Brücke und ungeprüftem Inhalt**.

Der Unterschied zu React Native, sachlich: Dort gibt es **kein DOM**, also
auch keine klassische XSS-Kette. Bei uns gibt es sie, und ein erfolgreicher
Angriff eskaliert von „Datendiebstahl im Browser" zu „nativer Zugriff mit den
Rechten der App" — also GPS-Verlauf plus Gesundheitsdaten.

**Ehrlich dazu:** Es wurde **kein dokumentierter Vorfall** gefunden, bei dem
eine Capacitor-Gesundheits-App auf diesem Weg kompromittiert wurde. Das
Risiko ist konzeptionell belegt, empirisch nicht.

### Wo Capacitor wirklich schlechter dasteht

**Zertifikat-Pinning.** Ionics Lösung ist ein kostenpflichtiges
Enterprise-Paket, das zum **31.12.2027 eingestellt** wird — und es deckt nur
Aufrufe über `CapacitorHttp` ab, nicht `fetch`. Unser `supabase-js` benutzt
`fetch`. **Unser Hauptdatenkanal wäre damit gar nicht abgedeckt.**

In React Native ist das gelöste Standardarbeit, weil der HTTP-Verkehr ohnehin
durch nativen Code läuft.

### Code-Schutz — kleiner Unterschied, als beide Lager behaupten

Unser Bundle liegt als lesbares JavaScript im APK. React Native mit Hermes
liegt als Bytecode vor — aber es gibt ein Werkzeug, das ihn zerlegt **und
wieder zusammensetzt**. Nativ ist am besten geschützt, aber auch dekompilierbar.

Nach OWASP ist Verschleierung ohnehin nur für Apps mit Manipulationsrisiko
gefordert, nicht im Grundschutz. Wichtiger ist, dass **keine Geheimnisse im
Bundle liegen** — und das gilt für alle drei Bauarten gleich.

---

## 6. Skalierung: der Engpass ist unser Schema, nicht der Anbieter

Ausgezählt in unseren eigenen Migrationen:

```
auth.uid() unverpackt          140
(select auth.uid())              0
```

Und die Regel, die bei jedem GPS-Punkt läuft:

```sql
exists (select 1 from public.runs r where r.id = run_id and r.user_id = auth.uid())
```

Je Zeile eine Unterabfrage auf `runs` — die selbst Zeilenrechte hat, die
mitlaufen. Supabases eigene Messungen:

| Änderung | vorher | nachher |
|---|---|---|
| `auth.uid()` → `(select auth.uid())` | 179 ms | 9 ms |
| Funktion mit Join verpackt | 11.000 ms | 7 ms |
| Index auf die Policy-Spalte | 171 ms | <0,1 ms |

Bei 10.000 Läufern sind das 10.000 Zeilen je Sekunde.

**Der einzige Wert, der genau bei 10.000 steht, ist die
Realtime-Verbindungsgrenze** — auf jedem Tarif außer Enterprise. Und
`Postgres Changes` prüft jedes Ereignis gegen jeden Abonnenten und läuft
einsträngig; ein größerer Server bringt dort laut Supabase **nichts**. Für
Feed und Gruppen gehört das auf `Broadcast` umgestellt.

**Speicher**, gerechnet auf unser Schema bei 10.000 Läufern, vier Läufen die
Woche:

| | je Punkt | im Jahr |
|---|---|---|
| heute | 208 Bytes | **1,4 TiB** |
| schlank | 120 Bytes | 0,8 TiB |
| gebündelt | 16 Bytes | **0,11 TiB** |

Fast die Hälfte sind Indizes, der größte Teil davon der UUID-Schlüssel — der
fachlich nichts leistet und zusätzlich ein Schreibverstärker ist, weil
zufällige Schlüssel den Index ständig aufspalten.

**Eine naheliegende Antwort fällt weg:** Supabase hat TimescaleDB
abgekündigt. Der Ersatz ist Partitionierung, aber ohne Kompression.

### Reihenfolge, von billig nach teuer

1. `TO authenticated` auf den zwölf Regeln nachtragen, die es nicht haben
2. Die 140 `auth.uid()` verpacken, wo kein Zeilenbezug besteht
3. `run_points` umbauen: `user_id` mitführen, Regel auf einen Indexvergleich
   reduzieren — **das widerspricht unserer 3NF-Regel und braucht eine
   ausdrückliche, dokumentierte Ausnahme**
4. UUID-Schlüssel streichen, Schlüssel auf `(run_id, recorded_at)`
5. Partitionieren — erfüllt zugleich unsere eigene, bisher unerfüllte Auflage
   zur Aufbewahrungsstrategie
6. Realtime auf `Broadcast`
7. Erst danach: größerer Server

---

## 7. Biomechanik: alle rechnen auf dem Sensor

| Produkt | Rate | Wo gerechnet wird |
|---|---|---|
| Stryd | — | auf dem Pod, nur fertige Metriken raus |
| Plantiga | 416 Hz | auf dem Gerät, Übertragung per **physischem Dock** |
| RunScribe | 500 Hz intern | auf dem Pod; Livestream nur 1–100 Hz |
| Moticon | 200 Hz | Rohdaten zum **Desktop**, nicht zum Telefon |

**Kein einziges untersuchtes Produkt wertet hochfrequente Rohdaten auf dem
Telefon in Echtzeit aus.** Je höher die Rate, desto sicherer bleiben die
Rohdaten auf dem Gerät — das löst gleichzeitig Durchsatz, Akku und
Datenschutz.

**Und einfache Schwellen schlagen maschinelles Lernen.** Gegen ein
instrumentiertes Laufband gemessen: **1,0 ms** mittlerer Fehler beim
Fußaufsatz, mit einem Schwellenverfahren, unabhängig von der Steigung.
Maschinelles Lernen war bei Gangereignissen gleichauf und **unterschätzte bei
neuen Probanden** — also im Normalfall einer App.

**Für Pronation wurde keine einzige Validierungsstudie gefunden**, nur
Marketing.

---

## 8. Die Grenze zum Medizinprodukt

Die maßgebliche EU-Leitlinie wurde im **Juni 2025 neu gefasst**. Darin steht,
dass ein Gerät, das durch Analyse physiologischer Parameter das **Risiko von
Krankheiten** angeht — genanntes Beispiel: Lage der Rückenwirbel — in
**Klasse IIa** fällt. Das ist strukturell dasselbe wie Pronationsstellung.

Klasse IIa heißt Benannte Stelle, ISO 13485, klinische Bewertung. Ein
Jahresprojekt mit sechsstelligem Budget.

**Die Grenze verläuft im Wortlaut, nicht in der Rechengenauigkeit:**

| | |
|---|---|
| „Bodenkontaktzeit 245 ms, links 8 % länger" | Messung → kein Medizinprodukt |
| „Dein Fersenanteil sank von 60 auf 45 %" | Beschreibung → kein Medizinprodukt |
| „Diese Asymmetrie **erhöht dein Verletzungsrisiko**" | → **Klasse IIa** |
| „Deine **Überpronation** solltest du korrigieren" | → **Klasse IIa** |

Auch ein Screenshot im Play Store zählt. Der Ort der Ausführung ist
ausdrücklich egal — auf den Server auszulagern ändert regulatorisch nichts.

**Daraus die Regel, die nichts kostet und alles entscheidet:**

> **MyProSole misst und beschreibt. MyProSole bewertet nicht.**

Sie gehört in die Entwicklungsstandards, nicht in ein Marketing-Papier —
sonst beschriftet irgendwann jemand einen Knopf mit „Verletzungsrisiko".

---

## 9. Die zehn Kennzahlen — woran wir merken, dass es Zeit ist

Zu erheben, sobald der erste Einlagen-Prototyp Daten liefert. **Reißen zwei
oder mehr über zwei Wochen, ist es Zeit.**

| # | Kennzahl | Schwelle |
|---|---|---|
| 1 | Brückenübergänge je Sekunde | > 50 → Firmware muss bündeln. > 100 trotz Bündelung → Bauart am Ende |
| 2 | **Paketverlustquote** | **> 0,5 %** → Nutzsignal unzuverlässig |
| 3 | Lange Aufgaben im Hauptstrang | > 1 Aufgabe über 50 ms je Minute → sichtbares Ruckeln |
| 4 | Latenz Sensor → Anzeige, P95 | > 300 ms |
| 5 | Akkuverbrauch je Aufzeichnungsstunde | > 8 % |
| 6 | Speicherwachstum der WebView | > 30 % ohne Plateau in 60 min |
| 7 | Anzahl eigener Capacitor-Plugins | ≥ 4 → wir pflegen nebenbei ein Framework. Heute: 1 |
| 8 | Anteil der Aufzeichnungslogik in nativem Code | > 60 % → die WebView ist nur noch Anzeige |
| 9 | **Uhr auf der Roadmap** | **sobald verbindlich → Capacitor ist raus** |
| 10 | Betreuerlage des BLE-Plugins | 6 Monate ohne Commit → unser BLE-Stack ist verwaist |

**Kennzahl 9 reicht allein.** Capacitor unterstützt Wear OS nicht — dort gibt
es keine WebView, die das könnte.

---

## 10. Empfehlung

**Vorerst bei Capacitor bleiben. Aber ab sofort so bauen, als würden wir
wechseln.**

In dieser Reihenfolge:

1. **Bluetooth-Empfang in den bestehenden Vordergrunddienst verlagern** —
   *bevor* der Einlagen-Prototyp fertig ist, nicht danach. Rohdaten in den
   nativen Puffer, die WebView bekommt nur aufbereitete Werte. Das löst die
   Fünf-Minuten-Wand und die Brückenkosten in einem Zug, und wir haben die
   Technik gerade erfolgreich angewandt.
2. **Firmware bündelt.** 5–10 Abtastungen je Meldung. Laufende
   Folgenummer in jede Nutzlast, damit Kennzahl 2 überhaupt messbar ist. Das
   ist eine Firmware-Entscheidung, die später teuer zu ändern ist.
3. **Fachlogik strikt von Darstellung trennen.** Was in `.ts` steht statt in
   `.tsx`, ist bei einem Wechsel geschenkt. Heute 6.366 zu 12.452 Zeilen —
   dieses Verhältnis bewusst verschieben.
4. **Die zehn Kennzahlen erheben**, sobald echte Sensordaten fließen. Messen,
   nicht schätzen.
5. **Zwei harte Auslöser festhalten:** Uhr wird verbindlich, oder Kennzahl 2
   reißt ohne Aussicht auf Behebung.

**Falls gewechselt wird, dann zu React Native, nicht zu nativ.** Für eine
Person mit React-Vorkenntnissen und iPhone auf der Roadmap ist zweimal nativ
zu bauen nicht tragbar — WHOOP, Oura und Garmin haben dafür getrennte Teams
je Plattform. Und unser wertvollster nativer Code läuft dort unverändert
weiter.

### Die Gegenposition, ernst genommen

Ein Fachmann könnte begründet widersprechen:

> *„Ihr baut eine Hardware-Sensor-App. Jede vergleichbare Firma am Markt ist
> nativ. Die WebView wird euch bei jeder kommenden Anforderung — Uhr, Health
> Connect, Echtzeitrückmeldung, Dauerbetrieb — erneut zwingen, nativ
> auszuweichen. Beim GPS habt ihr es getan, beim Bluetooth werdet ihr es tun.
> Nach dem dritten Mal habt ihr eine native App mit einer WebView obendrauf
> und die Kosten beider Welten bezahlt. Der Wechsel wird nie billiger als
> heute — der Bestand wächst nur."*

Das ist stark, und die Belege stützen es.

**Was trotzdem den Ausschlag gibt:** MyProSole hat **noch keine zahlenden
Nutzer**. Solange das so ist, ist die teuerste Fehlentscheidung nicht die
falsche Bauart, sondern fünf Monate ohne Produktfortschritt. Ein Wechsel
gewinnt keinen einzigen Nutzer. Sobald es zahlende Nutzer gibt und Kennzahl 2
oder 9 reißt, dreht sich diese Abwägung um.

---

## 11. Was sich nur in der Praxis klärt

**Die eine offene Frage: Wie viele Brückenübergänge je Sekunde erzeugt die
tatsächliche Einlage bei tatsächlichen Läufen auf einem Mittelklassegerät —
und wie hoch ist dabei der Paketverlust?**

Das kann niemand vorhersagen. Es hängt an der Bündelung, an der
ausgehandelten Paketgröße, am Verbindungsintervall und am Bluetooth-Teil des
jeweiligen Herstellers. Der bekannte Datenverlust-Fehler trat auf einem
Huawei-Gerät auf — und **nur** dort.

**Woran wir merken, dass sie geklärt ist:** Ein 30-Minuten-Lauf mit dem
Prototypen, auf einem drei Jahre alten Mittelklassegerät, Bildschirm
gesperrt, Telefon in der Tasche. Danach die Folgenummern auslesen. Liegt die
Lücke unter 0,5 % und die Brücke unter 50 Übergängen je Sekunde, ist die
Frage für zwei Jahre beantwortet und wir bauen Funktionen statt Frameworks.

**Dieser Lauf muss stattfinden, bevor die Firmware eingefroren wird.** Danach
ist die Bündelungsstrategie teuer zu ändern.
