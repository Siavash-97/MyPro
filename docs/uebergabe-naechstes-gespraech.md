# Übergabe – Stand 17.08.2026

Kurzfassung für ein neues Gespräch. Ausführlich stehen die Entscheidungen in
[`umsetzung-offene-punkte.md`](umsetzung-offene-punkte.md) und
[`sicherheit-zimmer-schubladen.md`](sicherheit-zimmer-schubladen.md).

## Wo die App steht

Läuft unter `https://my-pro-n38r.vercel.app`, Stand ist aktuell.
Migrationen **0023 bis 0027 sind eingespielt** und gegen die echte Datenbank
geprüft. Zuletzt gebaut: Community-Profil nach Entwurf, Zykluskalender als
Frage-Ablauf, Beiträge mit mehreren Bildern, Kommentare mit Antwort und Herz,
Laufvorschlag bearbeiten, Glocke für die offene Anamnese, Übungszähler,
unveränderliche Einwilligungen, Social-Studio mit echter Bilderzeugung.

## Offen – Fehler

**Profilbild speichert nicht.** Vom Nutzer auf dem Telefon gemeldet.
Bereits geprüft und in Ordnung:

- Behälter `avatars` existiert und ist öffentlich lesbar
- Spalte `profiles.avatar_url` existiert
- Regeln in 0022 (`avatars_read`, `avatars_insert_own`, `avatars_update_own`)
- `profiles_update_own` aus 0001 erlaubt das Ändern des eigenen Profils

Damit ist die Datenbankseite ausgeschlossen. Der Fehler steckt in der App –
in `store/auth.ts` (`setAvatar`) oder in `pages/Profile.tsx` (Zeilen 173–198).
Noch nicht gefunden. Die Verdrahtung sieht richtig aus, also lohnt ein Blick
mit echten Geräte-Protokollen statt weiterer Codelektüre.

**Ein weiterer Fehler ist per Screenshot gemeldet, aber unbekannt** – die
Bildübertragung war zu dem Zeitpunkt erschöpft. Nachfragen.

## Offen – Wünsche

**Vorschau im Community-Profil.** Nach dem Speichern soll ein Knopf zeigen,
wie das eigene Profil für andere aussieht. Die Seite kann beide Ansichten
schon (`pages/CommunityProfile.tsx` unterscheidet über `eigenes`); es fehlt
nur der Umschalter.

**Die große Frage.** Der Nutzer hat zwei Dokumente zur Bewertung gegeben:

- https://claude.ai/code/artifact/9b75e195-a76e-4159-92da-46c68e869d89
- https://claude.ai/code/artifact/00d2301b-52d6-40a1-bc9b-098ceb7813d7

Aufgabe: prüfen und eine eigene Einschätzung geben, wie aus der jetzigen
Web-App eine echte App wird. Seine Bedingungen, wörtlich sinngemäß:

- Von Anfang an so bauen, dass später **kein Umzug** zwischen Anbietern nötig
  wird und nicht ständig gewechselt werden muss
- Möglichst **kostenlose Tarife** nutzen
- Kostenpflichtiges **erst kaufen, wenn es wirklich gebraucht und genutzt
  wird** – nicht am Anfang etwas kaufen, das brachliegt
- Zeitpunkt des Kaufs, Nützlichkeit und Qualität zählen
- Als Maßstab nannte er das **GPS-Tracking von Strava**

Das ist keine Umsetzungsaufgabe, sondern eine Beratung – erst lesen, dann
begründet Stellung nehmen, auch widersprechen wo nötig.

## Vercel – abgeschlossen

Drei Projekte am Repo `Siavash-97/MyPro`:

- `my-pro-n38r` – die App, maßgeblich, mit MapTiler-Schlüssel
- `my-pro` – der Projektplaner (eigener Ordner `project-planner`)
- `my-pro-75lk` – Doppelung der App, **pausiert** (Status „blocked" ist richtig)

Jeder Push auf `main` baut alle Projekte. Versuche, das über „Skip
deployments" und „Ignored Build Step" abzustellen, haben nicht gegriffen.
Entschieden: **so lassen** – es kostet nur Build-Minuten, nichts ist kaputt.
Wenn es später stört, wäre der saubere Weg ein eigenes Repository für den
Projektplaner.

## Zwei Lehren aus dieser Runde

**Auslieferungsstand nicht am Zeitstempel messen.** Ein Abruf von
`my-pro-n38r.vercel.app` lieferte über Stunden eine zwischengespeicherte
Kopie (`Age: 415`), obwohl der Build fertig war. Daraus wurde zweimal
geschlossen, Vercel liefere nichts mehr aus – falsch. Richtig ist: Abruf mit
Zwischenspeicher-Umgehung und Vergleich des **Bundle-Dateinamens**, nicht des
Zeitstempels.

**Nicht raten, wo eine Einstellung liegt.** Zwei falsche Wegbeschreibungen zur
Vercel-Oberfläche, bevor die Dokumentation gelesen wurde. Erst nachschlagen.

## Bilder im Chat

Die Bildübertragung war am Ende des Gesprächs erschöpft – nicht wegen der
Größe, sondern wegen der Anzahl. Screenshots liegen jetzt in
`C:\MyProSole\screenshots`; von dort lassen sie sich direkt von der Platte
lesen, unabhängig vom Chat.
