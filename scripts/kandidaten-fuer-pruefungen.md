# Kandidaten für neue Prüfungen

Fehlerklassen, die **mehrfach** aufgetreten sind und deshalb ein Skript
verdienen — nicht eine Regel in Prosa. Der Anlass steht dabei, damit ein
späterer Leser weiß, ob der Kandidat noch aktuell ist.

Vorbild ist `check_upsert_ziele.py`: Er entstand, nachdem zwei unabhängige
Quelltextlesungen denselben blinden Fleck hatten. Der Satz, der ihn ausgelöst
hat, gilt für alles auf dieser Liste:

> Ein Skript, das das automatisch fängt, ersetzt „ein Agent hat zufällig
> gemessen" durch „das kann nicht mehr passieren".

Was hier steht, ist **notiert, nicht beschlossen**. Ob und wann gebaut wird,
entscheidet der Nutzer.

---

## 1. Wer `localStorage` benutzt, dessen Test muss ihn nachbauen

**Notiert am 25.08.2026.**

**Der Anlass.** Ein Test, der beweisen sollte, dass Fragebogen-Entwürfe beim
Abmelden gelöscht werden, war **leer grün**. Die Testumgebung ist `node`, es
gibt kein `localStorage`; `entwurfMerken` fängt den Fehlschlag selbst ab
(bewusst, damit ein voller Speicher den Fragebogen nicht anhält), und
`entwurfLesen` gibt danach `null` zurück. Der Test wäre grün geblieben, egal
was der Quelltext tut. Aufgefallen ist es nur, weil er **sofort** grün war,
wo er rot sein musste.

**Der Umfang.** Zehn Module benutzen `localStorage`:

```
lib/anamneseEntwurf.ts      lib/chatGelesen.ts        lib/design.ts
lib/laufMerker.ts           lib/pendingSignup.ts      lib/punktePuffer.ts
lib/ruhepegelSpeicher.ts    lib/runningPlan.ts
components/community/Zusammenlauf.tsx
components/layout/Benachrichtigungen.tsx
```

**Genau einer** hat einen Test, der `localStorage` nachbaut:
`lib/laufMerker.test.ts:16-25`, per `vi.stubGlobal`. Bei allen anderen ist
offen, ob ihre Tests überhaupt etwas messen.

**Was die Prüfung tun müsste.** Für jedes Modul, das `localStorage` benutzt
und eine Testdatei hat: prüfen, dass diese Testdatei `localStorage` nachbaut
(`vi.stubGlobal('localStorage'` oder eine Testumgebung, die ihn mitbringt).
Fehlt der Nachbau, ist der Test verdächtig — nicht zwingend falsch, aber
ungeprüft.

**Warum ein Skript und keine Regel.** Diese Lücke ist von außen unsichtbar:
Der Test ist grün, die Suite ist grün, und der Fehler zeigt sich erst im
Feld. Eine Regel in Prosa hilft nur dem, der beim Schreiben daran denkt — und
genau das habe ich beim ersten Versuch nicht getan.

**Verwandt:** Tag `nachbau-luecke`, angelegt am 23.08.2026, nachdem ein
Nachbau dreimal an einem Abend schwächer war als die Wirklichkeit
(`.eq()` gab ein Promise statt der Kette, `.range` fehlte, `.upsert` fehlte).
Jedes Mal sah die Lücke wie ein Fachfehler aus.

---

## 2. `?? []` und `?? null`, wo der Wert eine Aussage über den Nutzer trägt

**Notiert am 24.08.2026, verschärft am 25.08.2026.**

**Der Anlass.** Dieselbe Fehlerklasse in **drei** Dateien an zwei Tagen:

| Datei | die Abbildung | die Folge |
| --- | --- | --- |
| `store/communityProfile.ts` | unbekannte Einstellungen → Vorgaben | `sichtbar_fuer` wäre auf „alle" gesetzt worden |
| `store/anamnese.ts` | Ladefehler → `sessions: []` | Nutzer landete wieder in der Registrierung |
| `store/auth.ts` | Ladefehler → `profile: null` | Nutzer landete in „Profil einrichten" |

Der dritte Fall wurde vom Nutzer **aus der laufenden Produktion** gemeldet,
mit Bildschirmfoto — Stunden nachdem ich im Bericht zum zweiten geschrieben
hatte: *„dass er ein zweites Mal auftrat, spricht dafür, dass es ein drittes
Mal gibt."*

**Was die Prüfung tun müsste.** `?? []`, `?? null` und `|| []` in
`src/store/**` finden und melden, wenn im selben Aufruf ein `error` aus einer
Supabase-Antwort **nicht** ausgelesen wird. Das ist der gemeinsame Nenner
aller drei Fälle: `const { data } = await supabase...` ohne `error`.

**Zusatz, aus dem dritten Fall:** `.single()` meldet **null Zeilen** als
Fehler (PGRST116). Wer `.single()` benutzt und den Fehler pauschal behandelt,
kann „es gibt keins" nicht von „ging schief" unterscheiden. Auch das wäre
maschinell auffindbar.

**Regel dazu**, seit 25.08.2026 in `docs/DEVELOPMENT_STANDARDS.md` unter
*„Markieren, nicht verwerfen und nicht kappen"*.

---

## 3. Eine Testumgebung für Komponenten — Voraussetzung, keine Prüfung

**Notiert am 25.08.2026, vom Nutzer ausdrücklich als eigene Aufgabe
zurückgestellt.**

**Der Anlass.** Der Agent `pruefung` fand, dass von den drei Ursachen des
„Registrierung kommt immer wieder"-Fehlers eine gar nicht geprüft war: die
Umstellung des Wächters von `[user]` auf `[user?.id]`, die verhindert, dass
bei jeder Token-Erneuerung neu geladen wird.

Die **Entscheidung** des Wächters ist inzwischen als reine Funktion
herausgezogen und geprüft (`lib/wegweiser.ts`, elf Tests). Was bleibt, ist
die Eigenschaft eines **Effekts** — und dafür müsste die Komponente
tatsächlich rendern.

**Die Lage.** `myprosole_web` hat weder `jsdom` noch `happy-dom` noch
`@testing-library/*`. Es gibt im ganzen Projekt keinen einzigen
Komponententest. Der Projektplaner hat einen (`TaskEditTabs.test.tsx`), aber
das ist ein anderes Projekt mit eigenen Abhängigkeiten.

**Warum es hier steht.** Es ist die **Voraussetzung für Kandidat 1**: Zehn
Module benutzen `localStorage`, und eine Testumgebung, die ihn mitbringt,
wäre der geradere Weg als zehnmal `vi.stubGlobal`.

**Bedingungen des Nutzers, wörtlich:**

- **Nicht** in den Diff vom 25.08.2026 — eigene Aufgabe.
- **Mit Versionsrecherche statt Gedächtnis.** Was heute die übliche Wahl ist,
  wird nachgeschlagen (stehende Regel „Recherche vor technischen
  Festlegungen"), nicht aus der Erinnerung entschieden.
- **Eingeordnet gegen die Frischklon-Lücke**: Die Prüfsuite lässt sich auf
  einem frischen Klon heute nicht vollständig ausführen — sie braucht
  `node_modules` in drei Projekten, die nicht eingecheckte `.env.local` und
  die Playwright-Browser; ohne das kommt sie auf 10 von 15. Neue
  Testabhängigkeiten machen diese Lücke eher größer. Beides gehört zusammen
  entschieden, nicht nacheinander.

**Was offen bleibt, bis das entschieden ist:** Die Token-Erneuerungs-Weiche
ist **nicht geprüft**. Das steht so im Abschlussbericht vom 25.08.2026 und
wird nicht als geprüft ausgegeben.

---

## 4. Kleinbefunde aus dem Deploy-Umbau vom 25.08.2026

**Notiert, nicht bearbeitet** — vom Nutzer ausdrücklich aus dem Commit
herausgehalten. Alle vom Agenten `pruefung` gefunden.

| Was | Wo | Warum es wartet |
| --- | --- | --- |
| Der `rglob`-Fehlalarm lebt im Test weiter | `myprosole_app/tests/test_design_mockups.py`, Größenprüfung über `DESIGN_ROOT.rglob("*")` | Eine 30-MB-Datei in `mockups-entwurf/` macht den Test rot, obwohl Cloudflare sie nie sieht. Genau der Fehlalarm, den der Commit aus `check()` entfernt hat — in der Testdatei blieb er stehen. |
| Zwei Wege, das Deploy-Modul zu importieren | `_deploy_modul()` gegen den `sys.path`-Tanz in `test_only_the_design_folder_is_ever_published` | Ausgerechnet im Commit, der zwei Wege abschafft. |
| `TemporaryDirectory` ohne `ignore_cleanup_errors` | `scripts/deploy_prototype.py` | Meldet Windows beim Aufräumen einen offenen Griff, kommt der Traceback **nach** dem Upload und **vor** `confirm_live()`: hochgeladen ist alles, bestätigt nichts, der Link wird nie gedruckt. |
| Doppelter Eintrag in `AUSLIEFERN` | `scripts/deploy_prototype.py` | Stünde etwa `"mockups"` und `"mockups/welcome.html"` darin, zählt `dateien_zum_ausliefern()` doppelt, `buehne_bauen()` einfach — Abbruch mit einer Meldung, die von der Ursache wegführt. |
| Die Anleitung beschreibt das alte Verhalten | `myprosole_app/docs/prototyp-teilen.md` | „Es prüft vorher, dass der Ordner […] keine Unterlage enthält" — stimmt seit der Positivliste nicht mehr, und `AUSLIEFERN` kommt dort gar nicht vor. |
| Zwei Tests behaupten `check() == []` über den echten Arbeitsbaum | `test_design_mockups.py` | Solche Zusicherungen fallen aus Gründen, die mit dem Testnamen nichts zu tun haben. |
| `mockups-entwurf` wird im Test angelegt und nie weggeräumt | `test_design_mockups.py` | Heute folgenlos, weil der Ordner verfolgt ist. |

**Und ein Fund von außerhalb dieses Umbaus, gleich hier notiert:**
`myprosole_web/public/icons.svg` (6 Symbole, 5 KB) wird von **niemandem** im
Quelltext referenziert — die Symbole liegen seit einiger Zeit direkt in
`src/components/ui/IconSprite.tsx`. Sieht nach einem Überbleibsel aus.
**Nicht angefasst**, weil eine Datei in `public/` auch von außen aufgerufen
werden kann und ich das nicht ausschließen konnte.

---

## 5. Der Katalog gegen die Migrationen

**Notiert am 26.08.2026.**

**Der Anlass.** Beim Prüfen der Vorbedingungen für 0057 kam heraus:
`public.darf_ich_anfragen(ziel uuid)` steht in der Produktionsdatenbank,
`security definer`, ausführbar für `authenticated` — und **in keiner
Migration des Repos**. Alle vier committeten Fassungen von 0056 durchsucht;
sie war immer in `intern`.

Gefunden hat sie eine Zählung, die etwas anderes prüfen sollte: „vier
Funktionen müssen da sein" meldete **fünf**. Hätte dort „mindestens vier"
gestanden — die naheliegendere Formulierung —, wäre sie grün gewesen.

**Was daraus folgt, und es ist größer als der eine Fund.** Wir wissen seit
dem 25.08., dass die Migrationshistorie der Produktionsdatenbank **leer**
ist. Daraus folgte bisher nur eine Warnung vor `supabase db push`.

Es folgt aber auch: **Niemand hat je geprüft, ob der Katalog zu den
Migrationen passt.** Wir kennen die Migrationen, die wir geschrieben haben.
Was tatsächlich in der Datenbank steht, ist eine andere Frage — und sie
wurde nie gestellt.

**Was die Prüfung tun müsste.** Aus den Migrationen die erwarteten Objekte
ableiten (Funktionen mit Signatur, Policies je Tabelle, Spaltenrechte) und
gegen `pg_proc`, `pg_policies` und `information_schema` halten. Beide
Richtungen melden:

- im Katalog, nicht in den Migrationen → wie dieser Fund
- in den Migrationen, nicht im Katalog → eine Migration, die nie oder nur
  halb lief (auch das ist heute passiert: 0056 kam beim ersten Einspielen
  auf **2 von 4** Funktionen, ohne dass es jemandem auffiel)

**Warum ein Skript und keine Regel.** Beide Seiten sind abfragbar, der
Vergleich ist mechanisch, und die Lücke ist von außen unsichtbar: Die
Migrationen lesen sich vollständig, die App läuft, und trotzdem steht in der
Datenbank etwas, das niemand geschrieben hat.

**Einschränkung, die dazugehört:** Die Prüfung braucht Zugriff auf die
Produktionsdatenbank. Sie kann deshalb nicht Teil von `run_tests.py` sein,
sondern ist ein Werkzeug, das der Nutzer gegen den SQL-Editor fährt — oder
eines, das gegen die **lokale** Datenbank läuft, nachdem alle Migrationen
dort eingespielt wurden. Das Zweite ist billiger und fängt den Fall
„Migration erzeugt etwas anderes als gedacht"; den Fall „jemand hat von Hand
etwas angelegt" fängt nur das Erste.
