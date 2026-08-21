# MyProSole – Arbeitsanweisung

Die vollständigen Regeln stehen in
[`docs/DEVELOPMENT_STANDARDS.md`](docs/DEVELOPMENT_STANDARDS.md) und gelten für
`project-planner`, `myprosole_app` und `myprosole_web`.

**Diese Datei ist der Auszug.** Sie steht hier, weil ein Verweis auf 633 Zeilen
schwächer ist als zehn Zeilen direkt — am 21.08.2026 wurde nachweisbar, dass
Regeln in Prosa nicht halten und nur das hält, was ein Skript prüft.

---

## Die fünf, die am häufigsten gebrochen wurden

**1. Nachsehen statt erzeugen.** Klassennamen, Schnittstellen, Konstanten und
Verfügbarkeiten werden **nachgeschlagen**, nicht aus dem Gedächtnis erzeugt.
Eine erfundene CSS-Klasse verursacht keinen Fehler — sie tut einfach nichts.

**2. Kein Grund ohne Prüfung.** Steht in einem Bericht „nicht testbar", „nicht
verfügbar", „nicht nötig", muss das **geprüft** sein. Eine plausible Erklärung
an der Stelle einer fehlenden Prüfung ist schlimmer als eine Lücke, weil sie
unsichtbar macht, dass eine da ist.

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

`python scripts/run_tests.py --suite all` ist erfolgreich (zurzeit 11 Prüfungen),
die Definition of Done ist erfüllt, und **gehört eine Migration dazu, ist sie
eingespielt und nachgewiesen** — der Bericht kommt danach, nicht davor.

Regelkonflikte, fehlender sicherheitsrelevanter Kontext und unvermeidbare
Abweichungen werden ausdrücklich benannt. Regeln werden nicht stillschweigend
umgangen.
