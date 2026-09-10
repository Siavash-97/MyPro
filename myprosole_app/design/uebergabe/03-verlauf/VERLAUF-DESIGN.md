# Paket 03 — Verlauf

**Vorlage:** `myprosole_app/design/mockups-neue-farben/verlauf.html`
**Zieldatei:** `myprosole_web/src/pages/History.tsx`
**Voraussetzung:** Paket 00 (Fundament) ist abgenommen.

Gemeinsame Farben, Tokens und der Seitenkopf stehen in
[`../00-fundament/FUNDAMENT-DESIGN.md`](../00-fundament/FUNDAMENT-DESIGN.md).

| Screenshot | Zustand |
| --- | --- |
| `screenshots/01-verlauf-hell.png` | helles Thema, Filter „Woche" |
| `screenshots/02-verlauf-dunkel.png` | dunkles Thema |

---

## 1. Die eigentliche Änderung: zwei Kennzahlen wandern nach oben

Heute stehen alle vier Kennzahlen zusammen in einem 2×2-Raster unter den
Filter-Chips. Neu:

```
┌ .md-page-hero ─────────────────────────────────┐
│ MYPROSOLE                     [Thema] [Glocke] │
│ Verlauf                                        │
│ Alle Läufe und Routinen dieser Woche           │
│ 37,3 km        3:59 h                          │  ← die zwei wichtigsten
│ Distanz        Aktive Zeit                     │     Werte in den Kopf
└────────────────────────────────────────────────┘
  [Woche] Monat  Jahr  Alle                        ← Filter-Chips
  ┌ Routinen ──┐ ┌ Übungszeit ─┐                   ← die zwei übrigen
  │    1       │ │  0 Minuten  │                      bleiben als 2er-Raster
  └────────────┘ └─────────────┘
  Diese Woche
  ┌▎Mi., 26. Aug., 11:29                       › │
  │ 0,8 km · 5:53 min · 6:44 min/km              │
  └──────────────────────────────────────────────┘
  … weitere Läufe …
```

**Die Unterzeile im Kopf hängt am Filter.** „Alle Läufe und Routinen dieser
Woche" gilt nur für den Filter „Woche". Es gibt in `History.tsx` bereits
`SECTION_TITLES` und `PERIOD_SUFFIX` je Filter — daran anschließen, nicht neu
erfinden.

Ebenso: Wechselt der Filter, ändern sich die Kennzahlen im Kopf mit.

---

## 2. Filter-Chips

`.md-filter-row` mit vier `.md-filter-chip`: Woche · Monat · Jahr · Alle.
Die Beschriftungen stimmen bereits mit `TIME_LABELS` in `History.tsx` überein.

Der aktive Chip trägt jetzt die **volle Markenfarbe** (`--md-brand`, weiße
Schrift) statt des blassen Tons — die Änderung passiert in Paket 00.

> **Falle:** `.md-filter-row` braucht `min-height: 38px`. `overflow-x: auto`
> setzt sonst die automatische Mindesthöhe des Flex-Kindes auf 0, und die ganze
> Zeile fällt in der Flex-Spalte auf 0 px zusammen. `overflow-y: visible` hilft
> **nicht** — die Spezifikation erlaubt keine gemischten Achsen. Steht in
> Paket 00, hier nur zur Erinnerung.

---

## 3. Die Lauf-Liste

`.md-list-item` **plus `.md-list-item--tint-cyan`** — Cyan, weil Strecke, Zeit
und Tempo Basiswerte sind.

```
┌▎Mi., 26. Aug., 11:29                          › │
│ 0,8 km · 5:53 min · 6:44 min/km                 │
└─────────────────────────────────────────────────┘
 ▲ 4 px Balken #209ACD + auslaufender Verlauf
```

**Eine Ausnahme:** Einträge, die kein Lauf sind (abgeschlossene Trainings-
einheiten), bleiben **ungetönt** und tragen stattdessen eine `__thumb`-Kachel
mit Trainings-Icon:

```
┌ [Icon] Workout · Sa., 22. Aug., 12:32          › │
│        Abgeschlossen · 0 min                     │
└──────────────────────────────────────────────────┘
```

Das ist Absicht: die Tönung sagt „Lauf", die Kachel sagt „Einheit". Farbe ist
hier nicht das einzige Unterscheidungsmerkmal — die Zeile trägt zusätzlich das
Wort „Workout".

---

## 4. Offener Punkt: der Lauf-Score

**Die echte Seite hat einen Score-Ring, das Mockup nicht.**

`History.tsx` zeigt, wenn mindestens ein Lauf einen Score hat:

- eine `.md-card.md-score` mit Ring (96 × 96) und Durchschnittswert
- „Ø Lauf-Score" plus „Aus N Läufen dieser Woche."
- dazu je Lauf ein `.md-score-badge` mit Ampelfarbe (≥ 70 gut, ≥ 50 mittel,
  darunter niedrig)

Das Feld `Run.score` existiert in der Datenbank.

Ich habe den Score im Mockup entfernt, weil er auf der öffentlichen Vorschau
nicht zu sehen war. **Das war eine Beobachtung, keine Entscheidung.**

Drei Möglichkeiten — bitte entscheiden, bevor gebaut wird:

| | Was passiert |
| --- | --- |
| **a) Score bleibt** | Ring und Abzeichen behalten, nur neu einfärben. Dann gehört der Ring unter die Kennzahlen — oder in den Kopf? |
| **b) Score fällt weg** | Ring und Abzeichen entfernen. Dann ist auch zu klären, ob `Run.score` weiter befüllt wird. |
| **c) Score wandert** | Er ist eine Bewertung des Laufs, keine Basisgröße — evtl. gehört er auf die Analyse-Seite statt in die Liste. |

> Falls **a)**: Die Ampelfarben des Abzeichens brauchen einen zweiten Hinweis
> neben der Farbe (Zahl reicht), und **Rot ist tabu** — ein niedriger Score ist
> kein technischer Fehler. Die Palette sieht dafür Bernstein-Töne vor.

---

## 5. Inhalte — was ist echt, was ist Platzhalter

### ✅ Vorhanden

| Anzeige | Quelle |
| --- | --- |
| Filter Woche/Monat/Jahr/Alle | `timeFilter`-Zustand, `TIME_LABELS` |
| Abschnittstitel je Filter | `SECTION_TITLES` |
| Zeitraum-Zusatz („dieser Woche") | `PERIOD_SUFFIX` |
| Distanz gesamt | `totalRunDistanceKm` aus `filteredRuns` |
| Aktive Zeit gesamt | `totalRunSeconds` |
| Routinen | `completedWorkouts.length` aus `useWorkout()` |
| Übungszeit | im selben Block gerechnet |
| Lauf-Liste | `useRun().recentRuns`, gefiltert |
| Datum/Uhrzeit je Zeile | `formatDate()` aus `started_at` |
| Tempo je Zeile | `durchschnittstempoText()` aus `lib/tempo` |
| Zeile → Detail | Route `/lauf/:id` |
| Ladezustand / leerer Zustand | `LoadingSpinner`, `EmptyState` |

Die Seite ist **datentechnisch vollständig.** Die Arbeit ist gestalterisch.

### ⚠️ Zu klären

| Punkt | Frage |
| --- | --- |
| **Score** | Siehe Abschnitt 4 — die eine echte Entscheidung dieser Seite. |
| **Kennzahlen im Kopf, wenn nichts gefiltert übrig ist** | Heute wird das ganze `.md-metric-grid` ausgeblendet, wenn es weder Läufe noch Einheiten gibt. Im Kopf geht das nicht so einfach — er ist immer da. Was steht dann dort? Vorschlag: „0,0 km" und „0:00 h" statt Leerstelle. |
| **Filter-Icon in der alten Kopfleiste** | Die alte `.md-app-bar` hatte rechts einen Filter-Knopf. Der Kopf hat ihn nicht mehr — die Chips sind der Filter. Fällt er ersatzlos weg? |

### Leere Zustände

- **Kein Lauf im Zeitraum** → `EmptyState` gibt es schon. Sieht er im dunklen
  Kopf noch gut aus?
- **Läuft noch** → `LoadingSpinner` vorhanden.
- **Läufe ohne Score** → Ring erscheint gar nicht erst (`avgScore != null`).

---

## 6. Abnahme

- [ ] Kopf zeigt Distanz und Aktive Zeit, und beide **ändern sich mit dem Filter**
- [ ] Unterzeile im Kopf passt zum gewählten Filter
- [ ] Lauf-Zeilen sind cyan getönt, Workout-Zeilen **nicht**
- [ ] `.md-filter-row` fällt nicht auf 0 px zusammen
- [ ] Aktiver Chip trägt die volle Markenfarbe
- [ ] Entscheidung zum Score ist umgesetzt (nicht offen gelassen)
- [ ] Leerer Zeitraum sieht sinnvoll aus, auch im Kopf
- [ ] Hell und dunkel gezeigt
