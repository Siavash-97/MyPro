# Startseite — Design-Spezifikation

**Referenz-Umsetzung:** `myprosole_app/design/mockups-neue-farben/home.html`
**Zielsystem:** `myprosole_web/src/pages/Home.tsx` (React + Vite + Tailwind v4)
**Farbsystem:** Set B — im Web bereits aktiv über `document.documentElement.setAttribute('data-palette','setb')` in `main.tsx`

> Diese Datei beschreibt **wie es aussehen soll**. Sie schreibt **nicht** vor,
> woher die Inhalte kommen — die Zahlen in den Screenshots sind Platzhalter.
> Welche Daten wirklich anzuzeigen sind, steht in Abschnitt 7.

---

## 1. Screenshots

| Datei | Zustand |
| --- | --- |
| `screenshots/01-startseite-hell.png` | Standard, helles Thema, Reiter „Letzte" |
| `screenshots/02-startseite-dunkel.png` | dasselbe im dunklen Thema |
| `screenshots/03-naechste-einheiten.png` | Reiter „Nächste" aktiv |

Die lebende Vorlage ist aussagekräftiger als jeder Screenshot: Datei im Browser
öffnen und mit den DevTools ausmessen, statt Werte aus dem Bild zu schätzen.

---

## 2. Aufbau von oben nach unten

```
┌─ .md-home-hero ──────────── dunkel, randlos, bleibt beim Scrollen oben ─┐
│  Wortmarke MYPROSOLE          [Thema-Schalter] [Glocke]                 │
│  Begrüßung „Guten Morgen!"                                              │
│  ┌────────┐                                                             │
│  │ Ring   │  Läufe diese Woche                                4         │
│  │ + Rakete│ Wochenziel                                      79 %       │
│  └────────┘  Status                                        Gesund       │
│  [        Neuen Lauf starten        ]  ← Verlaufs-Knopf, volle Breite   │
└─────────────────────────────────────────────────────────────────────────┘
   ↓ 24 px Abstand
┌─ Banner „Nächstes Training" ────────────────── weiße Karte, kein Pfeil ─┐
└─────────────────────────────────────────────────────────────────────────┘
   ↓ 24 px
   Überschrift „Letzte Einheiten"          [Nächste | Letzte]  ← Umschalter
   ↓ 8 px
   Lauf-Zeilen (cyan)  — je nach Reiter Vergangenheit oder Plan
   ↓ 24 px
   Überschrift „(i) Meine Übungen"                        „Alle Übungen" →
   ↓ 8 px
   Übungs-Zeilen (indigo)
   ↓
┌─ .md-nav ──────────── unten fixiert: Start Training Community … ───────┐
```

Der Chat-Knopf (`.md-fab`) schwebt rechts über der Navigationsleiste. Er ist
Teil der App-Hülle, nicht der Startseite.

---

## 3. Farben

Alle Werte kommen aus `design-system/tokens.css`, Block `[data-palette="setb"]`.
**Direkte Hex-Werte nur dort verwenden, wo sie unten ausdrücklich stehen** — das
sind die festen Markenfarben, die sich bewusst *nicht* mit dem Thema ändern.

### Feste Markenfarben (in beiden Themen identisch)

| Verwendung | Wert |
| --- | --- |
| Hero-Fläche | `linear-gradient(160deg, #272053 0%, #180F3F 100%)` |
| „MY" / „SOLE" in der Wortmarke | `#85C9F1` |
| „PRO" in der Wortmarke | `#FFFFFF` |
| Ring-Spur (ungefüllter Teil) | `rgba(255,255,255,0.14)` |
| Ring-Wert (gefüllter Teil) | `#85C9F1` |
| Start-Knopf | `linear-gradient(120deg, #209ACD, #006484)` |
| Status „Gesund" | `#82D3AF` |
| Lauf-Zeile: Balken links + Icon | `#209ACD` |
| Übungs-Zeile: Balken links | `#585B97` |
| Übungs-Zeile: Bild-Kachel | `linear-gradient(135deg, #585B97, #2A2C57)` |

### Thema-abhängige Tokens

| Token | Hell | Dunkel |
| --- | --- | --- |
| `--md-background` | `#F7F8FA` | `#13161F` |
| `--md-surface-container-low` (Karten) | `#FFFFFF` | `#1B1F2B` |
| `--md-surface-container` | `#F6F5FB` | `#232838` |
| `--md-on-surface` | `#161920` | `#E4E8F0` |
| `--md-on-surface-variant` | `#575B62` | `#BDBFC4` |
| `--md-card-border` | `#D5D6DA` | `#2E3444` |
| `--md-primary` | `#006484` | `#85C9F1` |
| `--md-brand` | `#006484` | `#85C9F1` |

### Bedeutung der Farben — verbindlich

Diese Regel stammt aus `App-Design/farbpalette.html` und gilt app-weit:

- **Cyan** (`#209ACD` / `--md-primary`) — Basiswerte: Tempo, Strecke, Zeit.
  Werte, die auch die kostenlose Version zeigt.
- **Violett** (`#76399B` / `--md-tertiary`) — **ausschließlich** Auswertungen
  aus den Sensoreinlagen (Pronation, Kniehub, Spurbreite …).
  Niemals für Strecke/Zeit.
- **Indigo** (`#585B97`) — Marke und neutrale Inhalte: Übungen, Community.
- **Rot** ist für technische Fehler reserviert, nie für einen körperlichen
  Befund. Abweichungen heißen „auffällig" in Bernstein-Tönen.

Weitere Regel: 60 % neutrale Fläche, 30 % Text, 10 % gesättigter Akzent. Nicht
jede Liste braucht eine Tönung.

---

## 4. Der Hero im Detail

```css
.md-home-hero {
  display: flex; flex-direction: column; gap: 8px;
  padding: 16px 16px 24px;
  border-radius: 0 0 28px 28px;
  color: #FFFFFF;
}
[data-palette="setb"] .md-home-hero {
  background: linear-gradient(160deg, #272053 0%, #180F3F 100%);
}
```

**Bleibt beim Scrollen oben stehen.** Am Telefon über `position: sticky;
top: env(safe-area-inset-top, 0px); z-index: 29`, auf dem Rechner dadurch, dass
er `flex: 0 0 auto` im Rahmen ist und nur `.md-page-stack` scrollt. Beide Regeln
stehen schon in `design-system/components.css` — sie gelten für
`.md-home-hero`, `.md-page-hero` und `.md-app-bar` gemeinsam.

### Der Fortschrittsring

| Eigenschaft | Wert |
| --- | --- |
| Behälter | `92 × 92 px`, `position: relative` |
| SVG | `viewBox="0 0 100 100"`, **`width:100%; height:100%`** |
| Kreise | `cx=50 cy=50 r=40`, `stroke-width: 8`, `fill: none` |
| Wert-Kreis | zusätzlich `stroke-linecap: round` |
| Drehung | das SVG selbst `transform: rotate(-90deg)` → Start oben |
| Umfang | `2 × π × 40 = 251.2` |

Füllstand über `stroke-dasharray="251.2"` und
`stroke-dashoffset = 251.2 × (1 − anteil)`.
Beispiel Screenshot: 31,6 / 40 km → Anteil 0,79 → Offset `52.75`.

> **Fallstrick:** Ohne `width:100%; height:100%` auf dem SVG rendert es in seiner
> nativen Attributgröße (100 px) statt in den 92 px des Behälters. Der Ring sitzt
> dann versetzt und die Rakete daneben. Diese Zeile nicht weglassen.

### Die Rakete auf dem Ring

Zwei Pfade mit identischen Daten, über je einen `<clipPath>` maskiert: violetter
Körper `#5e17eb`, gelbe Flamme `#fffc00`. Sie sitzt auf dem **Kopf des
gefüllten Bogens** und zeigt in Laufrichtung.

Aktuelle Werte für Anteil 0,79 bei 92 px Ring:

```html
<div class="md-home-hero__rocket"
     style="left:10.36px; top:36.85px; width:46px; height:46px;
            transform: translate(-50%,-50%) rotate(331.44deg);">
```

**Diese Werte gelten nur für Anteil 0,79 und Ringgröße 92 px.** Sobald der
Füllstand aus echten Daten kommt, muss die Position gerechnet werden:

```js
const UMFANG = 251.2, r = 40, cx = 50, cy = 50
const anteil  = Math.min(1, weekKm / goalKm)
// -Math.PI/2, weil das SVG selbst um -90deg gedreht ist (siehe oben) — die
// Rakete ist ein eigenes HTML-Element und erbt diese Drehung nicht von
// selbst. Ohne den Abzug landet der Punkt eine Vierteldrehung daneben.
const theta   = anteil * 2 * Math.PI - Math.PI / 2   // Bogenmaß, 0 = 12 Uhr
// Punkt im viewBox-Raum:
const x = cx + r * Math.cos(theta)
const y = cy + r * Math.sin(theta)
// in Prozent des Behälters, weil das SVG ihn exakt ausfüllt:
const left = `${x}%`, top = `${y}%`
// Ausrichtung: Tangente + Eigendrehung der Zeichnung (empirisch 41,33°)
const winkel = ((anteil * 360 + 90 - 41.33) % 360 + 360) % 360
```

> **Korrektur, 26.08.2026:** Die ursprüngliche Fassung hatte die -90°-Korrektur
> nicht, dieselbe Drehung, die für das SVG selbst schon dokumentiert war. Beim
> Nachrechnen gegen das Beispiel unten (Anteil 0,79 → `left:10.36px;
> top:36.85px` bei 92 px) ergab die alte Formel `left≈59,5 %; top≈11,1 %` —
> eine Vierteldrehung daneben. Mit dem Abzug stimmt es auf zwei
> Nachkommastellen. Alte Fassung zum Zurücknehmen, falls sich diese Korrektur
> als falsch erweist:
> ```js
> // ALT, falsch — theta ohne -90°-Korrektur:
> const theta = anteil * 2 * Math.PI          // Bogenmaß, 0 = 3 Uhr
> ```

Die Eigendrehung `41,33°` ist die Richtung, in die die Zeichnung bei
`rotate(0deg)` zeigt — nachgemessen mit `getScreenCTM()` an Spitze und Flamme.
Wird die Rakete durch ein anderes Bild ersetzt, muss dieser Wert neu gemessen
werden; er ist nicht übertragbar.

Bei Anteil 0 (keine Läufe) die Rakete ausblenden — sonst klebt sie ohne Bezug
am 3-Uhr-Punkt.

### Kennzahlen rechts

Drei Zeilen, `justify-content: space-between`.
Beschriftung `12 px / rgba(255,255,255,0.65)`, Wert `--type-label-lg`, `700`,
weiß. Der Statuswert trägt seine eigene Farbe (`#82D3AF` für „Gesund").

### Der Start-Knopf

Volle Breite, `border-radius: 999px`, `padding: 15px 24px`,
`font: var(--type-title-md)`, `font-weight: 700`,
`box-shadow: 0 8px 20px -8px rgba(0,100,132,0.55)`.
Im Kreis links das **Läufer-Logo** (`.icon-brand-runner`), kein Play-Dreieck:
hier startet ein Lauf, kein Video.

---

## 5. Der Inhaltsbereich

`.md-page-stack` — `padding: 24px 16px`, `display:flex; flex-direction:column;
gap: 24px`. Scrollt unter dem Hero durch.

### Banner „Nächstes Training"

`.md-card.md-row`, weiße Karte, **kein Pfeil rechts** — bewusst ein Banner, kein
Navigationseintrag. Die Fläche bleibt trotzdem klickbar (führt zum Laufplan).

Links das Kalender-Icon **ohne Hintergrundkachel**:
`background: transparent; color: #209ACD; width: 40px` mit Icon `28 × 28`.

### Umschalter „Nächste / Letzte"

`.md-segmented`, rechts neben der Abschnitts-Überschrift, `width: auto`.
Aktiver Reiter: `background: var(--md-brand)`, weiße Schrift, `font-weight: 700`,
`box-shadow: var(--elevation-2)`, `transform: translateY(-1px)`.

Beim Umschalten wechselt **auch die Überschrift** zwischen
„Letzte Einheiten" und „Nächste Einheiten".

> Wichtig: **Beide Listen sehen gleich aus.** Ein früherer Entwurf hat geplante
> Einheiten gestrichelt und violett dargestellt — das wurde verworfen. Violett
> ist der Einlagen-Analyse vorbehalten, und der Reitertext sagt bereits, was
> man sieht.

### Lauf-Zeilen (`.md-run-row`)

```css
border: 1px solid var(--md-card-border);
border-left: 4px solid #209ACD;
border-radius: 12px;
padding: 13px 14px 13px 12px;
background: linear-gradient(90deg, #209ACD22 0%, var(--md-surface-container-low) 65%);
```

Links Icon (transparent, `#209ACD`, `26 × 26`) + Datum/Tageszeit,
rechts die Kennzahl fett + Pfeil.
Abgeschlossene Läufe tragen das Medaillen-Icon, geplante das Kalender-Icon.

### Abschnitt „Meine Übungen"

Überschrift mit **vorangestelltem** Info-Knopf (`26 × 26`, runde graue Fläche),
rechts der Link „Alle Übungen" in `--md-primary`.
Ein Tippen auf den Info-Knopf klappt einen Hinweis auf:

> „Sobald du deine Einlagen und die Laufanalyse nutzt, werden diese Übungen
> individuell auf dich zugeschnitten."

> **Fallstrick:** Das Designsystem setzt global `svg { fill: currentColor }`.
> Das überschreibt ein `fill="none"` im HTML — CSS schlägt Präsentationsattribut.
> Strich-Icons („outline") werden dadurch zu schwarzen Klecksen. Für den
> Info-Knopf deshalb ein **gefülltes** Icon mit ausgesparter Kontur verwenden.

Übungs-Zeilen (`.md-exercise-row`) tragen dieselbe Form wie die Lauf-Zeilen, aber
in Indigo `#585B97`, plus eine `52 × 52`-Bildkachel mit Play-Symbol.

---

## 6. Navigationsleiste

Fünf Einträge: **Start · Training · Community · Verlauf · Profil**.
Aktiver Eintrag: Text und Icon in `--md-primary`, dahinter eine Pille
(`56 × 28`, `--md-secondary-container`, `elevation-1`, `translateY(-1px)`).

Gehört zur App-Hülle (`AppShell.tsx` → `BottomNav`), nicht zur Startseite.

---

## 7. Inhalte — was ist echt, was ist Platzhalter

**Alle Zahlen und Texte in den Screenshots sind erfunden.** Keinen davon
übernehmen. Die folgende Tabelle ist der Stand der Prüfung von
`myprosole_web/src/pages/Home.tsx` und der zugehörigen Stores.

### ✅ Vorhanden — die Startseite rechnet das heute schon

| Anzeige | Quelle im Code |
| --- | --- |
| Begrüßung | `getGreeting()` (Tageszeit) + `profile.display_name` aus `store/auth` |
| Ring-Zähler (`31,6`) | `weekKm` — Summe `distance_km` der `recentRuns` mit `status === 'completed'` der letzten 7 Tage |
| Ring-Nenner (`von 40 km`) | `planTotalKm(weekPlan)` aus `store/runningPlan` |
| „Läufe diese Woche" | `weekRuns.length` |
| „Wochenziel %" | `weekKm / goalKm × 100` — heute als Balken (`.md-progress`) dargestellt |
| Start-Knopf → | Route `/lauf/tracking` |
| Kilometer im Banner | `kmForDate(weekPlan, new Date())` |
| Liste „Letzte" | `recentRuns` gefiltert auf `completed`, Felder `started_at`, `distance_km`, `duration_s` |
| Zeile → Detail | Route `/lauf/${run.id}` |
| „Alle Übungen" → | Route `/training` |

### ⚠️ Nicht gefunden — hier **nachfragen statt erfinden**

| Anzeige im Entwurf | Was fehlt |
| --- | --- |
| **„Status: Gesund"** | Keine Quelle gefunden. Gibt es ein Feld für Belastung/Verletzung? Wenn nein: Zeile weglassen, nicht mit einem festen „Gesund" füllen. |
| **„Regenerationslauf", „Intervalle", „Long Run"** | `WeekPlan` ist `Record<PlanDayKey, string>` — **nur Kilometer je Wochentag**, kein Typ und kein Name. Entweder Datenmodell erweitern oder die Zeile auf die Kilometer beschränken. |
| **„8,2 km locker"** — der Zusatz „locker" | Dieselbe Lücke wie oben. |
| **„Nachmittags"** unter dem Datum | Ableitbar aus `started_at` — aber ist diese Genauigkeit gewollt, oder lieber die Uhrzeit? |
| **Liste „Nächste"** (3 Einträge) | Aus `weekPlan` sind die kommenden Tage mit `km > 0` ableitbar. Die Dauer-Schätzung („ca. 45 min") braucht ein Tempo — welches? Aus der Anamnese, aus dem Schnitt der letzten Läufe, oder gar nicht anzeigen? |
| **„Meine Übungen"** — welche drei? | `store/exercises.ts` liefert alle Übungen und Gruppen, aber es gibt **keine Auswahlregel** für „meine drei". Zuletzt gemacht? Nie gemacht? Aus dem Plan? |
| **Dauer je Übung** („Kraft · 6 min") | Prüfen, ob `ExerciseWithRelations` eine Dauer trägt. Wenn nicht: nur die Kategorie zeigen. |
| **Glocke oben rechts** | Kein Benachrichtigungssystem gefunden. Weglassen, bis es eins gibt — ein Knopf, der nichts tut, ist schlechter als keiner. |

### Leere Zustände — nicht vergessen

Die Screenshots zeigen alle einen gefüllten Account. Zu klären und zu bauen:

- **Kein Laufplan** → `goalKm` ist `null`. Was zeigt der Ring dann? Vorschlag:
  Ring als reine Zählung ohne Nenner, oder Hinweis „Plan anlegen".
- **Keine Läufe** → Liste „Letzte" leer; Ring auf 0, Rakete ausblenden.
- **Keine Übungen ausgewählt** → Abschnitt ganz weglassen oder Einstieg zeigen.

---

## 8. Bekannte Stolpersteine bei der Übernahme

1. **Der Hero muss aus `.md-page-stack` heraus.**
   `AppShell.tsx` rendert heute `<TopAppBar />` und darunter
   `<main className="md-page-stack">` — der Seiteninhalt liegt also *innerhalb*
   des gepolsterten Bereichs. Der Hero ist randlos und muss ein Geschwister von
   `<main>` sein, kein Kind. Das betrifft die Hülle, nicht nur `Home.tsx`.

2. **Das CSS fehlt im Web-Projekt.**
   `myprosole_web/src/styles/components.css` kennt `.md-home-hero`,
   `.md-run-row` und `.md-exercise-row` **nicht** (geprüft: 0 Treffer). Diese
   Blöcke müssen aus `myprosole_app/design/design-system/components.css`
   übernommen werden. Beide Dateien sind Kopien voneinander mit Abweichungen —
   nicht blind überschreiben, sondern die benötigten Blöcke einzeln übertragen.

3. **`.md-exercise-row` steht nur lokal im Mockup.**
   Diese Klasse liegt in einem `<style>`-Block in `home.html`, nicht im
   Designsystem — sie war ein Experiment im Ordner `mockups-neue-farben`.
   Beim Übernehmen gehört sie ins gemeinsame CSS.

4. **Geteilte Klassen haben Reichweite.**
   `.md-run-row`, `.md-list-item`, `.md-filter-chip`, `.md-segmented` und
   `.md-nav` werden von mehreren Seiten benutzt. Vor jeder Änderung an einer
   dieser Klassen mit `grep` prüfen, wo sie sonst vorkommt, und die anderen
   Seiten mitprüfen.

5. **Der Ordner `mockups-neue-farben` ist ein Farb-Experiment.**
   Der Ordner `mockups` daneben trägt den alten Stand. Vorlage ist ausschließlich
   `mockups-neue-farben`.

---

## 9. Was fertig heißt

- [ ] Sieht in **beiden** Themen wie die Screenshots aus, Umschalter funktioniert
- [ ] Kein einziger Zahlenwert fest im Code — alles aus Store oder Datenbank
- [ ] Leere Zustände gebaut (kein Plan / keine Läufe / keine Übungen)
- [ ] Ring rechnet Position und Winkel der Rakete, statt feste Pixel zu tragen
- [ ] Hero bleibt beim Scrollen oben stehen, am Telefon wie auf dem Rechner
- [ ] Kein horizontales Scrollen bei 320 px Breite
- [ ] Jede geteilte Klasse, die angefasst wurde, ist auf den anderen Seiten geprüft
- [ ] Offene Punkte aus Abschnitt 7 sind **beantwortet**, nicht geraten
