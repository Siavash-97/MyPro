# Woher die Übungen kommen können

Stand 19.08.2026. Gesucht wurde eine Quelle für Übungen **ohne jedes Gerät** –
Beweglichkeit, Kräftigung, Dehnen –, nachdem der Übungskatalog mit Migration
0039 geleert wurde.

Die Zahlen unten sind gemessen, nicht aus Beschreibungen übernommen: Die
wger-Angaben stammen aus vier Seiten ihrer offenen Schnittstelle
(`/api/v2/exerciseinfo/?equipment=7`), abgerufen am 19.08.2026.

---

## Was schon da ist

Im Repo liegt `myprosole_app/supabase/import/uebungen-de.json`: **59 von Hand
geschriebene deutsche Texte** zu einer Auswahl aus free-exercise-db. Sie sind
keine wörtliche Übersetzung, sondern bewusst gekürzt.

Nach Geräten aufgeschlüsselt:

| Gerät laut Quelle | Anzahl |
|---|---|
| `body only` – gar nichts | **39** |
| `foam roll` – Faszienrolle | 8 |
| `dumbbell` – Kurzhantel | 6 |
| `bands` – Band | 5 |
| `exercise ball` – Gymnastikball | 1 |

**39 passen also bereits auf „ohne jegliches Equipment".** Die Datei trägt
selbst den Hinweis: *„Fachliche Durchsicht durch Physiotherapie oder Trainerin
steht aus."* Das gilt weiterhin und wiegt schwer, sobald Menschen mit
Beschwerden diese Übungen bekommen.

---

## Die Quellen im Vergleich

| Quelle | Lizenz | Ohne Gerät | Deutsch | Bilder | Kommerziell nutzbar |
|---|---|---|---|---|---|
| **wger** | CC-BY-SA 4.0 (Daten) | **275** | **193 mit Namen, 192 mit Anleitung** | 72 | ja, mit Namensnennung |
| **free-exercise-db** | Unlicense (gemeinfrei) | ~200 von 800+ | nein | ja | ja, ohne Auflagen |
| **ExerciseDB API** | AGPL-3.0 (Code), Dienst kostenpflichtig | 11.000+ gesamt | nein | GIFs, Videos | **nein** – Abo nötig |
| **exercises-dataset** (hasaneyldrm) | MIT (Code), Bilder © Gym visual | ~325 | **nein** (10 Sprachen, kein Deutsch) | GIFs, **nicht frei** | **nein** – eigene Lizenz nötig |
| **exercemus/exercises** | MIT (Code), Daten gemischt | – | teils | – | je Übung zu prüfen |

### Empfehlung: wger

[wger](https://github.com/wger-project/wger) ist die einzige Quelle, die alle
drei Anforderungen erfüllt:

- **Deutsch von Anfang an.** wger ist ein deutsches Projekt; die Texte sind
  nicht maschinell übersetzt. 192 der 275 gerätefreien Übungen haben eine
  deutsche Anleitung.
- **„Ohne Gerät" ist eine eigene Kategorie**, nicht ein leeres Feld:
  `equipment=7` heißt dort ausdrücklich *none (bodyweight exercise)*.
- **Beweglichkeit und Dehnen sind vertreten**, nicht nur Kräftigung. Aus der
  Stichprobe: *Sitzende Piriformis-Dehnung*, *Buch aufschlagen (Open Book)*,
  *Dehnung des rechten Schulterblattes*, *Beinschwingen über Kreuz*,
  *Armkreisen rückwärts*.

Gemessene Lizenzverteilung der 275: **265 × CC-BY-SA 4.0**, 6 × CC0,
4 × CC-BY-SA 3.0.

---

## Was CC-BY-SA für uns bedeutet

Zwei Pflichten, eine Entwarnung:

**Pflicht 1 – Namensnennung.** Jede übernommene Übung braucht eine
Quellenangabe. Praktisch: eine Seite „Quellen" in der App, die wger und die
jeweiligen Urheber nennt. Die Schnittstelle liefert `license_author` je Übung
mit, das lässt sich automatisch mitführen.

**Pflicht 2 – Weitergabe unter gleichen Bedingungen.** Wer einen Text
bearbeitet, muss die Bearbeitung wieder unter CC-BY-SA stellen. Kürzen wir
eine Anleitung – wie es bei den 59 vorhandenen Texten geschehen ist –, ist das
eine Bearbeitung.

**Entwarnung: Die App wird davon nicht erfasst.** Die ShareAlike-Bedingung
gilt für die *Bearbeitung des Materials*, nicht für alles, was daneben liegt.
Übungstexte in eine App aufzunehmen ist eine Sammlung, keine Bearbeitung des
Programms; der Quelltext bleibt unberührt.
([Creative-Commons-FAQ](https://creativecommons.org/faq/))

Das ist keine Rechtsberatung. Vor der Veröffentlichung gehört die
Quellenseite von jemandem angesehen, der das darf.

---

## Warum die anderen ausscheiden

**ExerciseDB API** hat mit 11.000 Übungen, 5.000 GIFs und 15.000 Videos die
mit Abstand beste Ausstattung – ist aber ein **kostenpflichtiger Dienst**. Das
widerspricht der Bedingung „möglichst kostenlose Tarife, Kostenpflichtiges
erst kaufen, wenn es wirklich gebraucht wird". Zudem wäre es eine Abhängigkeit
von einem fremden Server; die Daten lägen nicht bei uns.

**exercises-dataset** sieht auf den ersten Blick ideal aus: 1.324 Übungen,
GIFs, zehn Sprachen. Zwei Ausschlussgründe: **Deutsch ist nicht dabei**, und
die GIFs gehören *Gym visual* – für eine kommerzielle Nutzung braucht es dort
eine eigene Lizenz. Der MIT-Vermerk gilt nur für den Code, nicht für die
Bilder. Genau die Art Falle, die man erst beim Nachlesen findet.

**free-exercise-db** ist gemeinfrei und damit auflagenfrei – aber englisch.
Es ist die Quelle der 59 vorhandenen Texte; die deutsche Fassung musste von
Hand geschrieben werden. Als Ergänzung brauchbar, als Grundlage nicht.

---

## Was die Messung außerdem zutage gebracht hat

**Die Einteilung bei wger ist nicht zuverlässiger als die alte.** In der
Stichprobe der gerätefreien Übungen stand *„Bizeps mit TRX"* – ein TRX ist ein
Gerät. Es gilt also dasselbe wie beim alten Katalog: Die Quelle liefert
Rohmaterial, die Auswahl bleibt Handarbeit. Das ist kein Einwand gegen wger,
sondern gegen die Vorstellung, man könne einen Katalog automatisch übernehmen.

**Bilder sind die Lücke.** Nur 72 der 275 gerätefreien Übungen haben
überhaupt ein Bild, ganze 2 ein Video. Die Übungsseite und die Mikroroutine
zeigen aber einen Videoplatz. Entweder wird der ehrlich beschriftet, oder es
braucht eine eigene Aufnahme – was bei einem Katalog von 20 bis 30 Übungen
machbar ist.

---

## Vorgeschlagenes Vorgehen

1. **Umfang festlegen, nicht Menge.** 20 bis 30 Übungen, die zu den
   Beschwerdebildern der Anamnese passen, sind mehr wert als 193 ungeprüfte.
   Die Anamnese fragt nach Schmerzstellen – danach sollte sich die Auswahl
   richten, nicht nach Muskelgruppen.
2. **wger als Grundlage**, die 59 vorhandenen deutschen Texte behalten und
   dagegen abgleichen.
3. **Fachliche Durchsicht**, bevor jemand mit Beschwerden diese Übungen
   angezeigt bekommt. Der Hinweis in `uebungen-de.json` steht seit dem
   15.08.2026 offen.
4. **Quellenseite in der App**, sobald der erste CC-BY-SA-Text übernommen ist –
   nicht später.
