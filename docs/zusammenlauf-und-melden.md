# ZusammenLauf und Melden

**Festgelegt:** 21.08.2026 · **Gebaut:** noch nichts davon

Bis heute war ZusammenLauf im Quelltext ein Wort ohne Umriss. Dieses Dokument
gibt ihm einen — und hält fest, was daraus für die Sicherheit folgt.

---

## 1. ZusammenLauf hat zwei Teile

**Teil A — Der Laufvorschlag.** Jemand erstellt aktiv einen Vorschlag: Ort,
Zeit, Strecke. Andere sehen ihn und können mitlaufen. *Ein Ereignis steht im
Mittelpunkt.*

**Teil B — Die Profile.** Wie bei einer Kennenlern-App: Man sieht Profile
anderer Läufer und kann anfragen — *„Hast du Lust, laufen zu gehen?"* *Ein
Mensch steht im Mittelpunkt.*

**Später:** Vorschläge nach Ähnlichkeit — vergleichbare Streckenlänge,
vergleichbare Ergebnisse. Wer ähnlich läuft, wird einander gezeigt.

## 2. Was der Sichtbarkeitsschalter tut

> **Ist er an, erscheint das Profil in Teil B und kann angefragt werden.
> Ist er aus, existiert man dort nicht.**

Heute ist der Schalter ein Versprechen ohne Wirkung — er schaltet nichts.
Das ist Scheibe 6 im [Fahrplan](fahrplan-bis-zur-einlage.md).

**Er muss in der Datenbank wirken, nicht in der App.** Ein Filter in der
Abfrage ist Bequemlichkeit, kein Schutz. Wer die Abfrage umgeht, sieht sonst
alles. Zeilenrechte entscheiden.

---

## 3. Man kann niemanden suchen

**Wichtige Korrektur zur ersten Fassung dieses Dokuments.** Dort stand, Teil B
sei die Profilsuche, vor der das [Schutzkonzept](schutzkonzept.md) warnt. Das
war zu weit gegriffen.

> **Es gibt keine Suche.** Man gibt keinen Namen ein. Man bekommt Vorschläge
> und wischt — wie bei einer Kennenlern-App.

Das ist ein echter Unterschied. Die Gefahr im Schutzkonzept ist das **gezielte**
Nachstellen: jemand sucht eine bestimmte Person. Ohne Suchfeld fällt genau das
weg, und der Algorithmus entscheidet, wer wem gezeigt wird.

**Was bleibt, ist kleiner und hängt nicht am Suchen:** Sobald Fremde einen Lauf
sehen, sehen sie den Startpunkt — und der ist bei den meisten Menschen die
Wohnadresse. Das ist der einzige Grund, warum die Privatzone vor Teil B kommt.
Mehr wird hier nicht behauptet.

### Die Reihenfolge

Damit weniger streng als in der ersten Fassung, aber in dieser Folge:

| | Zuerst | Warum |
|---|---|---|
| 1 | **Privatzone um Zuhause** | Ein geteilter Lauf verrät sonst, wo jemand wohnt. Betrifft **jeden**, auch ohne Community |
| 2 | **Sichtbarkeitsschalter wirkt wirklich** | Sonst steht jedes Profil in Teil B, ohne dass jemand zugestimmt hat |
| 3 | **Melden und Sperren** | Abschnitt 4. Muss **vor** der ersten Anfrage stehen, nicht danach |
| 4 | Teil A — Laufvorschläge | Ein Ereignis ist harmloser als ein Mensch |
| 5 | Teil B — Profilvorschläge und Anfragen | Erst wenn 1 bis 3 stehen |
| 6 | Ähnlichkeitsvorschläge | Setzt Teil B voraus |

**Der Satz, den ich mir merken soll:** Wer Teil B vor der Privatzone baut, zeigt
Fremden Läufe, die am Wohnort beginnen.

---

## 3a. Wie wir über Menschen reden

**Keine geschlechtsspezifische Sprache.** Kein „nur Frauen / nur Männer". Wer
so fragt, muss sofort erklären, warum die Liste dort aufhört — und jede
Antwort darauf ist entweder unvollständig oder eine Debatte, die wir nicht
führen wollen.

Stattdessen neutral, entlang dessen, worum es geht: **gemeinsam laufen.**
Bumbles Trennung in Kennenlernen und Freundschaft ist die Idee dahinter —
nicht das Wort. Wir sind ohnehin nur das Zweite.

**Offen und bewusst nicht entschieden:** Manche Menschen wünschen sich aus
Sicherheitsgründen Laufpartner eines bestimmten Geschlechts, besonders abends
und allein. Diesen Wunsch gibt es, und er ist berechtigt. Ihn zu erfüllen,
ohne in eine Zweiteilung zurückzufallen, ist eine eigene Entscheidung — sie
gehört in Abschnitt 5, nicht in einen schnellen Schalter.

---

## 3b. Die Fragen im Profil

Wer mehr beantwortet, wird besser vorgeschlagen. Die Fragen sind der Rohstoff
des Algorithmus.

| Frage | Wofür sie taugt |
|---|---|
| Warum läufst du? | Absicht — Wettkampf trifft nicht gern auf Spazieren |
| Seit wann läufst du? | Erfahrung |
| Welche Sportarten machst du sonst? | Gemeinsamkeiten jenseits des Laufens |
| Wie viele Kilometer in der Woche? | Umfang — die härteste Passungsgröße |
| Was ist schön am Laufen? | Ton und Haltung |
| Wo läufst du? | Gegend, ohne genaue Adresse |
| Lieber allein oder in der Gruppe? | Ob jemand überhaupt gesucht wird |
| Bist du in einem Verein? | Anschluss, der schon besteht |

**Drei Regeln dazu:**

1. **Einfach auszufüllen.** Antworten zum Antippen, kein Aufsatz. Wer tippen
   muss, füllt nicht aus — und ein leeres Profil bekommt schlechte Vorschläge,
   also gibt er auf.
2. **Sichtbarer Fortschritt.** Wie vollständig ist das Profil, und was brächte
   die nächste Antwort. Das ist der Anreiz, ohne jemanden zu drängen.
3. **Vorher sagen, was passiert.** Bevor die erste Frage kommt, in einem Satz:
   wofür die Antworten benutzt werden, wer sie sieht, und dass man sie später
   ändern oder löschen kann. Nicht nur, weil die DSGVO es bei automatischer
   Zuordnung verlangt — sondern weil ein Fragebogen ohne Begründung wie
   Datensammeln aussieht und wie Datensammeln behandelt wird.

---

## 4. Melden

Nutzer müssen andere Nutzer melden können — wegen Beschimpfung, Belästigung,
Gewaltandrohung, Spam, gefälschtem Konto oder etwas anderem.

### Wo es steht

| Ort | Was | Warum dort |
|---|---|---|
| **Fremdes Profil in ZusammenLauf** | Drei-Punkte-Menü → „Melden" | Am Ort des Problems. Wer sich bedroht fühlt, sucht nicht in den Einstellungen |
| **Eigenes Profil** | „Problem melden" → Support | Für alles, was kein einzelnes Konto betrifft |

### Was ein Meldegrund ist

Beschimpfung · Belästigung · Gewalt oder Drohung · Spam · Gefälschtes Konto ·
Etwas anderes *(mit Freitext)*

### Was mindestens dazugehört

- **Blockieren im selben Schritt.** Wer meldet, will meist zuerst Ruhe. Die
  Meldung geht an uns, das Blockieren wirkt sofort.
- **Die Meldung ist unveränderlich**, wie die Einwilligungen. Ein Nachweis,
  den man ändern kann, ist keiner.
- **Rückmeldung an die meldende Person.** Eine Meldung, auf die nie etwas
  folgt, wird kein zweites Mal geschrieben.
- **Wer meldet, bleibt der gemeldeten Person gegenüber ungenannt.**

### Nicht nur guter Wille

Für Anbieter, bei denen Nutzer Inhalte an andere Nutzer richten, ist ein
Meldeweg in der EU **rechtlich gefordert** (Digital Services Act,
Melde- und Abhilfeverfahren). Das ist noch nicht anwaltlich geprüft — es
gehört auf dieselbe Liste wie Datenschutzerklärung und AGB.

**Und praktisch:** Ohne Meldeweg ist der erste ernste Vorfall zugleich der
erste Vorfall ohne Handhabe.

---

## 5. Was noch offen ist

| Frage | Wer entscheidet |
|---|---|
| Was zeigt ein Profil in Teil B? Name, Bild, Umkreis, Wochenkilometer? | Produkt — je Feld die Frage, ob es zur Identifizierung taugt |
| Wie erfüllen wir den Wunsch nach gleichgeschlechtlichen Laufpartnern, ohne eine Zweiteilung einzuführen? | Produkt — siehe 3a |
| Umkreis statt Ort: reicht „5 km um dich"? | Produkt + Sicherheit |
| Wer bearbeitet Meldungen, und in welcher Frist? | Betrieb — ohne Antwort darauf ist der Knopf eine Attrappe |
| Mindestalter für Teil B? | Recht |
| Sperren beidseitig oder einseitig? | Produkt |
