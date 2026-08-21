# PRD — Phase „Erste Einlage sendet"

**Stand:** 20.08.2026 · **Zeitraum:** bis ca. 20.11.2026 · **Fassung:** 1.0

Dieses Dokument ist das Ergebnis eines Gesprächs, nicht einer Annahme. Jede
Festlegung darin hat einen Satz, der sagt, **warum** — und jede offene Frage hat
einen Stichtag, an dem sie beantwortet sein muss.

Sprache und Begriffe: [ubiquitous-language.md](ubiquitous-language.md).
Bauart und Umzugsfrage: [bauart-und-wachstum.md](bauart-und-wachstum.md).

---

## 1. Das Ziel — und warum es zwei sind

Der erste Entwurf dieses Dokuments hatte ein Ziel. Das war falsch. Es sind zwei,
und ihre Reihenfolge ist die wichtigste Festlegung im ganzen Plan.

> **Phase 1 — Die App trägt ohne Einlagen.**
> Sie ist das Freemium-Produkt: Aufzeichnung, Training, Community, Übungen.
> Sie wird vollständig getestet, bevor Hardware ins Spiel kommt.
>
> **Phase 2 — Die erste Einlage sendet.**
> Sie verbindet sich, ihre Daten fließen, ein Reiter für die biomechanische
> Auswertung geht auf, die Übungen werden persönlich.

**Warum die Trennung wichtig ist:** Käme die Einlage in eine ungetestete App,
wären bei jedem Fehler zwei Verdächtige da — und man wüsste nie, welcher es war.
Phase 1 räumt den einen Verdächtigen weg, bevor der zweite ankommt.

### 1.1 Phase 1 ist erreicht, wenn

1. Ein Lauf draußen mit ausgeschaltetem Bildschirm ist vollständig gespeichert.
2. **Kein Lauf geht verloren.** Nicht einer.
3. Keine englische und keine technische Meldung steht mehr in der Oberfläche.
4. Der Wohnort ist aus einem geteilten Lauf nicht ablesbar.
5. Erst intern, dann Freunde, dann eine Testgruppe Läufer — ein Monat,
   wöchentliches Feedback.

### 1.2 Phase 2 ist erreicht, wenn

1. **Beide** Einlagen verbinden sich und bleiben eine Laufstunde verbunden —
   mit ausgeschaltetem Bildschirm.
2. Ihre Daten überleben Bildschirm aus, App-Wechsel und Weg-Wischen.
3. Der Zeitversatz zwischen links und rechts ist gemessen und liegt unter 10 ms.
4. Nach dem Lauf steht mindestens **ein** Merkmal auf dem Bildschirm, das aus
   der Einlage kommt und nicht aus dem Telefon.
5. Danach wieder: intern, dann Freunde.

**Wann Phase 2 beginnt, entscheidet die Hardware, nicht der Kalender.** Ist die
Einlage vor Phase 1 fertig, wartet sie. Das ist kein Zeitverlust — es ist der
Unterschied zwischen einem Fehler, den man findet, und einem, den man sucht.

### 1.3 Ausdrücklich **keine** Ziele dieser Phase

Das Wichtigste an einem Plan ist, was nicht drinsteht.

| Kein Ziel | Warum nicht |
|---|---|
| Umzug auf React Native | Legt 6–10 Wochen lahm, genau wenn die Hardware kommt. Begründung in Abschnitt 7. |
| iPhone-Fassung | Kommt, wenn Android trägt. Vorher verdoppelt es jeden Fehler. |
| Medizinprodukt-Zulassung | Bewusst später. Bis dahin: beschreiben, nicht bewerten. |
| Diagnostische Aussagen | Siehe [ubiquitous-language.md](ubiquitous-language.md) Abschnitt 7 — die verbotenen Wörter. |
| Endgültige Backend-Architektur | Entscheidung fällt mit den Messwerten des Prototyps, nicht davor. |
| Öffentlicher Store-Auftritt | Erst Testgruppe, dann Markt. |

---

## 2. Wer daran arbeitet

| Rolle | Wer | Verantwortet |
|---|---|---|
| Gestaltung und App | Siavash | Oberfläche, App-Quelltext, diese Dokumente |
| Struktur und Geschäft | Coach | Geschäftslogik, Kundensegmente, Zielgruppen |
| Hardware | Hardware-Entwickler | Einlage, Sensorik, Firmware |

**Der wichtigste Satz dieses Abschnitts:** Das Ziel dieser Phase hängt an einer
Person, die nicht am App-Quelltext arbeitet. Wenn die Schnittstelle zwischen App
und Firmware nicht **früh und schriftlich** feststeht, scheitert die Phase nicht
an Programmierfehlern, sondern an einem Missverständnis. Deshalb ist Abschnitt 5
das Herzstück dieses Dokuments und nicht ein Anhang.

Arbeitszeit: 30–45 Stunden je Woche für das gesamte Startup — nicht für den
Quelltext allein. Jeder Plan hier rechnet mit **etwa der Hälfte davon** für die
App.

---

## 3. Was heute steht

| Baustein | Zustand |
|---|---|
| Aufzeichnung im Hintergrund | **Fertig.** Nativer Dienst, Bildschirm aus, App weggewischt — läuft. |
| Zweistufige Übergabe der Punkte | **Fertig.** Dienst sammelt, App holt, bestätigt, Dienst löscht. |
| Bewegungserkennung, Ruhepegel | **Fertig**, 26 Tests. Der Stillstands-Fehler ist behoben. |
| Gesamtzeit / Bewegungszeit getrennt | **Fertig**, Migration eingespielt. |
| Bluetooth (Pulsgurt) | **Läuft, aber in der WebView.** Stirbt nach 5 Minuten im Hintergrund. |
| Biomechanische Auswertung | **Existiert bereits** — siehe 3.1. |
| Lauf draußen mit echten Daten | **Noch nie passiert.** Der Dienst hat null echte Punkte geschrieben. |

Die letzte Zeile ist der Grund, warum Arbeitspaket A ganz oben steht.

### 3.1 Was in `myprosole_app` schon liegt

Beim Prüflauf zu diesem Dokument ist aufgefallen, dass die Auswertung **nicht
bei null anfängt**. In `myprosole_app/core/domain/` stehen rund 1.100 Zeilen
Biomechanik, die auf echten Messdaten laufen:

| Modul | Zeilen | Was es tut |
|---|---|---|
| `pressure_analysis.py` | 362 | Druckverteilung, Ferse-Vorfuß-Balance, Links/Rechts |
| `recommendations.py` | 356 | Übungsvorschläge aus dem Muster |
| `fsr.py` | 215 | Glättung, Ereigniserkennung, Schrittkennzahlen |
| `sensor_mapping.py` | 123 | Sensoren auf Fußzonen abbilden |
| `imu/schema.py` | — | 6 Achsen `ax ay az gx gy gz`, mehrere Sensorknoten |
| `calibration.py` | 25 | Kalibrierung |

Dazu **echte Aufzeichnungen**, darunter eine von dir selbst
(`FSR_LOG_50s_Sia.CSV`).

**Das beantwortet drei Fragen dieses Dokuments vorzeitig:**

1. **Wie die Hardware aussehen soll:** Die Pipeline erwartet **drei Sensoren je
   Fuß** — `heel`, `lateral_forefoot`, `medial_forefoot`. Die vorhandene
   Aufzeichnung `FSR_LOG` hat davon nur zwei, und nur rechts; sie ist eine
   Teilmessung, kein Endzustand. Die Abtastung liegt bei **3 bis 4 ms**, also
   rund **285 Hz**.
2. **Was ein Merkmal ist:** nicht zu erfinden. Die Liste ergibt sich aus
   `compute_step_metrics`, `detect_events` und `evaluate_heel_forefoot_balance`.
3. **Wo die Auswertung natürlicherweise hingehört:** Sie ist in **Python**
   geschrieben. Python läuft weder in einer Einlage noch sinnvoll auf einem
   Telefon. Das ist ein starkes Argument für den getrennten Analyseweg aus
   Abschnitt 6 — und zwar eines, das schon existiert, statt entschieden werden
   zu müssen.

**Aufgabe daraus:** Diese Module dürfen nicht ein zweites Mal in TypeScript
entstehen. Wo die App etwas anzeigt, das hier berechenbar ist, ist Python die
Quelle und die App die Anzeige.

---

## 4. Die Entscheidungen, die gefallen sind

| Frage | Entscheidung | Begründung |
|---|---|---|
| Wann umziehen? | **Nicht in dieser Phase.** Neu bewerten, sobald der Prototyp misst. | Ein Umzug jetzt trifft die Hardware mitten im Umbau. |
| Umzugsziel, wenn es soweit ist | **React Native**, nicht zweimal nativ. | „Beide Plattformen von Anfang an" macht doppelten Quelltext unbezahlbar. |
| iPhone | Nach Android, aber vor Markteintritt. | Beide Läden sollen zum Start bedient werden. |
| Zulassung | Erst beschreiben. Nachvollziehbarkeit ab dem **ersten zahlenden Kunden**, nicht ab heute. | Daten aus der Testphase wären als Nachweis ohnehin wertlos. |
| Prototyp | **Als Paar**, nicht einzeln. | Seitenvergleich ist der Produktkern. Zeitsynchronisierung damit ab erster Firmware Pflicht. |
| Streamlit | Bleibt **Laborwerkzeug**. Der Analysedienst wird getrennt gebaut — aber aus denselben Python-Modulen. | Die Oberfläche taugt nicht für viele Nutzer; die Fachlogik schon. |
| Sprachen | **Identifikator ≠ Sprache.** Kennzahlen bleiben englisch, übersetzt wird nur, was ein Mensch liest. Mechanismus jetzt, Seiten nach und nach. | Spätere Länder kosten dann eine Datei statt eines Rundgangs durch 37 Seiten. Siehe 6.4. |
| Erste Nutzer | Ich und Freunde → Testgruppe Läufer, 1 Monat, wöchentliches Feedback → Markt. | |
| Bluetooth | **Wandert jetzt in den nativen Dienst.** | Richtig in jeder Zukunft: die Java-Zeilen wandern bei einem Umzug unverändert mit. |

---

## 5. Die Einlagen-Schnittstelle

Das Herzstück. Sie muss stehen, **bevor** die Firmware geschrieben wird.

### 5.1 Das Problem, das sie löst

Es ist nicht entschieden, wo aus Rohwerten Merkmale werden — in der Einlage, auf
dem Telefon oder im Backend. Der Chip steht nicht fest. Das wird gerade getestet.

**Diese Ungewissheit darf den Bau nicht aufhalten.** Deshalb ist die
Schnittstelle so entworfen, dass die Antwort sie nicht verändert:

> **Zwei Kanäle, unabhängig voneinander. Die App sieht in jedem Fall dasselbe.**

| | Kanal A — Merkmale | Kanal B — Rohwerte |
|---|---|---|
| Inhalt | ein Bündel je Schritt | Block von Sensorwerten |
| Menge | ~20 Byte je Schritt, ~120 B/s | ~10 KB/s |
| Pflicht? | **Ja** | Nein, nur wenn der Chip es kann |
| Wer füllt ihn? | Firmware — **oder** die Auswertung im Backend | Firmware |

Kann der Chip Schritte selbst erkennen, füllt er Kanal A und Kanal B bleibt
stumm. Kann er es nicht, sendet er Kanal B, und **die Auswertung im Backend**
rechnet Kanal A daraus. Für die Oberfläche ändert sich nichts.

**Damit wird „wo wird gerechnet" von einer Architekturentscheidung zu einer
Einstellung.** Sie darf sich sogar später noch ändern, ohne dass etwas bricht.

### 5.1.1 Das Telefon ist Bote, nicht Gutachter

> **Das Telefon misst, aber es wertet nicht aus.**

Die Trennung, auf die es ankommt — und sie ist feiner, als der erste Entwurf
dieses Abschnitts behauptete:

| | Beispiel | Wo es geschieht |
|---|---|---|
| **Messung** | Der Schrittzähler des Telefons meldet eine Zahl | überall, wo ein Sensor sie hergibt |
| **Auswertung** | Aus Druckverläufen werden Bodenkontaktzeit und Aufsetzmuster | **an genau einem Ort** |

Das Telefon **darf** seinen eigenen Schrittzähler lesen — das ist eine Messung.
Welche Quelle je Messgröße vorgeht und was passiert, wenn keine da ist, steht
in [messquellen.md](messquellen.md): Einlage vor Uhr vor Telefon, und wenn
nichts messen kann, **steht keine Zahl da.**

Das Telefon rechnet aber **keine Merkmale aus Sensor-Rohwerten der Einlage.**
Die Auswertung ist Python, sie liegt im Backend, und sie ist die einzige Stelle,
die aus Rohwerten Merkmale macht — was den späteren Weg zur Zulassung
überhaupt erst gangbar hält.

**Was aus dem GPS kommt, heißt weiterhin Bewegung und nie Schritt.** Die beiden
Wörter sind in [ubiquitous-language.md](ubiquitous-language.md) getrennt und
bleiben es — ein Bodenkontakt ist etwas anderes als eine Ortsveränderung.

**Folge für Kanal B:** Er wird durchgereicht, nicht ausgewertet. Damit muss die
WebView die Rohwerte nur **weiterleiten** — das ist deutlich weniger heikel, als
sie zu verarbeiten, und verschiebt den Zeitpunkt, an dem uns die Brücke zwingt
umzuziehen.

### 5.2 Was die Firmware bereitstellen muss

Ein eigener GATT-Dienst mit fünf Merkmalen:

| Merkmal | Art | Zweck |
|---|---|---|
| Schrittereignis | Notify | Kanal A — ein Bündel je Bodenkontakt |
| Rohblock | Notify | Kanal B — gebündelte Sensorwerte, **niemals einzeln** |
| Steuerung | Write | Start, Stopp, Abtastrate, Kanal an/aus |
| Zustand | Read + Notify | Akku, Pufferfüllstand, Zeitbasis, Verbindungsgüte |
| Kennung | Read | Firmwareversion, **Regelversion**, Seriennummer, Fuß (links/rechts) |

### 5.3 Vier Anforderungen, die leicht vergessen werden

**1. Gemeinsame Zeitbasis beider Einlagen — ab der ersten Firmware.**
Ohne sie ist jede Aussage über Seitenunterschiede wertlos — und
Seitenunterschiede sind der Kern des Produkts. Jedes Ereignis trägt die
Chipzeit; das Telefon bildet sie auf seine eigene Uhr ab. Die Abweichung
zwischen links und rechts muss unter **10 ms** bleiben.

**Nicht aufschiebbar.** Der Prototyp kommt als Paar — damit ist das kein
Ausbauschritt, sondern Bestandteil der ersten Firmware. Die vorhandenen
Aufzeichnungen sind einfüßig (`step_count_left: 0`), das heißt: **dieser Fall
ist noch nie erprobt worden.** Er gehört als Erstes geprüft, nicht als Letztes.

**2. Puffer in der Einlage, zweistufige Übergabe.**
Wie beim GPS: Die Einlage speichert selbst, das Telefon holt ab und bestätigt,
erst dann wird gelöscht. Bluetooth reißt ab — beim Laufen ständig. Ohne Puffer
ist jeder Abriss ein Loch in den Daten.
**Mindestens 10 Minuten Puffer.**

**3. Bündeln, nicht einzeln senden.**
Jede Bluetooth-Benachrichtigung kostet Strom und Zeit. Rohwerte gehen in Blöcken
von mindestens 100 ms. Das gilt unabhängig vom Rahmen und ist der Grund, warum
Kanal B überhaupt durch eine WebView passt.

**4. Regelversion in jedem Bündel.**
Welche Firmware-Auswertung dieses Ergebnis erzeugt hat. Kostet ein Byte. Ohne
sie sind zwei Läufe aus zwei Firmwareständen nicht vergleichbar — und der Weg zur
Zulassung ist zu.

### 5.4 Vorschlag für das Schrittereignis

Etwa 16 Byte bei der heutigen Bestückung. Der Hardware-Entwickler soll
widersprechen, wo es nicht passt.

**Die Felder sind nicht erfunden** — sie kommen aus dem, was
`compute_step_metrics` und `evaluate_heel_forefoot_balance` in `myprosole_app`
bereits berechnen (siehe 3.1). Was dort keinen Platz hat, gehört nicht hierher.

| Feld | Größe | Inhalt |
|---|---|---|
| Chipzeit | 4 B | Millisekunden seit Firmwarestart |
| Bodenkontaktzeit | 2 B | ms |
| Flugzeit | 2 B | ms |
| Spitzendruck je Kanal | 3 B | `heel`, `lateral_forefoot`, `medial_forefoot` |
| Ferse-Vorfuß-Verhältnis | 2 B | `heel_to_forefoot_ratio` aus der Pipeline |
| Aufsetzmuster | 1 B | die sechs Werte aus `contact_pattern` |
| Güte | 1 B | wie sicher die Erkennung war |
| Regelversion | 1 B | siehe 5.3 Punkt 4 |

**Offene Frage an die Hardware:** Die Pipeline erwartet drei Sensoren je Fuß,
die vorhandene Aufzeichnung hat zwei. Wird der Prototyp drei haben? Davon hängt
ab, ob dieses Bündel feste Länge bekommt — und das ist billiger jetzt zu klären
als nach der ersten Firmware.

**Das Bündel ist zugleich eine Prüfvorschrift.** Bevor die Firmware existiert,
lässt sich ein Byte-Feld von Hand erzeugen und ein Test schreiben, der es
zerlegt. Damit hat der Hardware-Entwickler eine Beschreibung, die man
**ausführen** kann statt sie zu lesen — der einzige Weg, ein Missverständnis
über ein Datenformat vor dem Löten zu bemerken.

---

## 6. Der Datenweg und das Backend

### 6.1 Die Mengen, ehrlich gerechnet

Gerechnet mit der Bestückung, die die Pipeline erwartet (3.1), nicht mit
geschätzter: 3 FSR + 6 IMU-Achsen = 9 Kanäle je Fuß, ~285 Hz, 2 Byte je Wert,
3 Laufstunden je Nutzer und Woche.

| | je Laufstunde, beide Füße | bei 1 Mio. Nutzern je Woche |
|---|---|---|
| Rohwerte | ~37 MB | **~110 TB** |
| Merkmale | ~0,4 bis 2 MB | **~1 bis 6 TB** |

Der Unterschied ist Faktor 16 bis 80. **Aber beides ist zu viel für eine
Postgres-Tabelle neben den Nutzerkonten** — auch der sparsame Weg landet bei
Terabytes je Woche.

Zwei Dinge fallen daran auf, und beide sind wichtiger als die Zahlen selbst:

- Die **hohe Abtastrate** kostet mehr als die Sensorzahl. Ob 2 oder 8 FSR ist
  fast egal; ob 285 Hz oder 100 Hz ist Faktor drei. **Frage an die Hardware:
  brauchen wir wirklich 285 Hz, oder war das nur der Standardwert des Chips?**
- Rohdaten dauerhaft für alle aufzuheben ist keine Option, die man später
  zurücknehmen kann. Sie ist entweder von Anfang an gerechnet oder sie kommt
  als Rechnung.

### 6.2 Die Trennung

Der Instinkt, Analyse und App zu trennen, ist richtig — und zwar aus **drei**
Gründen, von denen nur einer die Geschwindigkeit ist:

1. **Last.** Eine schwere Auswertung darf nie die Anmeldung ausbremsen.
2. **Datenschutz.** Der Analyseweg braucht keinen Namen, keine E-Mail — nur eine
   Pseudonym-Kennung. Trennung macht die Aussage „unsere Analyse kennt keine
   Personen" **wahr** statt nur behauptet.
3. **Austauschbarkeit.** Was hinter einer schmalen Schnittstelle liegt, kann
   ersetzt werden. Was in dieselbe Datenbank hineinwächst, kann es nicht.

**Die Regel, die das absichert:**

> Die App fragt **niemals** den Analyseweg direkt. Sie kennt nur Supabase.
> Ergebnisse kommen als fertige Merkmale zurück.

Solange diese Regel hält, ist der Analyseweg jederzeit ersetzbar — und genau das
war die Bedingung: *„wenn wir umziehen müssen, nicht schwer".*

### 6.3 Was in dieser Phase gebaut wird

**Noch kein Analyse-Backend im Betrieb.** In dieser Phase landen die Merkmale in
Supabase, und die Rohwerte bleiben auf dem Telefon. Bei einem Prototyp und einer
Handvoll Testläufer trägt das mühelos.

**Aber der Weg dahin ist kürzer als gedacht.** Die Auswertung existiert bereits
als Python-Modul (3.1). Aus ihr einen Dienst zu machen, der eine Aufzeichnung
entgegennimmt und Merkmale zurückgibt, ist kein Neubau — es ist eine Hülle um
vorhandenen Code. Das ist der billigste Weg zu einem echten Analysepfad, und er
liegt schon da.

Die Entscheidung über Betrieb und Ort fällt mit echten Messwerten des Prototyps
— **Stichtag: erste Testgruppe.**

**Streamlit ist nicht die Zukunft, aber die Module sind es.** Die Oberfläche aus
`myprosole_app` bleibt Laborwerkzeug und geht nicht in Betrieb — für viele
Nutzer taugt sie nicht. Der Analysedienst wird getrennt entwickelt, geprüft auf
Stabilität, Standards und Belastbarkeit.

Das heißt aber **nicht**, dass die Auswertung neu geschrieben wird. Hier gilt
dieselbe Regel wie in der App:

> **Fachlogik nach unten, Darstellung nach oben.**
> Streamlit ist die Darstellung. `core/domain/` ist die Fachlogik.
> Das eine fällt weg, das andere bleibt.

Was geprüft werden muss, bevor die Module in Betrieb gehen: Verhalten bei
unvollständigen Daten, Verhalten bei zwei Füßen statt einem, Laufzeit je
Auswertung, und ob die Kennzahlen zwischen zwei Aufzeichnungen desselben Laufs
stabil sind. **Stichtag: erste echten Einlagendaten.**

### 6.4 Sprachen — die strategische Festlegung

Die Auswertung nennt ihre Kennzahlen englisch (`stance_swing_ratio`), die
Oberfläche ist deutsch, und später sollen andere Länder dazukommen. Die Frage
war, wie das geht, ohne alles noch einmal zu bauen.

**Die Antwort beginnt mit einer Unterscheidung:**

> **Ein Identifikator ist keine Sprache.**
> `stance_swing_ratio` ist kein englischer Text, sondern ein Name — so wie
> `moving_time_s` in der Datenbank keiner ist. Sprache ist nur, was ein Mensch
> liest.

Daraus folgen drei Ebenen, die sich nie vermischen:

| Ebene | Beispiel | Übersetzt? |
|---|---|---|
| **Kennzahl** — Python, Datenbank, Schnittstelle | `stance_swing_ratio` | nie |
| **Textschlüssel** — in der App | `merkmal.stance_swing_ratio.name` | nie |
| **Text** — was der Nutzer liest | „Verhältnis Stand zu Schwung" | **hier** |

**Was das kostet und was es spart:**

- Die Python-Module werden **nicht umbenannt.** Kein Umbau an Code, der läuft
  und getestet ist.
- Die Datenbank bleibt englisch. Das ist die Regel, die ohnehin schon gilt.
- Eine neue Sprache ist **eine Datei**, kein Rundgang durch 37 Seiten.

**Der Weg dorthin, ohne alles anzuhalten:** Der Mechanismus kommt jetzt. Bereits
vorhandene Seiten wandern, wenn sie ohnehin angefasst werden. **Jede neue Seite
wird von Anfang an richtig gebaut** — und die Seiten für die Auswertung aus
Phase 2 gibt es noch gar nicht. Das ist der billigste Zeitpunkt, den es je
geben wird.

**Eine Warnung für später:** Übersetzungen dürfen die Grenze aus
[ubiquitous-language.md](ubiquitous-language.md) Abschnitt 7 nicht aufweichen.
„ungleich verteilt" darf in keiner Sprache zu „fehlbelastet" werden. Wer
übersetzt, übersetzt auch die Zulassungsgrenze mit — oder reißt sie ein.

---

## 7. Warum jetzt nicht umgezogen wird

Gemessen an unserem Quelltext, nicht geschätzt:

| Wandert unverändert | Muss angefasst werden |
|---|---|
| Fachlogik 1.547 Z. | Seiten 10.375 Z. |
| Zustand 4.034 Z. | Komponenten 1.885 Z. |
| Tests 423 Z. | Gestaltung 2.865 Z. |
| Nativer Dienst 1.206 Z. | Navigation, Karte, Bluetooth |
| **≈ 7.200 Zeilen** | **≈ 15.100 Zeilen** |

**6 bis 10 Wochen Vollzeit** für Android-Gleichstand. In Geld: **kein
Lizenzgeld.** Jeder Euro am Umzug ist ein iPhone-Euro und fällt in jedem Fall an.

Drei Gründe gegen jetzt: die Hardware käme mitten in den Umbau; die Frage „wo
wird gerechnet" ist noch offen und entscheidet mit; und Wochen ohne sichtbaren
Fortschritt sind das, was gerade am wenigsten bezahlbar ist.

**Der Ersatz:** Nach jedem Arbeitspaket wächst der Anteil nativen Codes. Heute
sind 1.206 native Zeilen da, davon 901 ohne Capacitor-Bezug — sie liefen
unverändert unter React Native. Jedes Paket senkt den Preis des Umzugs.

---

## 8. Arbeitspakete

In dieser Reihenfolge, weil jedes vom vorigen abhängt.

**Zwei Stränge laufen nebeneinander:** Phase 1 hängt an mir, Phase 2 an der
Hardware. Paket B gehört deshalb an den Anfang, obwohl es zu Phase 2 zählt —
es ist die einzige Aufgabe, deren Verzug man erst bemerkt, wenn es zu spät ist.

### Strang 1 — die App tragfähig machen

#### A · Der Beweis draußen — *diese Woche*
Ein Lauf mit ausgeschaltetem Bildschirm. Danach die Datenbank des Dienstes
auslesen und die Kette prüfen.
**Fertig, wenn:** ein Lauf mit plausibler Strecke gespeichert ist.
**Blockiert:** alles andere. Ohne diesen Beweis bauen wir auf Vermutungen.

#### C · Bluetooth in den nativen Dienst — *3 bis 4 Wochen*
Der Dienst empfängt selbst, speichert selbst, übergibt zweistufig — genau wie
beim GPS. Pulsgurt zuerst, weil es ihn schon gibt.
**Fertig, wenn:** eine Stunde Pulsgurt mit ausgeschaltetem Bildschirm ohne Lücke
aufgezeichnet ist.
**Zählt doppelt:** Diese Java-Zeilen sind auch das Fundament für die Einlage.

#### D · Testgruppe vorbereiten
Alles, was eine fremde Person betrifft: Privatzone um Zuhause, der
Sichtbarkeitsschalter, die 27 rohen Datenbankmeldungen.
**Fertig, wenn:** keine Meldung mehr englisch oder technisch ist und der
Wohnort nicht mehr aus einem geteilten Lauf ablesbar ist.

#### G · Sprachgerüst einziehen — *klein, aber jetzt*
Nach Abschnitt 6.4. Der Mechanismus kommt sofort, die Seiten wandern nach und
nach.
**Fertig, wenn:** der Mechanismus steht und jede neue Seite ihn benutzt.
**Warum jetzt:** Die Seiten von Phase 2 gibt es noch nicht. Jede davon, die
richtig geboren wird, ist Arbeit, die nie anfällt.

### Strang 2 — die Einlage vorbereiten

#### B · Die Schnittstelle schriftlich — *diese und nächste Woche*
Abschnitt 5 als eigenes Dokument an den Hardware-Entwickler, durchgesprochen und
gegengezeichnet. **Mit den drei offenen Rückfragen:** Abtastrate, Kanalzahl,
Zeitsynchronisierung beider Einlagen.
**Fertig, wenn:** er bestätigt, dass die Firmware das liefern kann — oder
begründet widerspricht und wir es ändern.
**Warum so früh:** der einzige Punkt, an dem Monate Verzug entstehen können,
ohne dass jemand es merkt.

#### E · Einlage anschließen — *sobald Hardware da ist*
Kanal A und B nach Abschnitt 5. Erst Zahlen auf dem Bildschirm, dann Schönheit.
**Voraussetzung:** Paket A, C und D sind fertig. Sonst gibt es bei jedem Fehler
zwei Verdächtige.

#### F · Der Reiter für die Auswertung — *am Ende*
Ein eigener Bereich, der aufgeht, sobald Einlagen verbunden sind. Zuerst ein
einziges, gut gewähltes Merkmal. **Beschreibend, nicht bewertend.**
Dazu die Erweiterung der Datenbank: Bis heute speichert ein Lauf Tempo und
Strecke — künftig auch die Merkmale.

---

## 9. Risiken

| Risiko | Wirkung | Was wir tun |
|---|---|---|
| Chip steht in 3 Monaten immer noch nicht fest | Ziel verfehlt, ohne dass die App schuld ist | Paket B sofort. Schnittstelle trägt beide Fälle. |
| Bluetooth bricht beim Laufen ständig ab | Löcher in den Daten | Puffer in der Einlage ist **Pflicht**, nicht Kür |
| Zwei Einlagen ohne gemeinsame Zeit | Seitenvergleich unmöglich — der Produktkern | Abschnitt 5.3 Punkt 1. Die Auswertung selbst kann zwei Füße bereits (`sample_data.csv`: 40 Schritte, 20 links / 20 rechts). **Ungeprüft ist die Zeitsynchronisierung zwischen zwei getrennten Funkgeräten** — dort liegt das Risiko, nicht in der Auswertung. |
| Deutsche Texte stecken in der Auswertung | Zweite Sprache wird teuer, Zulassungsgrenze schwer zu bewachen | `classification_notes` liefert fertige Sätze („Klassischer Fersenaufsatz."). Nach 6.4 müssen daraus Schlüssel werden. Siehe Paket G. |
| Rohdatenrate erdrückt die WebView | Kanal B unbrauchbar | Bündeln ab 100 ms; im Ernstfall zwingt es den Umzug — dann mit Messwerten |
| Testgruppe erlebt Datenverlust | Vertrauen weg, schwer zurückzuholen | Paket A und C vor Paket D |
| 30–45 h gelten dem ganzen Startup | Plan zu ehrgeizig | Pakete sind einzeln fertig; jedes ist für sich nützlich |

---

## 10. Woran wir es messen

| Größe | Ziel |
|---|---|
| Verlorene Läufe | **0** |
| Lücke in der Aufzeichnung, Bildschirm aus, 1 h | < 30 s gesamt |
| Zeitabweichung zwischen linker und rechter Einlage | < 10 ms |
| Strecke bei stehendem Telefon, 30 min | < 100 m |
| Anteil nativer Zeilen ohne Capacitor-Bezug | steigt mit jedem Paket |
| Englische oder rohe Meldungen in der Oberfläche | **0** |

---

## 11. Was danach entschieden werden muss

Nicht jetzt — aber mit Datum, damit es nicht vergessen wird.

| Frage | Entscheidbar ab | Was sie beantwortet |
|---|---|---|
| Wo wird gerechnet? | Messwerte des Prototyps | Kanal A oder B, Backend-Größe. **Teilantwort liegt vor:** die Auswertung ist Python und gehört damit auf einen Server, nicht in die Einlage. |
| Abtastrate: 285 Hz oder weniger? | Rückfrage an die Hardware | Datenmenge, Akkulaufzeit, ob Kanal B durch die WebView passt |
| Bleiben es 2 FSR je Fuß? | Rückfrage an die Hardware | ob das Schrittbündel feste Länge haben kann |
| Analyseweg getrennt von Supabase? | erste Testgruppe | Kosten, Betrieb, Datenschutzaussage |
| Umzug auf React Native? | wenn Kanal B die WebView erdrückt **oder** eine Uhr auf den Plan kommt | 6–10 Wochen |
| Nachvollziehbarkeit für die Zulassung | erster zahlender Kunde | ob spätere Bewertung möglich ist |
| iPhone | wenn Android trägt | Apple-Kosten, doppelte Prüfung |
