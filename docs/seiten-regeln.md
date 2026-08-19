# Seitenregeln

Diese Regeln gelten für **jede neue Seite** in `myprosole_web`. Sie sind der
Teil der Entwicklungsstandards, der sich auf Aussehen und Aufbau bezieht.

## Warum es diese Datei gibt

Eine Seite ging ohne Seitencontainer in die App: Der Titel war in der Hülle
schon eingetragen, die Route lag daneben. Beide Hälften derselben Änderung, an
zwei Stellen, nie gegeneinander geprüft. Am Telefon klebte der Inhalt am Rand.

Regeln in Prosa haben das nicht verhindert – sie standen schon da. Deshalb ist
alles, was sich mechanisch prüfen lässt, in `scripts/check_page_rules.py`
hinterlegt und läuft bei jedem `run_tests.py --suite all` mit. Was Augen
braucht, steht hier als Prüfliste.

## Der Aufbau einer Seite

Eine Seite bringt **kein eigenes Grundgerüst** mit. Sie liefert nur ihren
Inhalt; alles andere kommt aus `AppShell`:

```tsx
// App.tsx – die Route gehört IN diesen Block
<Route element={<AppShell />}>
  <Route path="meine-seite" element={<MeineSeite />} />
</Route>
```

`AppShell` liefert `<main class="md-page-stack md-page-stack--with-nav">`.
Daher kommen die seitlichen Abstände (16 px), der Platz für die Navigation
unten und der sichere Bereich am Bildschirmrand. Eine Seite daneben hat davon
nichts – der Inhalt klebt am Rand.

Dazu gehört ein **Titel** in `TopAppBar.tsx`, sonst bleibt die Kopfzeile leer:
`ROOT_TITLES` für die fünf Hauptseiten, `SUB_ROUTES` für alles darunter.

**Vollbild ohne Hülle** ist die Ausnahme und braucht eine Begründung in
`VOLLBILD_ERLAUBT` (`scripts/check_page_rules.py`). Berechtigt ist sie nur,
wenn Navigation im Weg wäre: laufende Aufzeichnung, laufendes Training, ein
Frageablauf mit Fortschritt.

## Farben

Nie feste Werte, immer Gestaltungswerte – sonst kennt die Farbe den Hellmodus
nicht und ändert sich bei einer Anpassung der Palette nicht mit.

| Wofür | Wert |
|---|---|
| Grundfläche, Text darauf | `--md-background`, `--md-on-background` |
| Karten, Text darauf | `--md-surface`, `--md-on-surface`, `--md-on-surface-variant` |
| Hauptfarbe, Text darauf | `--md-primary`, `--md-on-primary`, `--md-primary-container` |
| Linien, Ränder | `--md-outline`, `--md-outline-variant`, `--md-card-border` |
| Fehler, Warnung, Erfolg | `--md-error`, `--md-warning-container`, `--md-success-container` |
| Medaille | `--md-gold`, `--md-gold-container` |
| Abdunkeln über Bildern | `--md-scrim`, `--md-on-scrim` |

Eine feste Farbe ist nur erlaubt, wenn sie von außen vorgegeben ist –
Markenzeichen, Text auf einem Foto, Rückfallwert für die Karte. Dann muss sie
sich erklären, in der Zeile oder darüber:

```tsx
// feste-farbe-ok: Google schreibt die weisse Flaeche hinter seinem Zeichen vor
```

## Abstände, Radien, Schrift

| Abstand | | Radius | | Schrift |
|---|---|---|---|---|
| `--space-xs` 4 | | `--radius-sm` 8 | | `--type-display` |
| `--space-sm` 8 | | `--radius-md` 12 | | `--type-title-lg` / `-md` |
| `--space-md` 16 | | `--radius-lg` 16 | | `--type-body-lg` / `-md` |
| `--space-lg` 24 | | `--radius-xl` 28 | | `--type-label-lg` / `-md` |
| `--space-xl` 32 | | `--radius-full` | | |

Die Seite setzt **keinen eigenen seitlichen Abstand** – der kommt aus der
Hülle. Wer selbst `padding: 16px` setzt, hat ihn doppelt.

Ebenso **kein eigener sicherer Bereich**: `env(safe-area-inset-*)` steht
zentral in `index.css` (oben am `body`, unten am `.md-page-stack`). Eine Seite,
die ihn nochmals setzt, schiebt den Inhalt zu weit.

## Scrollen

Eine Seite scrollt **nur, wenn ihr Inhalt nicht hineinpasst**. Passt alles auf
den Bildschirm, steht die Seite still – auch dann, wenn später etwas dazukommt,
das nicht mehr passt: Dann wird sie von selbst scrollbar.

Das ist kein Verhalten, das eine Seite selbst herstellt. Es kommt aus der
Hülle, und zwar über den Platz für die untere Leiste:

- **Falsch** war eine Polsterung am Inhalt (`padding-bottom`). Sie gehörte zur
  Mindesthöhe des Inhalts und machte jede kurze Seite um genau diesen Betrag zu
  hoch – Start, Übungen und Verlauf scrollten, obwohl alles hineinpasste.
- **Richtig** ist ein eigener Streifen unter dem Inhalt (`.md-nav-reserve` mit
  `flex: 0 1 …`). Er nimmt nur, was nach dem Inhalt übrig bleibt. Passt die
  Seite, bleibt sie stehen; passt sie nicht, behält die letzte Karte ihren
  Abstand zur Leiste.

Für eine neue Seite heißt das: **nichts tun**. Kein eigener unterer Abstand für
die Leiste, kein `height: 100vh`, kein eigenes `overflow`. Wer das setzt, hebt
die Regel für seine Seite auf.

## Knöpfe

`md-button` plus eine Ausprägung: `--filled` für die Haupthandlung,
`--tonal` für die zweite, `--text` für Nebensächliches, `--compact` für enge
Stellen. Ein Knopf, den man mit dem Daumen trifft, ist mindestens 48 px hoch.

## Prüfliste für jede neue Seite

Automatisch geprüft (`run_tests.py --suite all`):

1. Route liegt in `AppShell` – oder mit Begründung in `VOLLBILD_ERLAUBT`
2. Titel in `TopAppBar.tsx` vorhanden
3. Keine feste Farbe ohne Begründung

Mit den Augen zu prüfen, am Gerät, nicht im Browserfenster:

4. Abstände links wie rechts gleich, nichts läuft über den Rand hinaus
5. Unterster Knopf nicht am Bildschirmrand geklebt
6. Seite scrollt nicht, obwohl alles hineinpasst
7. Tippziele mindestens 48 px
8. Hell- **und** Dunkelmodus angesehen
9. Klicktiefe: Ist die Seite ohne verstecktes Menü erreichbar? Führt eine
   Zeile auf eine Seite, ist sie ein Link – kein Knopf mit Hinweis
