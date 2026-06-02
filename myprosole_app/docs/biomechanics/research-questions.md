# Forschungsfragen & benötigtes Wissen – MyProSole (Brainstorming-Input)

> Zweck: Vollständige Übersicht für externen Bot / Fachperson zum Brainstorming.
> Stand: 2026-06-01 · Projekt: MyProSole In-Shoe-Analyse (3 FSR/Fuß + geplante IMU)
>
> **Grundsatz:** MyProSole liefert **technische Screening-Hinweise**, **keine
> medizinische Diagnose**. Gesuchtes Wissen = Referenzbereiche, Kalibrierung,
> personenbezogene Baselines – nicht harte Populations-Normen zum Copy-Paste.

---

## 0. Projektkontext (kurz)

| Aspekt | Stand heute |
|--------|-------------|
| Hardware | 3 FSR pro Fuß: S1=Ferse, S2=lateraler Vorfuß, S3=medialer Vorfuß |
| Abtastrate | ~100 Hz (Default), Zeitauflösung 10 ms |
| Werte | Unkalibrierte Raw-Werte (ca. 0–1023), optional Kalibrierfaktor kg/raw |
| UI | Streamlit-App: Schrittanalyse, Gang-/Laufanalyse, Druckkarte |
| Analyse | Regelbasiert (keine KI), modular unter `core/` und `myprosole_analysis/` |

**Bereits umgesetzte Heuristiken (Referenz, keine medizinische Norm):**

| Parameter | Wert | Bedeutung |
|-----------|------|-----------|
| `REFERENCE_HEEL_SHARE_STATIC` | 60 % | Referenz Fersenanteil (statisches Stehen) |
| `REFERENCE_FOREFOOT_SHARE_STATIC` | 40 % | Referenz Vorfußanteil |
| `HEURISTIC_TOLERANCE` | 8 PP | „Im Referenzbereich" |
| `HEURISTIC_STRONG_DEVIATION` | 22 PP | „Deutliche Abweichung" |
| `FLAT_FOOT_TIME_WINDOW_MS` | 120 ms | Flacher Aufsatz (absolut, Legacy) |
| `FLAT_FOOT_STANCE_RATIO` | 0,15 (15 %) | Flacher Aufsatz (relativ zur Standphase) |
| `SENSOR_THRESHOLD` | 30 raw | Sensor „aktiv" |
| `MEDIAL_LATERAL_THRESHOLD` | 0,20 (20 PP) | Mediale/laterale Dominanz |
| `ASYMMETRY_THRESHOLD_PERCENT` | 15 % | Links/Rechts-Hinweis |

**Code-Anker:** `pressure_analysis.py`, `step_features.py`, `gait_classification.py`, `config.py`

**Bereits dokumentierte Erkenntnis:** 60/40 ist für **statisches Stehen** plausibel, für **Gangdaten** nicht stabil. „Fersenläufer" (Aufsatz-Reihenfolge) ≠ hoher Fersen-Mitteldruck in der Druckkarte.

---

## 1. Sensorik & Kalibrierung (Fundament – P0)

### Benötigtes Wissen
- Umrechnung **Raw → kPa / N / % Körpergewicht**
- Sensorkontaktfläche pro Region (für Kraft = Druck × Fläche)
- **Validität & Repeatability** von In-Shoe-FSR vs. Pedar / F-Scan / emed
- Einfluss von Temperatur, Alterung, Schuhtyp, Sensorposition
- Optimale **Aktivierungsschwelle** (aktuell 30 raw – größter Hebel für alle Folgeparameter)

### Fragen
1. Welche **Kalibrierungsmethoden** sind für Smart-Insoles üblich (bekannte Last, Körpergewicht, werkseitige Kurve)?
2. Welche **Genauigkeit** (± kPa, ± %) ist für Wellness-Screening vs. klinische Nähe nötig?
3. Wie kalibriert man **3 diskrete Sensoren** sinnvoll, wenn keine Flächen-Druckmatte vorliegt?
4. Ab welchem Raw-Wert ist **Bodenkontakt** biomechanisch sinnvoll (Schwellwert 20–40)?
5. Wie testet man **Stabilität** der Schwellwerte über verschiedene Personen und Schuhe?
6. Welche **Abtastrate** ist Minimum für Aufsatz-Timing und Peak-Erfassung?

---

## 2. Statischer Stand vs. dynamischer Gang (P1)

### Benötigtes Wissen
- Referenz **Ferse/Vorfuß** beim **ruhigen Stehen** (Literatur: ~60/40 plausibel)
- Unterschied zu **Gehen/Laufen**: Last wandert (Ferse → Mittelfuß → Vorfuß/Abstoß)
- Ob und wie man **Modi automatisch erkennt** (Stehen / Gehen / Laufen / Treppen)

### Fragen
7. Welche **Referenzverteilungen** (Ferse/Vorfuß, medial/lateral) gelten für **Stehen, Gehen, Laufen** getrennt?
8. Soll die App **Modi erkennen** – und wenn ja, mit welchen Merkmalen?
9. Dürfen **Druckkarten-Farben** bei Gangdaten die 60/40-Stehen-Referenz nutzen – oder nur Schritt-Timing?
10. Welche Kennzahlen sind für **Stehen** vs. **Gang** jeweils sinnvoll (Mean vs. Peak vs. PTi)?

---

## 3. Fußaufsatz & Timing (Gang-/Laufanalyse – P2)

### Benötigtes Wissen
- **Initial Contact, Loading Response, Midstance, Push-Off** – was messbar mit 3 FSR?
- Normierung: **% Standphase**, **% Gangzyklus** statt fixer ms
- **Heel-Strike-Index** (kontinuierlich 0–100) statt harter Klassen
- **Personen-Baseline** (Median/IQR über N Schritte, z-Score)
- Später: **IMU** (Foot-Pitch, Impact-Peak) zur Validierung

### Bereits umgesetzt (Heuristik)
- `heel_to_forefoot_time_ms`, `heel_to_forefoot_ratio`
- `simultaneous_sensors` (gleiche Sample-Nummer bei 100 Hz)
- Klassen: `heel_strike_normal`, `fast_flat_foot_contact`, `forefoot_strike_*`

### Fragen
11. Ist **Normierung auf Standphase** (`heel_to_forefoot / stance_duration`) der richtige erste Schritt – oder besser **% Gangzyklus** / Froude-Zahl?
12. Welche **Ratio-Schwellen** trennen flach / normal / ausgeprägt (aktuell 15 % – begründbar)?
13. Ab wie vielen Schritten ist eine **persönliche Baseline** stabil (Vorschlag: min. 10–15, besser 20–30)?
14. Wie definiert man **„leichter vs. starker Fersenaufsatz"** ohne klinische Ground Truth?
15. Wie kalibriert man einen **Heel-Strike-Index 0–100** (Timing, Impuls, Winkel)?
16. Welche **IMU-Merkmale** (Foot-Pitch, vertikaler Impact, Tibia-Winkel) korrelieren am stärksten mit Druck-Timing?
17. Wie fusioniert man **Druck + IMU** robust (Regeln vs. Score vs. ML)?
18. Was bedeutet **„gleichzeitige Aktivierung"** bei 10 ms Raster – nur dokumentieren oder klassifizieren?

---

## 4. Druckverteilung & Belastungsmuster (P3)

### Benötigtes Wissen
- Regionale **Peak Pressure, Mean Pressure, Force, Contact Area, Pressure-Time Integral**
- **COP-Pfad** (Schwerpunkt) – mit 3 Sensoren nur grob approximierbar
- **Symmetrie-Index** – keine universelle Norm in der Literatur
- Medial/laterale Belastung – Schwellen in Studien

### Aktuell im Code
- Mittelwert über gesamte Messung (schwach für Gang)
- Heatmap-Farben nach 60/40-Abweichung pro Zone
- `medial_ratio`, `lateral_ratio`, Links/Rechts-Verteilung

### Fragen
19. Welche **Asymmetrie in %** ist beim Gehen „normal" (nicht idealisiertes 50/50)?
20. Welche **medial/laterale Schwellen** sind in Pedografie-Studien üblich (wir: 20 PP)?
21. Was kann man mit **nur 3 Sensoren** belastbar sagen – und was explizit **nicht**?
22. Brauchen wir **COP/Impuls** – oder reicht regionale Verteilung für das Produkt?
23. Soll die Druckkarte bei **Gangdaten** nach **Schritt-Mittel** statt Session-Mittel eingefärbt werden?
24. Wie trennt man **Aufsatzart** (Fersenläufer) von **Druckverteilung** (Mittelwert) in der UI?

---

## 5. Gangparameter – Schritte, Kadenz, Phasen (P3)

### Benötigtes Wissen
- Normale **Kadenz** (Gehen ~100–120 spm, Laufen höher)
- **Stand-/Schwung-Verhältnis** alters- und tempabhängig
- Plausible Grenzen **Schritt-/Stance-Dauer** (wir: 150–2000 ms Stance)

### Fragen
25. Welche **Kadenz- und Phasen-Normen** pro Altersgruppe / Geschwindigkeit?
26. Wann ist **Links/Rechts-Differenz** bei Kadenz, Stance Time, Peak, Impuls relevant?
27. Wie gehen wir mit **Stillstand, Doppelkontakt, Treppen, Richtungswechsel** um?
28. Welche **Min/Max-Schrittdauern** sind biomechanisch plausibel (Filter)?

---

## 6. Aggregation & Kennzahlen (Methodik)

### Benötigtes Wissen
- **Peak vs. Mean vs. PTi** – wann welche Größe?
- Fenster: ganze Session vs. pro Schritt vs. rollierend (wir: `ROLLING_WINDOW_STEPS = 5`)
- Glättung (wir: 3 Samples) – Einfluss auf Aktivierungszeitpunkte

### Fragen
29. Welche **Aggregation** ist Standard in Pedobarografie-Publikationen?
30. Wie viele Schritte für **rollierende Statistik** (5 vs. 10 vs. 20)?
31. Wie stark darf **Glättung** sein, ohne Aufsatz-Timing zu verschmieren?

---

## 7. IMU – Gyroskop & Beschleunigung (P4, geplant)

### Benötigtes Wissen
- **Foot pitch** beim Aufsatz → Fersen-/Mittel-/Vorfußaufsatz
- **Impact-Peak** → leichter vs. harter Aufsatz bei gleicher Reihenfolge
- Sensorplatzierung (Ferse, Mittelfuß, am Gerät)

### Fragen
32. Welche **IMU-Achsen/Position** sind für In-Shoe am sinnvollsten?
33. Welche **Merkmale** trennen Aufsatzart und -härte besser als Druck allein?
34. Wie synchronisiert man **IMU + Druck** (Timestamp, Latenz)?
35. Kann IMU als **Ground Truth** dienen, um Druck-Heuristiken zu kalibrieren?

---

## 8. Produkt, Validierung & Regulatorik (P5)

### Fragen
36. Ist MyProSole **Wellness/Screening** oder **Medizinprodukt** (MDR, DiGA)?
37. Welche **Formulierungen** sind erlaubt („Hinweis", „Trend", „Abweichung vom Referenzmuster")?
38. Welche **Endpunkte** sollen unterstützt werden (Sturzrisiko, Überlastung, Reha, Training)?
39. Brauchen wir **klinische Validierungsstudien** – welchen Umfang für MVP vs. Produkt?
40. Welche **Zielgruppen** (Sport, Reha, Alltag, Diabetiker, Ältere) brauchen unterschiedliche Referenzen?

---

## 9. Prioritäten-Roadmap (nach Bot-Review 2026-06-01 angepasst)

| Priorität | Thema | Warum |
|-----------|-------|-------|
| **P0** | **Messqualität** (Rauschen, Schwelle, Wiederholbarkeit) | Größter Hebel vor allen Normen |
| **P0b** | **Kalibrierung** Raw → N / kPa / % KG | Ohne physikalische Einheiten keine echten Normen |
| **P1** | **Modus-Erkennung** (Stehen / Gehen / Laufen / Stillstand) | 60/40 nur für Stehen |
| **P2** | **Schrittbasierte Analyse** (nicht Session-Mittel bei Gang) | Aufsatzart ≠ Druckverteilung |
| **P3** | Relative Timing (`heel_to_forefoot_ratio`, Kadenz) | Keine universellen ms-Werte |
| **P4** | Personen-Baseline (Median/IQR, später z-Score, min. 10–15 Schritte) | Wichtiger als Populationsnorm |
| **P5** | Heel-Strike-Index 0–100 (kontinuierlich) | Besser als harte Klassen |
| **P6** | IMU-Fusion (Foot pitch, Impact) | Druck = was; IMU = wie |
| **P7** | Validierung (Video, Labels, Pedar/F-Scan) | Produkt-Glaubwürdigkeit |
| **P8** | Regulatorik & klinische Endpunkte | Produkt-Rahmen |

**Umsetzungsstand im Code:**

| Phase | Inhalt | Status |
|-------|--------|--------|
| 0 | Threshold-Sensitivität (20–40) | umgesetzt (`threshold_sensitivity.py`) |
| 1 | `heel_to_forefoot_ratio`, Kadenz | umgesetzt |
| 2 | `simultaneous_sensors` dokumentieren | umgesetzt |
| 3 | Personen-Baseline / z-Score | offen |
| 4 | Heel-Strike-Index 0–100 | offen |
| 5 | IMU-Fusion | offen |

---

## 10. Prompt für Brainstorming-Bot (Copy-Paste)

```
Kontext: MyProSole – In-Shoe-System mit 3 FSR pro Fuß (Ferse, lateraler und
medialer Vorfuß), ~100 Hz, unkalibrierte Raw-Werte. Analyse: Schritterkennung,
Fußaufsatz-Timing, Druckverteilung, Links/Rechts. Ziel: technisches Screening,
keine Diagnose.

Bitte beantworte strukturiert:

1. Welche Referenzwerte/Kennzahlen sind für STEHEN, GEHEN, LAUFEN empfohlen?
2. Welche universellen Normen gibt es NICHT (ms-Aufsatz, 60/40 beim Gang, 50/50 Symmetrie)?
3. Kalibrierung: Raw → kPa/N – Methoden und Mindestgenauigkeit?
4. Aufsatz-Timing: Normierung (% Standphase vs. % Gangzyklus), Ratio-Schwellen, Mindest-Schrittzahl für Baseline?
5. Was sind realistische Grenzen von 3 Drucksensoren pro Fuß?
6. IMU: welche Merkmale (Foot-Pitch, Impact) ergänzen Druck am meisten?
7. Priorisierung: Was zuerst recherchieren/validieren für MVP?

Nutze Quellen wo möglich. Kennzeichne klar: evidenzbasierte Norm vs. heuristische App-Schwelle.
```

---

## 11. Verwandte Projekt-Dokumente

- [`pressure-distribution.md`](pressure-distribution.md) – Druckkarte, 60/40, Normen-Einordnung
- [`gait-foot-strike-timing.md`](gait-foot-strike-timing.md) – Aufsatz-Timing, adaptive Ideen, Bot-Abgleich
- [`conversation-log.md`](conversation-log.md) – Entscheidungsverlauf
- [`sources.md`](sources.md) – bisherige Quellen

---

## 12. Antworten Brainstorming-Bot (2026-06-01)

| # | Thema | Kernaussage | Evidenz vs. Heuristik | Empfehlung Code/UI |
|---|-------|-------------|------------------------|---------------------|
| 1–6 | Kalibrierung P0 | Raw ≠ Druck; Trends ok, Normen ohne Kalibrierung nein. MVP: relative Belastung, L/R, Verlauf. Klinisch: Referenzsystem, Fehlerbereich. | Heuristik (MVP) / Studien zu FSR-Drift | „Sensorsignal", nicht „Druck"; `% KG` später |
| 7–10 | Stehen vs. Gang | 60/40 nur **Stehen** (Lit. ~60/40 Rückfuß). Gang: Phasen wandern; Tempo ändert Druck. | Referenz (Stehen) / Heuristik (Gang) | Modus-Erkennung; **keine 60/40-Farben bei Gang** |
| 11–18 | Timing | `heel_to_forefoot_ratio` richtig; 15 % = **Heuristik**. Index 0–100 besser als Klassen. Baseline min. 10–15, besser 20–30 Schritte. | Heuristik + Literatur zu Foot-strike-Klassen | Ratio primär; ms nur Zusatz; Heel-Strike-Index Phase 5 |
| 19–24 | 3 Sensoren | Gut: Timing, Symmetrie grob, medial/lateral. Schlecht: COP, MT-Köpfchen, Diagnose. | Grenze des Systems | UI: Grenzen kommunizieren; Gang: Schritt-Mittel |
| 25–28 | Gangparameter | Kadenz/Phasen alters- & tempabhängig; keine universelle Symmetrie-Norm. | Populationsreferenzen mit Vorsicht | 15 % Asymmetrie = Hinweis ok |
| 32–35 | IMU | Foot pitch + Impact + Drucktiming = robuster. Druck: *was* berührt; IMU: *wie* Aufsatz. | Studien Wearables/Gait events | Phase 6 Fusion |
| 36–40 | Produkt | Screening/Verlauf realistisch; kein Pedografie-Ersatz. | Strategisch | Keine Diagnose-Sprache |

**Kritische Bot-Aussage:** Mit 3 FSR/Fuß → gutes **Screening- & Verlaufsprodukt**, kein klinisches Pedografie-System.

**Positive Bot-Aussage:** MVP-Kombination Timing + relative Belastung + Symmetrie + Baseline + später IMU ist **realistisch und sinnvoll**.

---

## 13. Ausführliche Bot-Meinung (Zusammenfassung)

### Messqualität vor KI/Normen
Größter Hebel: Sensorrauschen, Schwelle (`SENSOR_THRESHOLD`), Wiederholbarkeit, Kalibrierung. FSR: nicht linear, Drift, Hysterese, Temperatur (vgl. Plantar-Pressure-Reviews).

### Was 3 Sensoren können / nicht können
**Können:** Kontakt, Ferse/Vorfuß zuerst, medial/lateral grob, Kadenz, Standphase grob, L/R-Hinweis.  
**Nicht:** kPa-Normen, exakter COP, MT-Köpfchen, klinische Diagnose, Diabetes-Risiko.

### Stehen vs. Gang (entschieden)
- 60/40-Referenz **nur statischer Stand**
- Gangdaten: **Schrittphasen, Peaks, Impulse, Timing** – keine 60/40-Heatmap-Farben
- Session-Mittel bei Gang biomechanisch **gefährlich** (Aufsatzart ≠ Mitteldruck)

### Timing & Index
- Ratio primär, 120 ms legacy/Zusatz
- Heel-Strike-Index 0–100 (heuristische Bänder z. B. 0–25 Vorfuß … 70–100 Ferse)
- Feste Klassen behalten, aber in den Hintergrund

### Personen-Baseline
Wichtiger als Populationsnorm (Reha, Sturzrisiko, Fatigue). Bei <10 Schritten: Median/IQR + Warnung „geringe Datenbasis".

### Geschärfte Roadmap (Bot)
1. Messqualität → 2. Modus-Erkennung → 3. Schrittbasierte Analyse → 4. Relative Timing → 5. Baseline → 6. Heel-Strike-Index → 7. IMU → 8. Validierung

---

## 14. Offene Antworten (Detail-Tabelle, optional ergänzen)

| # | Frage (Kurz) | Antwort / Quelle | Evidenz vs. Heuristik | Empfehlung für Code |
|---|--------------|------------------|------------------------|---------------------|
| 1 | Kalibrierung | Siehe §12; MVP relativ, klinisch Referenzsystem | Heuristik / Validierungsstudien | Raw umbenennen |
| 2 | Stehen 60/40 | Plausibel für Stehen | Referenz-Literatur | Nur Stand-Modus |
| 3 | Gang vs. Stehen | Strikt trennen | Konsens | Modus + UI |
| … | … | … | … | … |
