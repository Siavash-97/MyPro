# Paket 02 — Training

**Vorlage:** `myprosole_app/design/mockups-neue-farben/uebungen.html`
**Zieldatei:** `myprosole_web/src/pages/Training.tsx`
**Voraussetzung:** Paket 00 (Fundament) ist abgenommen.

Gemeinsame Farben, Tokens und der Seitenkopf stehen in
[`../00-fundament/FUNDAMENT-DESIGN.md`](../00-fundament/FUNDAMENT-DESIGN.md).
Diese Datei beschreibt nur, was für diese Seite gilt.

| Screenshot | Zustand |
| --- | --- |
| `screenshots/01-training-hell.png` | helles Thema |
| `screenshots/02-training-dunkel.png` | dunkles Thema |

---

## 1. Der Seitenkopf

`.md-page-hero` mit Titel, Unterzeile und **drei** Kennzahlen:

```
MYPROSOLE                          [Thema] [Glocke]
Training
32 kostenlose Übungen in 5 Kategorien
0×              5              32
Diese Woche     Kategorien     Übungen
```

Alle drei Zahlen sind echt herleitbar (siehe Abschnitt 4) — keine davon fest
eintragen.

---

## 2. Aufbau darunter

```
┌ Aufklapp-Liste (.md-analysis-accordion) ────────────────┐
│  ▸ Beweglichkeit für Läufer          6 Übungen          │
│  ▸ Knie kräftigen                    6 Übungen          │
│  ▸ Bauch und Po kräftigen            6 Übungen          │
│  ▸ Fuß-Übungen                       6 Übungen          │
│  ▸ Lauftechnik                       8 Übungen          │
└─────────────────────────────────────────────────────────┘
   ↓ aufgeklappt: Einleitungstext + Übungs-Zeilen
   
┌ .md-insole-promo ─── „Mit Sensoreinlagen" ─────────────┐
└─────────────────────────────────────────────────────────┘

┌ .md-card ─── „Übungen diese Woche"              0×  ───┐
└─────────────────────────────────────────────────────────┘
```

### Die Aufklapp-Liste

Native `<details>` / `<summary>` — kein JavaScript. Der Pfeil rechts dreht sich
beim Öffnen über `[open] summary svg { transform: rotate(180deg) }`.

```html
<details class="md-analysis-section">
  <summary>
    <span><strong>Beweglichkeit für Läufer</strong><small>6 Übungen</small></span>
    <svg class="icon"><use href="#icon-chevron-down"/></svg>
  </summary>
  <div class="md-analysis-section__content">
    <p>Einleitungssatz der Kategorie …</p>
    …Übungs-Zeilen…
  </div>
</details>
```

Diese Struktur **hat die echte Seite bereits** (`Training.tsx`, ab Zeile 144).
Hier ist nichts neu zu bauen.

### Die Übungs-Zeilen

`.md-list-item` **plus `.md-list-item--tint-indigo`** — das ist die Änderung
gegenüber heute. Indigo, weil Übungen zu „Marke und neutrale Inhalte" gehören,
nicht zu den Basiswerten (Cyan) und erst recht nicht zur Einlagen-Analyse
(Violett).

```
┌▎[Icon] Gesäßdehnung im Sitzen                        › │
│        3 × 30–60 Sekunden halten (Gesäß)               │
└─────────────────────────────────────────────────────────┘
 ▲ 4 px Balken #585B97, dazu ein nach rechts auslaufender Verlauf
```

Aufbau: `__thumb` (48 × 48, `--md-primary-container`) · `__body` mit `__title`
und `__meta` · Pfeil rechts.

### Einlagen-Werbung

`.md-insole-promo` — Augenbraue „Mit Sensoreinlagen", Titel „Diese Übungen – auf
dich zugeschnitten", Fließtext, Knopf „Einlagen kennenlernen".

Benutzt `--md-secondary-container`, **nicht** den Violett-Ton. Violett ist der
tatsächlichen Analyse vorbehalten — hier wird sie nur beworben.

Existiert schon (`Training.tsx`, ab Zeile 202).

---

## 3. Wichtig: das Mockup zeigt den Zustand *ohne Laufplan*

Die echte Seite zeigt **oberhalb** des Katalogs drei weitere Blöcke, aber nur
`{planExists && …}` — also wenn ein Laufplan angelegt ist:

1. `.md-card` „Diese Woche" mit Fortschrittsbalken (`gelaufen / geplant km`)
2. „Heute" — eine `.md-week-plan`-Zeile mit Knopf „Starten"
3. `.md-card` „Nächste Tage" mit den kommenden 7 Tagen und „Plan bearbeiten"

**Das Mockup zeigt diese Blöcke nicht**, weil ich es gegen die öffentliche
Vorschau abgeglichen habe, wo kein Plan hinterlegt war.

**Das ist kein Auftrag, sie zu entfernen.** Sie bleiben und bekommen nur die
neue Optik:

- `.md-card` behält Form und Rahmen, nur die Tokens ändern sich (passiert
  automatisch über Paket 00)
- Die `.md-week-plan`-Zeilen bleiben unverändert
- Der Fortschrittsbalken `.md-progress` bleibt

Zu klären: Der Kopf zeigt „0× Diese Woche". Der Block „Diese Woche" weiter unten
zeigt Kilometer. Ist das eine Dopplung, die stört? Mein Vorschlag: nein — oben
stehen Übungs-Einheiten, unten Lauf-Kilometer. Aber sieh es dir im Zusammenhang
an und sag Bescheid.

---

## 4. Inhalte — was ist echt, was ist Platzhalter

### ✅ Vorhanden

| Anzeige | Quelle |
| --- | --- |
| Kategorien und ihre Reihenfolge | `useExercises().groups` |
| Übungen je Kategorie | `useExercises().uebungenDerGruppe(groupId)` |
| Anzahl Übungen je Kategorie | Länge davon |
| Vorgabe („3 × 12 Wiederholungen") | `vorgabeText()` aus `lib/labels` |
| „Übungen diese Woche 0×" | `useWorkout().mikroroutinenDieseWoche` |
| Wochenplan-Blöcke | `useRunningPlan().plan`, dazu `hasPlan`, `planTotalKm`, `kmForDate`, `upcomingDays` aus `lib/runningPlan` |
| gelaufene Wochenkilometer | `useRun().recentRuns`, gefiltert auf `completed` ab Montag |
| Zählung je Übung | `useExercises().zaehlungen` |
| Übung → Detailseite | Route `/training/uebung/:slug` |

### ⚠️ Zu klären

| Punkt | Frage |
| --- | --- |
| **„32 Übungen in 5 Kategorien"** im Kopf | Beide Zahlen aus `groups` und deren Übungen rechnen — **nicht** eintippen. Was zeigt der Kopf, solange die Daten noch laden? |
| **Muskelgruppe in der Zeile** („(Gesäß)") | Kommt aus `muscleGroups` — prüf, ob `vorgabeText()` das schon anhängt oder ob es getrennt gehört. |
| **Einleitungssatz je Kategorie** | Im Mockup steht je Kategorie ein erklärender Satz („Die sechs Stellen, die beim Laufen zuerst dicht werden…"). Hat `ExerciseGroup` ein Beschreibungsfeld? Wenn nicht: weglassen oder Feld ergänzen? |
| **Reihenfolge der Kategorien** | Der Kommentar im Store sagt „in ihrer Reihenfolge" — gibt es ein Sortierfeld, oder ist es die Reihenfolge aus der Datenbank? |

### Leere Zustände

- **Katalog lädt noch** → was steht im Kopf statt „32 Übungen"?
- **Keine Übungen** (Datenbank leer oder Ladefehler) → Ladefehler darf nicht wie
  ein leerer Katalog aussehen. Auf der Community-Seite gibt es dafür schon ein
  Muster (`fehler &&` mit `--md-error-container`) — daran orientieren.
- **Kein Laufplan** → genau der Zustand aus den Screenshots.

---

## 5. Abnahme

- [ ] Kopf ist dunkel, mit drei **gerechneten** Kennzahlen
- [ ] Übungs-Zeilen tragen die Indigo-Tönung
- [ ] Aufklapp-Liste funktioniert weiterhin ohne JavaScript
- [ ] Die Wochenplan-Blöcke sind **noch da** und sehen im neuen Thema richtig aus
      (mit angelegtem Plan prüfen!)
- [ ] Einlagen-Werbung benutzt **nicht** Violett
- [ ] Leere Zustände gebaut
- [ ] Hell und dunkel gezeigt
