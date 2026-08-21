# Messquellen: woher eine Zahl kommt

**Festgelegt:** 21.08.2026

Jede Zahl in MyProSole kann aus mehreren Quellen stammen. Eine Kadenz kann aus
der Einlage kommen, aus einer Uhr oder aus dem Schrittzähler des Telefons —
und je nachdem ist sie unterschiedlich gut.

Dieses Dokument legt fest, **welche Quelle vorgeht, was passiert wenn keine da
ist, und wie die App herausfindet, was ein Gerät überhaupt kann.**

Sprache und Begriffe: [ubiquitous-language.md](ubiquitous-language.md).

---

## 1. Der Grundsatz

> **Keine Zahl schlägt eine falsche Zahl.**

Eine leere Stelle ist ehrlich. Eine geratene Zahl sieht aus wie eine Messung
und ist keine. Wo nichts messbar ist, steht nichts — und zwar mit einem Satz,
der sagt warum.

---

## 2. Die Rangfolge je Messgröße

Die App nimmt die erste Quelle, die tatsächlich verfügbar ist.

| Messgröße | 1. Wahl | 2. Wahl | 3. Wahl | sonst |
|---|---|---|---|---|
| Druck, Seitenvergleich | Einlage | — | — | **keine Zahl** |
| Schritte, Kadenz | Einlage | Uhr | Schrittzähler des Telefons | **keine Zahl** |
| Herzfrequenz | Pulsgurt | Uhr | — | **keine Zahl** |
| Höhe | Uhr | Luftdrucksensor des Telefons | GPS-Höhe **mit Hinweis** | **keine Zahl** |
| Tempo, Strecke | GPS | — | — | **keine Zahl** |

**Zur GPS-Höhe:** Sie ist die ungenaueste Größe, die GPS liefert — der
Höhenfehler ist typisch zwei- bis dreimal so groß wie der seitliche. Sie wird
trotzdem gezeigt, aber **nie stillschweigend**. Daneben steht ein Satz wie:

> „Kein Höhensensor am Telefon und keine Uhr verbunden — die Höhe stammt von
> den Satelliten und ist deshalb nur ungefähr."

Der Nutzer soll die Zahl einordnen können, nicht ihr vertrauen müssen.

---

## 3. Was die App dem Rest verbirgt

Als **tiefes Modul** gebaut: Der Rest der App fragt nach einer Messgröße und
erfährt nie, woher sie kam.

```
    Bildschirme, Auswertung, Verlauf
                 │
                 │  "gib mir die Kadenz"
                 ▼
        ┌────────────────────┐
        │    Messquellen     │   ← kennt die Rangfolge,
        └────────────────────┘     prüft Verfügbarkeit,
          │      │      │          merkt sich die Herkunft
       Einlage  Uhr  Telefon
```

**Der Gewinn:** Kommt in einem Jahr eine Uhr dazu, ändert sich **eine Datei** —
nicht dreißig Bildschirme. Das ist die Regel „tiefe Module" aus den
[Standards](DEVELOPMENT_STANDARDS.md), angewandt auf den Fall, für den sie
gemacht ist.

---

## 4. Erkennung: drei Zustände, niemals zwei

**Das ist der heikelste Teil des ganzen Konzepts.**

Wenn ein Kunde weiß, dass sein Telefon einen Sensor hat, und wir behaupten das
Gegenteil, verlieren wir ihn. Nicht wegen der fehlenden Zahl — wegen des
offensichtlich falschen Satzes.

Der häufigste Weg, genau das zu tun: Der Schrittzähler wird abgefragt, **ohne
dass die Berechtigung `ACTIVITY_RECOGNITION` erteilt ist.** Das Ergebnis sieht
aus wie „kein Sensor vorhanden" und ist es nicht.

Deshalb kennt die App drei Zustände und nie nur zwei:

| Zustand | Was wirklich los ist | Was der Nutzer sieht |
|---|---|---|
| **Nicht vorhanden** | Das Gerät hat den Sensor tatsächlich nicht | „Dein Telefon hat keinen Höhensensor." Kein Knopf, keine Schuld |
| **Nicht erlaubt** | Sensor da, Berechtigung fehlt | „Dein Telefon kann das — MyProSole darf noch nicht darauf zugreifen." **Mit Knopf zum Erlauben** |
| **Meldet sich nicht** | Da und erlaubt, liefert aber nichts | „Wird gerade nicht gemessen." Erneut versuchen |

**Regel:** Der Satz „hat dein Gerät nicht" darf **nur** fallen, wenn die
Abfrage ohne Berechtigungsfrage möglich war und wirklich nichts geliefert hat.
Im Zweifel gilt der mildere Zustand.

### Ein Ort, an dem der Nutzer nachsehen kann

Ein Bereich **„Was dein Telefon kann"** listet jede Messgröße mit ihrer Quelle
und ihrem Zustand — und lässt fehlende Berechtigungen direkt dort erteilen.

Das ist das Gegengift gegen den Vertrauensverlust: Statt dass jemand rät, warum
eine Zahl fehlt, kann er nachsehen. Und wenn er dort etwas Falsches sieht,
sagt er es uns, statt zu gehen.

---

## 5. Wenn die Quelle mitten im Lauf wechselt

Die Einlage verliert die Verbindung, das Telefon könnte weiterzählen.

**Festlegung: Die App schaltet um, und jeder Abschnitt merkt sich seine
Herkunft.** Der Lauf läuft lückenlos weiter, aber die Naht bleibt sichtbar —
sie wird nicht weggerechnet.

In der Zusammenfassung steht danach, womit gemessen wurde:

> „28 min mit Einlage, 12 min ohne."

**Warum nicht still umschalten:** Dann entstünde eine Zahl, deren Herkunft
niemand mehr kennt. Für den Verlauf wäre das Unfug, für einen späteren
Zulassungsweg wertlos.

**Warum nicht die Quelle festnageln:** Dann gingen zwölf Minuten Daten
verloren, weil eine Funkverbindung abgerissen ist. Das ist eine Bestrafung des
Nutzers für ein technisches Ereignis.

---

## 6. Die Herkunft wird immer gespeichert

**Immer speichern, sparsam zeigen.**

- **Gespeichert:** an jedem Abschnitt, immer, ohne Ausnahme.
- **Gezeigt:** in der **Laufzusammenfassung**, in einer Zeile. Während des
  Laufs nicht — dort zählt die Zahl, nicht ihre Abstammung.

**Warum das nicht verhandelbar ist:** 5.000 Schritte aus der Einlage und 5.000
aus der Hosentasche sind nicht dieselbe Zahl. Ohne Herkunft mischt der Verlauf
unbemerkt verschiedene Güten, und niemand kann später sagen, welcher Lauf
belastbar war. Ein Messwert ohne Herkunft ist für eine Zulassung wertlos —
und nachträglich lässt sich Herkunft nicht ergänzen.

---

## 7. Was das für die Auswertung **nicht** bedeutet

Die Rangfolge betrifft **Messungen**. Sie ändert nichts daran, wo **gerechnet**
wird:

> Der Schrittzähler des Telefons ist eine **Messung** — ein Sensor meldet eine
> Zahl. Aus Rohwerten der Einlage Merkmale zu rechnen ist eine **Auswertung**,
> und die bleibt an einem Ort.

Das Telefon darf also seinen eigenen Schrittzähler lesen. Es wertet weiterhin
keine Sensor-Rohwerte der Einlage aus — siehe
[PRD Abschnitt 5.1.1](prd-erste-einlage.md).

---

## 8. Offen

| Frage | Entscheidbar ab |
|---|---|
| Wie oft wird die Verfügbarkeit geprüft — bei jedem Start oder nur bei Änderung? | wenn die erste Quelle außer GPS steht |
| Schrittlänge eichen: über GPS, wie es Uhren tun? | wenn der Telefon-Schrittzähler gebaut ist |
| Was, wenn Einlage und Uhr gleichzeitig da sind und sich widersprechen? | wenn es beides gibt |
