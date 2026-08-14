# Offene Fragen: Mockups 1:1 in die App bringen

**Für dich zum Ausfüllen.** Schreib deine Antwort jeweils hinter `Antwort:`.
Kurz reicht („ja", „nein", „später", „Variante B"). Wo nichts steht, mache ich
das, was unter *Mein Vorschlag* steht.

Stand: 14.08.2026 · Grundlage: vollständiger Abgleich aller 34 Mockups gegen
die 19 React-Seiten.

---

## Was der Abgleich ergeben hat

Ehrliche Zusammenfassung, bevor die Fragen kommen:

| | Anzahl |
|---|---|
| Mockup-Screens insgesamt | 34 |
| Davon in der App vorhanden und nah am Mockup | 2 (Login, Verlauf) |
| Davon vorhanden, aber mit fehlenden Teilen | 15 |
| Davon in der App **gar nicht vorhanden** | 17 |

Die 17 komplett fehlenden Screens:

- `welcome.html` (Einstiegsseite mit Video-Hero)
- `confirm-email.html`
- `laufplan.html` (Wochenraster zum Bearbeiten)
- `trainingseinheit.html` (geführte Mikroroutine)
- `analyse-ergebnis.html` (Laufanalyse mit Score-Ring und Akkordeon)
- `einlage-verbinden.html`, `einlage.html`, `einlagen-entdecken.html`
- `share-export.html`, `social-studio.html`
- `community.html`, `community-beitrag.html`, `community-neuer-beitrag.html`,
  `community-gruppen.html`, `community-gruppe-detail.html`,
  `community-gruppe-erstellen.html`, `community-meine-gruppen.html`,
  `community-profil.html`, `community-zusammenlauf.html`,
  `community-zusammenlauf-filter.html`
- `zyklus-einrichten.html`, `zyklus-kalender.html`

Das CSS für praktisch alle diese Screens liegt bereits vollständig in der App
(`myprosole_web/src/styles/components.css`) — es fehlt „nur" das Zusammenbauen
der Seiten.

---

## Teil A — Grundsatzfragen (die steuern alles andere)

### A1. Bedienelemente ohne fertige Funktion: anzeigen oder weglassen?

Du hast gesagt, manche Verbindungen sind bewusst noch nicht angeschlossen
(KI-Chat, Community, Einlagen). Ich hatte diese Bedienelemente daraufhin
**ganz entfernt** — z. B. den Bluetooth-Knopf im Live-Tracking, die
Anhang-/Mikrofon-Knöpfe im Chat, den ganzen „Gerät"-Abschnitt im Profil.
Genau das hat dazu geführt, dass es nicht 1:1 ist.

- **Variante A:** Alles wie im Mockup anzeigen. Wo die Funktion fehlt,
  erscheint beim Tippen ein kurzer Hinweis „Funktion kommt bald" (die Mockups
  machen das schon so, über `prototype-placeholder.js`).
- **Variante B:** Weiter weglassen, was nicht funktioniert.

*Mein Vorschlag: **Variante A** — dann stimmt das Design überall, und du siehst
beim Testen den vollständigen Aufbau.*

**Antwort:**

---

### A2. In welcher Reihenfolge soll ich die Seiten nachziehen?

Ich schlage diese Reihenfolge vor (jede Seite einzeln, mit Screenshot zum
Abnicken, bevor die nächste kommt):

1. Untere Navigation + App-Leisten (betrifft jede Seite)
2. Home
3. Profil
4. Training/Übungen inkl. Wochenplan
5. Laufzusammenfassung
6. Live-Tracking
7. Chat
8. Trainingstagebuch
9. Registrieren + Profil einrichten
10. Danach die komplett fehlenden Seiten (siehe A3)

**Antwort (andere Reihenfolge? welche Seite zuerst?):**

---

### A3. Welche der 17 fehlenden Seiten sollen jetzt gebaut werden?

Bitte pro Zeile: **jetzt** / **später** / **gar nicht**

| Seite | Was sie tut | Antwort |
|---|---|---|
| `welcome.html` | Einstiegsseite mit Video, Google/Facebook/E-Mail-Buttons | |
| `confirm-email.html` | 6-stelliger Bestätigungscode | |
| `laufplan.html` | Wochenraster: Kilometer pro Tag bearbeiten | |
| `trainingseinheit.html` | Geführte Mikroroutine (3 Übungen, Video, Begründung) | |
| `analyse-ergebnis.html` | Laufanalyse: Score-Ring, Auffälligkeiten, Biomechanik | |
| `einlage-verbinden.html` + `einlage.html` | Einlagen koppeln und Status | |
| `einlagen-entdecken.html` | Produktseite Einlagen | |
| `share-export.html` + `social-studio.html` | Social-Post aus dem Lauf bauen | |
| Community (10 Seiten) | Feed, Beiträge, Gruppen, ZusammenLauf | |
| `zyklus-einrichten.html` + `zyklus-kalender.html` | Zykluskalender | |

---

## Teil B — Fragen zu einzelnen Seiten

### B1. Untere Navigation

Mockup hat **5** Einträge: Start · Training · Community · Verlauf · Profil.
Die App hat **4**, in anderer Reihenfolge: Start · Verlauf · Training · Profil.

Soll ich auf 5 Einträge in der Mockup-Reihenfolge umstellen? (Community-Eintrag
führt dann auf die Community-Seite bzw. auf einen „kommt bald"-Hinweis, je nach
Antwort A1/A3.)

**Antwort:**

---

### B2. Home — was steht in der Startknopf-Unterzeile?

Mockup: „Heute geplant: Regenerationslauf · 8,2 km locker".
App aktuell: „GPS-Tracking mit Live-Statistiken".

Der echte Text braucht den Trainingsplan (`laufplan.html`), den es noch nicht
gibt. Was soll bis dahin dort stehen?

- **Variante A:** Zeile ganz weglassen, bis der Plan existiert
- **Variante B:** Neutraler Text wie jetzt
- **Variante C:** Plan zuerst bauen (siehe A3), dann steht der echte Text da

**Antwort:**

---

### B3. Home — „Letzter Lauf", wenn es noch keinen gibt

Mockup zeigt die Karte immer. Die App blendet sie aus, wenn das Konto noch
keinen Lauf hat. Soll stattdessen etwas dastehen wie „Noch kein Lauf
aufgezeichnet"?

**Antwort:**

---

### B4. Profil — die fehlenden Abschnitte

Im Mockup hat das Profil diese Abschnitte, in der App fehlen sie komplett:

| Abschnitt | Zeilen im Mockup | soll rein? |
|---|---|---|
| Zahlungen & Mitgliedschaft | Mitgliedschaft, Zahlungsmethode, Rechnungen | |
| Gerät | Einlage verbinden, Einlage kalibrieren, Batterie und Speicher, Smartwatch verbinden | |
| Community | Sichtbar für ZusammenLauf (Schalter), Community-Profil, Meine Gruppen, Blockierte Nutzer:innen | |
| Gesundheit | Zykluskalender (nur bei passender Profilangabe sichtbar) | |
| Einstellungen: Benachrichtigungen (Schalter) | | |
| Einstellungen: Sprache (Deutsch) | | |
| Einstellungen: Datenschutz (einfache Zeile) | | |
| „Upgrade"-Knopf auf der Plan-Karte | | |

**Sonderfall Farbschalter:** Das Mockup hat drei Schalter „Logo-Farben
(Violett)", „Vital-Farben (Petrol)", „Set B (Cyan & Indigo)". Im Mockup steht
dazu, das seien Vergleichsschalter für die Farb-Abstimmungsphase, die nach der
Entscheidung wieder rausfliegen. **Sollen die in die echte App?**

**Antwort:**

---

### B5. Profil — was die App zusätzlich hat

Die App zeigt zwei Dinge, die im Mockup nicht vorkommen:
- Abschnitt „Laufprofil" (Laufniveau, Wochenziel)
- Datenschutz-Karte mit den DSGVO-Art.-9-Einwilligungen

Sollen die **bleiben** oder **raus** (weil nicht im Mockup)?

**Antwort:**

---

### B6. Training/Übungen — der ganze obere Teil fehlt

Im Mockup steht über dem Übungskatalog:
1. Karte „Diese Woche" (3 von 4 Einheiten, Fortschrittsbalken)
2. Abschnitt „Heute" mit der Einheit und Knopf „Starten"
3. Karte „Nächste Tage" (7 Tage Vorschau) mit Link „Plan bearbeiten"
4. „Für dich empfohlen" → großer Einstieg „Übungen starten" mit Videobild

Das alles hängt am Trainingsplan, den es noch nicht gibt. Außerdem hat die App
zwei Dinge, die im Mockup **nicht** vorkommen: den Abschnitt „Meine Pläne" und
die Such-/Filterleiste über dem Katalog.

- Sollen die vier Mockup-Blöcke gebaut werden (dann brauche ich vorher den
  Trainingsplan, siehe A3)?
- Sollen „Meine Pläne" und Suche/Filter bleiben?
- Das Mockup hat oben rechts ein Hantel-Symbol zum Gym-Plan. Soll das rein?

**Antwort:**

---

### B7. Trainingseinheit — zwei verschiedene Dinge mit ähnlichem Namen

Das ist der wichtigste Fund im ganzen Abgleich:

- **Mockup `trainingseinheit.html`** ist eine *geführte Mikroroutine*: 3 Übungen
  nacheinander, Video, Zielangabe („2 Sätze · 15 Wiederholungen"), Begründung
  („Steht bei dir vorn, weil du früher Knieprobleme hattest") und ein
  Aufklapper „Warum das hilft". **Keine Eingabefelder.**
- **App `WorkoutSession.tsx`** ist etwas anderes: ein *Protokoll* für das
  Gym-Training, mit Feldern für Sätze, Wiederholungen und Gewicht.

Beide existieren nebeneinander sinnvoll. Frage:

- Soll ich die Mikroroutine als **zusätzliche** Seite bauen (dann gibt es
  beides)?
- Oder soll das Gym-Protokoll durch die Mikroroutine **ersetzt** werden?

*Mein Vorschlag: beides behalten — sie lösen verschiedene Aufgaben.*

**Antwort:**

---

### B8. Trainingstagebuch — fehlende Schmerz-Rückfragen

Im Mockup kommen bei „Beschwerden = Ja" **drei** Rückfragen:
1. Wo? (Chips) ✔ ist in der App
2. **Ab welchem Kilometer ungefähr?** ✘ fehlt
3. **„Beschreib es kurz"** (erscheint nur bei „Woanders") ✘ fehlt

Im Mockup steht dazu, die Kilometer-Angabe sei ein hartes Kriterium für die
automatische Übungsauswahl. Soll ich beide nachbauen?

Außerdem: Mockup zeigt Distanz/Dauer/**Tempo** als feste Kacheln (nicht
änderbar), die App zeigt Distanz/Dauer als **Eingabefelder** (änderbar, Tempo
fehlt). Was ist richtig — fest anzeigen oder änderbar lassen?

**Antwort:**

---

### B9. Laufzusammenfassung — vier fehlende Karten

Nach dem Lauf zeigt das Mockup (in dieser Reihenfolge):
1. **Mikroroutine-Angebot**: „Jetzt 6 Minuten · Deine Mikroroutine" mit
   „Starten" / „Heute nicht" — laut Mockup nicht nach jedem Lauf, sondern nach
   2–3 von 4 Läufen
2. **Plan-Zuordnung**: „Als Regenerationslauf (So) in deinen Wochenplan
   übernommen" mit „Passt nicht?"
3. Knopf **„Laufanalyse anschauen"**
4. **Social-Post-Karte**: „Mach daraus einen Social-Post"

Alle vier fehlen. Zusätzlich fehlt oben rechts der **Teilen**-Knopf, und in der
Kopfzeile fehlt die Uhrzeit („Heute, 07:42 Uhr · App-Modus mit GPS").

Welche davon jetzt? (Die Plan-Zuordnung hängt an der geparkten Frage, wie ein
Lauf einer geplanten Einheit zugeordnet wird — siehe B12.)

**Antwort:**

---

### B10. Laufzusammenfassung — Kilometer-Abschnitte

Mockup fasst zusammen: „km 1–3", „km 4–6", „km 7–8,2".
App zeigt jeden Kilometer einzeln: „km 1", „km 2", „km 3" …

Welche Darstellung willst du?

**Antwort:**

---

### B11. Live-Tracking — Herzfrequenz und Bluetooth

Im Mockup gibt es **vier** Kacheln: km · min/km · Hm · **bpm** (die bpm-Kachel
zeigt „--", solange nichts verbunden ist) und rechts unten einen
**Bluetooth-Knopf** zum Smartwatch-Verbinden. Beides fehlt in der App.

Soll ich beides einbauen (bpm zeigt „--", Knopf sagt „kommt bald")?

Außerdem: Der Zurück-Pfeil heißt im Mockup **„Minimieren"** (Lauf läuft weiter,
zurück zur Startseite). In der App **bricht er den Lauf ab**. Was ist richtig?

**Antwort:**

---

### B12. Wie wird ein Lauf einer geplanten Einheit zugeordnet?

Das ist die Frage, die wir am 12.08. geparkt haben — sie blockiert jetzt B2, B6
und B9. Konkret: Du hast am Sonntag „Regenerationslauf 8,2 km" geplant.

- **Fall 1:** Du läufst am Sonntag 11 km statt 8,2 km. Zählt der Lauf als die
  geplante Einheit (nur weiter gelaufen) oder als etwas anderes?
- **Fall 2:** Du läufst die 8,2 km am Montag statt am Sonntag. Zählt das als
  die Sonntagseinheit (nachgeholt) oder als Extra-Lauf, und die Sonntagseinheit
  bleibt offen?
- **Fall 3:** Du läufst zweimal am selben Tag. Welcher Lauf zählt?

**Antwort:**

---

### B13. Registrieren — fehlende Pflichtfelder

Im Mockup hat die Registrierung:
- ein **Namensfeld** („Vor- und Nachname") ✘ fehlt in der App
- eine **Pflicht-Checkbox** „Ich akzeptiere die AGB und die
  Datenschutzerklärung" ✘ fehlt in der App
- Passwort **mindestens 8 Zeichen** — die App verlangt nur 6

Die App hat dafür zusätzlich ein Feld „Passwort bestätigen" und einen
Google-Knopf (im Mockup steht Google nur auf `welcome.html`).

Soll ich Name, AGB-Checkbox und die 8 Zeichen nachziehen? Und: Sollen
„Passwort bestätigen" und der Google-Knopf bleiben?

*Hinweis: Die AGB-Checkbox ist rechtlich relevant, die 8 Zeichen sind eine
Sicherheitsfrage. Ich würde beides nachziehen.*

**Antwort:**

---

### B14. Profil einrichten — das Formular ist ein ganz anderes

Mockup fragt: Name, Alter, Größe, **Geschlecht** (steuert, ob der
Zykluskalender angeboten wird), Trainingsniveau (**4** Stufen: „Ich fange
gerade an" / „Ich laufe regelmäßig" / „Ich trainiere ambitioniert" / „Ich
trainiere für Wettkämpfe"), Läufe pro Woche, Kilometer pro Woche, und einen
Block **„Was ist dir wichtig?"** mit 4 Ankreuzfeldern. Unten steht **„Vorerst
überspringen"**.

Die App fragt nur: Anzeigename, Laufniveau (**3** Stufen: Anfänger /
Fortgeschritten / Erfahren), Wochenziel — und man kann **nicht überspringen**.

Soll ich das Mockup-Formular komplett nachbauen? Das betrifft auch die
Datenbank (neue Felder für Alter, Größe, Geschlecht, Ziele) und die
Laufniveau-Werte, die sich dann ändern.

**Antwort:**

---

### B15. Anamnese — komplett anderes Aussehen

Die Anamnese-Seite ist als einzige noch komplett in der alten Optik gebaut
(sie nutzt keine einzige `md-`Klasse). Die Texte stimmen weitgehend, das
Aussehen nicht.

Soll ich sie auf das Mockup-Design umstellen? Dabei würde ich zwei Fehler
gleich mitnehmen, die aufgefallen sind:
- Der Fortschrittsbalken **springt zurück** (von 66 % auf 63 %), wenn man den
  Schmerz-Zweig durchläuft
- Wenn man am Ende „Block B jetzt machen" wählt, landet man beim „Weiter"
  offenbar **wieder ganz am Anfang** statt bei der nächsten Frage

Außerdem fehlt der Mockup-Schritt **„Fast am Ziel – was möchtest du
verbinden?"** (Smartwatch / Einlagen). Soll der rein?

**Antwort:**

---

### B16. Chat — Anhänge und Benennung

Im Mockup heißt der Chat-Partner **„MyProSole-Agent"**, in der App **„Coach"**.
Welcher Name gilt?

Im Mockup gibt es in der Eingabezeile einen **Anhang-Knopf** (Foto/Video) und
einen **Mikrofon-Knopf** (Sprachnachricht), außerdem Nachrichtenblasen für Bild
und Sprachnachricht. Alles fehlt in der App. Soll ich die Knöpfe einbauen
(zunächst mit „kommt bald"-Hinweis)?

Die App zeigt außerdem einen Startbildschirm mit vier Vorschlagsfragen, den es
im Mockup nicht gibt. Bleiben oder raus?

**Antwort:**

---

### B17. Login — Zurück-Pfeil und Google

Im Mockup führt der Zurück-Pfeil auf `welcome.html`. Da es die Seite in der App
nicht gibt, führt er aktuell auf „Registrieren", was unlogisch ist.

Wenn `welcome.html` gebaut wird (siehe A3), löst sich das von selbst. Falls
nicht: Soll der Pfeil ganz weg?

Außerdem: Der Google-Knopf steht im Mockup **nur** auf `welcome.html`, in der
App auf Login *und* Registrieren. Bleiben?

**Antwort:**

---

### B18. Laufanalyse — gibt es zwei verschiedene Detailseiten?

Die App hat eine Seite „Laufdetails" (aus dem Verlauf angetippt). Das Mockup
hat `analyse-ergebnis.html` mit ganz anderem Aufbau: großer Score-Ring,
aufklappbare Bereiche „Erkannte Auffälligkeiten" / „Deine Laufwerte" /
„Biomechanik-Analyse", eine Werbekarte für Sensoreinlagen und eine
Einwilligungsfrage („Sollen diese Daten deine Übungen personalisieren?").

- Soll `analyse-ergebnis.html` als eigene Seite gebaut werden **zusätzlich** zu
  den Laufdetails?
- Oder soll die vorhandene Laufdetail-Seite **zu** dieser Analyse-Seite
  umgebaut werden?

**Antwort:**

---

### B19. Übungsdetail-Seite ohne Mockup

Die App hat eine Seite für eine einzelne Übung (Beschreibung, Muskelgruppen,
Equipment). Dafür gibt es **kein** Mockup. Soll ich eine bauen, oder passt die
Seite so, wie sie ist?

**Antwort:**

---

## Teil C — Das mache ich ohne Rückfrage 1:1 nach

Diese Punkte brauchen keine Entscheidung, sie sind eindeutig Abweichungen:

- App-Leiste: Glocken-Symbol auf Home, Filter-Symbol im Verlauf ergänzen
- App-Leiste: Titel bekommt die richtige Klasse (`md-app-bar__title`) statt
  eines nachgebauten Inline-Stils
- Chat-Knopf: Beschriftung „Mit MyProSole-Agent über deinen Lauf sprechen"
- Home: Profil-Hinweis-Karte („Damit die Empfehlungen zu dir passen") ergänzen
- Verlauf: Score-Text bekommt den Zeitraum zurück („Aus 4 Läufen dieser Woche")
- Live-Tracking: fehlender Satz im Coach-Hinweis („Einlagen kannst du jederzeit
  ergänzen.")
- Trainingseinheit: fehlender Satz im Hinweis („Ersetzt keine individuelle
  ärztliche Beratung.")
- Registrieren: Text „Schon ein Konto? Anmelden" statt „Bereits ein Konto?"
- Anamnese: Halbgeviertstriche („0–1 Tage" statt „0-1 Tage"), fehlende 🎉
- Tagebuch: „Letzte Einträge" werden anklickbar (führen zum jeweiligen Lauf)
- Tagebuch: Schmerzort „Sprunggelenk" — steht in der App, nicht im Mockup;
  ich lasse ihn drin, sag Bescheid, wenn er weg soll

---

## Wie es weitergeht

1. Du füllst die `Antwort:`-Zeilen aus (auch teilweise reicht — ich fange mit
   dem an, was beantwortet ist).
2. Ich arbeite die Seiten **einzeln** ab: Mockup lesen → Seite umbauen →
   Screenshot hell/dunkel → du nickst ab → nächste Seite.
3. Erst danach kommen die komplett fehlenden Seiten aus A3.
