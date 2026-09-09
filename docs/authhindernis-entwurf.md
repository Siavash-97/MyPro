# Entwurf: das Hindernis für Fehlschläge

**Begonnen 04.09.2026** · Kandidat 1 der Architektur-Durchsicht vom 03.09.2026
· Befragung nach `grilling`, in Runden

> **Diese Datei ist der Arbeitsstand, nicht der Gesprächsverlauf.**
> Sie entsteht **vor** der ersten Frage und wird nach jeder Antwort
> fortgeschrieben. Gearbeitet wird ab jetzt aus ihr, nicht aus dem Verlauf —
> die Sitzung stand beim Anlegen bei 2 % vor der automatischen
> Komprimierung, und eine Befragung dieser Größe läuft mitten hinein.
>
> Wer hier etwas nachliest, liest den geltenden Stand. Wer im Verlauf
> nachliest, liest, was zufällig übriggeblieben ist.

---

## 1. Der Rahmen — was schon entschieden ist

Diese Befragung muss das Konzept **nicht** erfinden. Zwei Dokumente haben es
bereits festgelegt:

**`docs/ubiquitous-language.md:108`**

> **Hindernis** — Der benannte Grund, warum etwas nicht geht — **nie eine
> rohe Fehlermeldung.** (`Hindernis`, `dienstHindernis`)

**`docs/fahrplan-bis-zur-einlage.md:70` und `:77-83`** — Scheibe 7, 8 Stunden,
von nichts blockiert:

> Es gibt 61 Stellen in 13 Dateien, die eine rohe Meldung durchreichen. Der
> falsche Weg wäre, 61 Stellen anzufassen. Der richtige ist **ein tiefes
> Modul**, das aus jedem Fehler ein benanntes `Hindernis` macht — die 61
> Aufrufer rufen dann eine Funktion, und die Regel gilt danach von selbst,
> auch für die 62. Stelle, die noch niemand geschrieben hat.

**Offen ist damit nicht das Ob, sondern:** wo die Naht liegt, welche
Kategorien es gibt, wo die Grenze zwischen Kategorie und Wortlaut verläuft,
und was mit dem offenen Rand geschieht.

---

## 2. Was gemessen ist

Alles hier ist am Quelltext nachgezählt, nicht geschätzt.

### Die neun Signaturen in `store/auth.ts`

| Zeile | Funktion | Fachlichkeit |
| --- | --- | --- |
| 22 | `signIn` | Anmeldung |
| 23 | `signInWithGoogle` | Anmeldung |
| 25 | `handleOAuthCallback` | Anmeldung |
| 51 | `verifyCode` | Anmeldung |
| 53 | `resendCode` | Anmeldung |
| 76 | `createProfile` | **Profil** |
| 77 | `resetPassword` | Anmeldung |
| 79 | `setzePasswort` | Anmeldung |
| 81 | `setAvatar` | **Dateiablage** |

Dazu `signUp` (`:31-38`) mit **anderer Verpackung, gleicher Krankheit**:
`Promise<{ error: string | null, bestaetigungNoetig, bereitsRegistriert }>`.
Das `error`-Feld ist ebenfalls Rohtext.

**Die Signatur ist das Symptom, nicht die Grenze.** Wer nach ihr zählt,
verliert `signUp`; wer nach Funktionsnamen zählt, verliert vier andere.

### Die zwölf Aufrufstellen

| Was dort geschieht | Stellen |
| --- | --- |
| Rohtext **verworfen**, fester Satz eingesetzt | Login, Register, ForgotPassword, Welcome, CodeConfirmForm (2×) |
| Rohtext **angezeigt** — Verstoß gegen `lib/melden.ts:83` | `ProfileSetup.tsx:55`, `PasswortNeu.tsx:54`, `Profile.tsx:108` |
| Rückgabewert **nur als Wahrheitswert** gelesen, Fehlerzweig **leer** | `App.tsx:92` (`handleOAuthCallback`) — gefangen und geschwiegen; dieselbe Klasse wie `signInWithGoogle`, anderer Mechanismus |

**Nachtrag 04.09.2026 — meine Aufzählung „drei Rohtext-Anzeigen" war zu
klein.** Es gibt eine **vierte**, und sie steht nicht in `store/auth.ts`:

`RunDetail.tsx:174` zeigt `Strecke nicht verfügbar: ${punkteFehler}`. Das Feld
`punkteFehler` hat **sechs Schreiber** (`store/run.ts`; „fünf" stand hier bis
zur Durchsicht von Commit 1 am 05.09. — `:1695` war übersehen) — und keiner
übersetzt zuverlässig:

| Zeile | was hineinkommt | übersetzt? |
| --- | --- | --- |
| `1645` | `abschluss.fehler` (Rohtext aus `punkteSenden`) | nein |
| `1647` | `grund.message` aus einem `catch` | nein |
| `1695` | `${vorher} \| ${meldung}` — hängt an das Vorhandene an | nein |
| `1997` | `menschenlesbar({...})` | **nur für stumme Codes** — `supabaseFehler.ts:63`: `return fehler.message ?? rueckfall`, sonst Rohtext |
| `2009` | `grund.message` aus einem `catch` | nein |
| `2470` | `` `${error.message} (${error.code})` `` | nein — **plus Fehlercode** |

**Berichtigt 05.09.:** Auch der fünfte übersetzt nur für die stummen Codes und
reicht sonst den Rohtext durch. Sechs Schreiber, keiner zuverlässig. Damit ist
die Form aus Q2 noch deutlicher: **Ein Feld, das an einer
Stelle übersetzt wird und an vier nicht, sieht wie Absicht aus und ist
Vergessen.** `2470` gibt zusätzlich `error.code` auf den Bildschirm.

Zum Vergleich das Gegenbeispiel, das trägt: `ladefehler` wird **nur auf
seinen Wahrheitswert** gelesen (`ladezustand.ts:59`), der Text erreicht die
Seite nie — und `RunDetail.tsx:129-134` schreibt hin, warum. Dieselbe
Bauart, entgegengesetztes Ergebnis, weil dort jemand die Frage gestellt hat.

### Die belegten Folgen

| Wo | Was der Mensch las | Was wirklich war |
| --- | --- | --- |
| ForgotPassword | „Bitte prüfe deine E-Mail-Adresse" | Ratenbegrenzung oder Server |
| Login | „E-Mail oder Passwort falsch" | Funkloch |
| Register | englischer Supabase-Rohtext | beliebig |
| CodeConfirmForm | „Prüf die sechs Ziffern" | auch offline, 429, 500 |

Die Oberfläche hat daraufhin eine **dritte Fehler-Gestalt** bekommen („nicht
die Schuld des Menschen"). Sie steht auf vier Seiten und **keine
Aufrufstelle kann sie auslösen** — der Auslöser fehlt an der Quelle.

### Die drei Antworten, die das Haus schon gibt

| Modul | gibt zurück | Wortlaut kommt von |
| --- | --- | --- |
| `lib/stoppfehler.ts` | Kategorie | **Oberfläche** (`LiveTracking.tsx:73`) |
| `lib/dienstHindernis.ts` | Kategorie | **Bibliothek** (`hindernisMeldung`) |
| `lib/supabaseFehler.ts` | Text | Bibliothek, mit Rückfall |
| `store/auth.ts` | Rohtext | **zwölf React-Handler, jeder für sich** |

### Die Trennlinie, die das Haus selbst benennt

`lib/dienstHindernis.ts:19-27` — und sie ist schärfer als
„Oberfläche gegen Speicher":

> Das ist eine geschlossene, bekannte Menge von drei Faellen … Ein
> Datenbankfehler ist das Gegenteil: eine offene Menge fremder Meldungen,
> deren Uebersetzung nur raten koennte. Das ist die Trennlinie — nicht
> „Oberflaeche gegen Speicher", sondern **geschlossen gegen offen**.

### Testbarkeit heute

- `store/auth.test.ts` **existiert** — 255 Zeilen, 8 Tests — und deckt **nur**
  `fetchProfile` und `signOut`. Null Nennungen von `signIn`, `resetPassword`,
  `verifyCode`, `resendCode`, `setAvatar`, `createProfile`.

  **Das ist kein fehlendes Testfeld, sondern eines, das wie Abdeckung
  aussieht und keine ist.** Wer „auth.test.ts, 255 Zeilen" liest, schließt auf
  geprüfte Anmeldung. Es ist Punkt 2 des Standards-Vorschlags — unbenannte
  Reichweite — angewandt nicht auf einen Test, sondern auf eine ganze Datei.
- Der Supabase-Nachbau dort stellt `signInWithPassword`, `verifyOtp`,
  `resend`, `resetPasswordForEmail`, `updateUser` **gar nicht** bereit.
- Keine Komponententests. Die einzige Naht, an der „bei Fehlerart X zeigt
  die Seite Y" geprüft wird, sind drei Playwright-Dateien — und die weisen
  ihre Lücke selbst aus (`anmelden-fehler.spec.ts:47`: *„Er braucht eine
  Kategorie von `signIn`, die es noch nicht gibt."*).

---

## 3. Eine Anmerkung zur Methode

An diesem Tag sind **drei Aufzählungen zu klein** ausgefallen — die
`Write`-Regeln, der Kontrastfund, und die Zahl der Signaturen. Alle drei nach
demselben Muster: **gesucht wurde, was erwartet wurde, nicht, was die Frage
war.**

Für diese Befragung heißt das: Jede Zahl in dieser Datei trägt ihre
Fundstelle, und eine Aufzählung ohne genannte Grenze gilt als unvollständig,
nicht als vollzählig.

---

## 4. Der Entwurfsbaum

```
Runde 1 (keine Vorbedingungen)
├── Q1  Umfang: alle neun oder nur die Auth-Pfade?
├── Q2  Grenze zwischen Kategorie und Wortlaut
├── Q3  Was geschieht mit dem Rohtext?
├── Q4  Wo liegt die Naht?
└── Q5  Nur Auth, oder die drei Antworten des Hauses vereinheitlichen?

Runde 1  ERLEDIGT  ->  (c) · (a) · (a, umformuliert) · (a) · (b)

Runde 2 (Grenze offen, alle Vorbedingungen erfüllt)
├── R2-Q1  Welche Kategorien je Fachgebiet — und wie heißt der Rest-Fall?
├── R2-Q2  `signUp`s abweichende Verpackung
├── R2-Q3  Was nimmt das Modul entgegen?
├── R2-Q4  Was gibt der Store zurück?
└── R2-Q5  Die vier Rohtext-Felder im Speicher — jetzt oder Folgeauftrag?

Runde 2  ERLEDIGT  ->  unbekannt · (a) · (a) · (a) · (a) + löschen

Runde 3  ERLEDIGT  ->  (b) + Grenze in den Standard · (b) + Wartezeit im Satz · (c) + Grenze im Testkopf

Runde 4  ERLEDIGT  ->  (a) umgeordnet 4→1→2→3abc→5 · (a) als lib/hindernis.ts · (a)

GRENZE LEER — 05.09.2026. Nichts stillschweigend angenommen.
Bauen erst nach Bestätigung des geteilten Stands (Abschnitt 10).
```

---

## 5. Runde 1 — gestellt am 04.09.2026

> **Q3 des Auftrags („welche Kategorien, und der ehrliche Rest-Fall") steht
> bewusst nicht hier**, sondern in Runde 2: Welche Kategorien es gibt, hängt
> davon ab, ob `setAvatar` und `createProfile` mitkommen (Q1) und ob die
> Bibliothek oder die Oberfläche den Wortlaut trägt (Q2). Eine Frage, deren
> Antwort von einer noch offenen Frage abhängt, gehört in eine spätere
> Runde — sonst rät man beim Beantworten.

### Q1 — Umfang: alle neun, oder nur die Auth-Pfade?

`createProfile` (`:76`) schreibt in die Tabelle `profiles`, `setAvatar`
(`:81`) legt eine Datei in den Behälter `avatars`. Beide tragen dieselbe
Signatur, aber **nicht dieselbe Fachlichkeit** — und beide zeigen heute den
Rohtext an, gehören also zu den drei schlimmsten Aufrufstellen.

- **(a) Alle neun plus `signUp`** — eine Naht, ein Muster, kein Rest.
- **(b) Nur die Anmeldung** (sieben) — kleinere Scheibe, aber zwei der drei
  Rohtext-Anzeigen bleiben stehen.
- **(c) Alle neun, aber die Kategorien nach Fachgebiet getrennt** — ein
  gemeinsamer Rahmen, verschiedene Mengen.

**Antwort: (c)** — alle neun, Kategorien nach Fachgebiet getrennt.

(a) zwänge **eine** Kategorienmenge, zugleich „falsches Passwort" und „Datei
zu groß" zu bedeuten. Dann ist sie keine geschlossene Menge mehr — und
geschlossen zu sein ist die ganze Zusicherung (`dienstHindernis.ts:19`).
(b) ließe zwei der drei Rohtext-Anzeigen stehen.

### Q2 — Wer bestimmt den Wortlaut: Bibliothek oder Oberfläche?

Gemessen: **Dieselbe Kategorie braucht auf zwei Seiten verschiedene Sätze.**
„Abgelehnt" heißt auf Login *„E-Mail oder Passwort stimmt nicht, prüf
beides"* und auf Register *„Diese E-Mail hat schon ein Konto"* — zwei völlig
verschiedene Handlungsaufforderungen.

- **(a) Kategorie in die Bibliothek, Wortlaut an die Oberfläche** — die
  Antwort von `stoppfehler.ts`.
- **(b) Wortlaut in die Bibliothek** — die Antwort von `dienstHindernis.ts`;
  zwingt die Bibliothek, die Seite zu kennen.
- **(c) Gemischt** — Vorgabesatz in der Bibliothek, überschreibbar je Seite.

**Antwort: (a)** — Kategorie in die Bibliothek, Wortlaut an die Oberfläche.

Getragen von der Messung: Dieselbe Kategorie heißt auf Login „E-Mail oder
Passwort stimmt nicht" und auf Register „Diese E-Mail hat schon ein Konto".
(c) ist die schlechteste der drei: Ein Vorgabesatz, den fünf Seiten
überschreiben und eine nicht, sieht wie Absicht aus und ist Vergessen —
genau die Bauart, die `punkteFehler` oben vorführt.

### Q3 — Was geschieht mit dem Rohtext?

`lib/punkteSenden.ts:139-163` führt **beides** mit: `fehler` und `code`,
getrennt, mit der Begründung *„seit der Aufrufer entscheiden muss, ob er ihn
einem Menschen zeigen darf"*.

- **(a) Mitführen, aber getrennt** — Rohtext in die Konsole, Kategorie auf
  den Bildschirm.
- **(b) Verwerfen** — kleinste Schnittstelle, aber ein Fehlerbericht ohne
  Rohtext ist schwerer zu lesen.
- **(c) Nur bei unbekannter Kategorie mitführen.**

**Antwort: (a) — aber NICHT in der Fassung, in der ich sie gestellt habe.**

Ich hatte „(a) Rohtext **in die Konsole**" geschrieben. **Mein eigener Beleg
trägt das nicht:** `punkteSenden.ts:139-163` enthält **kein** `console` —
nachgezählt, null Treffer. Der Rohtext wird dort im **Rückgabewert**
mitgeführt, damit der Aufrufer entscheiden kann. Ausgegeben wird er nicht.

`DEVELOPMENT_STANDARDS.md:26-27`: *„Interne Diagnoseinformationen gehören
ausschließlich in geschützte Logs."* Eine Browserkonsole in Produktion ist
keines. Ein Supabase-Rohtext trägt Tabellen-, Spalten- und Bedingungsnamen —
wer die Entwicklerwerkzeuge öffnet, liest das Schema mit.

**Die geltende Fassung:** Rohtext im **Rückgabewert** mitführen · **nie** auf
den Bildschirm · in Produktion **nicht** in die Konsole · wer ihn beim
Entwickeln sehen will, hinter `import.meta.env.DEV`.

Das Argument für (a) bleibt vollständig: Die drei Fehler dieser Woche wurden
gefunden, weil jemand den echten Grund sehen konnte. Das bleibt so — nur
nicht für jeden, der F12 drückt.

### Q4 — Wo liegt die Naht?

- **(a) Neues Modul in `lib/`**, das aus einem Supabase-Fehler ein Hindernis
  macht; der Store ruft es und gibt das Hindernis zurück.
- **(b) Der Store selbst** bildet ab, ohne eigenes Modul.
- **(c) Ein Modul, das die Aufrufstelle ruft** — der Store bleibt, wie er
  ist.

**Antwort: (a)** — neues Modul in `lib/`, vom Store gerufen.

Nur so wird die Übersetzung **ohne Browser prüfbar** — das Muster von
`dienstHindernis.test.ts`, und heute die größte Lücke überhaupt (siehe
Testbarkeit). (c) verlagerte das Raten von zwölf Stellen auf zwölf Stellen;
(b) ließe die Regel wieder an zwölf Stellen von Hand gelten.

### Q5 — Nur Auth, oder die drei Antworten des Hauses vereinheitlichen?

Das Haus beantwortet „wer bestimmt den Wortlaut" heute **dreimal
verschieden**. Eine vierte Antwort wäre der eigentliche Schaden.

- **(a) Nur Auth**, im Muster einer der drei vorhandenen.
- **(b) Auth jetzt, die anderen als benannter Folgeauftrag.**
- **(c) Alle vier in einem Zug** — deutlich größer als die 8 Stunden des
  Fahrplans.

**Antwort: (b)** — Auth jetzt, die anderen als **benannter** Folgeauftrag.

(a) wäre stillschweigend die vierte Antwort des Hauses auf dieselbe Frage —
und das ist der eigentliche Schaden, nicht der Rohtext. (c) sprengt die acht
Stunden. „Benannt" ist die tragende Hälfte von (b): unbenannt ist es (a).

---

## 6. Was nach Runde 1 feststeht

| # | Entscheidung |
| --- | --- |
| Q1 | Alle neun **plus** `signUp`; Kategorien **nach Fachgebiet getrennt** |
| Q2 | **Kategorie** in die Bibliothek, **Wortlaut** an die Oberfläche |
| Q3 | Rohtext im **Rückgabewert**, nie auf den Bildschirm, in Produktion nicht in die Konsole |
| Q4 | **Neues Modul in `lib/`**, vom Store gerufen |
| Q5 | **Auth jetzt**, die drei anderen Antworten des Hauses als benannter Folgeauftrag |

### Die Regelkollision — **in dieser Scheibe**, nicht auf der Liste

> **Umgestuft am 04.09.2026.** Dieser Abschnitt hieß zuerst „Nebenbefund —
> gehört auf die Liste". Das war falsch, und der Grund steht in einer Zeile:
> **`store/run.ts:485` ist das Vorbild, dessen Bauart hier kopiert wird.**
> Solange dort *„für die Konsole, NIE für den Bildschirm"* steht,
> widerspricht das neue Modul seinem eigenen Muster — und der Nächste fügt
> den elften Aufruf regelkonform hinzu. Eine Kollision zwischen zwei Regeln
> wird entschieden, nicht abgelegt.

Die Konsole als Ablageort für Rohtext ist **kein Versehen, sondern eine
niedergeschriebene Hausregel** — und sie steht gegen
`DEVELOPMENT_STANDARDS.md:26-27`.

Nachgezählt am 04.09.2026 in `myprosole_web/src`, ohne Tests:

| Messung | Wert |
| --- | --- |
| Zeilen, die `console.` enthalten | 13 |
| davon **echte Aufrufe** | **10** |
| davon **Kommentare**, die das Muster festschreiben | **3** |
| Aufrufe, die **fremden Rohtext** ausgeben | **8** von 10 |
| Aufrufe hinter `import.meta.env.DEV` | **0** |

> **Die 13 aus dem Auftrag ist die Zahl der Fundzeilen, nicht der Aufrufe.**
> Drei davon sind Kommentare. Beide Zahlen stimmen — sie messen Verschiedenes,
> und wer sie ungeprüft übernimmt, trägt „13 ungeschützte Aufrufe" weiter.
> Dieselbe Sorte Fehler wie die 61 Aufrufstellen aus CLAUDE.md Regel 2.

Die drei Kommentare sind der eigentliche Punkt. `LiveTracking.tsx:63` und
`anamnese.ts:118` sagen *„dasselbe Muster wie in …"*, und
`RunDetail.tsx:130-134` schreibt ausdrücklich:

> *„Der Store hat ihn beim Scheitern schon in die Konsole geschrieben —
> **dorthin gehört er**."*

**Solange das dort steht, fügt der Nächste den elften Aufruf regelkonform
hinzu.** Es ist keine Aufräumarbeit, sondern eine Regelkollision: Sie wird
entschieden und an beiden Stellen nachgezogen, oder sie wiederholt sich.

Die acht mit fremdem Rohtext: `dateiAblegen.ts:70`, `LiveTracking.tsx:508`
und `:613`, `anamnese.ts:121`, `auth.ts:345`, `run.ts:1995`, `:2414`, `:2439`.
Die zwei ohne: `laufdauer.ts:147` und `:157` — dort stehen eigene Zahlen.

---

## 7. Runde 2 — gestellt am 04.09.2026

### Was vorher nachgesehen wurde

Die Namensform ist nicht erfunden, sondern abgelesen:

| Fundstelle | Menge |
| --- | --- |
| `store/run.ts:481` | `type Stoppfehler = 'nicht-angemeldet' \| 'ablage'` |
| `lib/aufzeichnungBruecke.ts:82` | `'keine-erlaubnis' \| 'gps-aus' \| 'start-abgelehnt' \| null` |

**Deutsch, klein, Bindestrich. `null` heißt: es hat geklappt.**

Ein Unterschied zwischen beiden, der beim Abschreiben mitkäme:
`AufzeichnungHindernis` trägt das `null` **im Typ**, `Stoppfehler` nicht
(dort steht `Stoppfehler | null` am Feld). Zwei Bauarten für dieselbe Sache —
für das neue Modul wird eine gewählt, nicht beide geerbt.

> **Und ein vierter Konsolen-Vermerk, direkt im Vorbild.**
> `store/run.ts:485` über `Stoppergebnis.error`: *„Der technische Grund —
> für die Konsole, NIE für den Bildschirm."* Das ist genau die Stelle, deren
> Bauart hier kopiert werden soll — und sie sagt das Gegenteil von Q3. Wer
> `Stoppergebnis` als Muster nimmt, erbt den Vermerk mit. Er wird beim
> Nachziehen ausdrücklich mit umgeschrieben.

### R2-Q1 — Welche Kategorien, und wie heißt der ehrliche Rest-Fall?

Supabase ist eine **offene Menge**; `dienstHindernis.ts:19` sagt, warum eine
solche „nur raten könnte". Ein Rest ist also Pflicht — die Frage ist, wie er
heißt, ohne zu lügen.

**Vorgeschlagenes Trennkriterium:** *Zwei Kategorien sind verschieden, wenn
die **nächste Handlung des Menschen** verschieden ist.* Sonst sind sie eine.

| Fachgebiet | Kategorien |
| --- | --- |
| Anmeldung | `abgelehnt` · `zu-oft` · `nicht-erreichbar` · `nicht-angemeldet` · **Rest** |
| Profil | `verweigert` · `nicht-erreichbar` · `nicht-angemeldet` · **Rest** |
| Dateiablage | `zu-gross` · `format-abgelehnt` · `nicht-erreichbar` · `nicht-angemeldet` · **Rest** |

`nicht-angemeldet` ist bewusst **derselbe Name wie in `Stoppfehler`** — es
ist derselbe Sachverhalt.

Für den Rest-Fall: **(a) `unbekannt`** · (b) `nicht-durchgekommen` ·
(c) `sonstiges`

**Antwort: (a) `unbekannt`**, Kategorien wie vorgeschlagen.

Der tragende Grund gegen (b): **Eine Zeitüberschreitung nach erfolgreichem
Schreiben *ist* durchgekommen.** Das ist wörtlich der
`bestaetigungNachholen`-Fall, an dem dieser Zweig die Woche verbracht hat —
diesen Fehler als Typnamen einzubauen wäre die teuerste Art, ihn zu
wiederholen. `unbekannt` benennt den Wissensstand, nicht einen Ausgang.

### R2-Q2 — `signUp`s abweichende Verpackung

Nachgesehen (`store/auth.ts`, `signUp`): `bereitsRegistriert` entsteht aus
einer **erfolgreichen** Antwort — `error` ist `null`, erkannt an
`data.user.identities.length === 0`. Der Kommentar dort nennt es einen
gefälschten Erfolg und benennt die Abwägung ausdrücklich.

- **(a)** Nur `error` → `hindernis`; `bestaetigungNoetig` und
  `bereitsRegistriert` bleiben, weil sie **Ergebnisse** sind, keine Fehler.
- **(b)** `bereitsRegistriert` wird eine Kategorie `bereits-vergeben`.

**Antwort: (a)** — nur `error` wird zum Hindernis.

Bei (b) erzeugte eine **erfolgreiche** Antwort ein Hindernis, und
„null heißt: es hat geklappt" gälte nicht mehr.

### R2-Q3 — Was nimmt das Modul entgegen?

- **(a) `unknown`**, im Modul verengt.
- **(b)** Die Supabase-Fehlerarten (`AuthError | PostgrestError | …`).
- **(c)** Eine eigene schmale Form, die der Store füllt.

Gemessen: An drei Stellen steht bereits
`grund instanceof Error ? grund.message : String(grund)`
(`run.ts:1647`, `:2009`, `LiveTracking.tsx:613`) — **ein Netzfehler wird
geworfen, nicht zurückgegeben.**

**Antwort: (a) `unknown`**, im Modul verengt.

(b) fängt genau den Fall nicht, der die Login-Meldung im Funkloch verursacht
hat. (c) ist (a) plus zwölf handgeschriebene Vorsortierungen — also das
Raten, das hier verschwinden soll.

### R2-Q4 — Was gibt der Store zurück?

- **(a)** `Promise<Hindernis | null>` mit `Hindernis = { art, rohtext }`.
- **(b)** Zwei Felder nach dem Vorbild `Stoppergebnis` (`art` + `error`).

Bei (b) ist `{ art: null, rohtext: 'boom' }` darstellbar und bedeutungslos —
**dasselbe Argument wie bei den acht Lagen der Zustandsmaschine diese
Woche:** die Summe, nicht das Produkt.

**Antwort: (a)** — `Promise<Hindernis | null>`, `Hindernis = { art, rohtext }`.

### R2-Q5 — Die Rohtext-Felder im Speicher: jetzt oder Folgeauftrag?

`punkteFehler` ist **heute sichtbar** (`RunDetail.tsx:174`) und wird von
`run.ts:2470` mit `error.message` **plus `error.code`** gefüllt. Es liegt
aber in `run.ts`, nicht in `auth.ts` — nach Q5 also Folgeauftrag.

- **(a)** Nur die **Anzeige** jetzt entschärfen (eine Zeile), das **Feld**
  im Folgeauftrag umstellen.
- **(b)** `punkteFehler` ganz jetzt.
- **(c)** Alles in den Folgeauftrag.

Dazu gehört, ob `profilLadefehler` (6× geschrieben, **0× gelesen**)
umgestellt oder **gelöscht** wird.

**Antwort: (a)** — die Anzeige jetzt, das Feld im Folgeauftrag.

**Und `profilLadefehler` wird gelöscht, nicht umgestellt.** Sechs Schreiber,
null Leser außer den eigenen Tests: Der Löschtest fällt eindeutig aus.
Umstellen gäbe einem Feld eine Kategorie, die niemand liest. **Die drei
Testzeilen gehen mit** — ein Test, der nur das Schreiben eines ungelesenen
Feldes prüft, ist genau die Abdeckung, die keine ist.


---

## 8. Runde 3 — gestellt am 04.09.2026

> **Warum der Zuschnitt hier fehlt.** „Was gehört in einen Commit" hängt an
> allen drei Fragen unten. Eine Frage, deren Antwort von einer noch offenen
> abhängt, gehört in eine spätere Runde — sonst rät man beim Beantworten.
> Sie steht deshalb als Runde 4 im Baum.

### R3-Q1 — Wie weit reicht die Konsolen-Entscheidung in dieser Scheibe?

Entschieden ist, **dass** die Kollision hier gelöst wird. Offen ist, wie weit.

- **(a)** Nur die **vier Vermerke** umschreiben, das neue Modul richtig
  bauen. Die zehn Aufrufe bleiben, wie sie sind.
- **(b)** Vermerke **plus die acht Aufrufe mit fremdem Rohtext** hinter
  `import.meta.env.DEV`. Die zwei in `laufdauer.ts` bleiben.
- **(c)** Vermerke plus **alle zehn**.

**Antwort: (b)** — die acht mit fremdem Rohtext hinter `import.meta.env.DEV`, die
zwei in `laufdauer.ts` bleiben.

**Und der Einwand wog mehr als die Antwort.** Ich hatte „interne
Diagnoseinformationen" zitiert und dann auf Schemanamen verengt, ohne die
Verengung zu benennen — die plausible Erklärung an der Stelle der Regel.

**Die Grenze, die trägt und die wörtlich in den Standard gehört:**

> **Text, den die Anwendung nicht selbst formuliert hat, gehört nicht in
> die Konsole der ausgelieferten Fassung.**

Sie trennt beide Fälle, ohne „Schemaname" zu sagen: Eine Meldung von
Supabase, vom Dateisystem oder aus einer Bibliothek kann Namen tragen, die
niemand im Projekt gewählt hat, und niemand kann vorher wissen, welche.
`laufdauer.ts` gibt einen selbst gerechneten Wert in einem selbst
geschriebenen Satz aus — dort ist die Menge dessen, was herauskommen kann,
**geschlossen**. Dieselbe Trennlinie wie `dienstHindernis.ts:19`,
geschlossen gegen offen, nur auf Text angewandt.

### R3-Q2 — Welche Kategorie löst die dritte Gestalt aus?

Die Gestalt „nicht die Schuld des Menschen" steht auf vier Seiten und **kann
heute von keiner Aufrufstelle ausgelöst werden**. Mit den Kategorien aus
R2-Q1 gibt es erstmals einen Auslöser.

- **(a)** `nicht-erreichbar` und `zu-oft`.
- **(b)** **Alles außer `abgelehnt`.**
- **(c)** Nur `nicht-erreichbar`.

**Antwort: (b)** — alles außer `abgelehnt`, ohne Einschränkung.

Konsistent mit dem Kriterium aus R2-Q1: Bei `zu-oft` heißt die nächste
Handlung „warten", nicht „prüfen". Bei `unbekannt`: Wenn wir es nicht
wissen, ist ihn zu beschuldigen das Einzige, von dem wir sicher wissen,
dass es falsch ist.

**Zusatz zum Wortlaut, nicht zur Einteilung:** Gestalt 3 heißt „nicht
deine Schuld". Bei `zu-oft` muss der Satz **zusätzlich sagen, was jetzt
hilft** — warten, und ungefähr wie lange. Eine Meldung, die nur entlastet,
lässt den Menschen ohne nächsten Schritt. → Die Wartezeit ist R4-Q3.

### R3-Q3 — Die Testnaht: welche Tests, wo?

- **(a)** Nur Einheitstests am neuen Modul.
- **(b)** Modul **plus** `auth.test.ts` — die fehlenden Nachbauten für
  `signInWithPassword`, `verifyOtp`, `resend`, `resetPasswordForEmail`,
  `updateUser`.
- **(c)** (b) **plus** ein Browsertest, der einen Fehlerzustand wirklich
  auslöst und die dritte Gestalt belegt.

Nachgesehen: `page.route` + `route.fulfill` ist bereits Hausmuster
(`passwort-vergessen-fehler.spec.ts:172`), samt der ehrlichen Grenze im Kopf
der Datei — *„eine geroutete Antwort belegt die Reaktion der Seite, nicht das
Verhalten von Supabase."* Ein 429 ist damit billig fälschbar.

**Antwort: (c)** — Modul, Store-Nachbauten **und** ein Browsertest, der einen
Fehlerzustand auslöst.

Ohne (c) baut die Scheibe eine dritte Gestalt mit Auslöser, die niemand je
mechanisch erscheinen sieht — die Lage von heute, nur mit mehr Code.

**Auflage:** Die Grenze gehört **wörtlich** in den Kopf der neuen Prüfung —
*eine geroutete Antwort belegt die Reaktion der Seite, nicht das Verhalten
von Supabase.* Sonst liest sie in drei Wochen jemand als „429 ist geprüft".


---

## 9. Runde 4 — gestellt am 05.09.2026 — die letzte Grenze

### Was vorher nachgesehen wurde

**`zu-oft` ist strukturiert erkennbar.** `@supabase/auth-js` 2.112.3
(`node_modules/.../auth-js/dist/module/lib/errors.js`): `AuthError` trägt
`status` und `code`; die Codes `over_request_rate_limit`,
`over_email_send_rate_limit`, `over_sms_send_rate_limit` stehen in der
Bibliothek. **Kein Textparsen nötig**, um die Kategorie zu erkennen.

**Die Sekundenzahl steht nirgends in der Bibliothek.** Ob der Server sie
außerhalb des Rohtexts liefert (`Retry-After`, eigenes JSON-Feld), ist am
05.09.2026 an `recherche` gegeben — Primärquellen, mit Fundstelle. Bis die
Antwort da ist, bleibt R4-Q3 offen; die zwei anderen Fragen hängen nicht
daran.

### R4-Q1 — Zuschnitt und Reihenfolge der Commits

Jeder Commit für sich grün (16/16). Vorschlag, fünf Schritte:

| # | Inhalt | warum an dieser Stelle |
| --- | --- | --- |
| 1 | **Die Regel zuerst:** Grenzsatz in den Standard; vier Vermerke umschreiben; acht Aufrufe hinter `import.meta.env.DEV` | Das Modul wird unter der berichtigten Regel geboren, nicht gegen sein Vorbild |
| 2 | **Das Modul** mit Einheitstests (`/tdd`), noch ohne Aufrufer | Rot → grün ohne Browser; der Vertrag steht, bevor ihn jemand benutzt |
| 3a/b/c | **Store + Aufrufstellen, je Fachgebiet:** Anmeldung (8 Fn. mit `signUp`, 10 Stellen — nachgezählt 05.09.: 15 grep-Treffer, 3 davon Kommentare) · Profil (1/1) · Dateiablage (1/1) — jeweils mit Browsertest, wo eine Seite betroffen ist | Der Typwechsel zwingt Store und Aufrufer in einen Commit; der Schnitt nach Fachgebiet ist der kleinste, der übersetzt |
| 4 | `punkteFehler`-Anzeige entschärfen; `profilLadefehler` samt drei Testzeilen löschen | Unabhängig von 1–3, je eine Zeile bzw. eine Löschung |
| 5 | Folgeauftrag in `fahrplan-bis-zur-einlage.md` benennen: die drei anderen Antworten des Hauses, das Feld `punkteFehler`, `ladefehler` → Wahrheitswert | „Benannt" ist die tragende Hälfte von Q5(b) |

- **(a)** So, sieben Commits.
- **(b)** 3a/b/c in einem — drei Commits weniger, ein großer.
- **(c)** Andere Reihenfolge: Modul vor Regel.

**Antwort: (a) — aber Commit 4 gehört nach vorn.**

`punkteFehler` ist **heute sichtbar**: Ein Nutzer sieht dort gerade
Schemanamen und einen PostgREST-Code. Alles andere in der Liste ist Umbau.
Nach dem eigenen Grundsatz — **ein Fehler, der heute etwas preisgibt, geht
einem Umbau vor** — ist das der erste Commit, nicht der vierte. Er hängt an
nichts und kostet fünf Minuten. Ihn fünf Commits lang stehen zu lassen wäre
eine Rangfolge nach Erzählung statt nach Wirkung.

**Reihenfolge: 4 → 1 → 2 → 3a/b/c → 5.** Der Rest bleibt: Regel vor Modul,
damit es nicht zwei Commits lang gegen sein Vorbild steht; 3a/b/c getrennt,
weil 3b und 3c in 3a verschwänden.

**Auflage für die Nachricht von Commit 1:** Er ändert `store/run.ts:485`,
eine Datei außerhalb des Auth-Umfangs. Beabsichtigt und der Kern der
Regelkollision — aber es steht in der Nachricht, sonst fragt sich der
nächste Leser, was der Lauf-Store in einer Auth-Scheibe zu suchen hat.

### R4-Q2 — Name und Gestalt des Moduls

Vorbild im Haus: `dienstHindernis.ts` (Fachgebiet + `Hindernis`).

- **(a) Eine Datei, drei Funktionen, ein privater Kern.**
  `lib/supabaseHindernis.ts` mit `anmeldeHindernis(unknown)`,
  `profilHindernis(unknown)`, `ablageHindernis(unknown)`; Typen
  `AnmeldeHindernis`, `ProfilHindernis`, `AblageHindernis`. Das Erkennen
  von 429, geworfenem Netzfehler und fehlender Sitzung ist allen drei
  gemeinsam und steht einmal.
- **(b) Drei Dateien**, je Fachgebiet.
- **(c) Eine Funktion mit Fachgebiet als Parameter.**

**Antwort: (a) — aber nicht unter diesem Namen.**

`supabaseHindernis.ts` benennt den Anbieter, und das Vorbild
(`dienstHindernis.ts`) tut es nicht — nachgesehen: es nennt weder Capacitor
noch sonst eine Technik. Die drei Funktionen folgen der Regel schon; nur die
Datei fiel heraus. Was das Modul **zusichert**, ist „der benannte Grund" —
anbieterfrei, wie `ubiquitous-language.md:108` es definiert. Was es
**verarbeitet**, kommt zufällig von Supabase. Ein Dateiname mit dem Anbieter
sagt, das Modul sei ein Adapter — und beim nächsten Anbieterwechsel lügt er,
ohne dass jemand ihn anfasst.

**`lib/hindernis.ts`.** Beschreibt, was herauskommt, statt was hineingeht.
Nachgesehen am 05.09.: nichts im Haus exportiert `Hindernis` als Typ oder
Datei — der Name ist frei.

### R4-Q3 — Woher kommt die Wartezeit bei `zu-oft`?

**Recherche-Befund vom 05.09.2026** (`recherche`, Primärquellen: GoTrue
`supabase/auth` auf `master`, Commit `0907af9` vom 02.09.2026; `auth-js`
2.112.3 lokal; supabase.com/docs):

| Frage | Befund | Fundstelle |
| --- | --- | --- |
| `Retry-After`-Header bei 429? | **Nein.** GoTrue setzt bei Fehlern genau einen eigenen Header: `x-sb-error-code`. Die Ratenbegrenzung (`tollbooth.LimitByKeys`) schreibt keine Header. | `internal/api/errors.go:162-164`, `middleware.go:72-133` |
| Eigenes JSON-Feld für die Sekunden? | **Nein.** Körper ist exakt `{ code, message }`. Die Zahl entsteht in `fmt.Sprintf` und landet nur im Text. | `errors.go:76-79`, `:255-259` |
| Reicht `auth-js` Header oder Feld durch? | **Nein.** `AuthError` hat `name`, `message`, `status`, `code` — sonst nichts. „Retry-After" kommt im Paket nirgends vor. | `fetch.js:25-79`, `errors.js:11-27` |
| Ist die Zahl im Text überhaupt immer da? | **Nein — nur bei einer von drei Varianten.** Der Satz *„you can only request this after %d seconds"* kommt nur beim **Abstands**-Limit (E-Mail, SMS, MFA). `over_request_rate_limit` heißt immer *„Request rate limit reached"*; das **Stunden**-Kontingent für E-Mail heißt *„email rate limit exceeded"* — **derselbe Code `over_email_send_rate_limit`, mit oder ohne Zahl.** | `errors.go:255-259`, `mail.go:29`, `:342-700` (13 Stellen), `phone.go:73-92` |

**Spur, kein Befund:** Ein Medium-Beitrag zeigt `Retry-After: 60`. Aus dem
Quelltext nicht erklärbar; falls echt, von einer vorgelagerten Schicht
(Kong/Cloudflare). Ob die Cloud-Kante so etwas hinzufügt, sieht man nur an
einer echten Antwort — und `auth-js` würde den Header ohnehin verwerfen.
**Falle:** `X-RateLimit-Reset` gilt für die Management-API, ein anderer
Dienst.

Damit sind die Optionen:

- **(a) Keine Zahl versprechen.** Wortlaut aus der eigenen Dokumentation
  von Supabase: *„try again in a few minutes"* → „Zu viele Versuche. Warte
  ein paar Minuten und probier es dann noch einmal." Die Zahl bleibt im
  `rohtext` für den, der sie beim Entwickeln braucht.
- **(b) Die Zahl aus dem Rohtext lesen**, wenn der Satz sie trägt, sonst
  Rückfall auf (a). Ein Muster, im Modul, mit Rückfall — aber abhängig von
  einem englischen Satz eines fremden Servers, und im eigenen Netz nur gegen
  einen selbst gefälschten Text prüfbar.
- **(c) Zwei Unterkategorien nach `code`** (`over_request_…` gegen
  `over_email_…`/`over_sms_…`). Trägt nicht: Derselbe Code liefert je nach
  Ursache 60 s oder eine Stunde.

**Antwort: (a)** — keine Zahl versprechen.

Eine falsche Zahl ist schlimmer als „ein paar Minuten", weil sie eine
Zusicherung ist und die Vagheit keine. An den Primärquellen belegt, nicht
geschätzt. Die genaue Zahl bleibt im `rohtext`.


---

## 10. Der geteilte Stand — was gebaut wird

**Vier Runden, siebzehn Entscheidungen, keine offene Grenze.** Dies ist der
Vertrag; alles, was beim Bauen davon abweicht, wird hier zuerst geändert.

### Das Modul

- **`lib/hindernis.ts`** — eine Datei, drei Funktionen, ein privater Kern.
- `anmeldeHindernis(unknown)`, `profilHindernis(unknown)`,
  `ablageHindernis(unknown)` — nehmen `unknown`, weil Netzfehler geworfen
  werden, nicht zurückgegeben.
- Rückgabe je `Hindernis<Art> | null`, `Hindernis = { art, rohtext }`.
  `null` heißt: es hat geklappt. Summe, nicht Produkt.
- **Kategorien** (deutsch, klein, Bindestrich, wie `Stoppfehler`):

  | Fachgebiet | Menge |
  | --- | --- |
  | `AnmeldeHindernis` | `abgelehnt` · `zu-oft` · `nicht-erreichbar` · `nicht-angemeldet` · `nicht-bestaetigt` (Runde 5) · `unbekannt` |
  | `ProfilHindernis` | `verweigert` · `nicht-erreichbar` · `nicht-angemeldet` · `unbekannt` |
  | `AblageHindernis` | `zu-gross` · `format-abgelehnt` · `verweigert` (Runde 5) · `nicht-erreichbar` · `nicht-angemeldet` · `unbekannt` |

  Trennkriterium: verschieden, wenn die nächste Handlung des Menschen
  verschieden ist. Rest-Fall `unbekannt` — benennt den Wissensstand, nie
  einen Ausgang.
- **Ob ein Hindernis vorliegt, entscheidet die Existenz des Fehlerobjekts,
  nicht sein Inhalt.** Nachgesehen 05.09. in `postgrest-js` (dist/index.cjs,
  Nicht-OK-Zweig): Ein JSON-Körper wird ungeprüft als Fehlerobjekt
  übernommen, ein leerer Körper ergibt `{ message: '' }`. Ein Fehler ohne
  Code und ohne Meldung ist also erreichbar — er wird `unbekannt`, nie
  `null`. (`menschenlesbar` kann das nicht; steht in dessen Kopf.)
- `zu-oft` wird am `code` erkannt (`over_request_rate_limit`,
  `over_email_send_rate_limit`, `over_sms_send_rate_limit`), nicht am Text.
- **Rohtext:** im Rückgabewert, nie auf dem Bildschirm, in Produktion nicht
  in der Konsole; beim Entwickeln hinter `import.meta.env.DEV`.
- Glossar: `ubiquitous-language.md:108` bekommt `hindernis.ts` und die drei
  Typen in die Spalte „im Code".

### Der Store und die Aufrufstellen

- Alle neun `Promise<string | null>` → `Promise<Hindernis | null>`; bei
  `signUp` nur das Feld `error` → `hindernis`, die zwei Wahrheitswerte
  bleiben (sie sind Ergebnisse).
- **Wortlaut an der Oberfläche**, Kategorie aus der Bibliothek.
- **Dritte Gestalt** („nicht deine Schuld"): alles außer `abgelehnt`. Bei
  `zu-oft` sagt der Satz zusätzlich, was hilft: „Warte ein paar Minuten" —
  **keine Zahl**.
- `App.tsx:92` liest den Rückgabewert von `handleOAuthCallback` **nur als
  Wahrheitswert**; der Fehlerzweig ist **leer** und bekommt die dritte
  Gestalt. (Nicht „verworfen" — gefangen und geschwiegen. Wer nach einem
  fehlenden `const` sucht, findet keins.)

### Die Regelkollision

- Standard bekommt den Satz: **„Text, den die Anwendung nicht selbst
  formuliert hat, gehört nicht in die Konsole der ausgelieferten Fassung."**
- Vier Vermerke umgeschrieben: `LiveTracking.tsx:63`, `anamnese.ts:118`,
  `RunDetail.tsx:130-134`, **`store/run.ts:485`** (das Vorbild).
- Acht Aufrufe mit fremdem Rohtext hinter `import.meta.env.DEV`; die zwei in
  `laufdauer.ts` bleiben (eigene Zahlen in eigenen Sätzen — geschlossene
  Menge). **Form, entschieden beim Bauen (05.09.):** ein Helfer
  `entwicklerWarnung` in `lib/entwicklerkonsole.ts` statt acht Kopien von
  `if (import.meta.env.DEV)` — die Regel steht einmal; danach findet
  `grep console.` in `src/` genau drei **Aufrufe im Produktivcode** (Helfer +
  `laufdauer.ts`; ohne Tests, ohne Kommentarzeilen).

### Aufräumen mit Wirkung heute

- `RunDetail.tsx:174` zeigt `punkteFehler` nicht mehr roh an. **Erster
  Commit.**
- `profilLadefehler` wird **gelöscht** (6 Schreiber, 0 Leser) — samt dem
  **ganzen Test** `auth.test.ts:162-174` („legt den Ladefehler ab, statt ihn
  zu verschlucken"): die „drei Testzeilen" sind seine drei Zusicherungen,
  ohne sie bliebe ein leerer Rumpf. **Folge, benannt:** Ein gescheitertes
  Profil-Laden hinterlässt danach nur noch die Konsolenzeile `auth.ts:345`,
  und die geht in Commit 2 hinter `DEV`. In Produktion keine Spur — was
  für den Menschen schon heute gilt (0 Leser).

### Tests

- Modul: Einheitstests per `/tdd`, Vorbild `dienstHindernis.test.ts`.
- `auth.test.ts`: die fehlenden Nachbauten (`signInWithPassword`,
  `verifyOtp`, `resend`, `resetPasswordForEmail`, `updateUser`) — damit die
  255 Zeilen nicht länger wie Abdeckung aussehen.
- Browsertest mit `page.route`/`route.fulfill` (Hausmuster), der einen 429
  fälscht und die dritte Gestalt belegt. **Im Kopf wörtlich:** *eine
  geroutete Antwort belegt die Reaktion der Seite, nicht das Verhalten von
  Supabase.*

### Reihenfolge — jeder Commit 16/16

| Commit | Inhalt |
| --- | --- |
| 1 | `punkteFehler`-Anzeige entschärfen · `profilLadefehler` löschen |
| 2 | Grenzsatz in den Standard · vier Vermerke (**auch `run.ts:485`, außerhalb des Auth-Umfangs — steht in der Nachricht**) · acht Aufrufe hinter `DEV` |
| 3 | `lib/hindernis.ts` + Tests, ohne Aufrufer · Glossarzeile |
| 4a | Anmeldung: 8 Funktionen, 10 Stellen, Store-Nachbauten, Browsertest 429 |
| 4b | Profil: `createProfile` + `ProfileSetup.tsx:47` |
| 4c | Dateiablage: `setAvatar` + `Profile.tsx`, die `setAvatar`-Aufrufstelle in der Kurzeinblendung — **und die Naht `dateiAblegen.ts`**, die das Fehlerobjekt bis dahin zu Text flachte (Nachtrag 08.09., unten) |
| 5 | Folgeauftrag im Fahrplan: die drei anderen Antworten des Hauses · Feld `punkteFehler` · `ladefehler` → Wahrheitswert |

### Was ausdrücklich nicht in dieser Scheibe ist

`stoppfehler.ts`, `dienstHindernis.ts`, `supabaseFehler.ts` bleiben, wie sie
sind (Folgeauftrag).

### Auflage für den Folgeauftrag zu `punkteFehler` (05.09.2026)

Zwei Module, gleiche Eingabeform, entgegengesetztes Urteil — beide richtig,
aus **derselben** postgrest-js-Messung begründet:

    menschenlesbar({ message: '' })    -> null       „kein Fehler"
    anmeldeHindernis(<leeres Objekt>)  -> unbekannt  „Hindernis"

Was sie trennt, ist die **Herkunft der Eingabe**: `menschenlesbar` bekommt
ein Objekt, das `run.ts:1997` bedingungslos baut — leer heißt dort „bei
Erfolg gebaut". `hindernis.ts` bekommt das Objekt der Bibliothek, das bei
Erfolg `null` ist — nicht-null heißt dort „wirklich schiefgegangen".

**Die Regel von `menschenlesbar` gilt nur, solange ihr einziger Aufrufer
synthetisiert.** Der Folgeauftrag fasst genau diesen Aufrufer an. Reicht er
dann das Bibliotheksobjekt durch, wird aus „kein Fehler" still ein
verschluckter Fehlschlag — `punkteFehler` zum dritten Mal, rückwärts. Der
Satz steht seit 05.09. im Kopf von `menschenlesbar`; wer den Aufrufer
umbaut, fragt vorher `hindernis.ts`, nicht `menschenlesbar`.

### Beim Bau von Commit 3 nachgesehen (06.09.2026) — präzisiert, nicht geändert

Recherche an den Bibliotheken (alle 2.112.3) und den Server-Repos
(`supabase/storage` c015666, `supabase/auth` 0907af9, PostgREST 08811db):

- **Storage sendet für „zu groß", „falsches Format" und Zeilenrechte immer
  HTTP 400.** Der eigentliche Status steht nur als String in `statusCode`
  („413"/„415"/„403"), der Code in `code` (`EntityTooLarge`,
  `InvalidMimeType`, `AccessDenied`). `error.status` ist nutzlos; erkannt
  wird am Code. Netzfehler: `StorageUnknownError` mit `originalError`.
  (Die Doku-Seite zu Storage-Codes widerspricht dem Server; der Server gilt.)
- **JWT abgelaufen ist seit PostgREST 13 `PGRST303`**, davor `PGRST301`;
  nicht dekodierbar bleibt `PGRST301`. Welche Version die gehostete Instanz
  fährt, ist unbekannt → das Modul erkennt `PGRST30x`.
- **`42501` ist zweideutig:** 403 mit Sitzung (verweigert), 401 ohne — dann
  hat supabase-js den anon-Schlüssel geschickt (nicht angemeldet). Das
  Fehlerobjekt trägt keinen Status; die Antwort `{ error, status }` schon.
  **Deshalb nimmt jede Funktion auch die ganze Antwort an**; die Aufrufer in
  4b/4c reichen sie so weiter. Ohne Antwort fällt 42501 auf `verweigert`.
- `otp_expired` deckt falschen **und** abgelaufenen Code; `session_not_found`
  wird im Client zu `AuthSessionMissingError` ohne Code; der `ErrorCode`-Typ
  der Bibliothek ist **nicht abschließend** (28 Servercodes fehlen) — der
  Rest-Fall `unbekannt` ist Pflicht, nicht Vorsicht.

### Offen aus dem Bau von Commit 3 (06.09.2026): `AccessDenied` bei der Ablage

Storage meldet Zeilenrechte-Ablehnung als `AccessDenied` (statusCode „403") —
das ist Zeilenrechte **oder** keine Sitzung, am Objekt nicht zu trennen. Der
Vertrag hat für die Ablage kein `verweigert`; Profil hat es. Stand im Code:
`unbekannt` mit Rohtext; der Test schreibt nur fest, dass es ein Hindernis
ist, nicht welches. **Frage an Runde 5:** (a) `verweigert` auch für die
Ablage, wie bei Profil · (b) bei `unbekannt` lassen.

**Nachgesehen am 07.09., weil die Gegenprüfung einen Widerspruch sah**
(„keine Sitzung, nicht trennbar" gegen „kein JWT ist `InvalidJWT`"): Beide
Sätze stimmen, sobald „keine Sitzung" genau heißt, was es heißt. Ohne
Sitzung schickt supabase-js den **anon-Schlüssel** — ein gültiges JWT mit
Rolle `anon` (`supabase-js`, `_getAccessToken`: Rückfall auf `supabaseKey`).
Das ist kein `InvalidJWT`; es läuft in die Zeilenrechte, und Postgres
`42501` wird im Storage-Server **rollenunabhängig** zu `AccessDenied`
(`src/storage/database/errors.ts`, `fromDBError`, Zweig `case '42501'` →
`ERRORS.AccessDenied`; supabase/storage, c015666). `InvalidJWT` ist das fehlende oder
kaputte Token. Auf Bibliotheksebene ist `AccessDenied` also wirklich
zweideutig.

**Am Aufrufer ist es das nicht.** `setAvatar` (`store/auth.ts`, Wächter
`if (!user)` — stand beim Schreiben bei :262-264, nach 4a-i bei :380; deshalb
Bezeichner) kommt ohne Nutzer nie bis zum Server: `return 'Nicht angemeldet'`.
Ein `AccessDenied` aus diesem Aufruf ist damit immer eine Ablehnung **mit**
Sitzung. Empfehlung: **(a) `verweigert`**, und der Wächter im Store liefert
in 4c selbst `{ art: 'nicht-angemeldet' }` — ohne das Modul zu fragen.
Die Voraussetzung („gilt, weil der Aufrufer ohne Nutzer nicht sendet")
gehört wörtlich in den Kopf von `ablageHindernis`, sonst wiederholt sich
die `menschenlesbar`-Lage: eine Regel, die nur hält, solange ihr einziger
Aufrufer sich so verhält.

**Zu `email_not_confirmed`, Empfehlung der Gegenprüfung, der ich mich
anschließe: (a), eigene Kategorie `nicht-bestaetigt`.** Die nächste Handlung
ist eindeutig und von allen anderen verschieden. `unbekannt` führte einen
bekannten Zustand als unbekannt — dieselbe Zusicherungslücke wie „tsc Exit
0"; `abgelehnt` beschuldigte Adresse und Kennwort, obwohl beide stimmen —
der Fehler aus `3637157`. Was der Bildschirm daraus macht, entscheidet 4a;
das Modul liefert die Art, nicht den Weg. **Beides wartet auf das Wort des
Nutzers, bevor das Modul angefasst wird.**

**Runde 5, entschieden 07.09.2026: (a) und (a).** `nicht-bestaetigt` als
sechste Kategorie der Anmeldung; `AccessDenied` → `verweigert`, mit der
Voraussetzung wörtlich im Kopf von `ablageHindernis` (der Wächter in
`setAvatar` liefert `nicht-angemeldet` selbst). Eigener Commit vor 4a.

### Offen aus dem Bau von Commit 3 (06.09.2026): `email_not_confirmed`

Beim Schreiben von `anmeldeHindernis` an der Codeliste von auth-js
(`error-codes.d.ts`) aufgefallen: `email_not_confirmed` beim Anmelden. Die
nächste Handlung des Menschen ist **„E-Mail bestätigen"** — weder „Eingabe
prüfen" (`abgelehnt`) noch „später noch einmal" (`unbekannt`). Nach dem
eigenen Trennkriterium aus R2-Q1 wäre das eine **sechste** Kategorie der
Anmeldung. Der Vertrag hat fünf.

Stand im Code: fällt auf `unbekannt`; **kein Test schreibt das fest**, der
Kopf von `hindernis.ts` nennt es offen. Erreichbar ist der Fall: Wer sich
registriert, die Mail nie bestätigt und sich dann anmeldet, bekommt heute
„E-Mail oder Passwort falsch" — dieselbe Klasse wie die drei Funde vom 03.09.

**Frage an Runde 5, vor Commit 4a (Anmeldung):** (a) sechste Kategorie
`nicht-bestaetigt`, Wortlaut auf Login „Bestätige zuerst deine E-Mail" mit
Weg zur Bestätigungsseite · (b) bei `unbekannt` lassen und den Fall im
Folgeauftrag führen · (c) auf `abgelehnt` legen (falsch: beschuldigt die
Eingabe).

### Fund aus der Durchsicht von Commit 1 (05.09.2026) — vorbestehend, offen

**`run.ts:1997` setzt bei Erfolg einen Fehlertext.** `menschenlesbar` wird
unbedingt aufgerufen, auch wenn `ergebnis.fehler` null ist; das Objekt
`{ code: null, message: undefined }` ist wahr, `if (!fehler) return null`
(`supabaseFehler.ts:61`) greift nicht, `undefined ?? rueckfall` liefert
„Das hat nicht geklappt…". **Nach jeder gelungenen Übertragung steht im
Store ein Fehlertext**, bis `fetchRunPoints` (`run.ts:2470`) ihn
zurücksetzt. Vorher/nachher durch Commit 1 unverändert — aber die Aussage
„drei Fälle unterscheidbar" gilt nur, wenn das Feld bei Erfolg `null` ist.

**Entschieden 05.09.: eigener Commit direkt nach 1, mit Fehlerbericht.**
Der Grund: Es ist die Umkehrung von Commit 1 — der nimmt eine Meldung weg,
die zu viel zeigte; dieser eine, die zeigt, wo nichts ist. Dasselbe Feld,
dieselbe Seite, entgegengesetzte Richtung.

**Naht: `menschenlesbar` selbst (A), nicht der Aufrufer.** Die Funktion
verspricht mit `if (!fehler) return null` schon heute „kein Fehler → null"
und löst es nur nach Identität ein statt nach Inhalt; (A) vervollständigt
eine bestehende Zusicherung. Heute genau **ein** Aufrufer (`run.ts:1997`,
gemessen) — dass die Funktion es für weitere einlöst, ist eine Erwartung,
keine Zahl. **Auflage:** vier Fälle im Test statt eines roten — sonst
spiegelte (A) den Fehler (echter Fehlschlag ohne Code und Meldung würde
Stille); im Kopf steht, was `null` nicht heißt. Das Feld `punkteFehler` behält seinen Typ. Kein
Anbieter-Adapter, keine Wartezeit aus dem Text, kein Bash-Riegel in
`settings.local.json` (nicht ausdrückbar — siehe Fehlerbericht vom 04.09.).

### Nachgesehen vor 4c (08.09.2026): die Naht, die keine Runde sah

`setAvatar` läuft seit dem 22.08. durch `dateiMitZeile`
(`lib/dateiAblegen.ts`). Dessen Schnittstelle `Ablage` gibt
`{ fehler: string | null }` zurück — `supabaseAblage.hochladen` macht aus
dem Storage-Fehler `error.message`, und `Ergebnis.fehler` trägt bei der
Zeile `message (code)` als Text. **Das Fehlerobjekt mit `code`/`statusCode`
kommt nie bei `ablageHindernis` an.** Mit dem Vertrag, wie er bis hierher
stand, wäre jeder Fehler `unbekannt` gewesen (`merkmale` auf einem String:
kein Code, nur Text); `zu-gross` und `format-abgelehnt` hätten nie
entstehen können. Keine der fünf Runden hat die Naht gesehen; Zeile 796
nannte nur `setAvatar` und `Profile.tsx:106`.

**Entschieden (a):** `Ablage.hochladen/entfernen` geben zusätzlich
`roh?: unknown` — das Bibliotheksobjekt —, `Ergebnis` bekommt `roh: unknown`
(beim Hochladen der Storage-Fehler, sonst der Fehler oder die Ausnahme aus
`zeileSchreiben`). `fehler` als Text bleibt; die drei anderen Aufrufer
(`communityProfile.ts:324`, `feed.ts:123`, `chats.ts:216`) und die acht
Tests in `dateiAblegen.test.ts` bleiben unberührt, weil `roh` in der
Schnittstelle optional ist. Verworfen: (b) `setAvatar` umgeht `dateiMitZeile`
— macht die Zusammenlegung vom 22.08. rückgängig; (c) 4c als `unbekannt`
mit Rohtext — ein Modul, das an seinem einzigen Aufrufer nichts tut.

**Zwei Phasen, zwei Fachgebiete:** Scheitert das Hochladen
(`ergebnis.pfad === null`), ist es ein Storage-Fehler → `ablageHindernis`.
Scheitert die Zeile danach, ist es PostgREST → `profilHindernis`. Die
Profil-Arten sind eine Teilmenge der Ablage-Arten; der Rückgabetyp bleibt
`AblageHindernis | null`. Die Unterscheidung steht im Code und wird geprüft
— je ein Test pro Phase —, sonst liest irgendwann jemand einen
PostgREST-Fehler mit `ablageHindernis` und bekommt `unbekannt`, ohne dass
etwas rot wird.

**`format-abgelehnt` ist für `avatars` heute nicht auslösbar**, gemessen:
`0022_public_profiles_and_avatars.sql:54` legt den Behälter mit
`(id, name, public)` an, und `grep -rn "allowed_mime_types\|file_size_limit"`
über alle Migrationen findet nichts. `accept="image/*"` am Eingabefeld ist
nur ein Vorschlag an den Dateidialog, keine Prüfung. Die Kategorie bleibt
(sie kostet nichts, und der Behälter kann Grenzen bekommen); der Satz
verspricht keine Formate. Ob das Dashboard Grenzen trägt, die nicht im Repo
stehen, sieht nur der Nutzer nach.

**Die sechs Sätze der Kurzeinblendung** (`Profile.tsx`, 4 s, kurz):
`zu-gross` „Das Bild ist zu groß. Wähl ein kleineres." ·
`format-abgelehnt` „Dieses Dateiformat wird nicht angenommen. Wähl ein
anderes Bild." · `nicht-angemeldet` „Deine Anmeldung ist abgelaufen. Melde
dich neu an." · `nicht-erreichbar` und `!navigator.onLine` „Dein Gerät ist
offline. Versuch es, sobald du Netz hast." · `verweigert` „Das Speichern
wurde nicht erlaubt. Das liegt nicht an dir – versuch es später." ·
`nicht-erreichbar` (online) und `unbekannt` „Das Bild wurde nicht
gespeichert. Versuch es gleich noch einmal." Die ersten zwei sind Gestalt 1
— die Eingabe muss geändert werden, dasselbe Trennkriterium wie `abgelehnt`
bei der Anmeldung —, die anderen vier Gestalt 3.

### Nachgesehen bei der Sicherheitsprüfung (08.09.2026): woran die 401/403-Regel hängt

Das Protokoll oben bleibt, wie es ist — dies ist ein **Nachtrag**, keine
Berichtigung von „`42501` ist zweideutig: 403 mit Sitzung, 401 ohne". Der Satz
stimmt als Regel; was er offenlässt, ist, **wovon** die beiden Fälle abhängen.
Zwei Messungen dazu, beide an Primärquellen:

**1. Der Wächter `if (!user)` in `setAvatar` ist keine Zusicherung über die
Sitzung.** `get().user` ist ein Zustand des Speichers. Stirbt die Sitzung
zwischen Wächter und Antwort — die Erneuerung scheitert, `SIGNED_OUT` erreicht
den Speicher erst über den Zuhörer —, lässt der Wächter durch. supabase-js
2.112.3 sendet dann den API-Schlüssel als Bearer: `_getSessionToken`
(`node_modules/@supabase/supabase-js/dist/index.mjs`) gibt `null`, und in
`fetchWithAuth` wird daraus `Bearer <Schlüssel>` (`:302`, Rückfall
`allowKeyAsBearer`). **Die Folge ist ein falscher Satz, kein Zugriff:** Der
Mensch liest „Das Speichern wurde nicht erlaubt" statt „Deine Anmeldung ist
abgelaufen"; die Zeilenrechte lehnen ab, wie sie sollen. Der Wächter schärft
die Diagnose, er sichert sie nicht zu.

**2. Der 401-Zweig hängt am Schlüsselformat.** PostgREST beantwortet `42501`
mit 403, wenn die Anfrage eine Rolle trägt, sonst mit 401 —
`Error.hs:247` (`"42501" -> if authed then 403 else 401`), `authed =
containsRole` (`Auth.hs:81-82`); ein JWT trägt `role`. **Belegt ist das an
PostgREST 9.0.1**, gemessen von der Sicherheitsprüfung; welche Version die
gehostete Instanz fährt, ist unbekannt — dieselbe Lücke wie bei `PGRST30x`.
Daraus:

- Ein **alter JWT-Schlüssel** (`eyJ…`) ist ein signiertes JWT mit Rolle
  `anon`. Er geht als Bearer hinaus, PostgREST sieht eine Rolle → **immer
  403**, nie 401. Genau so ein Schlüssel steht heute in `.env.production`.
- Ein Schlüssel im **neuen Format** (`sb_publishable_…`) ist kein JWT und
  trägt keine Rolle. Wo er nicht als Bearer mitgeht, sieht PostgREST keine
  Rolle → **401**.

**Messgrenze, die den Zweig anders schneidet als erwartet:** In supabase-js
2.112.3 hängt das Weglassen des Bearer an der Option `omitApiKeyAsBearer`
(`isNewApiKey` `:274`, `allowKeyAsBearer` `:296`), und der Client setzt sie
**nur für die Edge-Functions** (`:657`). Der `fetch` für PostgREST und Storage
wird ohne sie gebaut (`:656`) — dort geht **auch** ein
`sb_publishable_`-Schlüssel als Bearer hinaus. Nach dieser Messung ist der
401-Zweig mit keinem der beiden Formate erreichbar, solange diese
Bibliotheksfassung PostgREST bedient.

**Der Zweig bleibt trotzdem** (`lib/hindernis.ts`, `profilHindernis`): Er
kostet nichts, er ist richtig, wenn der Status kommt, und beide Bedingungen
können sich ändern — ein Schlüsselwechsel, eine Bibliotheksfassung, ein
Zwischenstück, das den Kopf setzt. Was nicht bleiben darf, ist der Eindruck,
er hänge am Wächter des Aufrufers.
