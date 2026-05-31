# MyProSole – Regelbasierte Gang-/Laufanalyse

Modulare, **regelbasierte** Python-Analyse für smarte Einlagen mit **3 FSR-Drucksensoren pro Fuß**.

> **Keine KI, kein Machine Learning, keine Cloud.** Reine, nachvollziehbare Regeln auf
> Basis von `pandas`, `numpy` und `matplotlib`. Der Code ist bewusst schlank und
> vektorisiert gehalten, damit die Logik später echtzeitnah (z. B. auf ESP32 / in einer
> App) umgesetzt werden kann.

---

## Projektziel

Aus den Druckverläufen der Einlagen sollen **einzelne Schritte** erkannt, **charakterisiert**
und **regelbasiert klassifiziert** werden. Zusätzlich wird das **Links-Rechts-Verhalten**
verglichen. Die Ausgaben sind **neutrale, beschreibende Hinweise** – es erfolgt
**ausdrücklich keine medizinische Diagnose** (Begriffe wie „Pronation"/„Supination" werden
nicht verwendet).

---

## Sensorpositionen (pro Fuß)

| Sensor | Position | Rolle |
|--------|----------|-------|
| **S1** | Ferse / heel | `*_heel` |
| **S2** | lateraler Vorfuß (unter kleiner Zeh) | `*_lateral_forefoot` |
| **S3** | medialer Vorfuß (unter großer Zeh) | `*_medial_forefoot` |

---

## CSV-Format

Pflichtspalten (Reihenfolge egal, Namen müssen exakt stimmen):

```
time_s, L1_heel, L2_lateral_forefoot, L3_medial_forefoot, R1_heel, R2_lateral_forefoot, R3_medial_forefoot
```

- `time_s`: Zeitstempel in **Sekunden**.
- Sensorspalten: Druck-Rohwerte (z. B. 0–1023). Negative Werte werden auf 0 gesetzt.
- Fehlt eine Pflichtspalte, gibt der `data_loader` eine **klare Fehlermeldung** aus,
  welche Spalten fehlen.

Die Abtastrate wird automatisch aus `time_s` geschätzt (Median der Zeitdifferenzen);
gelingt das nicht, greift der Default aus `config.py`.

---

## Schritt- und Standphasenerkennung

- **Standphase START:** mindestens **einer** der 3 Sensoren eines Fußes liegt über
  `sensor_threshold`.
- **Standphase ENDE:** **alle** 3 Sensoren dieses Fußes liegen wieder unter dem
  Schwellenwert.
- Standphasen außerhalb von `[min_step_duration_ms, max_step_duration_ms]` werden als
  Artefakte verworfen.
- Die Kantenerkennung ist vektorisiert (`numpy`-Flanken) und damit auch für lange
  Aufzeichnungen schnell.

### Schwungphase (swing)

Die Schwungphase beginnt **nach** dem Ende einer Standphase und endet mit dem **Beginn der
nächsten Standphase desselben Fußes**. Sie wird nur gewertet, wenn sie mindestens
`min_swing_duration_ms` dauert.

### Gangzyklus (gait cycle)

Ein Gangzyklus reicht von einem **Kontaktbeginn** eines Fußes bis zum **nächsten
Kontaktbeginn desselben Fußes** (`gait_cycle_duration_ms`).

---

## Kontaktmuster (regelbasierte Klassifikation)

Pro Schritt wird ein **primäres Kontaktmuster** bestimmt; zusätzlich können
**Verteilungs-Hinweise** ergänzt werden.

| Muster | Bedingung | Hinweis |
|--------|-----------|---------|
| `heel_strike_normal` | S1 zuerst; S2/S3 folgen erst nach > `flat_foot_time_window_ms` | „Klassischer Fersenaufsatz." |
| `fast_flat_foot_contact` | S1 zuerst, aber S2/S3 innerhalb `flat_foot_time_window_ms` | „… Vorfuß folgte sehr schnell …" |
| `forefoot_strike_with_late_heel_contact` | S2/S3 zuerst; S1 später in derselben Standphase | „Vorfuß zuerst, Ferse folgte später …" |
| `forefoot_strike_no_heel_contact` | S2/S3 zuerst; S1 nie aktiv | „Vorfuß belastet, ohne messbaren Fersenkontakt." |
| `lateral_dominant` | `lateral_ratio` − `medial_ratio` > `medial_lateral_threshold` | „Erhöhte laterale Vorfußbelastung." |
| `medial_dominant` | `medial_ratio` − `lateral_ratio` > `medial_lateral_threshold` | „Erhöhte mediale Vorfußbelastung." |
| `early_medial_shift` | S1 zuerst; S3 sehr früh; S2 niedrig/später | „Frühe mediale Druckverlagerung." |
| `weak_forefoot_loading` | S2+S3 sehr niedrig im Vergleich zur Ferse | „Reduzierte Vorfußbelastung." |
| `unclear` | keine Regel passt klar | „Kein eindeutiges Kontaktmuster …" |

---

## Medial/Lateral-Analyse

Auf Basis der Vorfuß-Peaks:

```
forefoot_pressure = peak_S2 + peak_S3
medial_ratio      = peak_S3 / (peak_S2 + peak_S3)   # medial (große Zeh)
lateral_ratio     = peak_S2 / (peak_S2 + peak_S3)   # lateral (kleine Zeh)
```

Division durch 0 wird sicher behandelt (Ergebnis 0.0). Überschreitet die Differenz
`medial_lateral_threshold`, wird die entsprechende Seite als dominant markiert.

---

## Links-Rechts-Analyse

Verglichen werden u. a.:

- Schrittzahlen & Gangzyklus-Zahlen pro Seite
- durchschnittlicher **Peak-** und **Gesamtdruck** pro Seite
- durchschnittliche **Stand-/Schwungphasendauer** und das **Stand-/Schwung-Verhältnis**
- durchschnittliche **mediale/laterale Ratio**
- **prozentuale Lastdifferenz** und **dominante Seite**
- **prozentuale Verteilung der Kontaktmuster** je Seite

Liegt eine Seite um mehr als `asymmetry_threshold_percent` höher belastet, erscheint ein
neutraler Hinweis (z. B. „Die rechte Seite wurde im Durchschnitt stärker belastet.").

---

## Module

| Datei | Aufgabe |
|-------|---------|
| `config.py` | Alle Parameter zentral + automatische Sampling-Rate-Schätzung |
| `data_loader.py` | CSV laden, Pflichtspalten prüfen, klare Fehlermeldungen |
| `preprocessing.py` | NaN/negative Werte behandeln, Glättung, optionale Normalisierung |
| `step_detection.py` | Schritt-, Stand-, Schwungphasen- und Gangzykluserkennung (L/R) |
| `step_features.py` | Kennzahlen pro Schritt (Peaks, Aktivierung, Ratios, Timing) |
| `gait_classification.py` | Regelbasierte Kontaktmuster-Klassifikation |
| `left_right_analysis.py` | Links-Rechts-Vergleich + Asymmetrie-Hinweise |
| `visualization.py` | matplotlib-Plots (Zeitreihen, Schritte, Balken, Tabelle) |
| `main.py` | Pipeline + Tabellenausgabe |
| `generate_sample_data.py` | Erzeugt `sample_data.csv` (synthetisch) |
| `sample_data.csv` | Beispiel-Datensatz (~20 Schritte je Fuß) |

---

## Start

```bash
# Beispiel-Datensatz analysieren
python main.py sample_data.csv

# ohne Argument wird sample_data.csv automatisch genutzt
python main.py

# Beispiel-CSV neu erzeugen
python generate_sample_data.py
```

Die Plots werden als PNG im Ordner `output/` gespeichert (matplotlib läuft mit dem
nicht-interaktiven Backend „Agg", damit das Skript auch ohne Display nicht blockiert).

### Abhängigkeiten

```bash
pip install -r requirements.txt
```

---

## Ausgaben

1. **Step-Level-Tabelle** – pro Schritt: Timing, erster Sensor, Aktivierungsreihenfolge,
   Kontaktmuster, Peaks, medial/lateral Ratio und Klassifikationshinweise.
2. **Summary-Tabelle** – Gesamtschritte, Schritte je Seite, dominante Seite, Lastdifferenz,
   durchschnittliche Stand-/Schwungdauern und Stand-/Schwung-Verhältnis.
3. **Kontaktmuster-Verteilung** je Seite (in %).
4. **6 Visualisierungen** im Ordner `output/`.
