# Bericht: Druckverteilungs-Analyse (MyProSole) – Kennzahlen, Schwellenwerte & Normen-Einordnung

> Zweck: Dokumentation der aktuell verwendeten Mess- und Bewertungslogik der
> Druckkarte sowie Einordnung, inwieweit dafür anerkannte Normen existieren.
> **Kernaussage:** Die Logik ist eine **Screening-/Hinweislogik**, **keine
> medizinische Normprüfung oder Diagnose.**

## 1. Kontext / Zweck
Die App analysiert plantare Druckdaten beider Füße aus einer Sensoreinlage
(CSV-Import, z. B. 2300 Zeilen Zeitreihe). Pro Fuß gibt es **6 Sensoren** in
drei Regionen:
- **Ferse** (heel)
- **Medialer Vorfuß** (medial forefoot)
- **Lateraler Vorfuß** (lateral forefoot)

## 2. Rohdaten / Messgrößen
- Pro Sensor: **Rohwert** = arithmetischer **Mittelwert** der Sensorspalte über
  die gesamte Messung (Einheit: unkalibrierte „raw"-Einheiten, kein kPa/N).
- Pro Fuß: **Gesamtdruck** = Summe der Region-Rohwerte (`total_pressure_raw`).
- Beispiel: linker Fuß ≈ 351 raw, rechter Fuß ≈ 348 raw.

## 3. Abgeleitete Kennzahlen
1. **Links/Rechts-Verteilung** in % des Gesamtdrucks beider Füße (nur Anzeige).
2. **Fersen-/Vorfuß-Verteilung pro Fuß**:
   - `heel_share = Ferse / (Ferse + Vorfuß)`
   - `forefoot_share = Vorfuß / (Ferse + Vorfuß)`, `Vorfuß = medial + lateral`.
3. **Abweichung vom Referenzwert**: `deviation = |heel_share − Referenz|` (PP).

## 4. Aktuell verwendete Referenzwerte & Heuristik-Schwellen
| Parameter (interner Name) | Wert | Bedeutung |
|---------------------------|------|-----------|
| `REFERENCE_HEEL_SHARE_STATIC` | **0,60 (60 %)** | Referenz-Fersenanteil (statisches Stehen) |
| `REFERENCE_FOREFOOT_SHARE_STATIC` | **0,40 (40 %)** | Referenz-Vorfußanteil (statisches Stehen) |
| `HEURISTIC_TOLERANCE` | **0,08 (8 PP)** | Innerhalb davon „im Referenzbereich" |
| `HEURISTIC_STRONG_DEVIATION` | **0,22 (22 PP)** | Ab hier „deutliche Abweichung" (max. Hinweis) |

**Wichtig:** Dies sind **Referenz-/Heuristikwerte**, **keine medizinischen
Normen**. Schweregrad skaliert linear:
`severity = (deviation − 0,08) / (0,22 − 0,08)`, begrenzt auf [0, 1].

**Datenqualität:** Vollständige Bewertung nur, wenn alle drei Regionen
(Ferse, medial, lateral) Sensoren liefern; sonst Status „incomplete".

## 5. Farb-/Visualisierungslogik (nur Darstellung, nicht klinisch)
Heatmap-Farbe codiert eine „Intensität" (0–1):
0,00 Blau → 0,25 Cyan → 0,48 Grün → 0,70 Gelb → 0,85 Orange → 1,00 Rot.

- Kein/kaum Druck → 0,0 (Blau).
- Im Referenzbereich → fixe Intensität 0,32 (neutral) für beide Zonen.
- Auffällige Zone → `0,38 + 0,62 × severity` (8 PP → 0,38; ≥ 22 PP → 1,0 Rot).
- Unvollständige Daten → roher Relativdruck, gedeckelt auf max. 0,62 (Orange).
- Ohne Balance-Bewertung → `Sensorwert / max. Sensorwert beider Füße`.

## 6. Normen-Einordnung (externe Bewertung)
Zusammengefasste fachliche Rückmeldung zur Frage „Gibt es Normen?":

| Punkt | Einschätzung |
|-------|--------------|
| **Ferse/Vorfuß 60/40** | Für **statisches Stehen** plausibel (ca. 60 % Rückfuß/Ferse, 40 % Vorfuß in der Literatur). Für **Gehen/Laufen** nicht stabil, da die Last wandert (Ferse → Mittelfuß → Vorfuß/Abstoß). |
| **8 PP Toleranz** | Als technische/heuristische App-Toleranz vertretbar. Als medizinischer Grenzwert **nicht belegt**. |
| **22 PP „deutlich auffällig"** | Plausibel als „starker Hinweis", aber **nicht klinisch validiert**. Besser: „deutliche Abweichung vom Referenzbereich". |
| **Links/Rechts** | 50/50 ist im Stand idealisiert; leichte Asymmetrien sind normal. Für Gangdaten **keine** einheitliche universelle Asymmetrie-Norm. |
| **Raw-Mittelwert über gesamte Messung** | Für Prototyp ok, biomechanisch schwach. Standard: **Peak Pressure, Mean Pressure, Force, Contact Area, Pressure-Time Integral** (kPa, N, N·s, % Körpergewicht). |
| **Unkalibrierte Raw-Werte** | **Nicht normfähig**. Ohne Kalibrierung nur intra-individueller Vergleich, kein Abgleich gegen medizinische Normwerte. |

### Quellen
- Plantar Pressure and Postural Load Distribution: https://www.mdpi.com/2075-1729/15/9/1354
- Identification of Foot Pathologies Based on Plantar Pressure: https://www.mdpi.com/1424-8220/15/8/20392
- Pedobarography – Aetna Medical Clinical Policy Bulletins: https://www.aetna.com/cpb/medical/data/200_299/0294.html
- Validity and repeatability of in-shoe pressure systems: https://www.sciencedirect.com/science/article/abs/pii/S0966636216000370

## 7. Abgeleitete Entscheidungen für MyProSole
- **Sprache:** Keine pathologische/diagnostische Formulierung. Statt „abnormal/pathologisch":
  > „Die gemessene Druckverteilung weicht vom erwarteten Referenzmuster ab.
  > Die Bewertung basiert auf relativen Rohwerten und dient als technischer
  > Hinweis, nicht als klinische Diagnose."
- **Benennung:** Konstanten als **Referenz/Heuristik** kennzeichnen
  (`REFERENCE_*_STATIC`, `HEURISTIC_*`), nicht als „Target/Norm".
- **MVP-Schwellen** bleiben (0,60 / 0,40 / 0,08 / 0,22), aber explizit als
  Referenz für **statisches Stehen**.

## 8. Nächste sinnvolle Schritte (Backlog, nicht im MVP)
- **Statisch vs. dynamisch strikt trennen** – die 60/40-Logik gilt für ruhiges Stehen.
- Für Gangdaten pro Schritt analysieren statt Mittelwert:
  - Initial Contact: Ferse zuerst?
  - Loading Response: Ferse + Vorfuß?
  - Midstance: Druckverteilung stabil?
  - Push-Off: medialer/lateraler Vorfuß aktiv?
  - Left/Right Symmetry: Kontaktzeit, Peak, Impuls
- Kalibrierung auf physikalische Einheiten (kPa / % Körpergewicht), um
  überhaupt normfähig zu werden.
