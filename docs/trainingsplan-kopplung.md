# Trainingsplan-Kopplung: Wie ein Lauf zu einer geplanten Einheit wird

> **Status: Entwurf zur Entscheidung.** Dieses Dokument wird an fünf Stellen im
> Projekt zitiert (`home.html`, `lauf-zusammenfassung.html`,
> `test_design_mockups.py`, `design/README.md`, `RunDetail.tsx`), existierte
> aber bisher nicht. Der Entwurf fasst zusammen, was in Mockups und Tests
> bereits entschieden ist, und schlägt für die offenen Punkte eine Regelung vor.
> **Was du bestätigst, wird verbindlich; was du änderst, ersetzt den Vorschlag.**
>
> Grundlage: Vorschlag des Produktverantwortlichen vom 14.08.2026, geprüft gegen
> die vorhandenen Mockups, eine Wettbewerbsrecherche (Strava, Garmin, Nike Run
> Club, adidas Running, Runna, TrainingPeaks, Polar, Coros, Apple) und eine
> UX-Analyse.

---

## 1. Was bereits entschieden ist (nicht neu verhandelt)

Diese Punkte stehen in den Mockups und sind durch Tests abgesichert:

- **Ein einziger Startknopf.** `home.html` hat genau einen Weg in den Lauf.
  Der Test `test_the_run_is_linked_to_the_plan_after_the_run_not_before`
  (test_design_mockups.py, Zeile 1020) prüft ausdrücklich, dass es **keinen**
  zweiten gleichrangigen Knopf und keine Auswahl „Nach Plan / Ohne Plan" gibt.
- **Der Plan steht als Unterzeile im Knopf**, nicht als eigene Entscheidung
  (`md-cta__plan`, „Heute geplant: …").
- **Die Zuordnung passiert nach dem Lauf, nicht davor.** Begründung im
  Testkommentar: Vor dem Lauf steht oft nicht fest, was daraus wird.
- **Die Zuordnung wird sichtbar gemacht und ist korrigierbar.**
  `lauf-zusammenfassung.html` zeigt „Als *Regenerationslauf (So)* in deinen
  Wochenplan übernommen." mit dem Link „Passt nicht?".
- **Offene Einheiten verfallen nicht am selben Tag.** `uebungen.html`:
  „Offene Einheiten kannst du bis Sonntag nachholen."

Die Wettbewerbsrecherche bestätigt den Einzelknopf als Marktstandard: Garmin,
Coros, Polar und Strava lösen „geplant oder frei" über einen Start mit
optionaler Rückfrage. Zwei getrennte Einstiege haben nur Nike Run Club und
Apple.

---

## 2. Grundsatz

> **Der Start ist eine Absicht. Das Ende ist ein Ergebnis. Zugeordnet wird das
> Ergebnis.**

Daraus folgt: Ein Tippen auf „Laufen starten" hakt **nichts** ab. Erst der
gespeicherte Lauf wird verbucht.

**Warum nicht beim Start abhaken** (das war der ursprüngliche Vorschlag):
Ein Lauf, der nach 500 m wegen Schmerzen abgebrochen wird, wäre sonst als
erfüllte Einheit verbucht — und die App verlöre genau das Signal, auf das es
für die Verletzungsprävention ankommt.

---

## 3. Zuordnungsregeln

### 3.1 Wann ein Lauf überhaupt zählt

Ein Lauf ist eine **gültige Einheit**, wenn er mindestens **1,0 km** oder
mindestens **5 Minuten Bewegungszeit** erreicht. Darunter wird er als
„kurze Aktivität" gespeichert, aber nicht automatisch zugeordnet. Angeboten
wird trotzdem: „Trotzdem als heutige Einheit zählen?"

> **Offene Entscheidung 1:** Sind 1,0 km / 5 Minuten die richtigen Schwellen?
>
> **Antwort:**

### 3.2 Welcher Einheit ein Lauf zugeordnet wird

Geprüft wird in dieser Reihenfolge, der erste Treffer gewinnt:

1. Eine **offene Einheit desselben Lauftages**.
2. Sonst eine **offene Einheit der letzten zwei Tage**, deren geplante Distanz
   am nächsten liegt (das ist der Fall „Sonntagseinheit am Montag nachgeholt").
3. Sonst: **kein Treffer.** Der Lauf ist ein **Zusatzlauf**. Er zählt in die
   Wochensumme, hakt aber keine Einheit ab.

**Lauftag** ist der Kalendertag des Starts. Ausnahme: Ein Start zwischen
00:00 und 03:00 Uhr zählt zum Vortag (löst den Fall „23:50 Uhr gestartet,
00:30 Uhr beendet" eindeutig).

**Zweiter Lauf am selben Tag:** Nur ein Lauf trägt die geplante Einheit, der
zweite wird automatisch Zusatzlauf. Tauschen geht über „Passt nicht?".

### 3.3 Wie weit die Distanz abweichen darf

Die Distanz entscheidet **nicht, ob** zugeordnet wird, sondern **wie** es
benannt wird:

| Anteil der geplanten Distanz | Zustand | Was angezeigt wird |
|---|---|---|
| 80–120 % | **erledigt** | „Als Regenerationslauf (So) übernommen." |
| 40–80 % | **erledigt, kürzer** | „6,2 von 8,0 km — zählt als erledigt." |
| unter 40 % | **Teilstück** | Einheit bleibt offen und nachholbar |
| über 140 % | **erledigt, deutlich länger** | zusätzlich Hinweis auf die Wochensumme |

Der Hinweis bei über 140 % nennt nur die Tatsache, ohne Lob und ohne Rüge:
„Damit liegst du bei 46 von 40 km — das sind 18 % mehr als in der Vorwoche."
Das ist dieselbe Sprache wie die Sprungwarnung in `laufplan.html`.

> **Offene Entscheidung 2:** Sind 80 / 40 / 140 % die richtigen Grenzen?
> Im Trainingskonzept stehen bereits 10 % und 20 % als Steigerungsgrenzen pro
> Woche — die betreffen aber die Wochensumme, nicht den einzelnen Lauf.
>
> **Antwort:**

---

## 4. Kein Punktesystem

Der ursprüngliche Vorschlag sah „weniger Punkte bei 7 statt 8 km" vor. Davon
wird abgeraten:

1. **Es gäbe zwei konkurrierende Zahlen am selben Lauf.** Der Lauf-Score
   (0–100) existiert bereits und misst Laufqualität. Eine zweite Punktzahl
   zwingt zu der Frage, welche die wichtige ist.
2. **Punkte für Kilometer arbeiten gegen die eigene Progressionsregel.**
   `laufplan.html` warnt bei mehr als 10 % beziehungsweise 20 % Wochenzuwachs.
   Ein Zähler, der für mehr Kilometer mehr gibt, belohnt genau das.
3. **Es bestraft das erwünschte Verhalten.** Wer wegen Beschwerden früher
   aufhört, bekäme Abzug — und hätte einen Anreiz, weiterzulaufen und die
   Schmerzfrage im Tagebuch zu beschönigen. Das verschlechtert die
   Datenqualität genau dort, wo sie sicherheitsrelevant ist.
4. **Keine der neun untersuchten Apps bestraft eine verpasste oder verkürzte
   Einheit.** Was es gibt, sind angepasste künftige Vorschläge oder das
   Angebot, den Plan umzubauen.

**Stattdessen:** Zustand statt Zahl — *offen · erledigt · erledigt, kürzer ·
Teilstück*. Dazu die bereits vorhandene Wochenkilometer-Zeile und der
Einheiten-Zähler.

Wenn später doch belohnt werden soll, dann **Regelmäßigkeit und Prävention**
(Wochen mit Mikroroutine, eingehaltene Ruhetage, geführtes Tagebuch) — nie
Distanz.

> **Entscheidung 3: ENTSCHIEDEN am 14.08.2026 — Punktesystem gestrichen.**
> Wortlaut des Produktverantwortlichen: „es sollte keine Strafe auftreten".
> Es gibt keinen Punktabzug, keine Wertung und keine Bestrafung für kürzere,
> verpasste oder zusätzliche Läufe — weder sichtbar noch in einer verborgenen
> Kennzahl.

---

## 5. Ruhetage

**Der Startknopf wird am Ruhetag nicht blass und nicht gesperrt.** Ein Knopf,
der aussieht wie deaktiviert und trotzdem funktioniert, bringt jedem bei, dass
„ausgegraut" in dieser App nichts bedeutet — danach wird auch auf echte
deaktivierte Elemente getippt. Für Screenreader wäre die Information zudem
unsichtbar, weil sie nur in einer Farbe steckt.

**Stattdessen** sagt die Unterzeile, was Sache ist:

> Heute Ruhetag — ein lockerer Lauf ist trotzdem in Ordnung

Kein Bestätigungsdialog vor dem Lauf. Er käme in dem Moment, in dem jemand in
Laufkleidung an der Tür steht, verhindert nichts und erzieht zum Wegklicken.

**Ein Lauf am Ruhetag ist ein Zusatzlauf.** Der Ruhetag wird **nie automatisch
verschoben**.

> **Offene Entscheidung 4:** Ist der Ruhetag eine Empfehlung (dann reicht die
> Unterzeile) oder ein verbindlicher Rahmen (dann bräuchte es eine echte
> Sperre mit Ausweg — aber dann ehrlich als Sperre, nicht optisch getarnt)?
>
> **Antwort:**

---

## 6. Planänderungen: nicht nach dem Lauf

Der ursprüngliche Vorschlag fragte direkt nach dem Lauf „Sollen wir deinen Plan
ändern?". Davon wird abgeraten: Aus **einer** Abweichung folgt kein Muster, und
die Frage trifft eine erschöpfte Person.

**Gefragt wird erst nach einer Wiederholung** (entschieden am 14.08.2026).
Wortlaut: „eher nach Wiederholung eine Frage gestellt wird, wenn zum Beispiel
3 Mal hintereinander weniger gelaufen wird".

Konkret: Erst wenn **drei aufeinanderfolgende Einheiten** unter 80 % der
geplanten Distanz lagen, fragt die App — nicht nach der ersten und nicht nach
der zweiten. Eine einzelne kurze Einheit bleibt kommentarlos.

> Deine letzten drei Läufe waren kürzer als geplant. Soll der Plan kleiner
> werden?

Ebenso beim Rhythmus, wenn das Muster wiederholt auftritt:

> Du bist die letzten Wochen meistens am Wochenende gelaufen und unter der
> Woche gar nicht. Plan an deinen Rhythmus anpassen?

Von dort führt der Weg auf `laufplan.html`, wo manuell geändert wird.

**Zusätzlich, und wichtiger als jeder Einstieg:** Wenn über zwei Wochen weniger
als 30 % des Plans erfüllt wurden, fragt die App von sich aus — **bevor**
jemand sich als Versager fühlt:

> **Der Plan passt gerade nicht zu deiner Woche.**
> Das ist normal — Wochen sind verschieden.
> [Plan kleiner machen] [Pausieren] [So lassen]

Drei gleichwertige Knöpfe, keiner davon ist der „richtige".

---

## 7. Korrektur: „Passt nicht?"

Heute führt der Link ins Leere (auf `uebungen.html`). Er muss ein Auswahlfeld
öffnen mit:

- den offenen Einheiten dieser Woche
- „Zusätzlicher Lauf (keine Einheit)"
- „Einheit wieder öffnen"

Die Auswahl wirkt sofort; Wochenzähler und Wochensumme rechnen neu.
**Derselbe Weg bleibt dauerhaft über Verlauf → Laufdetail erreichbar**, nicht
nur in den Sekunden nach dem Lauf.

Die Wettbewerbsrecherche zeigt: Genau hier hat der Markt eine Lücke. Nur
TrainingPeaks („Pair/Unpair") und Runna („Link Activity") haben eine saubere
Funktion dafür; bei Garmin ist die fehlende Verknüpfung ein Dauerthema in den
Foren.

---

## 8. Nutzer ohne Plan

**Das ist kein Randfall, sondern die wertvollste Gruppe.** Die beiden Nutzer,
für die Sensoreinlagen am interessantesten sind — wer Beschwerden hat und
verstehen will, warum; und wer aus Neugier jede Zahl liest — starten
mehrheitlich **ohne** Plan.

Heute ist der Plan faktisch Pflicht: Zwei der drei Anmeldewege in
`welcome.html` führen direkt in `anamnese.html`, die „Lass uns deinen Laufplan
erstellen" heißt und mit „Dein Plan ist erstellt" endet. Wer nur laufen will,
muss vorher Gesundheitsfragen beantworten (Schmerzen, Operationen, Gewicht —
DSGVO Art. 9). Die Begriffe „ohne Plan", „kein Plan" oder „planlos" kommen im
gesamten Projekt kein einziges Mal vor.

### 8.1 Ein Knopf, vier Unterzeilen

Der Knopftitel bleibt immer **„Laufen starten"**. Nur die Unterzeile wechselt:

| Zustand | Unterzeile |
|---|---|
| Plan, heute Laufeinheit | „Heute geplant · Regenerationslauf, 8,2 km locker" |
| Plan, heute Ruhetag | „Heute Ruhetag — ein lockerer Lauf ist trotzdem in Ordnung" |
| Kein Plan, mindestens ein Lauf | „Zuletzt 8,2 km · 5:54 min/km" |
| Kein Plan, noch kein Lauf | „GPS an — mehr brauchst du nicht" |

Der dritte Zustand ist der wichtigste: Er gibt jemandem ohne Plan einen
**eigenen Bezugspunkt** statt eines leeren Platzes, wo bei anderen ein Ziel
steht.

### 8.2 Startseite ohne Plan

Nicht Karten ausblenden, sondern dieselben Plätze anders füllen. Statt
„Diese Woche · 31,6 / 40 km" mit Fortschrittsbalken:

> **Deine letzten 7 Tage**
> Distanz **12,4 km** · Läufe **2** · Aktive Zeit **1:14 Std**
> Die 7 Tage davor: 8,9 km · 2 Läufe

Der Vergleich misst gegen die eigene Vorwoche statt gegen eine Vorgabe — ohne
Prozentzahl, ohne Pfeil, ohne Ampelfarbe. Die Vergleichszeile erscheint nur,
wenn im Vorzeitraum überhaupt ein Lauf liegt.

Dazu: „Letzter Lauf" bekommt den Lauf-Score in die Zeile, und ab dem dritten
Lauf eine Karte „Was sich verändert" (Ø Score, Ø Tempo, längster Lauf, jeweils
gegen den Vorzeitraum).

### 8.2a Die Weiche nach der Anmeldung: drei Wege

Entschieden am 14.08.2026. Wortlaut: „am Anfang kann man auch eine Option
lassen, ich will meinen eigenen Plan selber erstellen". Und zum Auftrag der
App: „der Plan ist, dass wir die Leute hinweisen, wie die laufen sollen — und
die, die es wissen, können ja selber den Plan bearbeiten und eintragen."

Daraus folgen **drei gleichrangige Wege**, keine Haupt-Aktion mit
kleingedrucktem „Überspringen":

| Weg | Für wen | Wohin |
|---|---|---|
| **Plan erstellen lassen** | Wer Anleitung will — der Regelfall und der Kern des Produkts | Anamnese → fertiger Wochenplan |
| **Eigenen Plan selbst eintragen** | Wer weiß, was er tut | direkt in den Wochenplan-Editor (`laufplan.html`) |
| **Einfach loslaufen** | Wer erst mal nur aufzeichnen will | direkt auf die Startseite |

Der mittlere Weg ist neu und war bisher nirgends vorgesehen. Er trägt den
Anspruch der App mit: Anleitung ist das Angebot, nicht die Bedingung.

> **Offene Sicherheitsfrage 5 (bleibt offen):** Die Anamnese liefert heute die
> Angaben, die die Übungsauswahl absichern (Beschwerden, Operationen). Wer den
> mittleren oder rechten Weg wählt, hat sie nicht beantwortet.
>
> Vorschlag: Ein **Mini-Sicherheitsblock mit zwei Fragen** (aktuelle
> Beschwerden ja/nein, Operationen oder strukturelle Einschränkungen ja/nein)
> — **nicht** vor dem ersten Lauf, sondern **vor der ersten Mikroroutine**.
> Dort ist er begründbar („damit wir dir nichts Falsches zeigen") und kostet
> 20 Sekunden. Bis dahin nur ein neutraler Basissatz an Übungen
> (Mobilität, Rumpf), keine steigernde Belastung.
>
> **Antwort:**

### 8.3 Wann ein Plan angeboten wird

Nicht nach einem Zähler, sondern nach einem Anlass — frühestens ab dem vierten
Lauf:

- **Regelmäßigkeit erkennbar** (drei Läufe in vierzehn Tagen an wiederkehrenden
  Wochentagen): „Du läufst meistens dienstags und sonntags. Soll ich das als
  deinen Wochenrhythmus festhalten?"
- **Steigerung sichtbar** (längster Lauf über drei Wochen um 20 % gewachsen):
  „Deine Läufe werden länger. Ein Wochenplan sagt dir, wie viel du draufpacken
  kannst, ohne dich zu überlasten."
- **Beschwerden gemeldet** (zweimal dieselbe Schmerzstelle im Tagebuch): Hier
  wird **kein Plan** angeboten, sondern die Anamnese — das ist der wertvollste
  Einstieg, weil er echten Nutzen liefert.
- **Der Nutzer sucht selbst** (öffnet Training-Tab oder Entwicklungskarte).

Trifft nichts davon zu: **gar nicht fragen.** Höchstens drei Angebote im ersten
Jahr. Ablehnen wirkt dreistufig: wegtippen (30 Tage Ruhe), „Nein danke"
(90 Tage), „Frag mich nicht mehr" (dauerhaft, im Profil wieder einschaltbar).

### 8.4 Der Rückweg

**Bevor mehr Einstieg gebaut wird, muss der Ausstieg stehen.** Ein Plan, dem
man nicht folgt, erzeugt wöchentlich ein Versagenserlebnis — das bindet
schlechter als gar kein Plan.

In `laufplan.html` zwei sichtbare, beschriftete Zeilen (nicht in einem Menü):
**„Plan pausieren"** (1 Woche / 4 Wochen / bis ich ihn wieder starte) steht vor
**„Plan beenden"**. Der Bestätigungstext sagt, dass nichts verloren geht:

> Deine Läufe werden weiter aufgezeichnet. Verlauf, Lauf-Score und
> Trainingstagebuch bleiben unverändert. Du kannst den Plan jederzeit wieder
> starten.

---

## 9. Was ausdrücklich nicht gebaut wird

- Kein zweiter Startknopf, kein Modus-Wähler vor dem Lauf, kein
  Langdruck-Geheimnis (verstößt gegen die Klicktiefen-Regel).
- Kein zweiter Startbildschirm als eigene Datei — **derselbe** Screen mit
  Zustandsvarianten.
- Kein heimlich abgeleitetes Wochenziel („du läufst ja meistens 30 km").
  Das wäre ein aufgedrängter Plan durch die Hintertür.
- Keine Streaks, keine Abzeichen, kein „verpasst"-Zähler auf der Startseite.
- Keine Push-Benachrichtigung als Plan-Angebot.
- Keine Gesundheitsfragen vor dem ersten Lauf.

---

## 10. Offene Fragen, die noch niemand beantwortet hat

1. **Fließt Plantreue in den Lauf-Score ein?** Im Repository ist nur die
   *Anzeige* des Scores zu finden, keine Berechnung. Falls Plantreue einfließt,
   hätten Nutzer ohne Plan systematisch schlechtere Werte, ohne es zu wissen.
2. **Wochengrenze:** Montag bis Sonntag? Und bleiben offene Einheiten wirklich
   nur bis Sonntag nachholbar?
3. **Andere Datenquellen:** Sollen Laufband, manuelle Nacherfassung oder Import
   aus einer Uhr ebenfalls Einheiten abhaken können?
4. **Wo wird der Zustand des Plan-Angebots gespeichert?** Lokal bedeutet: Bei
   Neuinstallation oder auf einem zweiten Gerät wird erneut gefragt, obwohl
   „Frag mich nicht mehr" gewählt wurde.

**Antworten:**
