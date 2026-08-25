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
