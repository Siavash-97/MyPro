# Prompt — Paket 07: Öffentliche Seiten

```
Bau die öffentlichen Seiten der MyProSole-Web-App auf das neue Design um.

## Voraussetzung

Nur der CSS-Teil aus Paket 00 — konkret die Klasse .md-divider (Trennlinie mit
Text). NICHT der Umbau der App-Hülle: diese Seiten haben keine Hülle, keine
Navigationsleiste und keinen dunklen Seitenkopf.

Das ist das unabhängigste Paket. Es kann jederzeit laufen und eignet sich gut,
um mit dem Vorgehen warm zu werden.

## Lies zuerst

  myprosole_app/design/uebergabe/PROMPT-REGELN.md                    — Regeln für alle Pakete
  myprosole_app/design/uebergabe/07-oeffentliche-seiten/OEFFENTLICHE-SEITEN-DESIGN.md

Vorlagen und Screenshots: siehe Abschnitt-Tabelle in der Design-Datei.

Zieldateien: Welcome.tsx, Login.tsx, Register.tsx, ForgotPassword.tsx,
             ConfirmEmail.tsx, Legal.tsx

## Auftrag

Sieben Seiten, eine nach der anderen. Sie sind klein und unabhängig.

1. Willkommen — Vollbild-Hintergrund, Logo, GENAU ZWEI Einstiege:
   Google und E-Mail. Die Live-Seite hat keinen Facebook-Einstieg; im Entwurf
   war er ursprünglich drin und wurde entfernt. Nicht wieder einbauen.

2. Anmelden / Registrieren — Formular, dann die neue "oder"-Trennlinie
   (.md-divider), dann der Google-Knopf, dann der Wechsel-Link.
   Bei Registrieren zusätzlich das Kästchen mit den Links auf /agb und
   /datenschutz. Diese Links waren im Entwurf anfangs tot (href="#") und sind
   korrigiert — bitte so lassen.

3. Passwort vergessen / E-Mail bestätigen — schlicht.
   Beim sechsstelligen Code: numerische Tastatur, und Einfügen aus der
   Zwischenablage muss die Stellen verteilen statt alle ins erste Feld zu
   schreiben.

4. AGB / Datenschutz — eigene Klasse .md-legal, nur auf diesen beiden Seiten.

## Rechtstexte: Wortlaut nicht anfassen

Nicht umformulieren, nicht kürzen, nicht "schöner" machen. Nur die Darstellung
ändern. Steht im Entwurf ein Hinweis, dass der Text noch nicht anwaltlich
geprüft ist, bleibt der stehen.

Beide Seiten sind ohne Anmeldung erreichbar und müssen es bleiben — sie sind
von der Registrierung aus verlinkt.

Der violette Kasten um den Absatz zur Einwilligung in Gesundheitsdaten
(DSGVO Art. 9) ist KEIN Verstoß gegen die Farbregel: Violett steht für die
Einlagen-Auswertung, und genau darum geht es in dem Absatz.

## Der eine Punkt, der echtes Nachdenken braucht

Die Entwürfe zeigen keinen Fehlerfall. Falsches Passwort, E-Mail schon
vergeben, Bestätigungslink abgelaufen — die musst du gestalten. Regeln:

  - Meldung direkt beim betroffenen Feld, nicht nur gesammelt oben
  - Rot ist hier RICHTIG: es ist ein technischer Fehler, kein körperlicher
    Befund
  - Farbe nie allein: Text dazu, Feld über aria-invalid kennzeichnen
  - Die Meldung verschwindet nicht beim Tippen, bevor erneut geprüft wurde

Leg mir deinen Vorschlag dafür vor, bevor du ihn baust.

## Bevor du anfängst

Melde dich mit:
  a) deinem Vorschlag für die Fehlerdarstellung (siehe oben)
  b) der Frage zu PasswortNeu.tsx: Für diese Seite gibt es KEINEN Entwurf.
     Sie kommt aus der E-Mail mit dem Zurücksetz-Link. Mein Vorschlag wäre
     derselbe Aufbau wie "Passwort vergessen" mit zwei Passwortfeldern —
     soll ich einen Entwurf nachliefern?
  c) ob das Video für die Willkommen-Seite schon im Projekt liegt oder im
     Entwurf nur ein Platzhalter steht
  d) ob das Stand-Datum der Rechtstexte fest im Text steht oder gepflegt wird

Dann warte auf meine Antwort.

## Sicherheit

Diese Seiten führen die Anmeldung durch. Ändere NICHTS an der Auth-Logik —
nur an der Darstellung. Keine Felder hinzufügen, keine Abläufe umbauen, keine
Weiterleitungen ändern. Fällt dir an der Auth-Logik etwas auf, melde es, statt
es zu beheben.

## Fertig heißt

Abnahmeliste in Abschnitt 6 der Design-Datei. Besonders:
Genau zwei Einstiege auf Willkommen, die AGB-Links führen wirklich dorthin,
Rechtstexte im Wortlaut unverändert und ohne Anmeldung erreichbar.
```
