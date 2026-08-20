# Fahrplan bis zur Einlage

**Erstellt:** 20.08.2026 · **Zeitraum:** bis etwa 20.11.2026 (13 Wochen)

Das [PRD](prd-erste-einlage.md) sagt, **was** und **warum**. Dieses Dokument
sagt **wann** und **in welcher Reihenfolge**. Es ist aus dem tatsächlichen
Bestand gebaut — Quelltext, Migrationen, Zweige, Schutzkonzept — nicht aus
Erinnerung.

---

## 1. Die Rückwärtsrechnung

Der einzige feste Punkt ist die Hardware: **erste Einlage in etwa drei
Monaten.** Alles andere ergibt sich rückwärts daraus — und die Rechnung ist
enger, als sie aussieht.

| | Was | Dauer | Muss beginnen |
|---|---|---|---|
| ← | Einlage anschließen | 2 Wochen | Woche 12 |
| ← | Testgruppe läuft (1 Monat) + Auswertung | 5 Wochen | **Woche 7** |
| ← | Intern und Freunde | 2 Wochen | **Woche 5** |
| ← | Alles, was eine fremde Person berührt, ist sicher | 4 Wochen | **Woche 1** |

> **Der scharfe Termin ist nicht die Einlage. Es ist Woche 5.**
> Bis dahin muss die App so weit sein, dass man sie einem Fremden geben kann.
> Wer das verpasst, hat am Ende keine getestete App **und** eine Einlage, die
> in etwas Ungetestetes hineinsendet.

**Arbeitszeit:** 30–45 Stunden je Woche gelten dem ganzen Startup. Für den
Quelltext rechne ich mit **15 bis 22 Stunden**, also rund **230 Stunden** in
13 Wochen. Der Plan unten braucht etwa **150**. Der Rest ist Puffer — und er
wird gebraucht.

---

## 2. Die Scheiben

Jede ist für sich fertig, geprüft und nützlich. „Blockiert von" heißt: vorher
nicht anfangen.

### Sofort — Woche 1

| # | Scheibe | Aufwand | Blockiert von |
|---|---|---|---|
| **1** | **Lauf draußen mit ausgeschaltetem Bildschirm** | 2 h | — |
| **2** | **Schnittstellenpapier an den Hardware-Entwickler** | 4 h | — |
| 3 | Alte Testläufe mit erfundener Strecke löschen | 1 h | 1 |
| 4 | OpenAI-Schlüssel rotieren, Zweige aufräumen | 1 h | — |

**Zu 1:** Die ganze Kette hat noch **nie** echte Daten getragen. Die Datenbank
des Dienstes ist leer. Solange dieser Beweis fehlt, ist jede weitere Arbeit an
der Aufzeichnung eine Wette.

**Zu 2:** Die einzige Aufgabe, deren Verzug man erst bemerkt, wenn es zu spät
ist. Sie hängt an einem Menschen, der nicht am Quelltext arbeitet. Inhalt:
[PRD Abschnitt 5](prd-erste-einlage.md), samt der drei Rückfragen —
**Abtastrate (285 Hz nötig?), Kanalzahl (2 oder 3 je Fuß?),
Zeitsynchronisierung beider Einlagen.**

### Die App wird fremdentauglich — Woche 1 bis 5

Alles hier schützt Menschen, die uns nicht kennen. Reihenfolge aus
[schutzkonzept.md](schutzkonzept.md) Abschnitt 6.

| # | Scheibe | Aufwand | Blockiert von |
|---|---|---|---|
| **5** | **Privatzone um Zuhause** | 10 h | 1 |
| 6 | Sichtbarkeitsschalter anschließen | 4 h | — |
| 7 | Hindernis-Übersetzer statt roher Datenbankmeldungen | 8 h | — |
| 8 | `data_access_log` tatsächlich füllen | 4 h | — |

**Zu 5:** Laut Schutzkonzept **die größte offene Lücke**. GPS-Punkte werden von
der ersten bis zur letzten Sekunde gespeichert. Wer ein Konto übernimmt oder
später einen geteilten Lauf sieht, sieht die Wohnadresse. Betrifft **jeden**
Nutzer, auch ohne Community. Baulich an, nicht als Hinweis zum Einschalten.

**Zu 7 — und das ist ein Musterfall für die neue Entwurfsregel:** Es gibt
**61 Stellen in 13 Dateien**, die eine rohe Meldung durchreichen. Der falsche
Weg wäre, 61 Stellen anzufassen. Der richtige ist **ein tiefes Modul**, das
aus jedem Fehler ein benanntes `Hindernis` macht — die 61 Aufrufer rufen dann
eine Funktion, und die Regel gilt danach von selbst, auch für die 62. Stelle,
die noch niemand geschrieben hat.

### Die Datenbank hält Wachstum aus — Woche 3 bis 6

| # | Scheibe | Aufwand | Blockiert von |
|---|---|---|---|
| 9 | `auth.uid()` verpacken (135 Stellen) + `TO authenticated` | 4 h | — |
| 10 | `run_points`-Regel ohne Unterabfrage je Zeile | 6 h | 9 |

**Zu 9:** Mechanisch und risikoarm. Alle 135 Regeln rufen `auth.uid()`
unverpackt auf; verpackt wertet Postgres es **einmal** statt je Zeile aus.
Bei einem Lauf mit 3.000 Punkten ist das der Unterschied zwischen einer und
3.000 Auswertungen.

**Zu 10:** Braucht eine dokumentierte Ausnahme von unserer eigenen 3NF-Regel.
Das gehört ins [Ausnahmeverfahren](DEVELOPMENT_STANDARDS.md), nicht still
gemacht.

### Das Fundament für die Einlage — Woche 2 bis 8

| # | Scheibe | Aufwand | Blockiert von |
|---|---|---|---|
| **11** | **Bluetooth in den nativen Dienst** | 30 h | 1 |
| 12 | Schrittbündel-Zerleger, testgetrieben | 6 h | 2 |
| 13 | Fachlogik aus dem Java-Dienst testbar herauslösen | 8 h | 11 |
| 14 | `core/domain` mit zweifüßigen Daten prüfen | 4 h | 2 |

**Zu 11:** Die größte einzelne Scheibe. Dasselbe Fünf-Minuten-Problem wie beim
GPS, dieselbe Lösung, dieselbe zweistufige Übergabe. Pulsgurt zuerst, weil es
ihn schon gibt. **Zählt doppelt:** Diese Java-Zeilen sind auch das Fundament
für die Einlage — und sie wandern bei einem späteren Umzug unverändert mit.

**Zu 12:** Die erste Scheibe nach der neuen TDD-Regel. Reine Berechnung, festes
Datenformat, und schreibbar **bevor** es Hardware gibt. Das Ergebnis ist eine
Beschreibung, die der Hardware-Entwickler **ausführen** kann.

**Zu 13:** Heute sind **1.206 Java-Zeilen ohne einen einzigen Test** — und sie
besitzen die Daten. Was ohne Android läuft, wird testbar; der Rest bleibt
Gerätesache. Senkt nebenbei den Preis eines Umzugs.

### Vorsorge, die später zehnmal teurer wäre — Woche 4 bis 9

| # | Scheibe | Aufwand | Blockiert von |
|---|---|---|---|
| 15 | Sprachgerüst einziehen | 6 h | — |
| 16 | `classification_notes` von Text zu Schlüssel | 4 h | 15 |

**Zu 15:** Der Mechanismus jetzt, die 37 Seiten nach und nach. **Jede neue
Seite wird von Anfang an richtig gebaut** — und die Seiten für die Auswertung
gibt es noch gar nicht. Billiger wird dieser Zeitpunkt nie.

**Zu 16:** Die Python-Auswertung gibt heute fertige deutsche Sätze aus
(„Klassischer Fersenaufsatz."). Das läuft der Sprachregel zuwider — und
gefährlicher: **die Zulassungsgrenze wird dort bewacht, wo der Text steht.**
Steht er in Python, prüft ihn niemand mit.

### Testgruppe — Woche 5 bis 12

| # | Scheibe | Aufwand | Blockiert von |
|---|---|---|---|
| 17 | Testmaterial: Einwilligung, Anleitung, Feedback-Weg | 4 h | 5, 6, 7 |
| 18 | Intern und Freunde, zwei Wochen | — | 11, 17 |
| 19 | Testgruppe Läufer, ein Monat, wöchentliches Feedback | — | 18 |

---

## 3. Der Wochenplan

| Woche | Schwerpunkt | Fertig am Ende |
|---|---|---|
| 1 | Beweis + Schnittstelle | 1, 2, 3, 4 |
| 2–3 | Privatzone, Sichtbarkeit, Hindernisse | 5, 6, 7 |
| 3–4 | Datenbank + Protokoll, Bluetooth beginnt | 8, 9, 10 |
| 4–6 | Bluetooth nativ, Sprachgerüst nebenher | 11, 15 |
| 5 | **Prüfpunkt: fremdentauglich?** | 17 |
| 6–7 | Interne Tests, Freunde | 18 |
| 7–11 | **Testgruppe läuft**, parallel 12–14 | 12, 13, 14, 16 |
| 11–12 | Auswertung Testgruppe, Nachbesserung | 19 |
| 12–13 | Einlage anschließen | PRD Phase 2 |

---

## 4. Was nicht auf dem Plan steht

Wichtiger als die Liste dessen, was draufsteht.

| Nicht jetzt | Warum |
|---|---|
| Umzug auf React Native | Träfe die Hardware mitten im Umbau. [Begründung](prd-erste-einlage.md) Abschnitt 7 |
| iPhone | Erst wenn Android trägt |
| Analyse-Backend im Betrieb | Entscheidung fällt mit Messwerten des Prototyps |
| Partitionierung, Realtime auf Broadcast | Greift ab Größenordnungen, die wir nicht haben |
| Profilsuche, Firmengruppen | Schaffen erst die Gefahrenlage, gegen die 5 und 6 schützen |
| Nachvollziehbarkeit für die Zulassung | Stichtag ist der erste zahlende Kunde |
| Die 17 Produktpunkte aus [umsetzung-offene-punkte.md](umsetzung-offene-punkte.md) | Einzeln klein, zusammen ein Monat. Gehören zwischen 18 und 19, wenn die Testgruppe sagt, welche wirklich stören |
| Bilder und Videos für 32 Übungen | Inhaltsarbeit, kein Quelltext. Parallel möglich, blockiert nichts |

---

## 5. Was von anderen Menschen abhängt

Diese Punkte kann ich nicht erledigen, und sie sind trotzdem im Weg.

| Wovon | Wer | Wann nötig | Wenn es fehlt |
|---|---|---|---|
| Zusage zur Schnittstelle | Hardware-Entwickler | **Woche 2** | Phase 2 fällt aus, ohne dass es jemand merkt |
| Chip, Abtastrate, Kanalzahl | Hardware-Entwickler | Woche 3 | Bündelformat bleibt offen |
| Fachliche Durchsicht der 32 Übungen | Fachperson | vor Woche 7 | 12 selbstgeschriebene Texte gehen an Menschen mit Schmerzen |
| Rechtstexte prüfen lassen | Anwalt (kostet Geld) | vor zahlenden Kunden | Datenschutzerklärung und AGB tragen selbst den Hinweis, ungeprüft zu sein |
| Testläufer finden | du und der Coach | Woche 6 | Woche 7 verschiebt sich, und mit ihr alles danach |

---

## 6. Woran wir merken, dass wir hinterherliegen

Nicht am Gefühl.

| Prüfpunkt | Woche | Wenn nicht erfüllt |
|---|---|---|
| Ein echter Lauf ist gespeichert | 1 | **Sofort anhalten** und die Kette prüfen |
| Hardware-Entwickler hat die Schnittstelle bestätigt | 2 | Nachfassen, bis eine Antwort da ist |
| Privatzone ist an | 4 | Testgruppe verschieben, nicht die Privatzone |
| Pulsgurt zeichnet eine Stunde ohne Lücke auf | 6 | Bluetooth-Scheibe teilen: erst empfangen, dann puffern |
| Testläufer sind gefunden | 6 | Testgruppe auf drei Wochen kürzen, nicht streichen |
| Testgruppe hat begonnen | 7 | Phase 2 startet ohne getestete Grundlage — bewusst entscheiden, nicht hinnehmen |

**Die eine Regel für den Ernstfall:** Wenn die Zeit knapp wird, fällt **nicht**
die Sicherheit weg und **nicht** der Test. Es fallen die 17 Produktpunkte weg.
Sie sind das Einzige auf dieser Liste, dessen Fehlen niemandem schadet.
