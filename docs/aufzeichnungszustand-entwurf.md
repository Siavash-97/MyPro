# Der Zustand einer Aufzeichnung — Entwurf

**Stand 31.08.2026 · Entwurf, nichts davon gebaut · alle Entwurfsfragen
entschieden**

Kandidat 1 aus der Architektur-Durchsicht vom 31.08.2026. Die Entscheidungen
darin sind in vier Befragungsrunden gefallen und stehen als solche unten;
dieser Entwurf schreibt sie zusammen, damit vor dem Bauen an einer Stelle
steht, was gebaut wird.

---

## 1. Der Befund

Vier Felder in `store/run.ts` beschreiben zusammen **einen** Begriff — in
welchem Zustand eine Aufzeichnung ist:

```
phase          'idle' | 'tracking' | 'paused' | 'saving' | 'completed' | 'abgebrochen'
activeRunId    string | null
sitzungId      string | null
zeileSteht     boolean
```

Nachgezählt: **25 Schreibstellen aus sechs Zuständigkeiten**, keine davon
prüft die Gültigkeit der Kombination. Darstellbar sind `6 × 2 × 2 × 2 = 48`
Zustände; gültig ist ein Bruchteil.

**Was das im August 2026 gekostet hat, mit Datum:**

| Datum | Feld | Zwei Fragen in einem | Folge |
| --- | --- | --- | --- |
| 28.08. | `anzahl()` | Anzeigezahl **und** Abbruchbedingung | Einsammelschleife hätte zu früh aufgehört |
| 31.08. | `bestaetigt` | Bestätigung **und** Existenz der Zeile | Tagebuch-Verknüpfung verloren |
| 31.08. | `activeRunId` | Kennung **und** Existenz | `update` auf eine nie angelegte Zeile |
| 31.08. | `zeileSteht` | drei Setzstellen, eine Rückstellstelle | **der zweite Lauf jeder App-Sitzung wäre verloren gewesen** |

Der letzte fand sich nicht durch einen Test, sondern durch die Frage nach der
Struktur: *Welche Felder werden von mehr als einer Zuständigkeit
geschrieben?*

## 2. Die Entscheidungen

Alle in vier Runden getroffen, hier als Nachweis, nicht als Vorschlag.

| | Frage | Entscheidung |
| --- | --- | --- |
| Q1 | Produkt aus Feldern oder Summe aus Lagen? | **Summe** |
| Q2 | Merker hinter die Naht? | **Ja**, und `runId` wird zum Existenz-Bit |
| Q3 | `abgebrochen` als Lage oder Merkmal? | **Lage** |
| Q4 | Dienst mit hinter die Naht? | **Nein** — das ist Kandidat 2 |
| Q5 | `stoppversuche` dazu? | **Ja** |
| Q6 | Naht kann nicht rein sein, wenn der Merker dahinterliegt | **Zwei Schichten:** reine Übergangsfunktion, dünne Hülle |
| Q7 | `abgeschlossen` ohne bestätigte Zeile? | **Eigene Lage**, kein Merkmal |
| Q8 | Ein Feld im Store oder vier abgeleitete? | **Vier abgeleitete, als Zwischenschritt mit Ablaufdatum** |
| Q9 | Alte Merker von vor dem 31.08.? | **Lesepfad**, nicht verwerfen |
| Q10 | Tests in einem Zug oder mitwachsend? | **In einem Zug** |
| Q11 | Name der Lage aus Q7 | **`abgeschickt`** |
| Q12 | `dauerhaftGescheitert` — Lage oder Merkmal? | **Lage** |
| Q13 | Name dafür | **`nicht angekommen`** |
| Q14 | Was geschieht dann? | **Still bis zum nächsten Start** (Anzeige später) |
| Q15 | Schreibt `bestaetigungNachholen` den Zustand? | **Ja, über einen Übergang** |

**Die Regel hinter Q3, Q7 und Q12** steht seit heute in
`DEVELOPMENT_STANDARDS.md`:

> Zwei Lagen, wenn ein **Aufrufer** sich unterschiedlich verhalten muss.
> Ein Merkmal, wenn nur die Übergangsfunktion selbst es liest.

## 3. Die Lagen

```ts
type Aufzeichnungszustand =
  | { art: 'ruht' }
  | { art: 'zeichnet auf';  sitzung: string; zeileSteht: boolean; stoppversuche: number }
  | { art: 'pausiert';      sitzung: string; zeileSteht: boolean; stoppversuche: number }
  | { art: 'speichert';     sitzung: string; zeileSteht: boolean; stoppversuche: number }
  | { art: 'abgebrochen';   sitzung: string; zeileSteht: boolean; stoppversuche: number }
  | { art: 'abgeschickt';   lauf: string }
  | { art: 'nicht angekommen'; lauf: string }
  | { art: 'abgeschlossen'; lauf: string }
```

**Was der Typ damit verbietet** — und zwar beim Übersetzen, nicht zur
Laufzeit:

- `zeileSteht` in `ruht` (der Fehler von heute Vormittag)
- eine Sitzung ohne Kennung in `zeichnet auf`
- `stoppversuche` in einer abgeschlossenen Lage (die Asymmetrie aus Q5)
- `abgeschlossen` mit unbestätigter Zeile — dafür gibt es `abgeschickt`

**Warum vier Lagen dieselben Felder tragen.** `zeichnet auf`, `pausiert`,
`speichert` und `abgebrochen` unterscheiden sich nicht in den Daten, sondern
darin, **was die Aufrufer tun müssen**: Der Dienst läuft in zweien, in zweien
nicht; die Uhr läuft in einer. Das ist genau der Fall, für den die Regel aus
Q3 „Lage" sagt.

**Die drei Endlagen tragen `lauf` statt `sitzung`.** Seit dem 31.08. ist es
dieselbe Zeichenkette — aber der Name sagt, worüber gesprochen wird: Das
Glossar trennt **Aufzeichnung** (Vorgang) von **Lauf** (Ergebnis), und ab
`abgeschickt` gibt es ein Ergebnis.

## 4. Die Übergänge

Vollständig. Was hier nicht steht, ist kein gültiger Weg.

| Ereignis | von | nach | Auslöser heute |
| --- | --- | --- | --- |
| `beginnt(sitzung)` | `ruht`, `abgeschlossen`, `nicht angekommen` | `zeichnet auf` (zeileSteht: false, stoppversuche: 0) | `startRun` |
| `zeileEntstanden` | `zeichnet auf`, `pausiert` | dieselbe Lage, `zeileSteht: true` | `zeileNachziehen` |
| `zeileEntstanden` | `speichert` | dieselbe Lage, `zeileSteht: true` | **ein `zeileNachziehen`, das waehrend des Beendens landet** — siehe unten |
| `pausiert` | `zeichnet auf` | `pausiert` | `pauseRun` |
| `fortgesetzt` | `pausiert` | `zeichnet auf` | `resumeRun` |
| `beendenBegonnen` | `zeichnet auf`, `pausiert`, `abgebrochen` | `speichert` | `stopRun` |
| `zuKurz` | `speichert` | `ruht` | `istSpeicherwuerdig` false |
| `gespeichert(lauf)` | `speichert` | `abgeschlossen` | Schreiben bestätigt |
| `abgeschicktOhneAntwort(lauf)` | `speichert` | `abgeschickt` | Zeitgrenze beim Schreiben |
| `nachholenGelungen` | `abgeschickt` | `abgeschlossen` | `bestaetigungNachholen`, Erfolg |
| `nachholenAufgegeben` | `abgeschickt` **mit `zeileSteht: false`** | `nicht angekommen` | dauerhafter Fehlercode — ⚠️ siehe unten |
| `speichernGescheitert(wiederholbar)` | `speichert` | `zeichnet auf` / `pausiert` | `abbruchUndWeiterAufzeichnen` |
| `speichernGescheitert(dauerhaft)` | `speichert` | `abgebrochen` | `istDauerhaft` |
| `verworfen` | jede | `ruht` | `discardRun`, `reset` |
| `geborgen(sitzung, zeileSteht)` | `ruht` | `zeichnet auf` | `verwaisteAufzeichnungBergen` |

> ⚠️ **Diese Zeile weicht seit dem 02.09.2026 von der Freigabe ab, und die
> Abweichung ist noch nicht entschieden.**
>
> Freigegeben war die Bedingung ohne Einschränkung: „dauerhafter
> Fehlercode". Gebaut ist sie **enger** — nur aus `abgeschickt` mit
> `zeileSteht: false`.
>
> **Grund:** `bestaetigungNachholen` bedient zwei Wege. Auf dem
> `update`-Weg existiert die `runs`-Zeile seit `startRun`. `nicht
> angekommen` behauptet „es gibt keine Zeile" und lässt `ableiten`
> `activeRunId: null, zeileSteht: false` setzen — dort also eine
> Behauptung statt einer Auskunft. Ein dauerhafter Fehlercode beweist, dass
> **dieser Schreibvorgang** nicht durchkommt, nicht dass die Zeile fehlt.
>
> **Gemessene Folge der freigegebenen Fassung:** `punkteUebertragen` sperrt
> bei `!zeileSteht` die gepufferten Punkte genau dieses Laufs von der
> Übertragung aus, obwohl der Fremdschlüssel greifen würde. Roter Test:
> `bergung.test.ts`, „sperrt die eigenen Punkte nicht aus, wenn die Zeile
> existiert".
>
> **Offen:** Entweder wird diese Bedingung im Entwurf bestätigt — dann ist
> die Tabelle hiermit nachgezogen — oder der Code wird zurückgebaut. Bis
> dahin ist die Zeile **nicht** die Freigabe, sondern die Beschreibung des
> gebauten Stands mit ausgewiesener Abweichung. Fehlerbericht:
> `Fehler und Bug Reports6-09-01_2035_eine-stunde-lang-log-der-bildschirm.md`,
> Nachtrag vom 02.09.

**Drei Übergänge gibt es heute nicht und sie sind der Gewinn:**

- `nachholenGelungen` und `nachholenAufgegeben` — `bestaetigungNachholen`
  enthält heute **kein einziges `set()`**. Der Bildschirm zeigt einen
  fertigen Lauf, während der Merker „dauerhaft gescheitert" trägt. Siehe
  Abschnitt 8.
**Und einer ist nur über einen Wettlauf erreichbar — nachgemessen am
31.08.2026:**

`zeileNachziehen` liest die Wache **einmal vor** dem Netzaufruf
(`run.ts:954-956`) und schreibt **danach ohne erneute Prüfung**
(`run.ts:971`). Setzt `stopRun` in dieser Zeit `phase: 'saving'`, läuft der
Aufruf trotzdem zu Ende und schreibt.

Die Fortsetzung: `stopRun` liest die Weiche einmal
(`vorhandeneId = get().zeileSteht ? … : null`) und rechnet danach mit dem
alten Wert weiter — nimmt also den `upsert`-Zweig für eine Zeile, die
inzwischen existiert.

**Schaden heute: keiner**, und woran das gemessen ist: Der `upsert` trägt
dieselbe Kennung wie die eben angelegte Zeile, trifft auf
`ON CONFLICT DO UPDATE` und schreibt die Kennzahlen — derselbe Weg wie im
Regelfall. Die umgekehrte Reihenfolge trägt ebenfalls, weil
`zeileNachziehen` seit dem 31.08. `23505` als Erfolg wertet.

Es trägt also **aus Gründen, die an drei Stellen zufällig zusammenpassen** —
nicht, weil jemand den Fall vorgesehen hätte. Deshalb steht der Übergang in
der Tabelle, und deshalb bekommt er in Schritt 1 einen **eigenen Test**: Ein
Übergang, der nur über einen Wettlauf erreichbar ist, ist der
wahrscheinlichste Kandidat dafür, beim Umbau verlorenzugehen.

## 5. Wo die Naht liegt

Zwei Schichten, weil eine nicht geht (Q6):

```
lib/aufzeichnungszustand.ts        REIN, keine Wirkung nach aussen
  naechsterZustand(jetzt, ereignis) -> Aufzeichnungszustand
  merkerAus(zustand)                -> Laufmerker | null
  merkerZu(merker)                  -> Aufzeichnungszustand      (Q9)

store/run.ts                        die duenne Huelle
  uebergang(ereignis)  =  set(ableiten(naechsterZustand(...)))
                          + Merker schreiben aus merkerAus(...)
```

**Der Merker wird abgeleitet, nicht gepflegt.** Aus der Lage folgt
eindeutig, was im Gerätespeicher stehen muss:

| Lage | Merker |
| --- | --- |
| `ruht`, `abgeschlossen` | keiner |
| `zeichnet auf`, `pausiert`, `speichert` | `{ sitzung, zeileSteht }` |
| `abgebrochen`, `nicht angekommen` | `{ sitzung, zeileSteht, dauerhaftGescheitert: true }` |
| `abgeschickt` | `{ sitzung: lauf, zeileSteht }` |

Damit verschwinden die **10 verstreuten Merker-Aufrufe** über fünf
Zuständigkeiten. Und die zwei Wahrheiten aus Q2 können nicht mehr
auseinanderlaufen, weil es nur noch eine gibt.

`Laufmerker.runId` wird zu `zeileSteht: boolean` — das ist es heute schon:
Beide Schreibstellen (`run.ts:871`, `973`) übergeben dieselbe Kennung wie
`sitzungId`, das Feld sagt nur noch *dass* die Zeile existiert, und
`run.ts:1879` liest es bereits so.

**Der Lesepfad für alte Merker** (Q9): Trägt ein gespeicherter Merker eine
`runId`, die sich von `sitzungId` unterscheidet, stammt er von vor dem
31.08. Dann gilt `zeileSteht: true`, und die alte `runId` wird als
Lauf-Kennung übernommen. Vier Zeilen in `merkerZu`.

## 6. Der Zwischenschritt — und sein Ablaufdatum

Q8 hat entschieden: Das eine Feld ist die Wahrheit, die vier bleiben als
**abgeleitete Lesefelder** stehen, nur noch aus einer Stelle geschrieben.

```
aufzeichnung: Aufzeichnungszustand     <- die Wahrheit, einziger Schreibweg
phase, activeRunId, sitzungId, zeileSteht   <- abgeleitet, nur lesen
```

Das halbiert den Umbau: Die 25 Schreibstellen verschwinden sofort,
`LiveTracking.tsx` und die übrigen Leser bleiben unberührt.

> **Der Preis, ausdrücklich:** Für die Dauer des Zwischenschritts gibt es
> wieder **zwei Darstellungen desselben Zustands** — genau das Muster, das
> dieser Umbau abschafft. Es trägt nur, weil die Ableitung an einer Stelle
> liegt und rückwärts nicht geschrieben werden darf.

**Folgeauftrag F1 — Ablaufdatum.** Die vier Lesefelder entfallen, sobald
alle Leser die Lage fragen. Betroffen sind nach heutiger Zählung
`LiveTracking.tsx`, `Startbergung.tsx`, `RunSummary.tsx`, `RunDetail.tsx`.
**Solange F1 offen ist, gilt der Umbau als unvollständig** — nicht als
fertig mit Restarbeit.

## 7. Was am Testbestand geschieht

Erhoben, nicht geschätzt: **21 von 28** Tests in `bergung.test.ts` fassen
mindestens eines der vier Felder direkt an, 13 davon setzen sie im Aufbau.
Dazu drei in `liveweg.test.ts`, die alle an **einer** Zeile hängen (`:106`).
`run.test.ts` und `abmelden.test.ts` sind nicht betroffen.

Q10 hat entschieden: **alle in einem Zug**. Der Grund steht in der Erhebung
— sieben Tests unterstellen heute Kombinationen, die der Produktivcode seit
dem 31.08. gar nicht mehr erzeugt:

- `tracking` mit `activeRunId = null` (`bergung.test.ts:366`, `:987`)
- `tracking` ganz ohne Kennungsfelder (sieben Stellen)
- `tracking` mit `activeRunId ≠ sitzungId` (die Welt vor A2)

Bei einem mitwachsenden Umbau blieben genau diese stehen. Nach der
Umstellung sind sie **nicht mehr formulierbar** — das ist der Nachweis, dass
die Summe wirkt.

**Neu dazu:** je ein Test für die Übergänge, die es heute nicht gibt
(`nachholenGelungen`, `nachholenAufgegeben`), und eine Probe, dass
`merkerAus` und `merkerZu` zueinander passen.

## 8. Ein Fehler, den dieser Umbau nebenbei behebt

`bestaetigungNachholen` setzt bei einem dauerhaften Fehler
`merkerDauerhaftGescheitert()` und **fasst den Zustand nicht an** — die
Funktion enthält kein einziges `set()`. Nachgemessen am 31.08.

Folge heute: Der Bildschirm zeigt einen fertigen Lauf, der Merker sagt
„dauerhaft gescheitert", und **bis zum nächsten App-Start weiß es niemand.**
Das ist wörtlich der Satz, den der Kommentar drei Zeilen darüber als
verhindert ausgibt — er verhindert ihn für die Schleife, der Zustand lügt
weiter.

Mit `nachholenAufgegeben` (Q15) bekommt die Funktion einen Übergang, den sie
melden kann. **Der Fund bekommt einen eigenen Fehlerbericht, nach der
Behebung.**

## 9. Was dieser Entwurf nicht löst

- **Der Dienst bleibt draußen** (Q4). Jeder Lagewechsel geht heute mit einem
  Dienstbefehl einher, und die Versuchung ist groß, ihn mitzunehmen. Er kann
  scheitern und ist asynchron — das gehört hinter Kandidat 2s Naht, nicht
  hinter diese.
- **Die Anzeige für `nicht angekommen` fehlt** (Q14/B). Die Lage existiert im
  Modell, `Startbergung` liest die Marke beim nächsten Start wie bisher.
  **Folgeauftrag F2:** eine `oberflaeche`-Runde, die den Fall im Verlauf
  sichtbar macht.
- **`stopRun` bleibt 501 Zeilen.** Das ist Kandidat 2.
- **Die Leser bleiben unverändert** — Folgeauftrag F1.

## 10. Reihenfolge

| | Schritt | Prüfbar durch |
| --- | --- | --- |
| 1 | `lib/aufzeichnungszustand.ts` — Lagen, Übergänge, `merkerAus`/`merkerZu` | reine Funktion, `/tdd`, alle Übergangspaare |
| 2 | Hülle im Store; die 25 Schreibstellen werden Übergänge | bestehende Tests müssen grün bleiben |
| 3 | Die 21 + 3 Tests auf die neue Form | rot vor grün je Test |
| 4 | `bestaetigungNachholen` meldet (Q15) | roter Test: dauerhafter Fehler ändert die Lage |
| 5 | Merker-Ableitung ersetzt die 10 Aufrufe | Gegenprobe je Lage |

**Schritt 1 und 2 zusammen ergeben noch kein besseres Verhalten** — sie
verschieben nur, wer schreibt. Der Gewinn steht in Schritt 3 (die falschen
Kombinationen werden unformulierbar) und Schritt 4 (der Fehler aus
Abschnitt 8).

## 11. Was vor dem Bauen noch fehlt

Nichts. Alle fünfzehn Fragen sind entschieden. Was offen bleibt, steht als
Folgeauftrag F1 und F2 in diesem Entwurf und gehört in den Bericht der
Runde, nicht in ihre Umsetzung.
