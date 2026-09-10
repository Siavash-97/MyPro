# Paket 00 — Fundament

**Ziel:** Das gemeinsame CSS und die App-Hülle so vorbereiten, dass danach jede
Seite einzeln umgebaut werden kann, ohne die anderen anzufassen.

**Zieldateien**
- `myprosole_web/src/styles/components.css`
- `myprosole_web/src/components/layout/AppShell.tsx`
- `myprosole_web/src/components/layout/TopAppBar.tsx`
- `myprosole_web/src/components/layout/BottomNav.tsx`

**Vorlage:** `myprosole_app/design/design-system/components.css`

> Dieses Paket baut **keine Seite** um. Wenn es fertig ist, sieht die App fast
> unverändert aus — nur der Kopf jeder Seite ist dunkel statt hell. Genau das
> ist gewollt: ein kleiner, überprüfbarer Schritt.

---

## 1. Das Farbsystem ist schon da

`myprosole_web/src/index.css` enthält bereits den vollständigen Set-B-Block
(`[data-palette="setb"]` und `[data-theme="dark"][data-palette="setb"]`), und
`main.tsx` setzt `data-palette="setb"` am Wurzelelement.

**Hier ist nichts zu tun.** Die Tokens stimmen bereits mit dem Mockup überein.

### Feste Markenfarben (in beiden Themen identisch)

Diese Werte stehen bewusst direkt im CSS und nicht als Token — sie sollen sich
nicht mit dem Thema ändern.

| Verwendung | Wert |
| --- | --- |
| Kopf-Fläche (Hero) | `linear-gradient(160deg, #272053 0%, #180F3F 100%)` |
| „MY" / „SOLE" in der Wortmarke | `#85C9F1` |
| „PRO" in der Wortmarke | `#FFFFFF` |
| Ring-Spur | `rgba(255,255,255,0.14)` |
| Ring-Wert | `#85C9F1` |
| Start-Knopf | `linear-gradient(120deg, #209ACD, #006484)` |
| Status „Gesund" | `#82D3AF` |
| Lauf-Zeile: Balken + Icon | `#209ACD` |
| Übungs-Zeile: Balken | `#585B97` |
| Übungs-Kachel | `linear-gradient(135deg, #585B97, #2A2C57)` |

### Thema-abhängige Tokens (zur Kontrolle)

| Token | Hell | Dunkel |
| --- | --- | --- |
| `--md-background` | `#F7F8FA` | `#13161F` |
| `--md-surface-container-low` (Karten) | `#FFFFFF` | `#1B1F2B` |
| `--md-surface-container` | `#F6F5FB` | `#232838` |
| `--md-on-surface` | `#161920` | `#E4E8F0` |
| `--md-on-surface-variant` | `#575B62` | `#BDBFC4` |
| `--md-card-border` | `#D5D6DA` | `#2E3444` |
| `--md-primary` / `--md-brand` | `#006484` | `#85C9F1` |
| `--md-secondary-container` | `#E9E8F5` | `#3F396E` |

---

## 2. Was ins CSS übernommen werden muss

`myprosole_web/src/styles/components.css` kennt diese Klassen **nicht**
(nachgeprüft: 0 Treffer). Sie stehen in
`myprosole_app/design/design-system/components.css` und müssen dorthin.

| Klasse(n) | Zweck | Gebraucht ab Paket |
| --- | --- | --- |
| `.md-home-hero` + alle `__`-Kinder | dunkler Kopf der Startseite | 01 |
| `.md-page-hero` + `__title` `__subtitle` `__stats` `__stat` `__stat-value` `__stat-label` `__profile` `__avatar` | dunkler Kopf aller übrigen Seiten | 02–05 |
| `.md-page-hero--compact` + `__top-row` | schmaler Kopf mit Zurück-Pfeil | 06 |
| `.md-run-row` + `__left` `__icon` `__date` `__time` `__right` `__stat` | Lauf-Zeilen | 01 |
| `.md-run-row--upcoming` | geplante Läufe (aktuell ungenutzt, siehe unten) | – |
| `.md-exercise-row` + `__thumb` | Übungs-Zeilen | 01 |
| `.md-exercise-info-btn`, `.md-exercise-info-note` | Info-Knopf mit Aufklapp-Hinweis | 01 |
| `.md-list-item--tint-indigo`, `--tint-cyan` | getönte Listenzeilen | 02, 03 |
| `.md-card--tint-indigo` | getönte Karten (Gruppen) | 05 |
| `.md-divider` | Trennlinie mit Text („oder") | 07 |
| `.icon-brand-runner` | Läufer-Silhouette im Start-Knopf | 01 |

Dazu diese **Änderungen an bestehenden Klassen**:

| Klasse | Änderung | Warum |
| --- | --- | --- |
| `.md-page-stack` | `padding: 24px 16px` statt `padding: 0 16px 24px` | Ohne Abstand oben stieß der Inhalt an die Kante des dunklen Kopfes und wirkte abgeschnitten |
| `.md-filter-chip--active` | `background: var(--md-brand)`, `color: var(--md-on-brand)` | Der blasse Ton hob sich nicht von den weißen Nachbar-Chips ab |
| `.md-nav__item--active` | `color: var(--md-primary)` | Aktiver Eintrag soll in der Markenfarbe leuchten |
| `.md-segmented__item` | `border: none; background: transparent; cursor: pointer` ergänzen | Als `<button>` zeigte er sonst den nativen Browser-Rahmen |
| `.md-filter-row` | `min-height: 38px` ergänzen | Flexbox-Falle, siehe unten |
| `.md-home-hero__ring > svg` | `width: 100%; height: 100%` ergänzen | Ring-Falle, siehe unten |

> **Nicht die ganze Datei überschreiben.** Die beiden `components.css` sind
> Kopien voneinander mit Abweichungen (die Web-Fassung hat z. B. `.md-nav-reserve`
> und die Rahmenbreite für den Desktop, die es im Mockup nicht gibt). Übertrage
> die Blöcke einzeln.

### Zwei Fallen im Detail

**Die Flexbox-Falle bei `.md-filter-row`:** `overflow-x: auto` setzt die
automatische Mindesthöhe eines Flex-Kindes auf 0 statt auf die Inhaltsgröße. In
einer Flex-Spalte (`.md-page-stack`) fällt die Zeile dadurch auf 0 px zusammen.
`overflow-y: visible` hilft **nicht** — die Spezifikation erlaubt keine
gemischten Achsen und rechnet es zurück auf `auto`. Die Lösung ist
`min-height: 38px`.

**Die Ring-Falle:** siehe Paket 01, Abschnitt „Der Fortschrittsring".

---

## 3. Der Umbau der App-Hülle

Das ist der eigentliche Kern dieses Pakets — und der einzige Teil, der alle
Seiten zugleich berührt.

### So ist es heute

```tsx
// AppShell.tsx
<div className="flex flex-col min-h-dvh …">
  <TopAppBar />                                  {/* heller Kopf */}
  <main className="md-page-stack md-page-stack--with-nav flex-1">
    <Outlet />                                   {/* der Seiteninhalt */}
  </main>
  <div className="md-nav-reserve" />
  <ChatFab />
  <BottomNav />
</div>
```

Der Seiteninhalt liegt **innerhalb** von `.md-page-stack` und damit innerhalb
dessen seitlicher Polsterung von 16 px.

### So soll es werden

Der dunkle Kopf ist randlos — er geht bis an beide Ränder und trägt unten
abgerundete Ecken. Er kann deshalb **kein Kind von `.md-page-stack`** sein,
sondern muss dessen Geschwister werden, genau dort, wo heute `<TopAppBar />`
steht.

Jede Seite braucht aber einen **anderen** Kopf: die Startseite den großen mit
Ring und Start-Knopf, die übrigen den kompakten mit Titel und Kennzahlen, die
Unterseiten den schmalen mit Zurück-Pfeil.

**Wie das gelöst wird, ist deine Entscheidung — leg sie mir vorher vor.**
Zwei naheliegende Wege:

- **Über ein Layout-Element (Kontext/Slot):** Die Seite meldet ihren Kopf an,
  die Hülle rendert ihn an der richtigen Stelle. Sauber getrennt, aber ein
  Stück Verdrahtung.
- **Über die Route:** Die Hülle entscheidet anhand des Pfads, welchen Kopf sie
  zeigt. Weniger Verdrahtung, aber die Hülle muss jede Seite kennen.

Wichtig ist nur: **eine Lösung für alle Seiten**, nicht pro Seite eine eigene.

### Was dabei erhalten bleiben muss

- **Der Kopf bleibt beim Scrollen oben stehen.** Am Telefon über
  `position: sticky; top: env(safe-area-inset-top, 0px); z-index: 29`, auf dem
  Rechner dadurch, dass er `flex: 0 0 auto` ist und nur `.md-page-stack` scrollt.
  Die Regeln stehen schon im Mockup-CSS und gelten dort für `.md-app-bar`,
  `.md-page-hero` und `.md-home-hero` gemeinsam.
- **`.md-nav-reserve`** — der Streifen, der unten Platz für Leiste und
  Chat-Knopf freihält, damit kurze Seiten nicht unnötig scrollen.
- **Der Sicherheitsabstand oben** (`env(safe-area-inset-top)`), sonst beginnt
  der Inhalt vom Startbildschirm aus unter der Uhr des Telefons.
- **`TopAppBar` bleibt bestehen**, solange Seiten außerhalb der Hülle ihn noch
  benutzen (Live-Tracking, Anamnese, Zusammenfassung). Nicht löschen.

### Die Navigationsleiste

Fünf Einträge: **Start · Training · Community · Verlauf · Profil**.
Aktiver Eintrag: Text und Icon in `--md-primary`, dahinter eine Pille
(`56 × 28 px`, `--md-secondary-container`, `elevation-1`, `translateY(-1px)`).

Nur die Farbe des aktiven Eintrags ändert sich. Struktur bleibt.

---

## 4. Der kompakte Seitenkopf

Damit Paket 02–05 direkt loslegen können, wird er hier mitgebaut.

```css
.md-page-hero {
  display: flex; flex-direction: column; gap: 8px;
  padding: 16px 16px 24px;
  border-radius: 0 0 28px 28px;
  background: var(--md-scrim);         /* Rückfall für andere Paletten */
  color: #FFFFFF;
}
[data-palette="setb"] .md-page-hero {
  background: linear-gradient(160deg, #272053 0%, #180F3F 100%);
}
```

Aufbau von oben nach unten:

```
┌─────────────────────────────────────────────────┐
│ MYPROSOLE                    [Thema] [Glocke]   │  ← .md-home-hero__top
│ Verlauf                                         │  ← __title, 24px/700
│ Alle Läufe und Routinen dieser Woche            │  ← __subtitle, 70 % weiß
│ 37,3 km      3:59 h                             │  ← __stats (0–3 Stück)
│ Distanz      Aktive Zeit                        │     Wert 18px/700, Label 11px
└─────────────────────────────────────────────────┘
```

Die Icon-Leiste oben (`.md-home-hero__top` mit `__wordmark` und `__icons`) ist
auf **allen** Seiten identisch — auch das ist ein Grund, sie hier einmal
festzulegen statt in jeder Seite.

**Varianten:**
- `.md-page-hero__profile` — statt Titel ein Avatar (`52 × 52`) mit Name
  daneben. Nur auf der Profilseite.
- Ein `.md-segmented` als letztes Kind — nur auf den Community-Seiten, damit
  die Reiter im dunklen Bereich sitzen.
- `.md-page-hero--compact` + `__top-row` — für Unterseiten: Zurück-Pfeil und
  Titel in einer Zeile, kein Wortmark, keine Kennzahlen, weniger Polsterung
  unten.

---

## 5. Der Thema-Umschalter

Im Kopf sitzt oben rechts ein Knopf, der zwischen hell und dunkel wechselt
(Sonne bzw. Mond). In der echten App gibt es dafür bereits
`myprosole_web/src/lib/design.ts` mit `designLesen()` und `designUmschalten()` —
benutzt von der Profilseite.

**Diesen vorhandenen Weg verwenden**, keinen zweiten bauen. Zu klären:

- Sollen **beide** Schalter bleiben (Kopf und Profil-Einstellung)? Dann müssen
  sie sich gegenseitig spiegeln. Im Mockup war das anfangs kaputt: beide
  reagierten auf dasselbe Ereignis in falscher Reihenfolge, sodass der eine den
  anderen zurücksetzte.
- Oder nur der im Kopf, und die Zeile im Profil fällt weg?

**Nicht übernehmen:** Die Mockups haben in den Profil-Einstellungen zusätzlich
Paletten-Schalter („Logo-Farben (Violett)", „Vital"). Die waren nur für die
Farbabstimmung da. Set B ist entschieden — sie gehören nicht in die App.

---

## 6. Abnahme dieses Pakets

- [ ] Alle Klassen aus Abschnitt 2 sind in `styles/components.css` und werden
      von mindestens einer Testseite benutzt
- [ ] `.md-page-hero` erscheint auf allen fünf Hauptseiten anstelle des hellen
      Kopfes, randlos und mit abgerundeter Unterkante
- [ ] Der Kopf **bleibt beim Scrollen oben stehen** — am Telefon geprüft, nicht
      nur auf dem Rechner
- [ ] Der Sicherheitsabstand oben stimmt (vom Startbildschirm aus starten)
- [ ] Die Seiten außerhalb der Hülle (Live-Tracking, Anamnese, Zusammenfassung)
      sehen unverändert aus
- [ ] Aktiver Navigationseintrag leuchtet in `--md-primary`
- [ ] Thema-Umschalter funktioniert, und beide Schalter (falls beide bleiben)
      zeigen denselben Stand
- [ ] Kein horizontales Scrollen bei 320 px
- [ ] Hell und dunkel als Nachweis gezeigt

**Erst wenn das abgenommen ist, beginnt Paket 01.**
