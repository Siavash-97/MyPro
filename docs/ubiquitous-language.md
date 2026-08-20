# Unsere gemeinsame Sprache

Diese Datei ist kein Wörterbuch für Fremde. Sie ist die Abmachung zwischen uns
beiden: **ein Begriff, ein Wort — im Gespräch, im Quelltext, in der Oberfläche.**

Der Grund ist nicht Schönheit. Wenn du „Pace" sagst und ich „Tempo" lese und in
der Datenbank `avg_pace_s_per_km` steht, dann reden wir über drei Dinge und
merken es erst, wenn eine Zahl falsch ist. Jedes Missverständnis in diesem
Projekt bisher hatte ein Wort als Ursache, nicht einen Fehler.

**Regel:** Taucht ein Begriff hier auf, benutzen wir ihn genau so. Fällt dir ein
besseres Wort ein, ändern wir es hier zuerst und im Quelltext danach — nicht
umgekehrt.

---

## 1. Die drei Sprachen und wo ihre Grenze verläuft

Wir haben drei Ebenen, und sie sprechen absichtlich verschieden:

| Ebene | Sprache | Beispiel | Warum |
|---|---|---|---|
| Oberfläche | Deutsch | „Gesamtzeit" | Nutzer lesen Deutsch. Kein Englisch in der App. |
| Quelltext | Deutsch | `bewegungszeitS` | Damit Fachbegriffe im Code dieselben sind wie im Gespräch. |
| Datenbank | Englisch | `moving_time_s` | Gewachsen, bleibt so. Ändern wäre teurer als der Nutzen. |

**Die Grenze ist der Speicher-Aufruf.** Alles oberhalb heißt deutsch, alles
darunter englisch, und die Übersetzung passiert an genau einer Stelle je Feld.
Wenn du irgendwo im Quelltext ein englisches Fachwort findest, das nicht direkt
an der Datenbank klebt, ist das ein Fehler.

### 1.1 Und wenn die App eines Tages Englisch spricht?

Dann ändert sich an dieser Tabelle **nichts.** Denn:

> **Ein Identifikator ist keine Sprache.**

`stance_swing_ratio`, `moving_time_s`, `bewegungszeitS` sind Namen, keine Texte.
Kein Nutzer sieht sie je. Sprache ist nur, was ein Mensch liest — und die liegt
in genau einer Schicht:

| Ebene | Beispiel | Übersetzt? |
|---|---|---|
| Kennzahl (Python, Datenbank, Schnittstelle) | `stance_swing_ratio` | nie |
| Textschlüssel (App) | `merkmal.stance_swing_ratio.name` | nie |
| Text (Bildschirm) | „Verhältnis Stand zu Schwung" | **hier** |

Eine neue Sprache ist damit **eine Datei** und kein Rundgang durch 37 Seiten.
Und deutsche Namen im Quelltext bleiben deutsch — sie sind für uns, nicht für
die Nutzer.

**Die Ausnahme, die es zu bewachen gilt:** Eine Übersetzung darf die Grenze aus
Abschnitt 7 nicht aufweichen. „ungleich verteilt" darf in keiner Sprache zu
„fehlbelastet" werden. Wer übersetzt, übersetzt die Zulassungsgrenze mit — oder
reißt sie ein.

---

## 2. Zeit und Bewegung

Der Bereich, in dem wir uns am häufigsten missverstanden haben.

| Begriff | Bedeutung | Im Quelltext |
|---|---|---|
| **Lauf** | Eine Aufzeichnung von Start bis Beenden. Die Einheit, die der Nutzer sieht und speichert. | `Lauf`, `laufId` |
| **Gesamtzeit** | Stoppuhr. Start bis Ende, **einschließlich** Pausen und Ampeln. | `durationS` |
| **Bewegungszeit** | Nur die Zeit, in der wir Bewegung erkannt haben. Immer ≤ Gesamtzeit. | `bewegungszeitS` |
| **Pause** | Der Nutzer hat gedrückt. Eine Absicht. | `pausiert` |
| **Stillstand** | Die App hat erkannt, dass niemand geht. Keine Absicht, ein Befund. | `inBewegung === false` |
| **Ruhepegel** | Wie viel Scheinbewegung dieses eine Telefon im Stillstand erzeugt. Lernt sich selbst ein, bleibt auf dem Gerät. | `Ruhepegel` |
| **Haltezeit** | Wie lange etwas anhalten muss, bevor wir es glauben. Zurzeit 10 Sekunden. | `HALTEZEIT_MS` |

**Pause und Stillstand sind nicht dasselbe** und dürfen nie dasselbe Wort
bekommen. Das eine kommt vom Menschen, das andere vom Sensor. Beide zählen zur
Gesamtzeit, keines zur Bewegungszeit.

---

## 3. Ort, Tempo, Strecke

| Begriff | Bedeutung | Im Quelltext |
|---|---|---|
| **Messung** | Was der Sensor roh geliefert hat. Noch ungeprüft. | `RohMessung` |
| **Punkt** | Eine Messung, die unsere Prüfung bestanden hat und zum Lauf gehört. | `Punkt`, `punkte` |
| **Genauigkeit** | Der vom Gerät gemeldete Fehlerradius in Metern. Kleiner ist besser. | `genauigkeitM` |
| **Tempo** | Geschwindigkeit. Nie „Pace", nie „Speed". | `tempoMps`, `TempoArt` |
| **Güte** | Wie sicher sich das Gerät bei seiner eigenen Tempoangabe ist. | `tempoGueteMps` |
| **Schwerpunkt** | Mittelpunkt aus mehreren Punkten. Wir vergleichen Schwerpunkte, nie Einzelpunkte — Rauschen mittelt sich weg. | `SCHWERPUNKT_PUNKTE` |
| **Segment** | Der Weg zwischen zwei aufeinanderfolgenden Punkten. | `MIN_SEGMENT_M` |
| **Strecke** | Die aufsummierte Länge aller Segmente. Nie „Distanz". | `distanceKm` |

**Fußangel:** „Tempo" heißt bei uns immer **Meter pro Sekunde** im Quelltext und
**Minuten pro Kilometer** in der Oberfläche. Wo umgerechnet wird, steht das
`Mps` im Namen. Fehlt das `Mps`, ist es eine Anzeige.

---

## 4. Die Aufzeichnung

| Begriff | Bedeutung | Im Quelltext |
|---|---|---|
| **Dienst** | Der native Hintergrunddienst auf dem Telefon. **Er ist die Wahrheit** — er sammelt und speichert. | `AufzeichnungsDienst` |
| **Anzeige** | Alles im JavaScript. Rechnet und zeigt, besitzt aber keine Daten. | — |
| **Sitzung** | Eine Aufzeichnung aus Sicht des Geräts, unabhängig davon, ob die Datenbank sie schon kennt. | `sitzungId` |
| **Abholen** | Punkte vom Dienst holen, ohne sie zu löschen. | `punkteAbholen` |
| **Bestätigen** | Dem Dienst sagen: angekommen, du darfst löschen. | `punkteBestaetigen` |
| **Verwerfen** | Punkte wegwerfen, weil der Lauf abgebrochen wurde. | `punkteVerwerfen` |
| **Hindernis** | Der benannte Grund, warum etwas nicht geht — nie eine rohe Fehlermeldung. | `Hindernis`, `dienstHindernis` |

**Warum zwei Schritte:** Erst abholen, dann bestätigen, dann löscht der Dienst.
Ein Absturz dazwischen kostet nichts — doppelt ist harmlos, weg wäre es nicht.
Dieses Muster heißt bei uns **zweistufige Übergabe** und gilt ab jetzt auch für
die Einlage.

---

## 5. Die Einlage

Noch nicht gebaut. Die Wörter legen wir jetzt fest, damit sie nicht später
gegen die vorhandenen laufen.

| Begriff | Bedeutung |
|---|---|
| **Einlage** | Die Hardware im Schuh. Zwei davon: links und rechts. Nie „Sohle", nie „Insole". |
| **Rohwert** | Ein einzelner Sensorwert, wie der Chip ihn liest. Ohne Deutung. |
| **Merkmal** | Etwas Berechnetes mit Bedeutung — Bodenkontaktzeit, Druckschwerpunkt, Aufsetzmuster. |
| **Schritt** | Ein Bodenkontakt eines Fußes. Die natürliche Einheit für Merkmale. **Ein Schritt entsteht nur aus einer Einlage** — nie aus dem Telefon. |
| **Auswertung** | Der Vorgang, der aus Rohwerten Merkmale macht — egal, wo er läuft. |
| **Regelversion** | Welche Fassung der Auswertung ein Ergebnis erzeugt hat. Braucht ein Ergebnis nicht heute, aber der Begriff steht bereit. |

**Bewusst offen gelassen:** Wo die Auswertung läuft — in der Einlage, auf dem
Telefon oder im Backend — ist noch nicht entschieden und wird gerade getestet.
Genau deshalb heißt der Vorgang „Auswertung" und nicht „Backend-Analyse":
**das Wort darf die Entscheidung nicht vorwegnehmen.**

---

## 6. Die Oberfläche

| Begriff | Bedeutung |
|---|---|
| **Seite** | Ein Bildschirm mit eigener Adresse. |
| **Blatt** | Die Fläche, die von unten hereinfährt. Nie „Sheet", nie „Modal". |
| **Kachel** | Ein Feld mit einer Zahl und einer Beschriftung. |
| **Klicktiefe** | Wie viele Berührungen bis zu einer Funktion. Stehende Regel: so wenige wie möglich, nichts Wichtiges hinter unbeschrifteten Menüs. |

---

## 7. Wörter, die wir nicht benutzen — bis wir dürfen

Solange MyProSole **kein Medizinprodukt** ist, beschreiben wir und bewerten
nicht. Das ist keine Stilfrage, das ist die Grenze zur Zulassungspflicht.

| Verboten | Erlaubt |
|---|---|
| Risiko, Gefahr, Verletzungsgefahr | „Dein linker Fuß trägt 8 % mehr Last" |
| Diagnose, Befund, Fehlstellung | „Der Druckschwerpunkt liegt weiter außen als letzte Woche" |
| Fehlbelastung, ungesund, falsch | „ungleich verteilt", „verändert gegenüber" |
| Empfehlung im Sinne von Therapie | „Andere Läufer mit ähnlichem Muster machen häufig …" |

**Die Faustregel:** Wir sagen, **was zu sehen ist.** Wir sagen nicht, **was es
bedeutet.** Der Tag, an dem wir das ändern, ist ein Zulassungsverfahren und kein
Textupdate.

---

## 8. Wie wir über den Bau selbst sprechen

| Begriff | Bedeutung |
|---|---|
| **Tiefes Modul** | Verbirgt viel hinter einer schmalen Schnittstelle. Das Ziel. |
| **Flaches Modul** | Reicht im Wesentlichen weiter. Kosten ohne Gegenwert. |
| **Schnittstelle** | Was ein Aufrufer wissen muss. Sie ist der Preis eines Moduls. |
| **Senkrechte Scheibe** | Ein Stück Arbeit, das für sich fertig und nützlich ist — von der Datenbank bis zum Bildschirm. Nicht „erst alle Tabellen, dann alle Seiten". |
| **Rot – Grün – Sauber** | Erst der fehlschlagende Test, dann die einfachste Lösung, dann aufräumen. |
| **Strategisch** | Den Entwurf besser hinterlassen, als man ihn vorfand. **Nicht:** auf Vorrat bauen. |
| **Taktisch** | Der schnellste Weg zur Änderung. Manchmal richtig, meistens teuer. |

Ausführlich in [DEVELOPMENT_STANDARDS.md](DEVELOPMENT_STANDARDS.md),
Abschnitt „Tiefe Module und strategisches Bauen".

---

## 9. Falsche Freunde

Wörter, die wir schon einmal verwechselt haben:

- **Bewegung** kommt aus dem GPS und weiß nichts von Füßen. **Schritt** kommt aus der Einlage. Die App darf nie aus dem einen das andere machen — auch nicht ungefähr.
- **Genauigkeit** ist der Fehler des *Ortes*. **Güte** ist der Fehler des *Tempos*. Zwei Zahlen, zwei Zwecke.
- **Aufzeichnung** ist der Vorgang, **Lauf** das Ergebnis. Ein abgebrochener Lauf war eine Aufzeichnung ohne Lauf.
- **Verbinden** meint Bluetooth. **Anmelden** meint das Konto. Nie tauschen.
- **Gesamt** heißt „mit Pausen". **Netto** heißt „nur Bewegung". Wenn eines fehlt, ist die Zahl mehrdeutig.

---

## 10. Wie wir diese Datei benutzen

Wenn einer von uns ein Wort benutzt, das hier nicht steht und einen Fachbegriff
meint, ist das ein Anlass, es aufzunehmen — nicht, es zu ignorieren. Ein Begriff
gehört hierher, sobald er zum zweiten Mal fällt.

**Verwandte Dokumente:** [DEVELOPMENT_STANDARDS.md](DEVELOPMENT_STANDARDS.md)
(die Regeln), [bauart-und-wachstum.md](bauart-und-wachstum.md) (die Bauart),
[zurueckgestellt.md](zurueckgestellt.md) (was noch nicht geht).
