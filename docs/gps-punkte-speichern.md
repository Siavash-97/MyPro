# GPS-Punkte speichern, ohne den Server zu erdrücken

Wie die Aufzeichnung gebaut sein muss, damit sie zwei Dinge gleichzeitig
kann: bei leerem Akku nichts verlieren, und bei zehntausend gleichzeitig
Laufenden nicht zusammenbrechen.

---

## Warum der naheliegende Weg nicht geht

Der erste Gedanke ist: Jeder Punkt wird sofort geschrieben, sobald er
kommt. Damit ist nichts verloren.

Rechnen wir das durch. Ein Punkt pro Sekunde, pro Person:

| Gleichzeitig Laufende | Schreibvorgänge pro Sekunde |
|---|---|
| 100 | 100 |
| 1.000 | 1.000 |
| 10.000 | **10.000** |

Zehntausend Schreibvorgänge pro Sekunde bringen jede Datenbank in
Schwierigkeiten, und Supabase begrenzt außerdem die Zahl gleichzeitiger
Verbindungen. Die App würde nicht langsam – sie würde für alle stehen,
auch für die, die gerade nur ihr Profil ansehen.

Der heutige Zustand ist das andere Extrem: **ein einziger Schreibvorgang
am Ende des Laufs** (`store/run.ts`). Der Server hat fast nichts zu tun,
aber ein leerer Akku kostet den ganzen Lauf.

Beides sind Randlagen. Der Weg liegt dazwischen.

---

## Der Aufbau in vier Teilen

### 1. Das Gerät ist während des Laufs der Hauptspeicher

Jeder Punkt wandert sofort in den Speicher des Geräts – nicht ins Netz.
Das kostet nichts, gelingt immer und ist der eigentliche Schutz gegen
Datenverlust: Geht der Akku leer, stürzt die App ab, wird sie von Android
beendet – die Punkte liegen auf dem Gerät.

Dafür genügt **IndexedDB**, im Browser wie in der Hülle vorhanden. Kein
Plugin, keine zusätzliche Abhängigkeit.

Der wichtige Nebeneffekt: **Der Server ist während des Laufs nicht im
kritischen Pfad.** Wer im Wald ohne Empfang läuft, verliert nichts. Die
Aufzeichnung hängt nicht am Netz.

### 2. Übertragen in Bündeln, nicht einzeln

Alle 30 Sekunden – oder sobald 50 Punkte beisammen sind – geht **eine**
Anfrage mit allen Punkten darin raus.

| Gleichzeitig Laufende | Einzeln | In Bündeln zu 30 s |
|---|---|---|
| 1.000 | 1.000/s | **33/s** |
| 10.000 | 10.000/s | **333/s** |
| 100.000 | 100.000/s | **3.333/s** |

Das ist der größte Hebel im ganzen Aufbau: **Faktor 30, für eine Zeile
Code mehr.** Und die Datenbank schreibt 50 Zeilen in einem Vorgang fast so
schnell wie eine einzelne – der Aufwand steckt im Hin und Her, nicht in
den Daten.

Der Preis ist ehrlich zu benennen: Bei einem Absturz fehlen die letzten bis
zu 30 Sekunden **auf dem Server**. Auf dem Gerät liegen sie weiterhin und
werden beim nächsten Start nachgereicht.

### 3. Doppelte Punkte müssen unmöglich sein

Eine Übertragung kann scheitern, nachdem die Datenbank sie schon
angenommen hat – schlechtes Netz, Zeitüberschreitung. Die App versucht es
dann erneut, und ohne Vorkehrung stünde alles zweimal da.

Deshalb bekommt jeder Punkt eine Kennung vom Gerät, und die Datenbank
weist Doppelte ab (`on conflict do nothing`). Damit ist ein zweiter
Versuch **immer** gefahrlos – man muss nicht wissen, ob der erste
angekommen ist.

Das ist der Unterschied zwischen „meistens richtig" und „richtig".

### 4. Nachreichen beim nächsten Start

Beim Öffnen der App wird nachgesehen, ob auf dem Gerät noch Punkte liegen,
die nie übertragen wurden. Falls ja, gehen sie raus – im Hintergrund, ohne
dass jemand darauf wartet.

Damit ist der Fall „Akku leer mitten im Lauf" vollständig abgedeckt: Beim
nächsten Einschalten ist der Lauf da.

---

## Was den Server sonst noch belastet

Schreiben ist nur die eine Hälfte. Die andere ist Lesen, und dort steckt
eine Falle, die erst bei vielen Nutzern auffällt.

**Listen dürfen niemals Punkte laden.** Der Laufverlauf zeigt Datum,
Strecke, Zeit, Tempo – alles davon steht in `runs`. Würde die Liste die
Punkte mitladen, wären das bei 20 Läufen 20.000 Zeilen für eine Ansicht,
die keine einzige davon anzeigt. Punkte werden nur geholt, wenn jemand
eine Strecke wirklich auf der Karte öffnet.

**Kennzahlen werden beim Speichern berechnet, nicht beim Lesen.** Strecke,
Dauer, Höhenmeter und Tempo stehen fertig in `runs`. Sie bei jedem Aufruf
aus den Punkten neu zu berechnen, würde die Arbeit mit jedem Betrachten
wiederholen.

---

## Wachstum der Datenmenge

Ein Punkt braucht etwa 245 Byte. Bei rund 1.000 Punkten je Lauf sind das
etwa 245 kB pro Lauf.

| | Läufe | Rohpunkte |
|---|---|---|
| 1.000 Nutzer, 3 Läufe/Woche, 1 Jahr | 156.000 | ~38 GB |
| 10.000 Nutzer, dasselbe | 1.560.000 | ~380 GB |

Das ist die Zahl, die irgendwann den Tarif bestimmt – nicht die Zahl der
Nutzer. Deshalb die offene Frage nach der **Aufbewahrung**: Behalten wir
jeden Rohpunkt für immer, oder dampfen wir ältere Läufe nach einer Frist
auf Kennzahlen und eine vereinfachte Strecke ein?

Eine vereinfachte Strecke braucht etwa ein Zehntel des Platzes und sieht
auf der Karte gleich aus. Verloren geht dabei die Möglichkeit, alte Läufe
später neu auszuwerten – etwa mit einer besseren Schrittanalyse.

**Das ist keine technische, sondern eine fachliche Entscheidung**, und sie
gehört getroffen, bevor Schritt 1 gebaut wird: Wer die Punkte später
eindampfen will, braucht von Anfang an ein Feld, das den Zustand einer
Zeile festhält.

---

## Reihenfolge

1. **Örtlicher Speicher und Bündelübertragung** – nützt sofort, auch ohne
   Hintergrund-GPS: Heute kostet ein Absturz den ganzen Lauf.
2. **Hintergrund-GPS** – erst danach. Vorher würde es den Datenverlust
   vergrößern statt verkleinern, weil die Punkte dann stundenlang nur im
   Arbeitsspeicher lägen.
3. **Aufbewahrung** – sobald entschieden ist, wie lange Rohpunkte bleiben.

Was hier bewusst **nicht** steht: eine Warteschlange, ein eigener Dienst,
ein Zwischenspeicher. Alles davon löst Probleme, die wir bei zehntausend
gleichzeitig Laufenden noch nicht haben – und jedes davon ist ein weiteres
Stück, das betrieben und bezahlt werden will. Bündeln und örtlich puffern
reichen sehr weit; was danach kommt, entscheidet man mit echten Zahlen,
nicht mit geschätzten.
