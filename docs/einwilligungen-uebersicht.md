# Einwilligungen: welche Zwecke, wo eingewilligt wird

**Stand 26.08.2026.** Aus dem Quelltext und den Migrationen zusammengetragen,
nicht aus dem Gedächtnis — jede Angabe hat eine Fundstelle.

**Wozu diese Datei da ist:** Vor der Veröffentlichung wird das von echtem
Rechtsrat geprüft. Diese Übersicht soll diese Prüfung von einem Tag auf eine
halbe Stunde bringen. **Sie ist keine Rechtsauskunft** und trifft keine
Aussage darüber, ob die Gestaltung ausreicht.

---

## Die vier Zwecke

Die Aufzählung steht als Datenbanktyp in
`0034_einwilligungen_an_einer_stelle.sql:83` und spiegelt sich in
`src/types/index.ts:312`. **Vier, nicht mehr:**

| Zweck | Pflicht? | Was er abdeckt |
| --- | --- | --- |
| `gesundheitsdaten` | **ja** | Anamnese, Trainingstagebuch samt Schmerzangaben, Zyklusdaten |
| `notwendige_cookies` | **ja** | Anmeldung und Sitzung |
| `analyse` | **nein** | Nutzungsauswertung |
| `zusammenlauf` | **nein** | Das Profil wird Fremden als Laufpartner vorgeschlagen |

„Pflicht" heißt hier: **ohne diese Erlaubnis lässt sich die App nicht
sinnvoll benutzen** (`pflicht`-Kennzeichen, `types/index.ts:331`). Es heißt
nicht, dass sie erzwungen werden darf — die Frage, ob eine „Pflicht"-
Einwilligung überhaupt freiwillig sein kann, ist genau eine der Fragen für
den Rechtsrat.

---

## Wo eingewilligt wird: an genau zwei Stellen

`grep` über den gesamten Quelltext nach `erteilen(` ergibt **zwei**
Aufrufer. Nicht mehr.

### 1. Bei der Registrierung — `pages/Anamnese.tsx:186`

```ts
const eFehler = await erteilen(zwecke, 'registrierung')
```

Die Quelle wird als `'registrierung'` vermerkt. Hier werden die Zwecke
erteilt, die zum Start gehören.

### 2. Beim ZusammenLauf-Schalter — `store/zusammenlauf.ts:247`

```ts
const problem = await einwilligung.erteilen(['zusammenlauf'], 'profil')
```

Quelle `'profil'`. **Ein einzelner Zweck, nicht gebündelt.**

**Und beim Ausschalten wird widerrufen**, nicht nur der Schalter umgelegt.
Der Widerruf ist ein eigener Eintrag, kein Löschen des alten.

### Es gibt eine dritte Quelle, aber keine dritte Frage

`'uebernahme'` (`types/index.ts:341`) steht für Bestandsnutzer, deren
frühere Zustimmung übernommen wurde — siehe
`0034:294` (`'bestand-bis-2026-08'`). Das ist ein Datenbankvorgang, keine
Stelle in der App.

---

## Was als Nachweis gespeichert wird

Nicht „hat zugestimmt: ja", sondern **wem genau zugestimmt wurde**
(`types/index.ts:337-345`):

| Feld | Bedeutung |
| --- | --- |
| `zweck` | einer der vier |
| `entscheidung` | `erteilt` oder `widerrufen` |
| `zeitpunkt` | wann |
| `text_version` | welche Fassung des Wortlauts galt, z. B. `2026-08-v1` |
| `text_hash` | Prüfsumme des Wortlauts — **von der Datenbank berechnet, nicht von der App gesetzt** |
| `quelle` | `registrierung`, `profil` oder `uebernahme` |

**Der `text_hash` ist das eigentliche Beweisstück.** Er beantwortet die
Frage, die bei einem Streit zählt: *Welchem Wortlaut wurde zugestimmt?* Wird
der Text später geändert, entsteht eine neue Version — alte Einwilligungen
zeigen weiter auf den alten Hash.

**Die Einträge sind unveränderlich.** Ein Widerruf löscht nichts, er fügt
hinzu. Deshalb hinterlässt jedes Umlegen des Schalters eine Zeile — das ist
kein Nebeneffekt, sondern der Zweck.

---

## Die drei Empfehlungen vom 26.08.2026

Vom Nutzer angenommen. Sie stehen hier, damit der Rechtsrat sieht, was
**geplant** ist und nicht nur, was heute gebaut ist.

### 1. Die Erklärungen vor die Registrierung

Heute erfährt man erst am Schalter, was er tut. Künftig soll bei der
Registrierung stehen, was jede Erlaubnis bedeutet — in klaren Worten:

> *Wenn du das einschaltest, wirst du anderen Läuferinnen und Läufern als
> Laufpartner vorgeschlagen. Wenn nicht, sieht dich niemand.*

Dazu ein Verweis auf die ausführliche Fassung, anklickbar.

**Warum das nicht nur Bequemlichkeit ist:** Art. 13 verlangt, dass die
Information **vor** der Verarbeitung vorliegt. Heute steht sie an der Stelle,
an der die Verarbeitung beginnt — das ist knapp.

### 2. Kein Sammel-Häkchen

Der Wunsch war, alles einmalig bei der Registrierung zu bestätigen. **Die
Erklärungen ja, die Zustimmung nicht als ein Häkchen.**

Einwilligung muss je Zweck einzeln erteilbar sein. Gesundheitsdaten,
Sitzungstechnik, Auswertung und Community-Sichtbarkeit sind vier
verschiedene Dinge — ein gemeinsames Häkchen wäre angreifbar, und
ausgerechnet bei Gesundheitsdaten.

**Die Datenbank ist dafür schon richtig gebaut:** Der Zweck ist ein eigenes
Feld, und `erteilen()` nimmt eine Liste. Vier einzelne Häkchen auf einer
Seite sind ein Oberflächenentwurf, keine Umbauarbeit.

### 3. Der Schalter bleibt der Schalter

Er kann kein Häkchen von der Registrierung sein, weil er die Verarbeitung
**ist**. Wer heute zustimmt und in drei Monaten nicht mehr vorgeschlagen
werden will, muss ihn umlegen können — und dieser Widerruf muss belegbar
sein. Genau das tut er.

---

## Offene Fragen für den Rechtsrat

Das sind die Stellen, an denen ich **nicht** sagen kann, ob es reicht. Die
Reihenfolge ist vom Nutzer am 26.08.2026 festgelegt.

### 1. Standortdaten haben keinen eigenen Zweck — **höchste Priorität**

**Vom Nutzer ausdrücklich als Frage Nummer eins markiert:** *„das ist der
Fund, der am meisten zählt."*

Die App zeichnet GPS-Spuren auf und speichert sie dauerhaft — Breitengrad,
Längengrad, Höhe, Zeitstempel, je Messpunkt, mit Bezug zum Konto
(`run_points`; Zwischenspeicher auf dem Gerät in `lib/punktePuffer.ts`).

**In keiner der vier Kategorien kommt das vor.** Entweder ist es von
`gesundheitsdaten` mitgemeint — dann steht es nirgends —, oder es fehlt eine
Einwilligung.

Warum das schwer wiegt: Eine Laufspur ist keine Zahl über den Körper,
sondern eine **Bewegungsaufzeichnung**. Sie zeigt Wohnort, Tagesablauf und
regelmäßige Wege. Bei den Feldmessungen dieser Woche haben wir aus
GPS-Punkten Haltestellen, Anfahrten und Empfangslücken rekonstruiert — mit
denselben Daten ließe sich rekonstruieren, wo jemand wohnt.

**Der Punkt ist mir beim Zusammentragen dieser Übersicht aufgefallen, nicht
vorher.** Er stand in keinem Bericht, in keiner Migration und in keiner
Aufgabe.

### 2. Können „Pflicht"-Einwilligungen freiwillig sein? — zweite Priorität

`gesundheitsdaten` und `notwendige_cookies` sind als Pflicht markiert. Wer
nicht zustimmt, kann die App nicht benutzen. Ob das als Einwilligung trägt
oder eine andere Rechtsgrundlage braucht, ist eine Bewertung.

**Vom Nutzer bewusst offen gelassen**, wie Frage 1.

### 3. Deckt ein Zweck `gesundheitsdaten` wirklich alles ab?

Darunter fallen heute Anamnese, Schmerzangaben im Tagebuch **und**
Zyklusdaten. Ob das ein Zweck ist oder mehrere, ist eine Bewertung.

### 4. Reicht der Wortlaut?

Die Texte stehen in `0034:255-282` und `0053:30-48`. Sie sind kurz. Ob sie
den Anforderungen an Verständlichkeit und Vollständigkeit genügen, habe ich
nicht beurteilt.

### 5. Aufbewahrung und Kontolöschung

In dieser Übersicht nicht behandelt, weil es nicht um Einwilligung geht —
aber es gehört in dieselbe Prüfung.

## Was diese Übersicht nicht ist

Sie beschreibt, **wo** eingewilligt wird und **was** gespeichert wird. Sie
sagt nichts darüber, ob die Verarbeitung selbst zulässig ist, ob die
Rechtsgrundlagen richtig gewählt sind oder ob die Texte genügen.

Jede Angabe ist am Quelltext belegt. Wo ich etwas nicht geprüft habe, steht
es dabei.
