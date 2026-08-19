# Übergabe – Stand 18.08.2026

Diese Datei ist der Einstieg für das nächste Gespräch. Zuerst lesen, dann
`docs/DEVELOPMENT_STANDARDS.md` und `docs/seiten-regeln.md`.

## Womit das nächste Gespräch anfängt

Sein letzter Satz, wörtlich sinngemäß: **„Wir müssen einige Sachen rückgängig
machen und die ganze Struktur anpassen und auch die Logik hinter der App."**

Was genau, steht noch nicht fest. Er wurde gefragt:

1. Was soll rückgängig – etwas aus den letzten Tagen (Anamnese-Zwang bei der
   Registrierung, Community, Bluetooth, GPS) oder etwas Grundsätzlicheres?
2. Was stimmt an der Logik nicht – der Ablauf für den Nutzer, oder wie die
   Daten geschnitten sind?

Angeboten wurde ihm eine **Übersicht, wie die App heute tatsächlich
funktioniert** – Seiten und Wege dorthin, erzwungener Registrierungsablauf,
Tabellen und ihre Regeln, Datenflüsse; gemessen am Code, nicht als Wunschbild.
Daran kann er zeigen, was weg soll. Sagt er „Übersicht", ist das der erste
Schritt.

**Nichts zurückbauen, bevor das geklärt ist.** Alles liegt in Git, jeder Stand
ist einzeln wiederherstellbar – Zurückbauen ist kein Risiko, aber ohne Ziel
verlorene Arbeit.

## Sofort wichtig

- **Die App auf seinem Telefon ist abgemeldet** und zeigt wieder „Mit Google
  fortfahren". Ob das an den wiederholten Neuinstallationen lag oder an einer
  abgelaufenen Sitzung, ist ungeklärt. Er muss sich neu anmelden.
- **Die neue Geräteliste ist ungeprüft.** Der Code baut, die Funkdaten sind
  gemessen – die Darstellung selbst wurde nie am Gerät gesehen, weil die App
  abgemeldet war.
- **Offene Frage an ihn:** Soll ein Testaufbau für die React-App gebaut werden?
  Die vorhandenen Browsertests laufen gegen die alten HTML-Mockups, nicht gegen
  die echte App. Ohne so einen Aufbau lässt sich Oberfläche nur auf seinem
  Telefon prüfen – und nur, wenn er angemeldet ist.

## Wo die App steht

**Bluetooth** – die Kette einschalten → suchen → verbinden funktioniert für
jedes Gerät. Danach sagt die Seite ehrlich, dass das Auslesen der Daten je
Gerät einzeln gebaut werden muss. Am Telefon gemessen: 25 Funkkontakte, davon
2 mit Namen; seine Kopfhörer (EarFun Air Pro 3, −89 dBm) waren dabei, gingen
aber in namenlosen Einträgen unter. Die Liste sortiert jetzt nach Signalstärke,
zeigt benannte Geräte zuerst und klappt die namenlosen mit Erklärung weg.

Namenlose Einträge sind **echt**, nicht erfunden: fremde Geräte, die aus
Datenschutzgründen ohne Namen und mit wechselnder Adresse senden. `127` heißt
„Stärke unbekannt". Ton bei Kopfhörern läuft über klassisches Bluetooth, nicht
über BLE – als Testgerät ungeeignet.

**GPS** – Punkte werden laufend gesichert (Lauf-Zeile beim Start mit Status
`tracking`, Bündel alle 30 Sekunden, Kennung je Punkt gegen Doppelte).
Hintergrund-GPS ist bewusst zurückgestellt, bis er das getestet hat.

## Neue verbindliche Regeln

`docs/seiten-regeln.md` – Aufbau einer Seite, Farben, Abstände, Radien,
Schrift, Knöpfe, Scrollen, Prüfliste.

`scripts/check_page_rules.py` – läuft in der Suite mit (jetzt **8** Prüfungen)
und erzwingt: Route in `AppShell` oder begründete Ausnahme, Titel in
`TopAppBar`, keine feste Farbe ohne Begründung. Gegengetestet.

**Warum es das gibt:** Eine Seite ging ohne Seitencontainer in die App – der
Titel war in der Hülle schon eingetragen, die Route lag daneben. Die Regel
stand als Prosa längst da; `check_development_standards.py` prüfte nur, ob die
Regeldateien *existieren*, nicht ob der Code sie einhält. Beim ersten Lauf fand
die neue Prüfung sofort einen echten Fehler: eine fest eingetragene Goldfarbe,
während `--md-gold` je Hell-/Dunkelmodus einen eigenen Wert hat.

**Scrollen:** Eine Seite scrollt nur, wenn ihr Inhalt nicht hineinpasst. Der
Platz für Leiste und Chat-Knopf ist jetzt ein eigener Streifen
(`.md-nav-reserve`) statt einer Polsterung am Inhalt – die zählte zur
Mindesthöhe und machte kurze Seiten um 33 px zu hoch. Für neue Seiten heißt das:
nichts tun, kein eigener unterer Abstand, kein `100vh`.

## Noch offen

- Rohe Datenbankmeldungen erscheinen im Snackbar. Verstößt gegen
  `DEVELOPMENT_STANDARDS.md`, betrifft alle Stores – deshalb nicht nebenbei.
- Jahresrückblick (km, Städte, Stunden, Schritte, Kalorien) und danach Löschen
  der GPS-Rohpunkte. Modell entschieden, nicht gebaut.
- Health Connect / HealthKit für Gesundheitsdaten der Uhr – nach Bluetooth.
- Einlagen-Dienst über BLE – wartet auf die Firmware.
- `https://my-pro-n38r.vercel.app/passwort-neu` muss er in Supabase unter
  „Additional Redirect URLs" eintragen.
- Worktree `claude/check-entries-7d465e`, Commit `4dd62f8` (HTML-Maskierung in
  Planer-Mails): abgesichert, `main` eingearbeitet, wartet auf Sichtprüfung.

## Seine Bedingungen (gelten weiter)

- Von Anfang an so bauen, dass später **kein Umzug** zwischen Anbietern nötig
  wird
- Möglichst **kostenlose Tarife**; Kostenpflichtiges **erst kaufen, wenn es
  wirklich gebraucht und genutzt wird**
- Maßstab für Lauf-Aufzeichnung: **Strava**
- Bei technischen Grenzen: **kurz erklären und fragen** – keinen Umweg
  eigenmächtig bauen
- Struktur **modular und einfach** halten, nicht immer komplexer
- **Klicktiefe** gering halten, keine wichtige Funktion hinter unbeschrifteten
  Menüs

## Arbeitsweise – was sich bewährt hat

**Messen statt behaupten.** Jede Aussage über das Verhalten der App kam in
dieser Runde aus einer Messung am Gerät (`adb` + Chrome DevTools + Playwright
über CDP), nicht aus dem Gedächtnis. Zweimal hat das eine fertige Erklärung
widerlegt: `localName` hätte angeblich fehlende Gerätenamen gerettet – gemessen
null; und eine Messreihe hing an einer toten Verbindung nach einer
Neuinstallation und meldete überall „passt", obwohl nichts geladen war.
**Vor der Messung prüfen, ob wirklich Inhalt dasteht.**

**Die Nachbarschaft lesen, nicht die Zeile.** Der Grundfehler dieser Runde war,
Dinge dorthin zu setzen, wo textlich etwas Ähnliches steht, statt zu prüfen,
was die Stelle *bedeutet*. Vor jedem Einfügen: Was ist diese Gruppe, und was
liefert sie?

## Vercel – abgeschlossen

Drei Projekte am Repo `Siavash-97/MyPro`: `my-pro-n38r` (die App, maßgeblich),
`my-pro` (Projektplaner), `my-pro-75lk` (Doppelung, pausiert). Jeder Push auf
`main` baut alle. Entschieden: **so lassen** – kostet nur Build-Minuten.

Ein `post-commit`-Haken pusht automatisch nach jedem Commit. Beim Rebase führt
das zu einem Push je Commit samt vollem Prüflauf; für Rebases deshalb
`git -c core.hooksPath=/dev/null rebase --continue` und danach **einmal**
pushen.

## Bilder im Chat

Er kann Bilder direkt in den Chat geben – Ziehen, Einfügen oder als Pfad. Der
Pfad ist der zuverlässigste Weg und funktioniert auch für mehrere Bilder und
PDFs. Ältere Screenshots liegen in `C:\MyProSole\screenshots`.
