# Prompt — Paket 04: Profil

```
Bau die Profilseite der MyProSole-Web-App auf das neue Design um.

## Voraussetzung

Paket 00 (Fundament) muss abgenommen sein: .md-page-hero und
.md-page-hero__profile / __avatar müssen im gemeinsamen CSS stehen.
Ist das nicht so: melde dich, fang nicht an.

## Lies zuerst

  myprosole_app/design/uebergabe/PROMPT-REGELN.md                  — Regeln für alle Pakete
  myprosole_app/design/uebergabe/04-profil/PROFIL-DESIGN.md        — dieser Auftrag im Detail
  myprosole_app/design/uebergabe/00-fundament/FUNDAMENT-DESIGN.md  — Farben und Kopf

Vorlage:     myprosole_app/design/mockups-neue-farben/profil.html
Screenshots: myprosole_app/design/uebergabe/04-profil/screenshots/
Zieldatei:   myprosole_web/src/pages/Profile.tsx

## Auftrag

Das ist das kleinste Paket. Die echte Seite hat bereits jeden Abschnitt, den
das Mockup zeigt, mit denselben Bezeichnungen. Zu tun ist im Wesentlichen eins:

1. Avatar und Name wandern in den dunklen Kopf (.md-page-hero__profile).

2. Der bisherige helle .md-profile-header-Block ENTFÄLLT — sonst steht der Name
   zweimal da.

3. Alles andere bleibt unverändert und bekommt die neuen Farben automatisch
   über die Tokens. Keine Struktur anfassen.

Prüf, ob die vorhandene Avatar-Komponente sich auf dunklem Grund einfügt,
statt sie zu ersetzen.

## NICHT nachbauen

Das Mockup hat in den Einstellungen Paletten-Schalter ("Logo-Farben (Violett)",
"Vital-Farben"). Die waren nur für die Farbabstimmung da. Set B ist entschieden.
Sie gehören nicht in die App und sind in der echten Seite auch nicht drin.

## Offener Punkt: zwei Schalter für dasselbe Thema

Der Kopf hat oben rechts einen Thema-Umschalter. Die Einstellungen haben die
Zeile "Dunkles Design". Beide steuern dasselbe.

Entweder beide behalten — dann müssen sie sich gegenseitig spiegeln — oder die
Zeile in den Einstellungen fällt weg. Frag mich, was gilt.

Falls beide bleiben: im Mockup war die Spiegelung anfangs kaputt. Beide hingen
am selben Ereignis, liefen in falscher Reihenfolge, und der eine setzte den
anderen zurück. Das ist die Stelle zum genauen Hinsehen.

Benutz designLesen() / designUmschalten() aus lib/design.ts. Bau keinen
zweiten Weg.

## Bevor du Code schreibst

Melde dich mit:
  a) Tabelle: Anzeige-Element → Datenquelle
  b) deiner Frage zu den zwei Thema-Schaltern
  c) den leeren Zuständen: Profil lädt / kein Anzeigename gesetzt
  d) welches Feld das Datum "seit 24.8.2026" bei den Einwilligungen liefert

Dann warte auf meine Antwort.

## Was ich schon geprüft habe

Die Seite ist DATENTECHNISCH VOLLSTÄNDIG:
  - useAuth().profile für Name und Avatar
  - useEinwilligung() mit ZWECK_LABELS und ZWECK_UMFANG — diese Beschriftungen
    stimmen EXAKT mit dem Mockup überein, nicht neu tippen
  - useZusammenlauf() + SichtbarkeitsBlatt, MeldenBlatt, useSnackbar()
  - die Konstante NOT_WIRED für Zeilen, die noch nicht angeschlossen sind
Alle Abschnitte existieren: Tarif, Zahlungen, Gerät, Community, Gesundheit,
Einstellungen, Einwilligungen, Laufverlauf, Abmelden.

## Farbregel für diese Seite

"Alle Läufe löschen" darf rot sein — hier wird wirklich etwas zerstört. Das ist
eine der wenigen berechtigten Rot-Verwendungen.
Die grünen "Aktiv"-Pillen brauchen neben der Farbe ein zweites Merkmal — das
Häkchen-Icon und das Wort "Aktiv" erfüllen das bereits.

## Fertig heißt

Abnahmeliste in Abschnitt 6 der Design-Datei. Besonders:
Kein doppelter Name, keine Paletten-Schalter, grüne Pillen in beiden Themen
lesbar.
```
