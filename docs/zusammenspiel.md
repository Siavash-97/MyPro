# Das Zusammenspiel

**Erstellt:** 21.08.2026, nach einem Feldtest, bei dem die App nichts aufzeichnete

Die einzelnen Teile sind beschrieben — [bewegung](../myprosole_web/src/lib/bewegung.ts),
[Messquellen](messquellen.md), [Aufzeichnung](hintergrund-aufzeichnung-entwurf.md).
Dieses Dokument beschreibt, **wie sie zusammenwirken** und wo sie einander
umbringen können.

Anlass: Ein Fehler, der keinen einzelnen Baustein betraf, sondern ihre
Verkettung.

---

## 1. Die Kette, wie sie heute läuft

```
  Dienst (Java, 1 Hz)  ──>  SQLite auf dem Gerät
                                   │
                          punkteEinsammeln (1 s)
                                   │
                              addPoint
     ┌─────────────────────────────┼─────────────────────────────┐
     │ 1  Genauigkeit ≤ 100 m ?    │  sonst: Punkt verworfen     │
     │ 2  zu alt / rückwärts ?     │  sonst: Punkt verworfen     │
     │ 3  tempoErmitteln  ─── Güte ≤ 1,0 ?  sonst Tempo = 0      │
     │ 4  stehtStill ?  ──>  Ruhepegel LERNT                     │
     │ 5  tor = max(0,9 ; Ruhepegel + 0,2)      ◄── ENGSTELLE    │
     │ 6  bewegungFortschreiben  ──>  inBewegung                 │
     │ 7  !inBewegung ?  ──>  ABBRUCH: kein Punkt, keine Strecke │
     │ 8  Genauigkeit ≤ 50 m ?     │  sonst: kein Streckenanteil │
     │ 9  Segment ≥ 10 m, kein Sprung ──> Strecke, Höhe, Punkt   │
     └───────────────────────────────────────────────────────────┘
                                   │
                        tick (1 s) ──> tempoJetztMps ──> Anzeige
```

**Neun Prüfungen hintereinander, und jede kann alles danach abschneiden.**

---

## 2. Die Engstelle

Zeile 5 und 7 zusammen sind der Flaschenhals des ganzen Systems:

> **Eine einzige gelernte Zahl entscheidet, ob überhaupt etwas aufgezeichnet
> wird.** Ist `tor` zu hoch, gilt nichts als Bewegung. Dann gibt es keinen
> Punkt, keine Strecke, keine Karte, keinen speicherbaren Lauf — und die
> Oberfläche meldet „Kein GPS-Signal", obwohl der Empfänger auf vier Meter
> genau weiß, wo man steht.

Genau das ist am 21.08.2026 passiert. Der Ruhepegel hatte Gehgeschwindigkeiten
gelernt (Proben von 1,46 · 1,86 · 1,07 m/s im Gerätespeicher), das Tor lag
darüber, und **die App war blind bei perfektem Empfang.**

**Es gibt heute keinen zweiten Weg.** Fällt Zeile 5 falsch aus, gibt es nichts,
was das auffängt.

---

## 3. Die Fehlerart — und wo sie sonst noch lauert

> **Ein Teil, das über sich selbst entscheidet, braucht eine Grenze, die es
> nicht überschreiten kann.**

Der Ruhepegel misst, wie ruhig das Gerät im Stand ist, und hebt danach seine
eigene Schwelle. Ohne Deckel kann er sie über jede erreichbare Geschwindigkeit
heben und sich selbst abschalten. Ein Ruhepegel von 1,86 m/s ist **kein
rauschendes Gerät, sondern eine kaputte Messung** — kein Empfänger rauscht mit
Gehgeschwindigkeit.

Dieselbe Bauart steckt an drei weiteren Stellen:

| Stelle | Entscheidet über sich selbst | Deckel? | Zustand |
|---|---|---|---|
| **Ruhepegel** | seine eigene Schwelle | **nein** | **gebrochen** |
| **Güte-Filter** | ob Tempo zählt (Schwelle 1,0 an einem Gerät geeicht) | nein | droht |
| **Messquellen-Umschaltung** | welche Quelle gilt | nein | droht, noch nicht gebaut |
| **Bewegungserkennung** | wann sie zurück in Bewegung darf | ja (Mindestweg) | in Ordnung |

Die vierte Zeile zeigt, wie es aussieht, wenn es stimmt: Der Weg zurück in die
Bewegung hängt an einer Größe, die das Modul **nicht selbst erzeugt** — dem
tatsächlichen Abstand zum Haltepunkt.

---

## 4. Der Messquellen-Entwurf, geprüft

Das Umschalten Einlage → Uhr → Telefon ist **noch nicht gebaut**. Geprüft wurde
der Entwurf in [messquellen.md](messquellen.md) Abschnitt 5, mit genau der
Frage: Kann er flattern, Fehlermeldungen erzeugen oder etwas mitreißen?

**Sechs Lücken, jede mit dem, was fehlt:**

| # | Lücke | Was passieren kann | Was fehlt |
|---|---|---|---|
| 1 | „einige aufeinanderfolgende Meldungen" ist Prosa, keine Zahl | Zwei Umsetzungen, zwei Verhalten | **Drei** Meldungen in Folge, innerhalb von 5 s |
| 2 | Keine Obergrenze für die Zahl der Wechsel | Wackelige Verbindung → Dutzende Nähte in einem Lauf | Höchstens **ein Wechsel je 30 s**; danach bleibt die schlechtere Quelle bis zum Laufende |
| 3 | Die Übergangszeit ist nicht benannt | 5–10 s, in denen niemand liefert — zählen sie als Bewegung? | Sie zählen als **Lücke**, wie bei `MAX_LUECKE_S` |
| 4 | Kein Wort über Ausnahmen | Ein Fehler im Einlagen-Treiber beendet die Aufzeichnung | Eine Ausnahme heißt **„liefert nichts"**, nie Absturz — wie in `aufzeichnungBruecke.ts` |
| 5 | Kein Zustandsautomat, nur Prosa | Grenzfälle entstehen beim Programmieren statt beim Entwerfen | Vier Zustände als **reine Funktion**, testbar wie `bewegungFortschreiben` |
| 6 | **Unklar, ob eine fehlende Quelle die Aufzeichnung anhält** | Genau der Fehler von heute, nur mit mehr Beteiligten | Siehe unten — die wichtigste Regel |

### Die Regel, die aus dem heutigen Fehler folgt

> **Strecke und Zeit hängen allein am GPS. Keine andere Quelle darf sie
> blockieren.**
>
> Einlage, Uhr und Telefonsensoren **ergänzen** die Aufzeichnung. Sie dürfen
> Merkmale liefern, die es sonst nicht gäbe. Sie dürfen niemals dazu führen,
> dass ein Lauf **weniger** aufgezeichnet wird als ohne sie.

Ohne diese Regel gilt: Je mehr Quellen, desto mehr Wege, alles anzuhalten. Mit
ihr kann jede neue Quelle nur hinzufügen.

**Kein Absturzrisiko im engeren Sinn** — die vorhandene Bauart fängt Fehler
bereits ab. Aber Lücke 2 und 6 sind echte Betriebsrisiken, und beide sind heute
im Entwurf nicht ausgeschlossen.

---

## 5. Der Reparaturplan

In dieser Reihenfolge, und für jeden Schritt steht daneben, **was er nicht
kaputt machen darf**.

| # | Schritt | Darf nicht kaputtgehen | Wie geprüft |
|---|---|---|---|
| **1** | **Deckel für Ruhepegel-Proben.** Eine Probe über 0,6 m/s ist kein Stillstandsrauschen und wird nicht aufgenommen. Zusätzlich das Tor deckeln. | Die Drift-Abwehr vom 20.08.: stehendes Telefon, 30 min, unter 100 m | Der vorhandene Simulationstest — er muss grün bleiben |
| **2** | **Schlüssel `v1` → `v2`.** Die verdorbenen Proben verfallen auf allen Geräten. | Nichts; ein neuer Pegel lernt sich in einem Lauf ein | Sichtprüfung am Gerät |
| **3** | **Karte ehrlich machen.** „Kein GPS-Signal" nur ohne Messung; sonst „Noch keine Bewegung erkannt". | Die echte Kein-Signal-Meldung drinnen | Beide Fälle am Gerät |
| **4** | **Notausgang.** Kommen 60 s lang Messungen mit guter Genauigkeit und gilt nichts als Bewegung, fällt das Tor auf 0,9 zurück und die App sagt es. | Darf nicht selbst zum Drift-Einfallstor werden — deshalb nur bei **guter** Genauigkeit | Neuer Test: Drift bei schlechter Genauigkeit löst ihn **nicht** aus |
| 5 | `stehtStill` zusätzlich am zurückgelegten **Weg** messen, nicht nur an der Verschiebung | Die Stillstandserkennung selbst | Vorhandene Tests |
| 6 | Die sechs Lücken oben in `messquellen.md` schließen — **bevor** gebaut wird | — | — |

**1 bis 3 machen die App wieder benutzbar.** 4 fängt den nächsten unbekannten
Fall dieser Art. 5 verhindert den Rückfall. 6 verhindert, dass dieselbe
Fehlerart mit der Einlage wiederkommt.

---

## 6. Woran wir merken, dass nichts anderes gebrochen ist

Die Suite allein reicht nicht — sie war **grün, während die App blind war**.
Kein Test bemerkte, dass bei perfektem Empfang nichts aufgezeichnet wird.

**Das ist die eigentliche Lücke:** Es gibt Tests für jede Regel einzeln und
keinen für die Kette. Deshalb gehört dazu:

| Prüfung | Beantwortet |
|---|---|
| Stehendes Telefon, 30 min | Zählt Rauschen als Strecke? *(vorhanden)* |
| Echter Lauf, 2 km | Kommt die Strecke an? *(vorhanden)* |
| **Gehen mit verdorbenem Ruhepegel** | Blockiert eine gelernte Zahl die Aufzeichnung? **(fehlt)** |
| **Gute Genauigkeit, kein Punkt in 60 s** | Greift der Notausgang? **(fehlt)** |
| Draußen, Bildschirm aus | Hält die ganze Kette? *(nur am Gerät)* |

Die beiden fehlenden Prüfungen entstehen mit Schritt 1 und 4. Beide beschreiben
**das Zusammenspiel**, nicht einen Baustein — und genau dort war die Lücke.
