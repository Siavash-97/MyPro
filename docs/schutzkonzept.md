# Schutzkonzept

Stand 19.08.2026. Alle Zahlen sind an einer aus den Migrationen aufgebauten
Datenbank gemessen, nicht aus Beschreibungen übernommen.

Zweck: An einer Stelle festhalten, **was geschützt wird, wovor, womit** — und
was davon heute schon steht und was nicht. Ein Konzept, das nicht zwischen
beidem unterscheidet, ist eine Wunschliste.

---

## 1. Was es zu schützen gibt

| Bereich | Empfindlichkeit | Inhalt |
|---|---|---|
| **gesundheit** | **Art. 9 DSGVO** | Anamnese, Beschwerden, Schmerzstellen, Zyklus, Trainingstagebuch |
| **tracking** | sensibel | Laufstrecken, GPS-Punkte, Herzfrequenz — später Einlagendaten |
| **einwilligung** | Nachweis | Wer wozu wann Ja gesagt hat, mit Wortlaut |
| **profil** | normal | Name, Bild, Kontaktdaten |
| **fitness** | normal | Übungskatalog, Protokoll |

**Die beiden ersten sind das Eigentliche.** Ein Datenabfluss beim
Übungskatalog ist ärgerlich; einer bei Schmerzstellen und Laufstrecken kann
jemandem schaden — bis dahin, dass eine Wohnadresse und die übliche Laufzeit
einer Person zusammen bekannt werden.

---

## 2. Wovor

Vier Gefahren, nach Schadenshöhe geordnet — nicht nach Wahrscheinlichkeit.

**A. Nachstellen.** Jemand nutzt die App, um herauszufinden, wo und wann eine
bestimmte Person läuft. Der schwerste Fall, weil der Schaden körperlich ist
und die App ihn aktiv ermöglichen würde.

**B. Wohnadresse aus Laufdaten.** Start- und Endpunkte von Aufzeichnungen
zeigen, wo jemand wohnt. Belegt: Forscher der NC State University haben
Wohnadressen aus Stravas öffentlicher Heatmap bestimmt.

**C. Gesundheitsdaten beim Arbeitgeber.** Über die geplanten Firmengruppen.
Rechtlich der Punkt, an dem das Angebot im Betrieb scheitert.

**D. Fremdzugriff auf Konten.** Der gewöhnliche Fall — jemand liest Daten, die
ihm nicht gehören.

---

## 3. Was heute steht

Gemessen am 19.08.2026:

```
Tabellen in public                                41
davon mit Zeilenrechten eingeschaltet             41
Tabellen im Schema einwilligung                    2
Regeln insgesamt                                 128
Regeln, die Nichtangemeldeten etwas erlauben       0
Tabellen mit Rechten für Nichtangemeldete          0
```

**Gegen D (Fremdzugriff) ist der Schutz vollständig.** Jede Tabelle hat
Zeilenrechte, keine einzige Regel und kein einziges Zugriffsrecht gilt für
Nichtangemeldete. Wer nicht angemeldet ist, sieht nichts — auch nicht durch
einen Fehler in der App, weil die Entscheidung in der Datenbank fällt und
nicht in der Abfrage.

Seit Migration **0037** stehen die Zugriffsrechte in den Migrationen und
werden aus den Zeilenregeln abgeleitet. Vorher hatte keine einzige Tabelle
ein Zugriffsrecht — die App lief nur, weil Supabase neue Tabellen automatisch
freigab, und diese Einstellung wird zum 30.10.2026 abgeschafft.

### Zwölf Tabellen lassen sich nicht ändern

Nur lesen und anlegen, kein Ändern, kein Löschen:

`art9_consents`, `einwilligungen`, `texte`, `data_access_log`,
`community_group_answers`, `security_domains`, `exercises`,
`exercise_groups`, `exercise_muscles`, `exercise_equipment`, `equipment`,
`muscle_groups`

Bei den ersten vier ist das der Zweck: Ein Nachweis, den der Nachgewiesene
umschreiben kann, ist keiner. Ein Widerruf ist deshalb eine neue Zeile, kein
Überschreiben. Bei den übrigen ist es Nachschlagewerk, das nur über
Migrationen wächst.

### Der Nachweis trägt den Wortlaut

Seit **0034** steht in jeder Einwilligungszeile nicht nur *wer, was, wann*,
sondern **welchem Text**. Ein Gericht hat entschieden, dass Adresse, IP und
Zeitstempel dafür nicht genügen — ohne Nachweis gilt die Einwilligung, als
wäre sie nie erteilt worden.

### Keine IP-Adressen

Bewusst nicht erhoben. Sie ist ein personenbezogenes Datum (EuGH C-582/14),
und für die Zwecke, die sie erfüllen sollte, taugt sie nicht: Das
Betriebssystem steht nicht in ihr, und wer mit wem läuft, steht in den
Verabredungen. Stattdessen Plattform und Zeitzone als eigene Felder (0036).

---

## 4. Was heute NICHT steht

Ehrlich, weil ein Konzept ohne diese Liste nichts wert ist.

**Gegen A (Nachstellen): fast nichts.** Es gibt heute keine Profilsuche —
deshalb ist die Gefahr klein. Sie entsteht in dem Moment, in dem
ZusammenLauf zur Profilsuche wird. Die neun Maßnahmen dagegen stehen als
Entwurf in [gruppen-und-sicherheit-entwurf.md](gruppen-und-sicherheit-entwurf.md),
gebaut ist keine.

**Gegen B (Wohnadresse): nichts.** GPS-Punkte werden vollständig gespeichert,
von der ersten bis zur letzten Sekunde. Wer Zugriff auf ein Konto bekommt —
oder wer später Läufe teilen kann —, sieht, wo die Person losgelaufen ist.
Die Gegenmaßnahme (Privatzone) ist entworfen, nicht gebaut. **Das ist die
größte offene Lücke**, und sie betrifft auch Nutzer, die nie in die Community
gehen.

**Gegen C (Arbeitgeber): nichts**, weil es die Firmengruppen noch nicht gibt.
Die Regeln dafür — nur Summen, Mindestgröße 5 — sind entworfen.

**Rohe Datenbankmeldungen im Snackbar.** Steht seit Wochen als offener Punkt.
Eine Fehlermeldung der Datenbank kann Tabellen- und Spaltennamen preisgeben.
Kein Datenabfluss, aber eine unnötige Auskunft über den Aufbau.

**Der Zugriffsprotokoll wird nicht gefüllt.** `data_access_log` ist angelegt
und richtig abgesichert (nur anlegen, kein Lesen über die Schnittstelle) —
aber niemand schreibt hinein. Ein leeres Protokoll ist kein Protokoll.

**Rechtstexte sind Entwürfe.** Datenschutzerklärung und AGB tragen selbst den
Hinweis, dass sie nicht anwaltlich geprüft sind. Anbieterangaben fehlen.

**Fachliche Durchsicht der Übungen steht aus.** 12 der 32 Texte sind selbst
geschrieben und gehen an Menschen, die Schmerzen angegeben haben.

---

## 5. Die Grundsätze, nach denen entschieden wird

**Die Datenbank entscheidet, nicht die App.** Jede Zugriffsfrage wird über
Zeilenrechte beantwortet. Ein Filter in der Abfrage ist Bequemlichkeit, kein
Schutz — er täuscht vor, die Absicherung läge dort.

**Was nicht gespeichert wird, kann nicht auslaufen.** Vor jeder neuen Spalte
die Frage, ob die Angabe wirklich gebraucht wird. Die IP-Entscheidung ist der
Beispielfall.

**Baulich statt vorschriftlich.** Sicherheit, die davon abhängt, dass jemand
an eine Regel denkt, ist keine. Deshalb Privatzone von Anfang an an statt
eines Hinweises, sie einzuschalten.

**Ein Nachweis, der sich ändern lässt, ist keiner.** Einwilligungen und
Protokolle sind unveränderlich.

**Abgeleitet statt gespeichert.** Ob eine Einwilligung gilt, ergibt sich aus
der jüngsten Zeile. Eine Ableitung kann von den Daten nicht abweichen, ein
gespeicherter Zustand schon.

**Erst erweitern, nie sofort wegnehmen.** Die Datenbank aktualisiert sich für
alle sofort, die App auf dem Telefon nicht. Neues daneben, Altes erst
entfernen, wenn keine alte Fassung mehr läuft.

---

## 6. Reihenfolge

1. **Privatzone um Zuhause** — schützt jeden, auch ohne Community
2. **Sichtbarkeitsschalter anschließen** — heute ein Versprechen ohne Wirkung
3. **Rohe Datenbankmeldungen** aus der Oberfläche nehmen
4. **Firmenregeln** (Summen, Mindestgröße), bevor die erste Firmengruppe entsteht
5. **Profilsuche zuletzt** — sie schafft die Gefahrenlage, die 1 und 2 abdecken

Wer 5 vor 1 baut, liefert das Risiko zuerst aus.
