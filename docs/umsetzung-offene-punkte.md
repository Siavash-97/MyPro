# Offene Punkte aus der 1:1-Umsetzung

Gesammelt während der Umsetzung. Jeder Punkt hat einen **Vorschlag** — so habe
ich es gebaut oder würde es bauen. Am Ende gehen wir die Liste zusammen durch;
was du anders willst, ändere ich dann.

Stand: 14.08.2026

---

## 1. Profil einrichten: welche Felder bleiben?

**Lage.** Dein Entwurf `profil-einrichten.html` fragt Name, Alter, Größe,
Geschlecht, Trainingsniveau (4 Stufen), Läufe pro Woche, Kilometer pro Woche
und einen Block „Was ist dir wichtig?". Du hast gesagt, Alter und Ziel gehören
nicht dorthin, weil sie in der Anamnese stehen.

**Vorschlag.** Nur der **Anzeigename** bleibt. Alles andere kommt aus der
Anamnese. Damit entfällt auch das Wochenziel-Feld — die Startseite misst ihren
Wochenfortschritt dann gegen die Summe deines Laufplans, was ohnehin
stimmiger ist, seit der Plan existiert.

**Folge, wenn du zustimmst.** Das Feld `weekly_goal_km` im Profil wird nicht
mehr gefüllt; `running_level` ebenfalls nicht. Beide Spalten bleiben in der
Datenbank, damit nichts verloren geht.

---

## 2. Trainingsniveau: 3 oder 4 Stufen?

**Lage.** Entwurf: vier Stufen mit Ich-Sätzen („Ich fange gerade an", „Ich
laufe regelmäßig", „Ich trainiere ambitioniert", „Ich trainiere für
Wettkämpfe"). Datenbank: drei Werte (`anfaenger`, `fortgeschritten`,
`erfahren`) mit Prüfbedingung.

**Vorschlag.** Erledigt sich mit Punkt 1 — wenn das Feld aus dem
Profil-Einrichten verschwindet, wird es in der Anamnese erhoben, und dort
gelten ohnehin die Anamnese-Antworten. Falls du das Feld behalten willst,
schreibe ich eine Migration auf die vier Werte des Entwurfs.

---

## 3. `einlage.html` — Seite für die verbundene Einlage

**Lage.** Die Seite zeigt Akkustand (82 %), Gesamtstrecke (227 km) und
erfasste Läufe (34). Ohne Hardware gibt es keine dieser Zahlen.

**Vorschlag.** Erst bauen, wenn die Bluetooth-Anbindung steht. Eine Seite mit
erfundenen Werten, die niemand erreichen kann, hilft beim Testen nicht.

---

## 4. Persönliche Begründung in der Mikroroutine

**Lage.** Dein Entwurf zeigt pro Übung einen Satz wie „Steht bei dir vorn,
weil du früher Knieprobleme hattest." Das braucht die Auswertung der Anamnese.

**Vorschlag.** Bleibt weg, bis die Übungsauswahl an die Anamnese
angeschlossen ist. Stattdessen steht dort der Aufklapper „Warum das hilft" mit
der echten Übungsbeschreibung. Eine erfundene Begründung wäre schlechter als
keine.

---

## 5. Umfang der Mikroroutine

**Lage.** Feste Vorgabe: 3 Übungen, 2 Sätze, 12 Wiederholungen. Der Entwurf
zeigt je Übung eigene Werte („2 Sätze · 15 Wiederholungen pro Seite").

**Vorschlag.** Bleibt vorerst fest. Sobald die Übungsauswahl steht, kommen
Sätze und Wiederholungen pro Übung aus den Übungsdaten.

---

## 6. Zurück-Pfeil im Live-Tracking

**Lage.** Dein Entwurf beschriftet ihn mit **„Minimieren"** — der Lauf läuft
weiter, man geht nur zur Startseite. Die App **bricht den Lauf ab**.

**Vorschlag.** Auf „Minimieren" umstellen: zurück zur Startseite, Aufzeichnung
läuft weiter. Zum Abbrechen gibt es den Stop-Knopf mit Rückfrage. Das ist auch
das kleinere Risiko — ein versehentlicher Tap kostet dann keinen Lauf.

---

## 7. Übersicht der DSGVO-Einwilligungen im Profil

**Lage.** Steht nicht im Entwurf, zeigt aber die tatsächlich erteilten
Einwilligungen zu Gesundheitsdaten.

**Vorschlag.** Bleibt drin. Sie ersatzlos zu streichen wäre ein Rückschritt
bei der Transparenz über Gesundheitsdaten.

---

## 8. Abschnitt „Laufprofil" im Profil

**Lage.** Steht nicht im Entwurf; zeigt Laufniveau und Wochenziel.

**Vorschlag.** Fällt weg, sobald Punkt 1 entschieden ist — ohne die Felder
gibt es nichts anzuzeigen.

---

## 9. Abschnitt „Gesundheit" / Zykluskalender im Profil

**Lage.** Im Entwurf nur sichtbar, wenn die Profilangabe zum Geschlecht passt.
Diese Angabe erhebt die App nicht (siehe Punkt 1).

**Vorschlag.** Der Zykluskalender wird gebaut; der Einstieg im Profil bleibt
sichtbar, solange die Geschlechtsangabe fehlt. Sobald die Anamnese sie
liefert, wird er wie im Entwurf daran gebunden.

---

## 10. Farb-Vergleichsschalter im Profil

**Lage.** Dein Entwurf hat drei Schalter (Logo-Violett, Vital-Petrol, Set B)
und bezeichnet sie selbst als Schalter für die Abstimmungsphase.

**Vorschlag.** Weggelassen — die Entscheidung ist mit Set B getroffen.

---

## 11. Community: echte Inhalte fehlen

**Lage.** Die Community-Seiten zeigen Beiträge, Gruppen und Verabredungen. Es
gibt weder Tabellen noch Inhalte dafür.

**Vorschlag.** Die Seiten werden 1:1 gebaut und zeigen ihren Leerzustand
(„noch keine Beiträge"), statt erfundene Beiträge anzuzeigen. Die Tabellen
kommen mit der Funktions-Phase.

---

## 12. Social-Studio und Teilen

**Lage.** Beide Seiten erzeugen Bilder aus Laufdaten und Fotos.

**Vorschlag.** Aufbau und Bedienung 1:1 gebaut; die Bilderzeugung selbst
bleibt ohne Funktion und sagt das. `share-export.html` (Story/Post-Format,
Download) habe ich nicht getrennt gebaut — es ist der zweite Schritt desselben
Ablaufs und kommt mit der Bilderzeugung.

---

## 13. Community: Detailseiten noch offen

**Lage.** Gebaut sind die drei Tabs aus der segmentierten Umschaltung: Feed,
ZusammenLauf und Gruppen — jeweils mit Leerzustand.

**Noch nicht gebaut:** Beitragsdetail, neuer Beitrag, Gruppendetail, Gruppe
gründen, Meine Gruppen, Community-Profil, ZusammenLauf-Filter. Alle sieben
zeigen Inhalte, die es ohne Tabellen nicht gibt.

**Vorschlag.** Zusammen mit den Community-Tabellen bauen. Vorher wären es
sieben Seiten, die nur Leerzustände zeigen und sich gegenseitig verlinken.

---

## 14. Anamnese sieht anders aus als der Entwurf

**Lage.** Die Anamnese ist die einzige Seite, die noch komplett in der alten
Optik gebaut ist — sie nutzt keine einzige `md-`Klasse. Die Texte stimmen
weitgehend, das Aussehen nicht.

**Dabei aufgefallen (zwei echte Fehler, noch nicht behoben):**
- Der Fortschrittsbalken **springt zurück** (von 66 % auf 63 %), wenn man den
  Schmerz-Zweig durchläuft.
- Wählt man am Ende „Block B jetzt machen", landet man beim „Weiter"
  offenbar **wieder ganz am Anfang** statt bei der nächsten Frage.

**Vorschlag.** Als eigene Runde umstellen und beide Fehler dabei beheben. Ich
habe sie nicht nebenbei angefasst, weil die Anamnese der längste Ablauf der
App ist und eine eigene Prüfung verdient.

---

## 15. E-Mail-Bestätigung

**Lage.** `confirm-email.html` zeigt eine sechsstellige Code-Eingabe. Die
Bestätigung ist serverseitig abgeschaltet (frühere Entscheidung im Projekt),
die Registrierung führt direkt weiter.

**Vorschlag.** Nicht bauen, solange die Bestätigung abgeschaltet ist. Wird sie
wieder eingeschaltet, gehört die Seite dazu.

---

## 16. Schriftart Roboto

**Lage.** Die Design-Prüfung meldet bei jedem Durchlauf, Roboto sei eine
„überstrapazierte" Schrift und die Oberfläche wirke dadurch beliebig.

**Warum ich sie trotzdem gelassen habe.** Roboto ist die Schrift deines
Material-3-Designsystems und steht so in `design-system/tokens.css`. Eine
andere Schrift würde genau die 1:1-Treue brechen, um die es bei dieser ganzen
Arbeit geht.

**Vorschlag.** So lassen. Wenn du der Meldung zustimmst, ist das keine
Änderung an der App, sondern eine Design-Entscheidung für das gesamte
Designsystem — dann würde die Schrift zuerst in `tokens.css` gewechselt und
von dort in die App übernommen. Willst du die Meldung nur abstellen, genügt
einmalig:

```
/impeccable hooks ignore-value overused-font Roboto --shared
```

---

## Was am 15.08.2026 steht

**Alle 19 Seiten der App laden fehlerfrei**, kein seitliches Scrollen, keine
Konsolenfehler. Neu entstanden in dieser Runde: Willkommensseite, Wochenplan,
Mikroroutine, Laufanalyse, Einlagen kennenlernen, Einlage verbinden,
Community-Feed, ZusammenLauf, Gruppen, Zykluskalender, Social-Studio.

**Datenbank:** Der Wochenplan liegt in eigenen Tabellen (Migration 0013). Alles
andere nutzt die bestehenden Tabellen.

