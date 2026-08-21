# Bewertung: von der Web-App zur echten App

Du hast zwei Dokumente zur Prüfung gegeben und um eine eigene Einschätzung
gebeten. Hier ist sie – erst der Faktencheck, dann meine Meinung, auch dort,
wo sie von beiden Dokumenten abweicht.

Stand: 17.08.2026

Deine Bedingungen, an denen ich alles messe:

1. Von Anfang an so bauen, dass später **kein Umzug** zwischen Anbietern nötig wird
2. Möglichst **kostenlose Tarife**
3. Kostenpflichtiges **erst kaufen, wenn es wirklich gebraucht wird**
4. Maßstab für die Qualität: das **GPS-Tracking von Strava**

---

## Kurz

**Dokument 2 hat recht, Dokument 1 nicht.** Der Weg ist Capacitor: die
bestehende React-App in eine native Hülle setzen und nur die GPS-Schicht
austauschen. Kein Neuschreiben, kein Anbieterwechsel.

**Dokument 1 würde ich nicht umsetzen.** Es beruht auf einer Ausgangslage, die
es im Repository nicht gibt, und empfiehlt genau die zwei Umzüge, die du
ausgeschlossen hast.

**Aber auch Dokument 2 folge ich nicht in einem Punkt:** Es sagt, Supabase Pro
für 25 USD im Monat sei nötig. Das ist es nicht – jedenfalls nicht deshalb,
weil du Nutzer bekommst. Es ist die Folge davon, wie die GPS-Punkte gespeichert
werden. Das lässt sich mit einer Migration ändern, und dann bleibt der freie
Tarif noch lange reichlich. Genau das ist deine Bedingung 3.

---

## Faktencheck gegen das Repository

Ich habe jede prüfbare Behauptung nachgeschlagen, statt sie zu glauben.

| Behauptung | Aus | Befund |
| --- | --- | --- |
| „Es existiert bereits ein **Flutter-Projekt** `myprosole_app`" | Dok. 1 | **Falsch.** `myprosole_app` ist Python: die biomechanische Auswertung, heute mit Streamlit als Oberfläche. Kein `pubspec.yaml`, kein `lib/`, kein Dart. Es ist kein App-Rumpf, sondern die künftige Auswertungsseite (siehe unten). |
| „14 Screens" | Dok. 1 | **Falsch.** 37 Seiten unter `src/pages/`, 42 Routen. |
| „13 Tabellen" | Dok. 1 | **Zu niedrig.** 29 Migrationen, deutlich mehr Tabellen. |
| „Mapbox ist die richtige Wahl" | Dok. 1 | **Trifft nicht zu.** Die App nutzt bereits MapLibre GL mit MapTiler-Kacheln. |
| „~18.000 Zeilen, 38 Routen" | Dok. 2 | **Stimmt.** 18.012 Zeilen; inzwischen 42 Routen. |
| „Filterlogik haben wir schon" | Dok. 2 | **Stimmt.** `store/run.ts`: Messungen über 25 m Ungenauigkeit werden verworfen, Stillstand unter 5 m ignoriert, Ortungssprünge über das Tempo erkannt, Höhe über fünf Messungen geglättet. |
| „GPS-Punkte liegen nur im Arbeitsspeicher" | Dok. 2 | **Stimmt.** `store/run.ts:256` – „Ein einziger Schreibvorgang am Ende … Vorher steht nichts in der Datenbank." |
| „MapTiler Free, 100k Kacheln" | Dok. 2 | **Stimmt** mit dem Bestand. |

Dokument 2 hat den Code gelesen. Dokument 1 hat ihn nicht gelesen – die Zahl
„18.012 Zeilen" bekommt man nicht durch Raten, „14 Screens" bei 37 Seiten
schon.

---

## Warum Dokument 1 ausscheidet

Nicht wegen der Zahlenfehler. Wegen zweier Empfehlungen, die deiner Bedingung 1
direkt widersprechen:

**Der Flutter-Port ist ein Neuschreiben.** Das Dokument stellt ihn als
Weiterarbeit an etwas Bestehendem dar („Grundgerüst steht, du musst nicht bei
null anfangen"). Das Bestehende gibt es nicht. Es wären 18.000 Zeilen React in
Dart neu, und danach hättest du zwei Oberflächen zu pflegen – die Web-App
läuft laut demselben Dokument ja weiter. Das ist der teuerste denkbare Weg und
zugleich der mit der größten Bindung: Dart-Code kommt später nicht mehr
zurück ins Web.

**Der Wechsel zu Mapbox ist ein Umzug ohne Gegenwert.** Ihr habt MapLibre GL –
eine offene Bibliothek – mit MapTiler als Kachellieferant. Der Anbieter ist
dabei eine Zeile Konfiguration; MapLibre spricht mit jedem, der Vector Tiles
liefert. Das ist die geringste Anbieterbindung, die man in dem Bereich haben
kann, und ihr habt sie schon. Mapbox GL JS ist seit Version 2 proprietär
lizenziert und bindet fester. Von der freieren Lösung auf die gebundenere zu
wechseln, um dann bei 25.000 Nutzern dasselbe zu zahlen wie jetzt – nämlich
nichts – ist ein Umzug ohne Grund.

Dazu kommt: Dokument 1 nennt Firebase als **Schritt 1**, noch vor der App.
Push-Nachrichten braucht man, wenn es etwas zu melden gibt. Vorher ist ein
Firebase-Projekt ein Konto, das brachliegt – Bedingung 3.

---

## Wo ich Dokument 2 widerspreche

Dokument 2 ist gut. Die drei Stellen, an denen ich es anders sehe, sind aber
keine Kleinigkeiten.

### 1. Supabase Pro ist keine Folge von Nutzern, sondern des Datenmodells

Dokument 2 rechnet: 100 Nutzer × 3 Läufe/Woche × 1.000 Punkte ≈ 1,2 Mio.
Zeilen im Monat, „gut 120 MB", freier Tarif nach vier Monaten voll.

Die Zeilenzahl stimmt. Die Megabyte nicht. Eine Zeile in `run_points` ist:

- 24 Byte Kopf, 16 Byte `id`, 16 Byte `run_id`, zwei Zeitstempel, fünf
  Fließkommazahlen → **rund 116 Byte** in der Tabelle
- dazu **drei Indizes**: der Primärschlüssel auf `id`, `idx_run_points_run_id`
  und `idx_run_points_run_recorded` → zusammen **rund 130 Byte**

Also **etwa 245 Byte pro GPS-Punkt**, nicht 100. Und die 1.000 Punkte pro Lauf
sind ebenfalls niedrig gegriffen: Die App nimmt einen Punkt je 5 Meter
zurückgelegter Strecke, 1.000 Punkte sind also ein **5-Kilometer-Lauf**. Bei
8 km Schnitt sind es 1.600.

Realistisch: 1.300 Läufe × 1.600 Punkte × 245 Byte ≈ **510 MB im ersten Monat**.
Der freie Tarif ist nicht nach vier Monaten voll, sondern nach einem.

**Der Schluss daraus ist aber nicht, Pro zu kaufen.** Er ist, das zu ändern,
was 245 Byte pro Punkt kostet:

- **`idx_run_points_run_id` ist überflüssig.** Der zweite Index liegt auf
  `(run_id, recorded_at)`; jede Abfrage nach `run_id` allein benutzt ihn
  genauso. Ein Index weniger, sofort, ohne jede Änderung an der App.
- **`id` und `created_at` werden nicht gebraucht.** Ein Punkt ist durch
  `(run_id, recorded_at)` eindeutig; das kann der Primärschlüssel sein.
  `created_at` sagt dasselbe wie `recorded_at`.

Das allein bringt rund 245 auf **140 Byte** – der freie Tarif hält damit gut
doppelt so lange, für eine Migration ohne Risiko.

Der größere Schritt, wenn er nötig wird: **die Spur eines Laufs als eine Zeile
speichern** statt als tausend. Strava macht es so – Läufe sind dort
komprimierte Ströme, keine Punkttabellen. Aus 2 Millionen Zeilen im Monat
werden 1.300, aus 500 MB werden einige wenige. Das ist zugleich die
**Retention-Strategie, die Dokument 2 selbst als offen benennt** und die eure
`DEVELOPMENT_STANDARDS.md` für hochvolumige Zeitreihen ausdrücklich *vor* dem
Produktivbetrieb verlangt.

Ergebnis für dich: Supabase Pro wandert von „ab Start nötig" auf „wenn wirklich
Nutzer da sind". Das ist Bedingung 3, wörtlich.

### 2. Die Reihenfolge der Phasen ist verkehrt herum

Dokument 2 baut in Phase 2 das Hintergrund-GPS und sichert erst in Phase 3 die
Läufe gegen Verlust – nennt Phase 3 dabei selbst „nicht optional".

Genau deshalb gehört sie nicht dahinter. Solange die App im Vordergrund läuft,
endet der Lauf, wenn man sie verlässt; es gibt nichts zu verlieren. **Ab dem
Tag, an dem der Foreground Service funktioniert, läuft die Aufzeichnung
stundenlang im Arbeitsspeicher** – und Android beendet Hintergrundprozesse.
Der Verlust wird also durch Phase 2 erst erzeugt.

Beides in einer Phase, das Schreiben nach SQLite zuerst. Sonst hast du
zwei bis drei Tage lang eine App, die still ganze Läufe verschluckt – und das
merkt man erst hinterher.

### 3. Web Bluetooth: die Aussage stimmt so nicht

Dokument 2 schreibt, Web Bluetooth stehe „in der Android-WebView gar nicht zur
Verfügung – als PWA ließe sie sich nicht sauber bauen".

Der erste Halbsatz stimmt, der Schluss nicht. Als PWA **in Chrome** gibt es Web
Bluetooth durchaus. Das Argument gegen die PWA ist ein anderes: Eine
Browserverbindung überlebt keinen Wechsel in den Hintergrund, verbindet sich
nach einem Abbruch nicht von selbst wieder, und auf iOS gibt es Web Bluetooth
überhaupt nicht.

Praktisch wichtig ist die Folge daraus: **Mit Capacitor benutzt du kein Web
Bluetooth**, sondern ein natives BLE-Plugin. Wer das verwechselt, plant die
Einlagenanbindung auf einer Schnittstelle, die in der fertigen App nicht
existiert.

---

## Was beide Dokumente zu klein machen: die Einlage

Beide begründen den Schritt zur nativen App mit Hintergrund-GPS. Dokument 2
nennt Bluetooth einen „Nebeneffekt", Dokument 1 erwähnt es gar nicht.

Das ist die Rangfolge verkehrt herum. Hintergrund-GPS macht euch zu einer
Lauf-App, die so gut aufzeichnet wie andere auch. Die Einlage ist das, was
MyProSole von jeder anderen Lauf-App unterscheidet – sie steht im Namen. Ohne
native Hülle gibt es sie nicht: nicht dauerhaft verbunden, nicht während des
Laufs, nicht auf iOS.

Für deine Bedingung „Nützlichkeit zählt" heißt das: Der Schritt zu Capacitor
ist nicht in erster Linie ein GPS-Projekt, sondern die Voraussetzung dafür,
dass euer eigentliches Produkt überhaupt an die App kommt. Das ändert nichts am
Weg – aber es ändert, warum man ihn geht, und wie man ihn begründet, wenn Zeit
oder Geld knapp werden.

---

## Reihenfolge der Ausgaben

So wird aus deiner Bedingung 3 ein Ablauf:

| Wann | Was | Kosten | Warum erst dann |
| --- | --- | --- | --- |
| Jetzt | Capacitor, Capgo-Plugin, Debug-Builds auf zwei eigenen Handys | **0 €** | Alles funktioniert, auch Hintergrund-GPS. Es fehlt nur die Verteilung. |
| Vor dem ersten Verteilen | Google Play Developer Account | **25 USD einmalig** | Debug-Builds nimmt der Store nicht, und auf 100 fremden Geräten sind sie bei Gesundheitsdaten nicht vertretbar. |
| Nur wenn der Feldtest hakt | Transistorsoft-Lizenz | **399 USD** | Deren Mehrwert ist Herstellerwissen zu Samsung/Xiaomi. Ob ihr es braucht, zeigt erst der Test. |
| Wenn die Datenbank wirklich voll läuft | Supabase Pro | **25 USD/Monat** | Nach der Umstellung des Datenmodells dauert das lange. |
| Wenn jemand danach fragt | Apple Developer | **99 USD/Jahr** | Capacitor baut iOS aus derselben Codebasis. Später kostet es nicht mehr als jetzt. |

Zwei Dinge, die trotzdem **sofort** gehören, obwohl sie nichts kosten:

- **Eigenen Keystore anlegen und Play App Signing einschalten.** Eine
  App-Kennung hängt an genau einem Schlüssel. Wer ihn später wechselt, zwingt
  jeden Nutzer zur Neuinstallation und verliert dessen lokale Daten. Das ist
  der einzige Fehler auf dieser Liste, der sich nicht mehr korrigieren lässt.
- **Play-Konto auf die Firma, nicht auf dich privat.** Gleicher Preis. Bei
  neuen Privatkonten verlangt Google vor der Produktion zwölf Tester über
  vierzehn Tage im geschlossenen Test; beim Organisationskonto entfällt das.
  Achtung: Ein Organisationskonto verlangt einen Firmennachweis (nach meinem
  Stand eine D-U-N-S-Nummer), und der dauert. **Das bitte vor der Anmeldung
  nachschlagen statt darauf zu vertrauen** – wir hatten in diesem Projekt
  schon zwei falsche Wegbeschreibungen, weil vorher nicht nachgelesen wurde.

---

## Zum Maßstab Strava

Was „sauber wie Strava" technisch bedeutet, listet Dokument 2 richtig auf. Der
Punkt, der dabei untergeht: **Drei der vier Sachen habt ihr schon oder bekommt
sie geschenkt.**

- Die **Filterlogik** ist da und entspricht der Praxis. Sie wandert unverändert
  mit und arbeitet danach mit besseren Rohdaten.
- Der **Fused Location Provider** kommt mit dem Plugin, ohne eigenes Zutun.
- Der **Foreground Service** ist die eigentliche Arbeit – drei bis fünf Tage.
- Das **Barometer** für Höhenmeter ist der größte Qualitätssprung und aus dem
  Browser prinzipiell nicht erreichbar. GPS-Höhe ist die unzuverlässigste Größe
  überhaupt; eure Glättung über fünf Messungen ist eine gute Notlösung, aber
  eben eine.

Der Abstand zu Strava ist also kleiner, als er von außen aussieht, und er liegt
nicht in der Rechenlogik, sondern in dem, was der Browser nicht herausrückt.

---

## Die Auswertung: getrennt ja, Streamlit als Backend nein

Nachgetragen am 17.08.2026, nachdem die Rolle von `myprosole_app` klar war:
Dort liegt die biomechanische Auswertung. Die App schickt Messwerte hin und
bekommt Ergebnisse zurück. Die Frage war, ob die Trennung so richtig ist.

**Die Trennung ist richtig.** Auswertung und App haben nichts gemeinsam außer
den Daten: Die eine rechnet in Python mit NumPy und SciPy an Zeitreihen, die
andere zeigt Knöpfe auf einem Telefon. Sie ändern sich unabhängig voneinander,
sie skalieren unterschiedlich, und ein Fehler in der Auswertung darf die App
nicht mitreißen. Getrennt lassen.

**Streamlit als Backend ist es nicht.** Streamlit ist keine Serverschicht,
sondern eine Oberfläche: Bei jeder Eingabe läuft das ganze Skript neu, der
Zustand hängt an einer Browsersitzung, und es gibt keine Schnittstelle, die ein
Telefon aufrufen könnte. Man kann Streamlit dazu überreden — aber dann kämpft
man dauerhaft gegen das Werkzeug.

**Umbauen musst du dafür fast nichts.** Ich habe nachgesehen, und der Schnitt
ist schon da:

- `myprosole_analysis/` — Vorverarbeitung, Schritterkennung, Merkmale,
  Gangklassifikation, Links-rechts-Vergleich. **Kein einziger
  Streamlit-Import.**
- `modules/gait_analysis/pipeline.py` — normalisiert die Rohdaten und ruft die
  Bibliothek auf. **Ebenfalls ohne Streamlit.**
- Streamlit steckt nur in `core/` und in den Anzeigeteilen der Module.

Der Teil, den eine Schnittstelle aufrufen müsste, ist also bereits frei von der
Oberfläche. Es fehlt nur die Schnittstelle selbst.

### Vorschlag

```
myprosole_analysis/          die Algorithmen        (steht, unverändert)
modules/gait_analysis/       die Pipeline           (steht, unverändert)
  ├── api/                   FastAPI + Dockerfile   ← neu, dünn
  └── app.py + core/         Streamlit              (bleibt, dein Fenster)
```

Beide Aufsätze rufen dieselbe Pipeline auf. Streamlit verschwindet nicht — es
ist genau richtig, um sich Messungen selbst anzusehen. Es steht nur nicht mehr
im Weg der App.

### Warum ein Container und kein Anbieter

Deine Bedingung „kein Umzug" beantwortet sich hier über die **Verpackung**,
nicht über die Wahl des Anbieters: FastAPI plus ein `Dockerfile`. Ein Container
läuft auf Cloud Run, Render, Fly oder einem eigenen Server — der Wechsel ist
dann eine Einstellung, kein Umbau.

Was ich dafür **nicht** nehmen würde: anbietereigene Funktionsformate wie
Vercels Python-Funktionen. Die binden dich an deren Verzeichnisaufbau und
Laufzeitgrenzen, und NumPy/SciPy sprengen dort schnell die Paketgröße. Das ist
genau die Bindung, die du vermeiden willst.

Zum Betrieb, solange nichts genutzt wird: Google Cloud Run fährt auf null
herunter und hat einen dauerhaft freien Anteil; Render ist im freien Tarif
ebenfalls brauchbar, schläft aber ein und braucht dann fast eine Minute zum
Aufwachen. Beides kostet nichts, solange niemand rechnet — Bedingung 3 erfüllt.
Wichtig bei Gesundheitsdaten: **europäische Region wählen und den
Auftragsverarbeitungsvertrag prüfen**, bevor echte Messungen fließen.

### Der Weg der Daten

Nicht Telefon → Auswertung → Telefon, sondern:

1. Die App legt die Rohmessung in Supabase Storage ab.
2. Sie ruft die Auswertung mit dem Verweis darauf auf.
3. Die Auswertung liest von dort, rechnet, schreibt das Ergebnis in eine
   Tabelle.
4. Die App liest das Ergebnis wie jede andere Zeile.

Drei Gründe: Die Rohdaten liegen dann an **einer** Stelle — dort, wo Löschung
und Export schon geregelt sind, was bei Art.-9-Daten kein Nebenpunkt ist. Die
Auswertung bleibt zustandslos und damit beliebig ersetzbar. Und wenn die
Auswertung ausfällt, ist die Messung trotzdem nicht verloren; sie wird später
nachgerechnet.

**Anmeldung:** Die Schnittstelle prüft das Supabase-Token, das die App ohnehin
hat. Kein eigener Login, keine offene Adresse. Eine unauthentifizierte
Auswertungs-URL, an die Gesundheitsdaten gehen, wäre der schwerste Fehler in
diesem ganzen Aufbau.

### Wann

**Nicht jetzt.** Es gibt keine Einlagen-Firmware und keine einzige echte
Messung — eine Schnittstelle, die nichts zu rechnen bekommt, ist genau das
„am Anfang gekauft und liegt brach", das du vermeiden willst.

Zu tun ist heute nur eine Entscheidung, kein Code: **`myprosole_analysis/` und
`pipeline.py` bleiben frei von Streamlit-Importen.** Solange das gilt, ist der
Aufsatz später ein Tagesprojekt. Sobald jemand dort „nur kurz" ein
`import streamlit` einbaut, wird daraus eine Entflechtung.

---

## Was ich an deiner Stelle entscheiden würde

1. **Capacitor, nicht Flutter.** Kein Neuschreiben, kein zweiter Code.
2. **MapTiler und MapLibre bleiben.** Kein Mapbox.
3. **Capgo zuerst**, 399 USD als Reserve. Entscheidung nach dem Gerätetest.
4. **Datenmodell der GPS-Punkte zuerst**, bevor irgendein Tarif gekauft wird.
5. **Persistenz zusammen mit dem Hintergrund-GPS**, nicht danach.
6. **Play-Konto auf die Firma, Keystore am ersten Tag.**
7. **iOS und Firebase später** – beide kosten nichts, solange sie warten.
8. **Die Auswertung bleibt getrennt, aber bekommt später eine eigene
   Schnittstelle statt Streamlit** – und heute nur die Regel, dass die
   Rechenteile streamlitfrei bleiben.

Offen und von mir nicht entscheidbar, weil fachlich: **Wie lange bleiben
GPS-Rohpunkte erhalten?** Dauerhaft, oder nach einigen Monaten auf eine
vereinfachte Route reduziert? Diese Antwort bestimmt sowohl die
Retention-Strategie als auch, wann Supabase Pro fällig wird. Dokument 2 stellt
die Frage zu Recht – beantworten kann sie nur jemand, der weiß, was ihr mit
alten Läufen vorhabt.
