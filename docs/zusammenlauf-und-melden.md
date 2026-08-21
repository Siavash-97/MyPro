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

## 3a. Geschlecht: zwei Felder, drei Fragen

**Ersetzt die Festlegung vom Nachmittag** („weiblich / männlich / egal"). Die
war zu grob: Sie warf drei verschiedene Fragen in ein Feld.

### Die drei Fragen, die auseinandergehören

| Frage | Feld | Wofür | Wo erhoben |
|---|---|---|---|
| Wie rechnet die App mit mir? | **Biologisches Geschlecht** | Pace-Normen, VO₂max, später Biomechanik | **Registrierung** |
| Wer bin ich? | **Geschlechtsidentität** | Darstellung im Profil | Community-Profil |
| Wen will ich sehen? | **Vorliebe** | Vorschläge bei ZusammenLauf | Community-Profil |

**Feld 1 — Biologisches Geschlecht** (bei der Registrierung):
weiblich · männlich · divers/intergeschlechtlich · keine Angabe

Es ist eine Rechengröße, keine Zuschreibung. **„Keine Angabe" muss die
Auswertung aushalten**, ohne still etwas anzunehmen — sonst rechnet die App
heimlich mit einem Wert, den niemand angegeben hat.

**Feld 2 — Geschlechtsidentität** (im Community-Profil):
weiblich · männlich · nichtbinär · agender · keine Angabe

**Feld 3 — Vorliebe:** Mehrfachauswahl über dieselben Werte. **Voreinstellung:
alle.**

### Warum Identität und Vorliebe getrennt sind

> Wer nichtbinär ist, will deshalb nicht zwangsläufig nur mit nichtbinären
> Menschen laufen — genauso wenig, wie eine Frau nur mit Frauen laufen will.

Würde die Identität die Sichtbarkeit steuern, würde aus einer
Repräsentationsfunktion eine **Ausgrenzung**: In einer kleinen Nutzerbasis sähe
wer nichtbinär auswählt praktisch niemanden mehr. Zwei Felder kosten ein Feld
und vermeiden das vollständig.

### Die Transangabe steht getrennt — und das ist eine Sicherheitsentscheidung

**Trans ist ein eigenes, freiwilliges Feld mit eigener Sichtbarkeit**, nicht
ein Wert in der Identitätsliste.

Der Grund ist nicht Ordnungsliebe: Diese Angabe kann jemanden **outen**, und
zwar in einer Funktion, die Profile an Fremde zeigt. Stünde „Transfrau" in der
Identitätsliste, trüge jedes Profil die Angabe sichtbar mit — ohne dass die
Person das je einzeln entschieden hätte.

So dagegen erscheint eine **Transfrau schlicht als „weiblich"** für das
Zuordnen, was meistens genau der Wunsch ist. Unterscheidbar bleibt es trotzdem,
dort wo es gebraucht wird — und **wer es sieht, entscheidet sie selbst.**

**Rechtlich:** Angaben zur Geschlechtsidentität und zum Transstatus gehören zu
den besonders schützenswerten Daten. Sie gehören damit in dieselbe Klasse wie
die Gesundheitsdaten aus dem [Schutzkonzept](schutzkonzept.md) — nicht in die
Klasse „Profilangabe".

### Wann diese Felder gebaut werden — und warum noch nicht

**Stand 21.08.2026: keines davon existiert.** Weder eine Spalte in der
Datenbank noch ein Feld in der Oberfläche. Das ist Absicht, mit zwei
verschiedenen Gründen.

| Feld | Auslöser | Warum nicht jetzt |
|---|---|---|
| **Biologisches Geschlecht** | sobald der **erste Rechenweg** es liest – Pace-Normen, Herzfrequenz-Zonen, VO₂max oder die Biomechanik der Einlage | Heute liest es **niemand**. Nachgeprüft: keine VO₂max-Rechnung, keine Zonen, keine Altersklassen im Quelltext |
| **Identität und Vorliebe** | mit **Teil B** | Sie wirken erst, wenn Profile vorgeschlagen werden. Teil B steht an Stelle 5 der Reihenfolge oben – nach Privatzone, Sichtbarkeitsschalter und Melden |

**Der Grundsatz dahinter steht in den Standards:** *nur Daten erheben, die für
den klar beschriebenen Zweck erforderlich sind.* Ein Geschlechtsfeld zu
speichern, das keine Rechnung benutzt, verstößt dagegen – und bei einem Feld,
neben dem eine Transangabe steht, ist das kein Formalismus.

**Umgekehrt gilt:** Sobald der erste Rechenweg es braucht, wird Feld 1 gebaut,
**bevor** die Rechnung geschrieben wird. Sonst rechnet sie mit einer Annahme,
und die Annahme bleibt.

### Wenn die Vorliebe niemanden übrig lässt

**Ehrlich sagen, Erweitern anbieten:**

> „Mit dieser Auswahl finden wir gerade niemanden in deiner Nähe. Auswahl
> erweitern?"

Nicht still auffüllen — das wäre ein Versprechen, das die App bricht, ohne es
zu sagen. Und nicht heimlich den Umkreis vergrößern, sonst steht jemand
plötzlich vor einer Anfahrt von vierzig Kilometern.

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
| **Jeder Beitrag im Feed** | Drei-Punkte-Menü oben rechts → „Melden" | Der häufigste Fall. Der Feed steht bereits in [Community.tsx](../myprosole_web/src/pages/Community.tsx) — nur das Menü fehlt |
| **Fremdes Profil in ZusammenLauf** | Drei-Punkte-Menü → „Melden" | Am Ort des Problems. Wer sich bedroht fühlt, sucht nicht in den Einstellungen |
| **Eigenes Profil** | „Problem melden" → Support | Für alles, was kein einzelnes Konto betrifft |

**Dasselbe Menü an allen drei Stellen.** Wer es einmal gefunden hat, sucht es
nicht neu — und ein tiefes Modul dahinter heißt: Der vierte Ort, an dem
gemeldet werden soll, kostet drei Zeilen.

### Was ein Meldegrund ist

**Bei einem Menschen:** Beschimpfung · Belästigung · Gewalt oder Drohung ·
Spam · Gefälschtes Konto · Etwas anderes *(mit Freitext)*

**Bei einem Beitrag** zusätzlich: Gewaltdarstellung · Terror oder Extremismus ·
Nicht jugendfrei · Selbstgefährdung · Urheberrecht

**Warum die Liste bei Beiträgen länger ist:** Ein Beitrag ist ein Inhalt, den
wir verbreiten. Bei den oberen drei Gründen reicht „später ansehen" nicht —
sie gehören sofort verborgen und geprüft. Das ist auch die Erwartung des
Digital Services Act an ein Melde- und Abhilfeverfahren.

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
| Wer darf die Transangabe sehen — niemand, Angefragte, alle? | Produkt + Sicherheit, siehe 3a |
| Umkreis statt Ort: reicht „5 km um dich"? | Produkt + Sicherheit |
| Wer bearbeitet Meldungen, und in welcher Frist? | Betrieb — ohne Antwort darauf ist der Knopf eine Attrappe |
| Mindestalter für Teil B? | Recht |
| Sperren beidseitig oder einseitig? | Produkt |
