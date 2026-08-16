# Das Zimmer mit den Schubladen

Ein Bild aus der Anforderung: Jede Person hat ein Zimmer. Im Zimmer stehen
viele Schubladen. Eine erteilte Einwilligung wird mit Zeitpunkt in eine
Schublade gelegt und kodiert; später kann man sie wieder herausholen und
lesen. Und:

> Auch wenn jemand ins Zimmer schafft, sollte er nicht wissen, was wo ist.
> Auch wenn eine Schublade geöffnet wird, müssten nicht automatisch alle
> Schubladen geöffnet werden.

Dieses Dokument prüft, was davon schon steht, was sich bauen lässt, was nur
so aussieht wie Sicherheit, und was nicht geht.

---

## 1. Was heute schon dem Bild entspricht

**Das Zimmer gibt es.** Jede Zeile trägt eine Nutzerkennung, und jede
Tabelle hat Zeilenregeln, die auf `auth.uid()` prüfen. Kein Zimmer aus
Wänden, sondern eine Regel, die bei jeder einzelnen Abfrage geprüft wird.
Wer mit fremdem Zugang anfragt, bekommt nicht "Zugriff verweigert" – er
bekommt eine leere Antwort, als gäbe es die Daten nicht.

**Die Schubladen gibt es auch.** Gesundheitsdaten liegen nicht in einer
großen Tabelle, sondern getrennt nach Zweck, jede mit eigenen Regeln:

| Schublade | Tabellen |
|---|---|
| Anamnese | `anamnese_sessions`, `anamnese_answers` |
| Zyklus | `cycle_settings`, `cycle_periods` |
| Trainingstagebuch | `training_diary_entries`, `training_diary_pain_locations` |
| Läufe | `runs`, `run_points`, `run_splits` |
| Einwilligungen | `art9_consents` |

Das ist kein Zufall, sondern eine festgehaltene Regel: In Migration 0022
steht ausdrücklich, dass alles, was privat bleiben soll, eine eigene Tabelle
bekommt und nicht in `profiles` wandert. Genau deshalb hat der Zykluskalender
(0024) auch einen eigenen Einwilligungsbereich `cycle` bekommen statt den der
Anamnese mitzubenutzen: Wer in das eine eingewilligt hat, hat nicht in das
andere eingewilligt.

**Der Zeitpunkt steht schon drin.** `art9_consents` führt `consented_at` und
`revoked_at`. Wann etwas erteilt und wann es zurückgenommen wurde, ist
nachvollziehbar.

Was fehlt, ist genau ein Punkt: **die Kodierung.**

---

## 2. Wogegen soll die Kodierung schützen?

Das ist die Frage, an der alles hängt. Verschlüsselung ist kein Schutz an
sich – sie verschiebt das Problem auf den Schlüssel. Wer den Schlüssel hat,
liest mit. Deshalb zuerst: Wer könnte "ins Zimmer kommen"?

**(a) Jemand mit dem Zugang einer Person** – gestohlenes Telefon, abgefangene
Sitzung. Hier greifen die Zeilenregeln: Er sieht die Daten dieser einen
Person, sonst nichts. Verschlüsselung hilft hier **nicht**, denn die App muss
für genau diese Person ohnehin entschlüsseln.

**(b) Jemand mit dem Verwaltungsschlüssel der Datenbank** (`service_role`)
oder mit einer Sicherungskopie. Hier greifen die Zeilenregeln **nicht** –
dieser Zugang umgeht sie vollständig. Das ist die einzige Lücke, gegen die
Verschlüsselung wirklich etwas ausrichtet.

**(c) Wir selbst.** Wer die Datenbank betreibt, kann hineinsehen. Ob das so
bleiben soll, ist eine Entscheidung, keine technische Frage.

Alles Weitere richtet sich nach (b) und (c).

---

## 3. Wo liegt der Schlüssel? Drei Möglichkeiten

### Möglichkeit 1: Schlüssel in der Datenbank

Verschlüsseln mit `pgcrypto`, der Schlüssel liegt in einer Tabelle oder einer
Einstellung derselben Datenbank.

**Das schützt gegen nichts.** Wer die Datenbank hat, hat den Schlüssel gleich
mit. Es sieht aus wie Verschlüsselung, kostet Aufwand und Geschwindigkeit,
und die Lücke (b) bleibt offen. Ich nenne das ausdrücklich, weil es der
naheliegende Weg ist und weil man ihn in Anleitungen häufig findet.

**Nicht empfohlen.**

### Möglichkeit 2: Schlüssel außerhalb der Datenbank

Der Schlüssel liegt in der Umgebung einer Serverfunktion (Supabase Edge
Function). Die App ruft die Funktion, die Funktion entschlüsselt und gibt die
Daten zurück. Die Datenbank sieht nur unlesbare Werte.

**Das schließt Lücke (b) wirklich.** Eine gestohlene Sicherungskopie ist
wertlos, ein `service_role`-Schlüssel allein auch.

**Was es kostet – und das ist erheblich:**

- Alles, was verschlüsselt ist, geht nicht mehr direkt über PostgREST. Jede
  Abfrage auf diese Daten braucht eine Serverfunktion.
- Verbundene Abfragen (`select=*, andere_tabelle(...)`) über verschlüsselte
  Felder fallen weg.
- Filtern, Sortieren und Suchen auf verschlüsselten Feldern geht nicht. Der
  Zykluskalender könnte nicht mehr "gib mir die Perioden nach Datum sortiert"
  fragen, wenn das Datum verschlüsselt ist.
- Zeilenregeln greifen auf verschlüsselte Spalten nicht mehr sinnvoll.

Das ist ein spürbarer Sprung in der Komplexität – gegen den Grundsatz, die
Struktur einfach und verständlich zu halten. Deshalb: gezielt einsetzen, nicht
überall.

### Möglichkeit 3: Schlüssel bei der Person selbst

Der Schlüssel wird aus dem Passwort abgeleitet. Dann kann **niemand** außer
der Person lesen – auch wir nicht.

**Das schließt (b) und (c).** Es hat aber eine Folge, die man nicht wegplanen
kann:

> Passwort vergessen heißt Daten weg. Endgültig. Kein Zurücksetzen, keine
> Wiederherstellung, kein Support-Fall, in dem man aushelfen könnte.

Bei Anmeldung über Google gibt es gar kein Passwort, aus dem sich etwas
ableiten ließe. Und bei einer App im Gesundheitsumfeld ist "Ihre Anamnese ist
unwiederbringlich weg" eine harte Aussage.

**Nur sinnvoll, wenn das ausdrücklich gewollt ist.**

---

## 4. "Eine Schublade öffnet nicht alle"

Das lässt sich sauber bauen: Statt eines Schlüssels für alles wird pro
Schublade ein eigener abgeleitet – aus einem Hauptschlüssel und dem Namen der
Schublade (`anamnese`, `cycle`, `tagebuch`). Wer den Schlüssel für die
Zyklus-Schublade erbeutet, kann die Anamnese damit nicht öffnen.

Ehrlich dazugesagt: Wer den **Hauptschlüssel** hat, hat alle. Echte Trennung
hieße, die Schlüssel an getrennten Orten zu verwahren – das vervielfacht den
Betriebsaufwand und lohnt sich erst, wenn verschiedene Personen verschiedene
Bereiche verwalten. Für den jetzigen Stand ist die Ableitung der richtige
Kompromiss, und der Aufbau lässt sich später trennen, ohne die App zu ändern.

---

## 5. "Man soll nicht wissen, was wo ist"

Hier muss ich widersprechen, statt etwas zu versprechen: **Das geht in einer
relationalen Datenbank nur zum Teil.**

Verschlüsseln lässt sich der **Inhalt**. Nicht verschlüsseln lässt sich die
**Form**: Tabellennamen, Spaltennamen, wie viele Zeilen es gibt, wann sie
angelegt wurden, und welche Person überhaupt Zeilen in welcher Tabelle hat.
Wer in die Datenbank sieht, erkennt also weiterhin: "Diese Person hat einen
Zykluskalender und 14 Einträge darin." Der Inhalt bliebe verborgen, die
Tatsache nicht.

Diese Form zu verbergen hieße, alles als unleserliche Klumpen in eine einzige
Tabelle zu legen. Dann ließe sich nichts mehr abfragen, sortieren oder
filtern – und die Schubladen wären nicht mehr unterscheidbar, was Punkt 4
gerade wieder aufhebt. Die beiden Wünsche stehen sich hier im Weg.

Was sich stattdessen tun lässt und wirksam ist:

- **Wenig erheben.** Der Zykluskalender speichert nur Beginn und Ende – keine
  Symptome, keine Stimmung. Was nicht da ist, kann nicht abfließen. Das ist
  der stärkste Schutz überhaupt und kostet nichts.
- **Sprechende Werte vermeiden.** Statt `schmerz_ort = 'achillessehne'` ein
  Schlüsselwort, dessen Bedeutung woanders steht.
- **Zugriffe protokollieren.** Man verhindert damit nichts, aber man merkt es.

---

## 6. Und die Einwilligungen selbst?

Hier ein Einwand zur ursprünglichen Idee, die Einwilligung zu kodieren.

Eine Einwilligung ist kein Geheimnis, sondern ein **Nachweis**. Sie ist der
Beleg dafür, dass wir die Gesundheitsdaten überhaupt verarbeiten dürfen. Nach
Art. 7 Abs. 1 DSGVO muss dieser Nachweis erbringbar sein – gegenüber der
Person und gegenüber einer Aufsichtsbehörde.

Verschlüsselt man ihn, macht man den Nachweis schwerer, nicht sicherer. Und
sonderlich schützenswert ist der Inhalt nicht: "Person X hat am 14.08.2026 in
die Verarbeitung ihrer Anamnesedaten eingewilligt" verrät nichts über die
Gesundheit dieser Person.

Was der Einwilligung dagegen wirklich fehlt, ist etwas anderes: **Sie ist
heute änderbar, ohne dass es auffällt.** Sinnvoller als Verschlüsselung wäre,
sie unveränderlich zu machen – kein `update`, kein `delete`, ein Widerruf
schreibt eine neue Zeile statt die alte zu ändern. Dann steht die Geschichte
lückenlos da und niemand kann sie nachträglich zurechtrücken.

Das ist wenig Aufwand und ein echter Gewinn.

---

## 7. Vorschlag

Gestaffelt, vom größten Nutzen je Aufwand abwärts:

| | Was | Aufwand | Wogegen es hilft |
|---|---|---|---|
| 1 | Einwilligungen unveränderlich machen (kein update/delete, Widerruf als neue Zeile) | klein | Nachträgliches Zurechtrücken |
| 2 | Weiterhin so wenig erheben wie möglich | keiner | Alles |
| 3 | Anamnese-Antworten und Zyklusdaten verschlüsseln, Schlüssel in einer Serverfunktion, pro Schublade abgeleitet | groß | Gestohlene Sicherungskopie, `service_role` |
| 4 | Zugriffsprotokoll auf die Gesundheitstabellen | mittel | Merken, dass etwas passiert ist |

Punkte 1 und 2 würde ich in jedem Fall machen. Punkt 3 ist die eigentliche
Entscheidung: echter Schutz gegen (b), erkauft mit deutlich mehr Komplexität
in genau den Bereichen, die gerade erst einfach geworden sind.

Punkt 5 aus dem Bild – "nicht wissen, was wo ist" – lässt sich nicht
einlösen. Das gehört gesagt, statt es mit einer Lösung zu überdecken, die den
Eindruck erweckt.
