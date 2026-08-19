# Wie die App heute funktioniert

Stand 19.08.2026, gemessen am Code in `myprosole_web/src` und an den 33
Migrationen in `myprosole_app/supabase/migrations` – nicht am Entwurf und
nicht an dem, was die Seiten über sich selbst behaupten.

Zweck dieser Datei: Du sollst darauf zeigen können. Jeder Abschnitt nennt die
Stelle im Code, damit sich jede Aussage nachprüfen lässt.

---

## 1. Der erzwungene Weg beim ersten Start

Vor jeder geschützten Seite sitzt ein Wächter
(`src/components/auth/AuthGuard.tsx`). Er lässt niemanden durch, der nicht
alle drei Stufen hinter sich hat:

```
kein Konto             ->  /willkommen
kein Anzeigename       ->  /profil/setup
Anamnese Block A offen ->  /anamnese
sonst                  ->  die angeforderte Seite
```

Im Einzelnen:

| Schritt | Seite | Was passiert | Aufwand |
|---|---|---|---|
| 1 | `/willkommen` | Google, oder Konto mit E-Mail, oder Anmelden | 1 Tipp |
| 2 | `/register` → `/bestaetigen` | E-Mail, Passwort, dann 6-stelliger Code aus der Mail | Mailwechsel |
| 3 | `/profil/setup` | **Nur ein Feld: der Name** | 1 Feld |
| 4 | `/anamnese` | Erst Art.-9-Einwilligung, dann 12 bis 17 Fragen | 3–5 Minuten |
| 5 | `/` | Startseite – leer, bis Läufe da sind | – |

**Es gibt keinen Ausweg aus Schritt 4.** In der Anamnese führen sowohl
„Abbrechen" auf dem Einwilligungsschirm als auch „Zurück" auf dem ersten
Schritt zu `signOut()` und zurück nach `/willkommen`
(`src/pages/Anamnese.tsx:255` und `:299`). Der Kommentar dort benennt es
offen: jedes Ziel innerhalb der App wäre eine Sackgasse, weil der Wächter
sofort wieder hierher schickt.

Wer sich also anmeldet und die Gesundheitsfragen nicht beantworten will,
kann die App **überhaupt nicht benutzen** – er wird abgemeldet.

**Bei Google-Anmeldung war Schritt 3 bis vor Kurzem übersprungen**, weil ein
Auslöser in der Datenbank den Anzeigenamen aus der E-Mail-Adresse riet
(aus `s.gheshlaghi97@gmail.com` wurde der Anzeigename `s.gheshlaghi97`).
Migration `0031` hat das abgestellt; sie liegt im Repo.

---

## 2. Die Anamnese: was gefragt wird – und wer es liest

### Was gefragt wird

**Block A (Pflicht, 12 Fragen; 17 wenn Schmerzen angegeben werden)**

| Kennung | Frage |
|---|---|
| `ziel` | Was ist dein Ziel? |
| `wiedereinstieg` | Wiedereinstieg? |
| – | Wie sieht dein Laufpensum aktuell aus? |
| `training-gesamt` | Trainingsumfang gesamt |
| – | Machst du aktuell Krafttraining? |
| `andere-sportarten` | Betreibst du regelmäßig andere Sportarten? |
| `beschwerden-anderswo` | Beschwerden anderswo? *(nur wenn andere Sportarten = ja)* |
| `schmerzen` | **Hast du Schmerzen?** |
| `stelle` | Wo? *(Mehrfachauswahl)* |
| `seit-wann` | Seit wann bestehen die Beschwerden? |
| – | Art und Stärke der Beschwerden |
| `verlauf` | Gehen die Schmerzen von selbst wieder weg? |
| `umgang` | Weiterlaufen / pausiert / **in ärztlicher oder physiotherapeutischer Behandlung** |
| – | zwei Schlussfragen zu Person und Körperangaben |

Die fünf `d`-Fragen kommen nur, wenn `schmerzen = ja`
(`src/pages/Anamnese.tsx:159`).

**Block B (freiwillig, 2 Fragen)** – Motivation (`dranbleiben`) und Schlaf
(`schlaf`).

### Wer die Antworten liest

**Niemand.**

Gesucht im ganzen Quelltext: `anamnese_answers`, `answer_value` und
`question_key` kommen außerhalb von `store/anamnese.ts` an genau **einer**
Stelle vor – in `Anamnese.tsx:91`, und dort nur, um beim Wiedereinstieg die
eigenen früheren Antworten zurück ins Formular zu füllen.

Alles andere in der App fragt ausschließlich `hasCompletedBlock('a')` ab –
einen Wahrheitswert. Verwendet wird er an vier Stellen: im Wächter, auf der
Startseite, im Profil und in der Benachrichtigungsglocke. Immer nur als
„gemacht / nicht gemacht".

**Die Antworten selbst werden geschrieben und nie wieder angefasst.**

### Was dabei versprochen wird

Der erste Schirm der Anamnese (`Anamnese.tsx:527`):

> **„Lass uns deinen Laufplan erstellen"** … *„danach ist dein Plan
> startklar."*

Der Einwilligungsschirm (`Anamnese.tsx:243`):

> *„Deine Daten werden verschlüsselt gespeichert und **nur für deine Übungs-
> und Planauswahl verwendet**."*

Beides trifft heute nicht zu:

- **Der Laufplan wird nicht erzeugt.** `store/runningPlan.ts` kann einen Plan
  nur laden und speichern. Gespeichert wird er ausschließlich, wenn du ihn auf
  `/training/laufplan` von Hand einträgst. Nach der Anamnese ist der Plan
  **leer**.
- **Die Übungsauswahl kennt die Anamnese nicht.** Die Mikroroutine nimmt drei
  Übungen nach einem festen Filter (`modality = bodyweight | both`,
  `MicroRoutine.tsx:49`). Der Kommentar darüber sagt es selbst: *„Sobald die
  Übungsauswahl an die Anamnese angeschlossen ist, ersetzt sie diese feste
  Vorgabe."*

Das ist die größte Lücke im heutigen Aufbau: **Der Zwang ist da, der Nutzen
nicht.** Es werden besonders geschützte Gesundheitsdaten nach Art. 9 DSGVO
erhoben – mit ausdrücklicher Einwilligung, unveränderlich protokolliert,
Zugriffe geloggt – und dann liegen sie ungenutzt herum. Die Einwilligung
nennt einen Zweck, der nicht stattfindet.

---

## 3. Alle Seiten und wie man hinkommt

**39 Routen** (`src/App.tsx`). Bis zum 19.08.2026 waren es 43 – der
Gym-Trainingsplan ist mit Migration 0038 weggefallen, siehe Abschnitt 9.

### Die untere Leiste – fünf Einträge

`src/components/layout/BottomNav.tsx`

| Position | Ziel |
|---|---|
| 1 | `/` Start |
| 2 | `/training` Übungen |
| 3 | `/community` Community |
| 4 | `/verlauf` Verlauf |
| 5 | `/profil` Profil |

Dazu auf **jeder** Seite innerhalb der Hülle ein schwebender Knopf zum Chat
(`ChatFab`).

### Was hinter einem Tipp liegt

| Ziel | Weg |
|---|---|
| Lauf starten | Start → „Lauf starten" |
| Verlauf, Übungen, Community, Profil | untere Leiste |
| Chat | schwebender Knopf, überall |

### Was tiefer liegt

| Ziel | Weg | Tiefe |
|---|---|---|
| Laufplan bearbeiten | Übungen → Lauftraining | 2 |
| Trainingstagebuch | Übungen → Tagebuch | 2 |
| Einzelne Übung | Übungen → Übung | 2 |
| Mikroroutine | Start oder Laufzusammenfassung → Routine | 2 |
| Zykluskalender | Profil → Zykluskalender | 2 |
| Einlage verbinden | Profil → Einlage verbinden | 2 |
| Smartwatch/Pulsgurt | Profil → Smartwatch verbinden | 2 |
| Community-Profil | Profil → Community-Profil | 2 |
| Gruppen | Profil oder Community → Gruppen | 2 |
| Anamnese Teil B nachholen | Profil → Hinweiskarte | 2 |
| Laufanalyse | Verlauf → Lauf → Analyse | 3 |
| Gruppe gründen | Community → Gruppen → Gründen | 3 |

Die Klicktiefen-Regel wird eingehalten. Die einzige Verletzung war der
Gym-Trainingsplan hinter einem unbeschrifteten Hantel-Symbol oben rechts –
er ist weggefallen (Abschnitt 9).

### Ein toter Link

`src/pages/CycleCalendar.tsx:234` verweist auf **`/uebungen`**. Diese Route
existiert nicht – die Übungen liegen unter `/training`. Wer dort auf „Übungen
ansehen" tippt, landet auf der Nicht-gefunden-Seite.

Direkt darüber steht: *„Deine Übungsvorschläge berücksichtigen die aktuelle
Zyklusphase."* Auch das trifft nicht zu – im Übungsspeicher und in der
Mikroroutine kommt der Zyklus nirgends vor.

---

## 4. Die Datenbank: 40 Tabellen

| Bereich | Anzahl | Tabellen |
|---|---|---|
| **Community** | **18** | `community_posts`, `_post_comments`, `_post_likes`, `_post_images`, `_post_awards`, `_comment_likes`, `_groups`, `_group_members`, `_group_requests`, `_group_questions`, `_group_answers`, `_runs`, `_run_requests`, `_run_meeting_points`, `_chats`, `_chat_messages`, `_profiles`, `_profile_photos` |
| Übungen | 5 | `exercises`, `equipment`, `muscle_groups`, `exercise_equipment`, `exercise_muscles` |
| Laufen | 5 | `runs`, `run_points`, `run_splits`, `running_plans`, `running_plan_days` |
| Gesundheit (Art. 9) | 3 | `anamnese_sessions`, `anamnese_answers`, `art9_consents` |
| Konto & Sicherheit | 3 | `profiles`, `data_access_log`, `security_domains` |
| Tagebuch | 2 | `training_diary_entries`, `training_diary_pain_locations` |
| Routine-Protokoll | 2 | `workout_logs`, `workout_log_exercises` |
| Zyklus | 2 | `cycle_settings`, `cycle_periods` |

**45 % der Datenbank ist Community.** Zum Vergleich: Laufen – der Kern des
Produkts – hat 5 Tabellen.

### Spalten, die niemand liest

In `profiles` stehen drei Spalten, die nirgends in der App gelesen werden:

| Spalte | Zustand |
|---|---|
| `running_level` | Wird von `ProfileSetup.tsx:49` **ausdrücklich auf `null`** gesetzt. Nie gelesen. |
| `weekly_goal_km` | Ebenso, `ProfileSetup.tsx:50`. Nie gelesen. |
| `customer_code` | Von einem Auslöser erzeugt (Migration 0010, Format `MPS-XXXX-XXXX`). Kommt im Quelltext der App **kein einziges Mal** vor. |

Die Profil-Einrichtung fragt nur den Namen ab, füllt die beiden anderen
Felder mit `null` und schickt weiter in die Anamnese.

### Sicherheitsaufbau

Migration `0010` teilt die Daten in vier Bereiche (`security_domains`):
`profil` (normal), `fitness` (normal), `tracking` (sensibel), `gesundheit`
(art9). Zugriffe auf Gesundheitsdaten werden in `data_access_log`
protokolliert; die Tabelle ist über die API nur beschreibbar, nicht lesbar.
`art9_consents` ist seit `0027` unveränderlich – ein Widerruf ist eine neue
Zeile, keine Änderung.

Der Aufbau ist solide. Er schützt nur gerade Daten, die niemand verwendet.

---

## 5. Datenflüsse – was tatsächlich fließt

### Läuft vollständig

**Laufaufzeichnung.** `/lauf/tracking` legt beim Start eine Zeile in `runs`
mit Status `tracking` an, puffert GPS-Punkte lokal und schickt sie alle 30
Sekunden gebündelt an `run_points` (Kennung je Punkt gegen Doppelte,
Migration `0033`). Liegengebliebene Punkte werden beim nächsten App-Start
nachgereicht (`App.tsx:70`). Rauschfilter für Strecke, Tempo und Höhe stehen
in `store/run.ts` Zeile 33–80, mit gemessenen Begründungen.

**Community.** Beiträge, Kommentare, Likes, Gruppen mit Beitrittsfragen,
Zusammenläufe mit Treffpunkten, Chats – alles angeschlossen, 18 Tabellen.

**Gym und Tagebuch.** Pläne anlegen, Einheiten protokollieren, Tagebuch mit
Schmerzstellen.

**Zykluskalender.** Angeschlossen, mit Tagesfrage auf der Startseite.

### Läuft halb

**Bluetooth** (`store/bluetooth.ts`). Einschalten, suchen, verbinden
funktioniert für jedes Gerät. Genormt gelesen werden können Herzfrequenz
(0x180D) und Akkustand (0x180F). Danach sagt die Seite ehrlich, dass das
Auslesen je Gerät einzeln gebaut werden muss (`PulsgurtVerbinden.tsx:140`).

### Läuft nicht

| Was | Was stattdessen passiert | Stelle |
|---|---|---|
| **KI-Laufcoach** | Feste Antwort: „Der KI-Laufcoach wird bald verfügbar sein." Jede Frage bekommt denselben Satz. Trotzdem eigener Knopf auf jeder Seite. | `Chat.tsx:40` |
| **Einlage verbinden** | Knopf zeigt eine Kurzmeldung: „noch nicht angeschlossen" | `InsoleConnect.tsx:50` |
| **Verlauf filtern** | Symbol oben rechts zeigt eine Kurzmeldung | `TopAppBar.tsx:55` |
| **Diverse Profilzeilen** | „Diese Funktion ist noch nicht angeschlossen." | `Profile.tsx:25` |
| **Planerzeugung aus Anamnese** | – | siehe Abschnitt 2 |
| **Übungsauswahl aus Anamnese** | fester Filter | `MicroRoutine.tsx:49` |
| **Rechtstexte** | „Dieser Text ist ein Entwurf und noch nicht anwaltlich geprüft." Anbieterangaben fehlen. | `Legal.tsx:65` |

---

## 6. Wo Versprechen und Wirklichkeit auseinandergehen

Zusammengefasst, weil das der Kern ist:

1. **Die Anamnese verspricht einen Plan und liefert keinen.** Die
   Einwilligung nennt einen Zweck („Übungs- und Planauswahl"), den es nicht
   gibt. Erhoben werden Art.-9-Gesundheitsdaten.
2. **Der Zykluskalender verspricht zyklusabhängige Übungsvorschläge.** Es
   gibt keine. Der Link daneben ist tot.
3. **Der Chat sieht aus wie ein Coach und hat auf jeder Seite einen eigenen
   Knopf.** Dahinter steht ein einziger fester Satz.
4. **Drei Profilspalten werden gepflegt und nie gelesen.**
5. **18 von 43 Tabellen sind Community** – das größte gebaute Teilstück,
   während der beworbene Kern (Einlagen, Coach, Plan aus Anamnese) nicht
   steht.

---

## 7. Was das für „rückgängig machen" heißt

Vier Dinge lassen sich unabhängig voneinander entscheiden. Sie hängen nicht
zusammen – jedes lässt sich einzeln kippen, ohne die anderen anzufassen.

**A – Der Zwang zur Anamnese bei der Registrierung.**
Fällt er weg, ändert sich genau eine Bedingung in `AuthGuard.tsx:81`. Die
Anamnese bleibt erreichbar über Profil und Glocke. Kosten: nahe null.
Folge: Neue Nutzer sehen sofort die App.

**B – Die Anamnese selbst.**
Zwei Möglichkeiten: entweder anschließen (aus den Antworten wird ein Plan und
eine Übungsauswahl) oder kürzen. Solange sie weder das eine noch das andere
ist, sammelt sie Gesundheitsdaten ohne Zweck – rechtlich die heikelste Stelle
der ganzen App.

**C – Der Umfang der Community.**
18 Tabellen, ungefähr die Hälfte der Oberfläche. Zurückbauen ist möglich,
aber es ist die aufwendigste der vier Entscheidungen – und der einzige
Bereich, der heute vollständig funktioniert.

**D – Der Chat als eigener Knopf auf jeder Seite.**
Solange dahinter ein fester Satz steht, kostet er auf jeder Seite Platz und
Aufmerksamkeit. Der Knopf ließe sich entfernen, ohne die Seite anzufassen.

Alles liegt in Git; jeder Stand ist einzeln wiederherstellbar. Zurückbauen
ist kein Risiko.

---

## 8. Welche Datenbank haengt woran

Nachgemessen am 19.08.2026, weil die Frage aufkam, ob Android-App und
Web-App in dieselbe Datenbank schreiben. **Sie tun es.**

### Zwei Supabase-Projekte, strikt getrennt

| Datenbank | Wofuer | Wer liest daraus |
|---|---|---|
| `pssyomphfjvhnnuljtzh` | **MyProSole (die App)** | Web-App auf Vercel, Android-APK, die HTML-Entwuerfe unter `/design` |
| `bnifbyhkgtggtenrfmzx` | **Projektplaner** | nur `project-planner/` |

Im ganzen Baum: 26 Verweise auf die App-Datenbank, 1 auf die
Planer-Datenbank – und der liegt in `project-planner/`. Keine Vermischung.

Belege:

- `myprosole_web/.env.production` verweist auf `pssyomphfjvhnnuljtzh`; die
  Datei liegt in Git, Vercel baut damit (`vercel.json`, `buildCommand`).
- In der APK selbst, unter
  `myprosole_web/android/app/src/main/assets/public/`, steht dieselbe
  Adresse eingebacken.
- Der anon-Schluessel ist an allen drei Stellen derselbe – Pruefsumme
  `d1aa56a7...` in `.env.production`, in `dist/` und in den Android-Assets.
  Also nicht nur dasselbe Projekt, sondern derselbe Zugang.
- `vercel.json` erlaubt per Content-Security-Policy ausdruecklich nur
  `pssyomphfjvhnnuljtzh` als Verbindungsziel.
- `README.md` Zeile 52-60 haelt die Trennung bereits fest.

Der anon-Schluessel liegt versioniert im Repo. Das ist bei Supabase so
vorgesehen: Er ist oeffentlich und fuer sich wertlos; was jemand damit sehen
darf, entscheiden allein die Zeilenrechte in der Datenbank.

### Worauf stattdessen zu achten ist: der Programmstand

`myprosole_web/capacitor.config.ts` hat `webDir: 'dist'` und **kein**
`server.url`. Die APK laedt also nicht die Webseite, sondern traegt eine
eigene, beim Bauen eingefrorene Kopie der App in sich.

| | Daten | Programmcode |
|---|---|---|
| Web-App | aus `pssyomphfjvhnnuljtzh` | baut bei jedem Push auf `main` neu |
| Android-APK | aus `pssyomphfjvhnnuljtzh` | bleibt stehen, bis von Hand neu gebaut und installiert wird |

Gemessene Zeitstempel:

- `android/app/src/main/assets/public/index.html` – 18.08.2026, 20:49
- `myprosole_web/dist/index.html` – 19.08.2026, 11:12

Die APK ist damit einen Bauzustand aelter als die Web-App. Die Daten sind
identisch, das Verhalten kann abweichen. Faellt im Browser etwas auf, das auf
dem Telefon fehlt, ist das die Erklaerung – und nicht eine zweite Datenbank.

### Wo die Migrationen liegen

Alle 33 Migrationen liegen unter `myprosole_app/supabase/migrations/` und
gelten fuer `pssyomphfjvhnnuljtzh`. Der Ordner ist mit keinem entfernten
Projekt verknuepft (`supabase link` wurde dort nie ausgefuehrt); verknuepft
ist nur `project-planner/supabase/`, und zwar mit der Planer-Datenbank.

---

## 9. Nachtrag 19.08.2026 – was seither weggefallen ist

**Der Gym-Trainingsplan** (Migration 0038). Entschieden, weil der Kern von
MyProSole die Einlagen und die Ganganalyse sind; eigene Trainingsplaene mit
Saetzen, Wiederholungen und Gewicht gehoeren nicht dazu.

Weg sind: drei Tabellen (`gym_plans`, `gym_plan_exercises`,
`gym_plan_equipment`), vier Seiten, ein Speicher, zwei Bausteine, vier
Routen und der unbeschriftete Hantel-Knopf oben rechts auf der
Uebungen-Seite.

**Geblieben, obwohl es danach aussieht:** `workout_logs` und
`workout_log_exercises`. Die Mikroroutine schreibt dort hinein – haetten sie
mitgehen muessen, waeren Wochenzaehlung, Verlaufseintraege und die
Markierung erledigter Uebungen mit verschwunden. Aus der Tabelle ist damit
das geworden, was sie faktisch war: ein Protokoll der Mikroroutine.

**Ebenfalls geblieben:** der vollstaendige Uebungskatalog mit 94 Uebungen.

**Ausserdem erledigt** (Migrationen 0034 bis 0037): Die Einwilligung wird
nur noch einmal erteilt, am Ende der Anamnese, mit nachweisbarem Wortlaut.
Die drei verstreuten Abfragen – darunter die im Trainingstagebuch, die nach
jedem Lauf aufging – sind weg. Damit ist auch Punkt 1 aus Abschnitt 6
teilweise erledigt: Der Einwilligungstext verspricht nichts mehr, was nicht
stattfindet. Was bleibt: Die Anamnese-Antworten liest weiterhin niemand.
