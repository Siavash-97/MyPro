# MyProSole – Arbeitsanweisung

Die vollständigen Regeln stehen in
[`docs/DEVELOPMENT_STANDARDS.md`](docs/DEVELOPMENT_STANDARDS.md) und gelten für
`project-planner`, `myprosole_app` und `myprosole_web`.

**Diese Datei ist der Auszug.** Sie steht hier, weil ein Verweis auf 633 Zeilen
schwächer ist als zehn Zeilen direkt — am 21.08.2026 wurde nachweisbar, dass
Regeln in Prosa nicht halten und nur das hält, was ein Skript prüft.

---

## Die sechs, die am häufigsten gebrochen wurden

**1. Nachsehen statt erzeugen.** Klassennamen, Schnittstellen, Konstanten und
Verfügbarkeiten werden **nachgeschlagen**, nicht aus dem Gedächtnis erzeugt.
Eine erfundene CSS-Klasse verursacht keinen Fehler — sie tut einfach nichts.

**2. Kein Grund ohne Prüfung.** Steht in einem Bericht „nicht testbar", „nicht
verfügbar", „nicht nötig", muss das **geprüft** sein. Eine plausible Erklärung
an der Stelle einer fehlenden Prüfung ist schlimmer als eine Lücke, weil sie
unsichtbar macht, dass eine da ist.

**Konkreter Fall, 22.08.2026:** „Fehlerübersetzung, verstreut — fünf Module,
61 Aufrufstellen" stand wortgleich in elf aufeinanderfolgenden Berichten,
abgeschrieben statt geprüft. Nachgesehen: **zwei** Dateien
(`blockieren.ts`, `melden.ts`), je **ein** Aufrufer. Eine Zahl, die niemand
nachrechnet, bleibt falsch, egal wie oft sie wiederholt wird.

**2b. Lautes Rauschen ist auch eine Form von Blindheit.** Regel 2 warnt vor
der Erklärung, die eine Lücke verdeckt. Die Kehrseite: Ein Prüfwerkzeug, das
zu viel meldet, verdeckt genauso — nur langsamer. Wer zweimal 42 Fehlalarme
wegwischt, wischt beim dritten Mal den echten Fund mit weg.

**Konkreter Fall, 26.08.2026:** Ein Abgleich „Katalog gegen Migrationen"
meldete **43 Treffer. 42 davon waren Fehler im Werkzeug** — Regelnamen in
Anführungszeichen übersehen, Regeln aus `execute format()`-Schleifen nicht
gelesen, `drop table` nicht als Regel-Löschung verstanden, ein Schema nicht
abgefragt. Der eine echte Punkt stand mittendrin.

Daraus folgt, was ein Prüfwerkzeug schuldet:

- **Erst an bekannten Antworten prüfen, dann anwenden.** Ein Werkzeug, das
  Fälle nicht wiederfindet, deren Ergebnis man kennt, ist nicht fertig.
- **Jede Grenze steht im Kopf**, mit Fundstelle — nicht „prüft den Katalog",
  sondern was es dabei nicht sieht.
- **Eine Ausnahme wird belegt, nicht angenommen.** Wer ein Objekt als
  „gehört zur Plattform" abhakt, schreibt die Messwerte daneben, die das
  zeigen.
- **Null Treffer sind das Ziel.** Bleibt ein Fund offen, ist der Lauf nicht
  abgeschlossen — er steht bei diesem einen.

**3. `/tdd` bei reinen Funktionen, Datenformaten und Fehlern in Fachlogik.**
Und in Scheibe 1 nur das bauen, was Scheibe 1 verlangt — der häufigste eigene
Fehler ist, dort schon mehr zu bauen, sodass die nächste Scheibe nicht mehr
rot werden kann.

**4. Zwei Berichte, zwei Ordner.** Nach jeder Coding-Aufgabe ein Task-Bericht
nach `C:\MyProSole\Agent-Reports`. War es zusätzlich eine Fehlerbehebung, davor
den Ordner `C:\MyProSole\Fehler und Bug Reports` nach überlappenden Tags
durchsuchen und danach dort einen Bericht ablegen.

**5. Bei Oberfläche den Agenten `oberflaeche` benutzen.** Es gibt ein
Designsystem mit 2.865 Zeilen und `docs/seiten-regeln.md`. Inline-Stile sind
durch eine Sperrklinke gedeckelt und dürfen je Datei nicht wachsen.

**6. „Ich weiß es schon" ist kein Grund, einen Skill zu überspringen.** Das
Gefühl, die Lösung schon zu kennen und schnell bauen zu wollen, ist genau der
Moment, in dem `/grill-me`, `/tdd` oder ein Blick in `Fehler und Bug Reports`
am wahrscheinlichsten übersprungen werden — und genau dann am nötigsten sind.
Tempo ist im Bericht kein gültiger Grund für „warum nicht benutzt". Wer
schnell bauen will, benutzt die Skills schnell, statt sie auszulassen.

---

## Was nur der Mensch starten kann

`/mattpocock-skills:improve-codebase-architecture` und
`/mattpocock-skills:grill-me` tragen `disable-model-invocation`. **Nicht
nachbauen** — darum bitten. `grilling` dagegen ist aufrufbar und ist der
Inhalt von `grill-me`.

**Auslöser:** Taucht dieselbe Datei dreimal in Folge in den Berichten als
auffällig auf, ist ein Lauf von `improve-codebase-architecture` fällig.

---

## Fertig heißt

`python scripts/run_tests.py --suite all` ist erfolgreich — **alle** Prüfungen,
nicht eine bestimmte Anzahl. Das Skript nennt die Zahl selbst;
die Definition of Done ist erfüllt, und **gehört eine Migration dazu, ist sie
eingespielt und nachgewiesen** — der Bericht kommt danach, nicht davor.

Regelkonflikte, fehlender sicherheitsrelevanter Kontext und unvermeidbare
Abweichungen werden ausdrücklich benannt. Regeln werden nicht stillschweigend
umgangen.
