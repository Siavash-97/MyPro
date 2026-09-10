# Paket 05 — Community (drei Reiter)

**Vorlagen:**
`mockups-neue-farben/community.html` · `community-zusammenlauf.html` ·
`community-gruppen.html`

**Zieldateien:**
`myprosole_web/src/pages/Community.tsx` · `CommunityMeetups.tsx` ·
`CommunityGroups.tsx`

**Voraussetzung:** Paket 00 (Fundament) ist abgenommen.

| Screenshot | Zustand |
| --- | --- |
| `screenshots/01-feed-hell.png` | Reiter „Feed", hell |
| `screenshots/02-feed-dunkel.png` | Reiter „Feed", dunkel |
| `screenshots/03-zusammenlauf-hell.png` | Reiter „ZusammenLauf" |
| `screenshots/04-gruppen-hell.png` | Reiter „Gruppen" |

---

## 1. Die eigentliche Änderung: die Reiter wandern in den dunklen Bereich

Heute steht `<CommunityTabs />` als erstes Element **im** Inhaltsbereich, also
auf hellem Grund. Neu sitzt es **im** dunklen Kopf, als letztes Kind:

```
┌ .md-page-hero ──────────────────────────────────────┐
│ MYPROSOLE                          [Thema] [Glocke] │
│ Community                                           │
│ Läufe teilen, ZusammenLauf finden, Fragen stellen   │
│  ┌────────────────────────────────────────────┐     │
│  │  Feed  │ ZusammenLauf │    Gruppen         │     │ ← .md-segmented
│  └────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────┘
```

**Alle drei Seiten tragen denselben Kopf** — gleicher Titel, gleiche Unterzeile.
Nur der aktive Reiter unterscheidet sich. Das ist Absicht: es ist eine Fläche
mit drei Ansichten, nicht drei Seiten.

Die Komponente `CommunityTabs` bleibt unverändert — sie rendert bereits
`.md-segmented` mit dem aktiven Reiter aus dem Pfad. Sie muss nur an die neue
Stelle.

Der aktive Reiter trägt jetzt die volle Markenfarbe (Änderung aus Paket 00).

---

## 2. Reiter „Feed"

```
  ┌ Karte: „Frage stellen oder Lauf teilen…"      [📷] │  → neuer Beitrag
  └────────────────────────────────────────────────────┘
  ┌ <article class="md-card"> ─────────────────────────┐
  │  ⬤ Jana                                            │
  │    Heute, 09:14 Uhr · 10,2 km · 52:30 min          │
  │  ┌──────────────────────────────────────────┐      │
  │  │            Bild / Karte                  │      │  .md-post-photo
  │  └──────────────────────────────────────────┘      │
  │  Erster Long Run in dieser Saison…                 │  .md-post-caption
  │  ♥ 12      💬 4 Antworten                          │  .md-post-actions
  └────────────────────────────────────────────────────┘
```

Die Beiträge bleiben `.md-card` — **keine Tönung.** Ein Feed aus vielen Karten
wird mit farbigem Balken links schnell unruhig; die 60/30/10-Regel gilt.

### ⚠️ Das Mockup zeigt zu wenige Reaktionen

Die echte Seite hat **drei** Reaktionen je Beitrag:

1. **Like** (Herz)
2. **Kommentar**
3. **Goldmedaille** — bewusst getrennt vom Like. Der Kommentar im Code sagt,
   sie soll später Vergünstigungen auslösen, und dabei darf nichts mitgezählt
   werden, was keine ist.

Das Mockup zeigt nur Like und Kommentar. **Die Medaille bleibt** — sie ist nur
im Entwurf untergegangen. Ihr Gold hebt sich bewusst von der App-Farbe ab
(`--md-gold`, siehe `index.css`); das ist gewollt und kein Verstoß gegen die
Farbregel.

Bitte im Zuge dieses Pakets klären: Wo genau sitzt sie in der neuen Zeile, und
sieht Gold auf dunklem Grund noch gut aus?

---

## 3. Reiter „ZusammenLauf"

```
  ┌ Hinweis (blau getönt) ─────────────────────────────┐
  │ 🛡 Anderen zeigen wir nur deinen Vornamen, deine    │  .md-info-note
  │   ungefähre Distanz und eure gemeinsamen Zeiten…   │
  └────────────────────────────────────────────────────┘
  ┌ „Deine Filter"                          ⚙ Ändern   │
  │ Umkreis 5 km · Tempo 5:30–6:00 · Sa/So vormittags  │
  └────────────────────────────────────────────────────┘
  Läuferinnen und Läufer in der Nähe
  ┌▎⬤ Tobias, 31   [42 km/Wo]              [Anfrage]  │
  │   1,8 km entfernt · ~5:40 min/km · Sa/So morgens   │
  └────────────────────────────────────────────────────┘
```

Die Personen-Zeilen bekommen `.md-list-item--tint-indigo` — Community zählt zu
„Marke und neutrale Inhalte".

Der Datenschutz-Hinweis oben ist kein Beiwerk: Die Seite zeigt bewusst nur
Vorname, ungefähre Distanz und gemeinsame Zeiten. Kein genauer Standort, keine
Nachnamen, kein Chat vor einer bestätigten Anfrage. **Diese Zurückhaltung nicht
aufweichen**, auch nicht „nur für die Optik".

---

## 4. Reiter „Gruppen"

```
  ┌ 🔍 Gruppe oder Ort suchen ─────────────────────────┐  .md-search-field
  └────────────────────────────────────────────────────┘
  ┌ + Eigene Gruppe erstellen ─────────────────────────┐  gestrichelt
  └────────────────────────────────────────────────────┘
  [Alle] Locker  Tempo  Marathon                          .md-filter-row
  Beliebte Gruppen in deiner Nähe
  Nach Aktivität sortiert. Weitere findest du über die Suche oben.
  ┌▎⬤ Frühaufsteher München                          › │
  │   München · 214 Mitglieder · Locker                │  .md-card--tint-indigo
  │   Diese Woche gemeinsam gelaufen: 486 km           │
  └────────────────────────────────────────────────────┘
```

Die Gruppen-Karten bekommen `.md-card--tint-indigo` (nicht `.md-list-item`, sie
sind mehrzeilig).

Die echte Seite gliedert in **„Meine Gruppen"** und **„Gruppen entdecken"** —
das Mockup zeigt nur „Beliebte Gruppen in deiner Nähe". Beide Abschnitte
behalten, beide bekommen die Tönung.

> Die Sichtbarkeitsregel dahinter: Jede:r kann eine Gruppe gründen, aber nur
> die aktivsten erscheinen prominent. Alles andere ist über die Suche
> auffindbar — Sichtbarkeit als leiser Moderationsfilter, ohne dass die App
> Freitexte durchsuchen und bewerten muss.

---

## 5. Inhalte — was ist echt, was ist Platzhalter

**Alle Namen in den Screenshots sind erfunden** — Jana, Markus, Elena, Tobias,
Nina, David, „Frühaufsteher München". Das ist Absicht: die echte Vorschau zeigte
den Namen und das Foto einer echten Person. In Entwürfen und Screenshots stehen
keine echten Personendaten.

### ✅ Vorhanden

| Anzeige | Quelle |
| --- | --- |
| Reiter-Umschaltung | `components/community/CommunityTabs.tsx` |
| Beiträge, Likes, Kommentare, Medaille | `useFeed()` — `posts`, `fetchPosts`, `bildAdresse`, Typen `FeedPost`, `FeedComment` |
| Bilder | `bildAdresse()`, Komponente `Bildergalerie` |
| Ladezustand | `LoadingSpinner` |
| Ladefehler | eigener Block mit `--md-error-container` — gutes Muster, auch für andere Seiten |
| Verabredungen | `CommunityMeetups.tsx`, „Kommende Läufe", „Lauf vorschlagen" |
| Gruppen | `CommunityGroups.tsx`, „Meine Gruppen" und „Gruppen entdecken" |
| Melden / Aktionen | `MeldenBlatt`, `AktionsBlatt`, `useSnackbar()` |

### ⚠️ Zu klären

| Punkt | Frage |
| --- | --- |
| **Goldmedaille** | Siehe Abschnitt 2 — wo sitzt sie, und wie wirkt Gold im dunklen Thema? |
| **Kennzahlen im Beitragskopf** („10,2 km · 52:30 min · 5:09 min/km") | Trägt ein Beitrag den verknüpften Lauf? Prüfen, ob `FeedPost` das hat oder ob es nur Text ist. |
| **„42 km/Wo"-Abzeichen** bei ZusammenLauf | Woher? Ist das freiwillig sichtbar (Einwilligung `zusammenlauf`) oder immer? |
| **Filter-Chips bei Gruppen** (Locker/Tempo/Marathon) | Gibt es ein Kategorie-Feld an der Gruppe, oder sind die Chips im Mockup erfunden? |
| **„Diese Woche gemeinsam gelaufen: 486 km"** | Wird das gerechnet? Falls nicht: weglassen. |
| **Unterzeile im Kopf** | „Läufe teilen, ZusammenLauf finden, Fragen stellen" ist fester Text — das ist in Ordnung, es ist eine Beschreibung, keine Angabe. |

### Leere Zustände

- **Feed leer** vs. **Feed-Ladefehler** — die echte Seite trennt das bereits
  sauber. Beibehalten.
- **Keine Verabredungen** → „Noch keine Verabredungen" gibt es schon.
- **Keine eigenen Gruppen** → Abschnitt „Meine Gruppen" ausblenden oder Hinweis?

---

## 6. Abnahme

- [ ] Alle drei Reiter tragen denselben dunklen Kopf, Reiter sitzen **darin**
- [ ] Aktiver Reiter in der vollen Markenfarbe
- [ ] Beiträge bleiben **ungetönt** (kein farbiger Balken im Feed)
- [ ] Personen- und Gruppen-Zeilen sind indigo getönt
- [ ] **Die Goldmedaille ist noch da** und funktioniert
- [ ] Der Datenschutz-Hinweis bei ZusammenLauf steht unverändert
- [ ] Leerer Feed und Feed-Ladefehler sehen unterschiedlich aus
- [ ] Keine echten Personennamen in Screenshots oder Testdaten
- [ ] Hell und dunkel gezeigt
