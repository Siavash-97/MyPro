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

## 3. Die Reihenfolge, und warum sie nicht verhandelbar ist

Das [Schutzkonzept](schutzkonzept.md) Abschnitt 6 sagt seit Wochen:

> **„Profilsuche zuletzt — sie schafft die Gefahrenlage, die 1 und 2
> abdecken. Wer 5 vor 1 baut, liefert das Risiko zuerst aus."**

**Teil B ist genau diese Profilsuche.** Damit ist die Reihenfolge festgelegt,
bevor jemand anfängt:

| | Zuerst | Warum |
|---|---|---|
| 1 | **Privatzone um Zuhause** | Ein geteilter Lauf verrät sonst, wo jemand wohnt. Betrifft **jeden**, auch ohne Community |
| 2 | **Sichtbarkeitsschalter wirkt wirklich** | Sonst steht jedes Profil in Teil B, ohne dass jemand zugestimmt hat |
| 3 | **Melden und Sperren** | Abschnitt 4. Muss **vor** der ersten Anfrage stehen, nicht danach |
| 4 | Teil A — Laufvorschläge | Ein Ereignis ist harmloser als ein Mensch |
| 5 | Teil B — Profile und Anfragen | Erst wenn 1 bis 3 stehen |
| 6 | Ähnlichkeitsvorschläge | Setzt Teil B voraus |

**Der Satz, den ich mir merken soll:** Teil B ohne 1, 2 und 3 ist eine
Personensuche mit Wohnortangabe und ohne Notausgang.

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
| Umkreis statt Ort: reicht „5 km um dich"? | Produkt + Sicherheit |
| Wer bearbeitet Meldungen, und in welcher Frist? | Betrieb — ohne Antwort darauf ist der Knopf eine Attrappe |
| Mindestalter für Teil B? | Recht |
| Sperren beidseitig oder einseitig? | Produkt |
