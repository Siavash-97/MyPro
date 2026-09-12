# Ein Lauf ohne Netz — Entwurf

**Stand 29.08.2026 · Entwurf, nichts davon gebaut · Entscheidungen offen**

Dieser Entwurf fasst drei Dinge zusammen, die der Nutzer ausdrücklich **als
einen** behandelt sehen will:

1. **Der Wurzelfund** — ein ohne Netz gestarteter Lauf legt seine Punkte
   nirgends dauerhaft ab.
2. **Die Sichtbarkeits-Frist** — „großzügige stille Nachholfrist, aber nach
   etwa einem Tag sichtbar für den Nutzer markieren statt endlos still."
3. **Ein Verbraucher für `bestaetigt`** — er löst die verfrühte Navigation
   ins Trainingstagebuch, aus der die Fremdschlüsselverletzung entsteht.

Sie hängen an derselben Wurzel. Getrennt gebaut, würde dieselbe Stelle
dreimal angefasst.

---

## 1. Der Befund, in einem Satz

**`startRun` hat genau einen Schuss auf die `runs`-Zeile — und an dieser
einen Zeile hängt, ob der Lauf überhaupt dauerhaft gespeichert wird.**

Nachgemessen am Quelltext, nicht erinnert:

```
run.ts:848-862   startRun: EIN insert, ohne Fehlerbehandlung, ohne
                 Wiederholung. Nur bei Erfolg: activeRunId + merkerLaufId.
run.ts:1588      addPoint puffert NUR `if (runId)` mit
                 runId = get().activeRunId.
run.ts:1893      punkteEinsammeln reicht an addPoint - und quittiert
                 danach beim Dienst. Quittieren heisst dort loeschen.
```

Daraus folgt die Kette, die niemand geschrieben hat und die trotzdem gilt:

```
Kein Netz in der einen Sekunde des insert
  -> activeRunId bleibt den GANZEN Lauf null
  -> addPoint puffert nie
  -> die einzige dauerhafte Ablage ist der Dienstspeicher auf dem Telefon
  -> stopRun holt ihn ab UND quittiert ihn (= loescht ihn)
  -> ab da leben die Punkte nur noch im Arbeitsspeicher
```

**Das trifft auch den geglückten Abschluss.** Ein solcher Lauf bekommt eine
`runs`-Zeile mit Strecke, Dauer und Höhenmetern — und **null**
`run_points`. Die Karte ist leer, die Strecke steht als Zahl da.

Der Kommentar bei `run.ts:1255` behauptet das Gegenteil: `sitzungId` sei
„die Kennung, unter der diese Aufzeichnung gepuffert hat". Es gibt keinen
Aufrufer, der je unter `sitzungId` puffert — `punktMerken` hat genau zwei
Aufrufstellen, und beide setzen `activeRunId` voraus.

**Die Adoptionsschleife bei `run.ts:1269` ist damit toter Code** für den
Fall, für den sie geschrieben wurde. Sie greift nur noch für Punkte eines
*früheren* Laufs, der eine Zeile hatte.

## 2. Warum das nicht die Schuld der Dateilänge ist

`store/run.ts` hat 2.000 Zeilen, und ein Lauf von
`/improve-codebase-architecture` ist überfällig. **Aber er hätte diesen
Fehler nicht gefunden**, und darum steht er nach diesem Entwurf, nicht
davor.

Der Fehler ist eine **Verteilungsfrage**, keine Gliederungsfrage: Was
passiert, wenn eine Bestätigung ausbleibt? Die `if (runId)`-Lücke wäre in
einer sauber geschnittenen Datei genauso übersehen worden — sie steht nicht
im Weg, sie sieht richtig aus.

Und ein Schnitt jetzt liefe Gefahr, an der falschen Stelle zu schneiden:
Wo die dauerhafte Pufferung und der `bestaetigt`-Verbraucher hingehören,
entscheidet erst dieser Entwurf.

## 3. Die Zustände, die eine Aufzeichnung heute haben kann

Die `abgebrochen`-Zustandsmaschine hat diese Genauigkeit vorgemacht; hier
dieselbe für die **Lauf-Zeile**, weil dort das Loch sitzt.

| Zustand | `activeRunId` | `runs`-Zeile | Merker | Punkte dauerhaft? |
| --- | --- | --- | --- | --- |
| **N1** Start mit Netz, läuft | gesetzt | `tracking` | `{S, runId}` | ja, IndexedDB |
| **N2** Start ohne Netz, läuft | **null** | — | `{S, null}` | **nur Dienstspeicher** |
| **N3** N2, Netz kommt zurück | **null** | — | `{S, null}` | **nur Dienstspeicher** |
| **N4** beendet, Zeile geschrieben | gesetzt | `completed` | weg | ja |
| **N5** beendet, Zeitgrenze, Zeile existierte | gesetzt | `tracking` | weg | ja |
| **N6** beendet, Zeitgrenze, Zeile fehlte | gesetzt¹ | — | liegt | **nirgends** |

¹ seit Stufe 4 auf `bestaetigenId` gesetzt, obwohl die Zeile nicht steht —
siehe Entwurfsfrage 1.

**N3 ist der Zustand, den niemand vorgesehen hat.** Das Netz ist zurück,
aber nichts holt die Zeile nach; die Aufzeichnung bleibt bis zum Ende in
N2. **N6 ist der Zustand, in dem Daten verloren gehen.**

## 4. Die Wurzel unter der Wurzel: zwei Namensräume für dieselbe Sache

```
startRun   insert({...}).select('id')     -> Kennung kommt vom SERVER
stopRun    upsert({ id: neueId, ...})     -> neueId = sitzungId, vom GERÄT
```

Dieselbe Zeile, zwei Herkünfte. Solange der Start gelingt, fällt es nicht
auf. Sobald er scheitert, muss irgendetwas die beiden Welten verbinden —
und genau dieses Verbindungsstück (die Adoptionsschleife) läuft heute leer.

**Jede Lösung, die die zwei Namensräume bestehen lässt, braucht dieses
Verbindungsstück wieder.** Deshalb steht die Frage nach der Kennung am
Anfang und nicht am Ende.

---

# Entwurfsfragen

Jede mit Optionen, Kosten und einer Empfehlung. **Entschieden ist nichts.**

## F1 — Woher kommt die Lauf-Kennung?

**A1 — bleibt servergeneriert, Punkte werden unter `sitzungId` gepuffert
und später umgeschrieben.** Die Adoptionsschleife wird endlich benutzt.
*Kosten:* Die zwei Namensräume bleiben, mit ihnen das Umschreiben und
dessen Wettlauffenster. Und `run_id` im Puffer bedeutet dann mal eine
Sitzung, mal einen Lauf — genau die Doppeldeutigkeit, die uns diese Woche
zweimal getroffen hat.

**A2 — das Gerät vergibt die Kennung immer.** `sitzungId` *ist* bereits
eine UUID; `startRun` schreibt `insert({ id: sitzungId, … })`.
*Folge:* ein Namensraum. `addPoint` kann ab der ersten Sekunde puffern, die
Adoptionsschleife entfällt ersatzlos, `stopRun`s `upsert` trifft denselben
Schlüssel.
*Kosten:* `runs.id` hat `default gen_random_uuid()` — ein ausdrücklicher
Wert ist erlaubt, **keine Migration nötig**. Aber: `activeRunId` beantwortet
heute **zwei** Fragen zugleich („welcher Lauf?" und „steht die Zeile?").
Setzt man sie ab Sekunde null, ändert sich die Bedeutung von
`vorhandeneId` in `stopRun` — und das ist die Weiche zwischen `update` und
`upsert`.

➡️ **Empfehlung: A2, aber mit einem getrennten Merkmal `zeileSteht`.**
Ein Feld, das zwei Fragen beantwortet, ist genau der Fehler, der Stufe 4 in
die Irre geführt hat (`anzahl()`: Anzeigezahl und Steuerzahl in einer Zahl,
Bericht vom 28.08.). Die Weiche `update`/`upsert` hängt dann an
`zeileSteht`, nicht an `activeRunId`.

**Sicherheitsfrage, die `sicherheit` beantworten muss, bevor A2 gebaut
wird:** Eine vom Gerät gewählte Primärkennung erlaubt es, eine Kennung zu
*raten*. Die Zeilenrechte binden `user_id = auth.uid()`, ein fremder Treffer
scheitert also am Besitz — aber ein `upsert` auf eine geratene fremde
Kennung ist ein anderer Weg als ein `insert`. **Diese Aussetzung besteht
bereits heute** (`stopRun` macht genau das seit dem 24.08.), sie wird durch
A2 nur häufiger. Sie ist nicht neu, aber sie ist ungeprüft.

## F2 — Was schützt die Sendeschleife vor dem Fremdschlüssel?

Sobald immer gepuffert wird, liegen Punkte im Puffer, deren `runs`-Zeile
noch nicht existiert. `offeneSenden()` läuft alle 30 Sekunden und würde sie
mitschicken: `run_points.run_id` ist `not null references runs(id)`
(0008:44) → **23503**, und `punkteSenden.ts:192` hört beim ersten Fehler
auf.

*Das ist genau die Blockade, die ich am 16:20 fälschlich als bestehend
beschrieben habe. Sie besteht heute nicht — aber F1/A2 würde sie
erschaffen.* Sie gehört deshalb in denselben Entwurf.

**B1 — nur senden, wenn `zeileSteht`.** Einfach.
*Kosten:* `offeneSenden()` ist lauf-**global**; eine Sperre müsste je Punkt
oder je `run_id` greifen, nicht global, sonst hält ein wartender Lauf die
Punkte eines fertigen auf.

**B2 — `offeneSenden` hält bei einem dauerhaften Fehler nicht an**, sondern
macht weiter und meldet ihn in `punkteFehler`.

> **Richtiggestellt am 31.08.2026 beim Bauen.** Hier stand „überspringt
> dauerhaft abgewiesene **Bündel**", mit der Begründung, ein Bündel fasse
> 500 Punkte. **Beide Angaben waren falsch.** `BUENDEL` in
> `lib/punkteSenden.ts` ist **200** — ich hatte die Java-Konstante erinnert,
> statt die TypeScript-Konstante nachzusehen. Und bündelweise zu
> überspringen ist zu grob: Es liesse bis zu 199 gute Punkte für einen
> schlechten liegen, und zwar bei **jedem** Versuch aufs Neue, weil die
> Reihenfolge stabil ist. Gebaut ist deshalb **einzelnes Nachfassen** —
> siehe `Agent-Reports6-08-31_0855_...`, Regelabweichung 1.
*Nutzen:* löst zugleich den offenen Befund vom 28.08. („ein abgewiesener
Punkt blockiert die Übertragung dauerhaft").

➡️ **Empfehlung: B1 und B2 zusammen.** B1 verhindert den Normalfall, B2
fängt den Ausnahmefall — und B2 ist ohnehin fällig.

## F3 — Wer holt die Zeile nach, wenn der Start ohne Netz war?

**C1 — der 30-Sekunden-Takt versucht es, solange die Zeile fehlt.**
Derselbe Takt, der ohnehin läuft (`punkteUebertragen`). Verkürzt das
Fenster von „der ganze Lauf" auf „bis zum nächsten Takt mit Netz" und macht
aus Zustand N3 einen Übergang statt einer Sackgasse.
*Kosten:* ein Schreibversuch alle 30 s, solange kein Netz da ist. Er
scheitert billig und lokal.

**C2 — erst am Ende, wie heute.** Kein Aufwand, aber der gesamte Lauf hängt
an einem einzigen Schreibversuch im ungünstigsten Moment: dem Beenden.

➡️ **Empfehlung: C1.** Es ist die Änderung mit dem besten Verhältnis von
Aufwand zu Wirkung im ganzen Entwurf — und sie macht F4 seltener nötig.

## F4 — Der Verbraucher von `bestaetigt`

Heute liest ihn niemand (`LiveTracking.tsx:496` zerlegt nur
`{ runId, error, art }`). Bei `art: null` wird navigiert:

```
navigate(`/training/tagebuch?from=tracking&lauf=${runId}`)
   -> TrainingDiary.tsx:85  createEntry({ run_id: laufKennung, … })
   -> fk_diary_run (0008:76-82)  ->  23503, der Eintrag ist weg
```

**D1 — bei `bestaetigt === false` ohne `lauf`-Parameter navigieren.** Der
Eintrag hängt dann nur am Datum — ein Rückschritt gegenüber heute, aber
kein Fehler und kein Verlust.

**D2 — den Tagebuch-Schritt überspringen und zur Zusammenfassung.** Nimmt
dem Menschen etwas weg, wofür er nichts kann.

**D3 — die Verknüpfung nachtragen, sobald bestätigt ist.** Sauber, aber es
braucht einen Ort, an dem der unverknüpfte Eintrag wartet.

➡️ **Empfehlung: D1 jetzt, D3 als eigene spätere Frage.** D1 ist zwei
Zeilen und schließt einen echten Datenverlust; D3 ist Komfort.

## F5 — Die Sichtbarkeits-Frist

Deine Richtung: großzügig still, nach etwa einem Tag sichtbar markieren.

**E1 — ableiten, nicht speichern.** Eine Zeile auf `tracking`, deren
`started_at` älter als 24 Stunden ist, wird im Verlauf als „nicht
abgeschlossen" gezeigt.
*Vorteil:* **keine Migration**, und die Markierung kann nicht veralten —
sie ist eine Frage an die Daten, kein zweiter Zustand daneben.

**E2 — ein neuer Wert im Enum `run_status`** (`tracking, paused, completed,
abandoned`).
*Kosten:* Migration, ein weiterer Zustand in jeder Abfrage, und er muss
gesetzt **und** wieder entfernt werden — zwei neue Wege, auf denen etwas
hängenbleiben kann.

➡️ **Empfehlung: E1.** Die Woche hat zweimal gezeigt, was ein gespeicherter
Zustand kostet, der nicht zurückgesetzt wird.

**Der lokale Fall bleibt davon unberührt:** Wenn gar keine Zeile existiert
(N6), sieht der Verlauf nichts. Diesen Fall trägt der Merker, und
`Startbergung` ist der Ort, an dem er sichtbar würde. **Das ist die eine
Stelle, an der dieser Entwurf noch keine ausgearbeitete Antwort hat.**

---

## Was dieser Entwurf ausdrücklich nicht löst

- **Die geräteübergreifende Unterscheidung.** Eine `tracking`-Zeile kann
  weiterhin dreierlei heißen. Vom Nutzer am 29.08. zurückgestellt; F5/E1
  ändert daran nichts, es macht sie nur sichtbar.
- **Hintergrundarbeit ohne offene App.** `bestaetigungNachholen` stirbt mit
  der App. Ein `WorkManager`-Weg wäre eine eigene, größere Runde.
- **Die 30-Sekunden-Grenze in `supabase.ts`** ist weiterhin gewählt, nicht
  gemessen.

## Reihenfolge, wenn entschieden ist

Jeder Schritt für sich lauffähig und einzeln prüfbar:

| | Schritt | Prüfbar durch |
| --- | --- | --- |
| 1 | **F4/D1** — `bestaetigt` lesen, Navigation entschärfen | roter Test: FK-Fehler im Tagebuch nach Zeitgrenze |
| 2 | **F2/B2** — Sendeschleife überspringt statt anzuhalten | roter Test mit 23503 vorn in der Schlange |
| 3 | **F1/A2 + `zeileSteht`** — ein Namensraum | roter Test: Punkte eines netzlos gestarteten Laufs landen in `run_points` |
| 4 | **F3/C1** — Zeile im Takt nachholen | roter Test: N3 wird zu N1 |
| 5 | **F5/E1** — Markierung im Verlauf | reine Funktion, `/tdd` |

**Schritt 1 und 2 schließen je einen bekannten Datenverlust und hängen an
keiner der offenen Fragen.** Sie könnten vorgezogen werden, falls die
Entscheidung zu F1 länger braucht.

**Kein Migrationsbedarf** — bei A2/E1 kommt der Entwurf ohne aus. Das ist
kein Zufall, sondern ein Auswahlkriterium gewesen.

## Was vor dem Bauen noch fehlt

- **Deine Entscheidungen zu F1 bis F5.**
- **`sicherheit`** zur gerätevergebenen Primärkennung (F1/A2) — vor dem
  Bauen, nicht danach.
- **Eine Antwort für N6 in `Startbergung`** (siehe F5).
- **Ein Gerätetest**, der überfällig ist: Seit dem 28.08. ist nichts mehr am
  Telefon gelaufen.
