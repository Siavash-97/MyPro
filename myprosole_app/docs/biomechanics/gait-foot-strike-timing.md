# Brainstorming: Adaptive Fußaufsatz-Erkennung (Ferse vs. Vorfuß) bei variabler Person & Geschwindigkeit

> Status: **Abgestimmt (Cursor-Agent + externer Bot) – noch nicht implementiert.**
> Zweck: Input für einen zweiten Bot, um Meinung/Gegenvorschläge einzuholen.
> Es geht um eine **technische Screening-Heuristik**, **keine medizinische Diagnose.**

## 0. Worum geht es konkret?
In der Schritterkennung (`myprosole_analysis/step_features.py`,
`gait_classification.py`) bestimmen wir pro Schritt u. a.:
- `first_active_sensor` (S1=Ferse, S2=lateraler Vorfuß, S3=medialer Vorfuß)
- `activation_order` (z. B. `S1->S2->S3`)
- `heel_to_forefoot_time_ms` = Zeit von Fersenkontakt bis erstem Vorfußkontakt

Daraus wird grob klassifiziert: `heel_strike_normal`,
`fast_flat_foot_contact`, `forefoot_strike_*` usw.

**Problem (Kern der Diskussion):**
Die Klassifikation hängt aktuell an **festen Zeit-Schwellen in Millisekunden**.
Der zeitliche Abstand „Ferse → Vorfuß" ist aber **stark abhängig von Person und
Geschwindigkeit**:
- Läufer/schnelles Gehen → Standphase kürzer → alle Abstände kleiner.
- Starker Fersenläufer → großer, klarer Abstand Ferse→Vorfuß.
- Leichter Fersenläufer → kleiner, evtl. unzuverlässiger Abstand.
- Es gibt **keine festen ms-Werte**, die „echter Fersenlauf" vs. „leichter
  Fersenlauf" sauber trennen, weil der Referenzwert pro Person/Tempo wandert.

## 1. Aktuelle feste Schwellen (das, was wir ablösen/relativieren wollen)
Aus `myprosole_analysis/config.py`:
- `SENSOR_THRESHOLD = 30.0` (absoluter Rohwert für „aktiv")
- `FLAT_FOOT_TIME_WINDOW_MS = 120.0` (Ferse→Vorfuß darunter = flacher Aufsatz)
- `LATE_HEEL_CONTACT_THRESHOLD_MS = 150.0`
- `MEDIAL_LATERAL_THRESHOLD = 0.20`
- Abtastrate Default `100 Hz` (dt = 10 ms) → Zeitauflösung der Aktivierung ist
  durch das Sample-Raster begrenzt.

Klassifikationsregel heute (vereinfacht, `gait_classification.py`):
```
first == S1 und (forefoot_delay - t_s1) <= FLAT_FOOT_TIME_WINDOW_MS  -> flacher Aufsatz
first == S1 und größer                                              -> klassischer Fersenaufsatz
first in (S2,S3)                                                    -> Vorfußaufsatz (+/- späte Ferse)
```
→ **Eine harte 120-ms-Grenze entscheidet** über die Einordnung. Genau das ist
bei variabler Geschwindigkeit/Person fragil.

## 2. Variante B (vom Nutzer gewünscht): gleichzeitige Aktivierung abbilden
Heute liefert `first_active_sensor` immer **genau einen** Sensor. Bei
zeitgleicher Aktivierung (gleiches Sample) entscheidet eine feste Priorität
(S1>S2>S3) – kein kombinierter Eintrag.

**Vorschlag B:**
- Wenn zwei Sensoren innerhalb einer **Toleranz** aktiv werden, beide eintragen,
  z. B. `first_active_sensor = "S1+S2"`, `activation_order = "S1+S2->S3"`.
- Zusätzliche Spalte `simultaneous_sensors` (Liste) und ein Flag, damit die
  bestehende Logik/Tests (die einen einzelnen String erwarten) nicht brechen.

**Wichtige Verfeinerung (Nutzer-Idee):** Die Toleranz darf **nicht fix in ms**
sein, sondern sollte **relativ** sein (siehe Abschnitt 3), weil „gleichzeitig"
bei langsamem Gehen anders aussieht als beim Sprint.

## 3. Kernidee: von absoluten ms zu RELATIVEN / ADAPTIVEN Größen
Vorschläge, in Reihenfolge zunehmender Tiefe:

### 3.1 Normierung auf die Standphase (geschwindigkeitsrobust)
Statt `heel_to_forefoot_time_ms` (absolut) zusätzlich:
```
heel_to_forefoot_ratio = heel_to_forefoot_time_ms / stance_duration_ms
```
- Unabhängig vom Tempo, weil die Standphase mit der Geschwindigkeit skaliert.
- Schwellen dann als **Prozent der Standphase** statt fixe ms
  (z. B. „Vorfuß folgt in < 15 % der Standphase = flach").

### 3.2 Personen-adaptive Baseline über mehrere Schritte
Pro Person/Session über N Schritte (es gibt bereits
`ROLLING_WINDOW_STEPS = 5`) eine Verteilung bilden:
- Median + Streuung (IQR/Stdabw.) von `heel_to_forefoot_ratio`.
- Einordnung relativ: z. B. **z-Score** je Schritt gegen die persönliche
  Baseline → „dieser Schritt ist für DICH ein ausgeprägter / leichter
  Fersenaufsatz".
- Vorteil: löst exakt das Problem „kein universeller fester Wert" – wir
  vergleichen die Person mit sich selbst.

### 3.3 Geschwindigkeits-/Kadenz-Schätzung als Kontext
- Aus `gait_cycle_duration_ms` bzw. Kadenz (Schritte/min) den **Tempo-Bereich**
  schätzen.
- Optional: Schwellenfenster **als Funktion der Standphasendauer skalieren**
  (z. B. `window_ms = k * stance_duration_ms`), statt fix 120 ms.
- Min/Max-Zeiten über die Messung nehmen (langsamster vs. schnellster Schritt)
  und prüfen, wie sich das Muster mit dem Tempo verändert (Stabilität).

### 3.4 Kontinuierlicher „Heel-Strike-Index" statt harter Klassen
- Score 0..1 aus mehreren relativen Merkmalen:
  - relative Aktivierungsreihenfolge (Ferse zuerst?),
  - `heel_to_forefoot_ratio`,
  - Druckverhältnis Ferse/Vorfuß (Peak & Impuls),
  - Konsistenz über Schritte.
- Ausgabe als Spektrum (z. B. „eher Vorfuß ↔ flach ↔ eher Ferse") + Stärke,
  statt 0/1. Das bildet „leichter vs. starker Fersenlauf" natürlich ab.

### 3.5 Variabilität als eigenes Merkmal
- Streuung der Muster über Schritte = wie konsistent läuft die Person.
- Hohe Variabilität bei steigendem Tempo kann selbst ein Hinweis sein.

## 4. Zukunft: IMU (Gyroskop + Beschleunigung) als Hilfssignal
Wenn später IMU-Daten verfügbar sind:
- **Fußwinkel / Foot-Pitch bei Initial Contact** (Gyro-Integration) ist in der
  Literatur das nähere Korrelat für Rück-/Mittel-/Vorfußaufsatz als reine
  Drucktiming-Werte.
- **Vertikale/anterior-posteriore Beschleunigungsspitze** beim Aufsatz
  (Impact-Peak) hilft, Aufsatzart und -härte zu trennen.
- Fusion: Druck-Timing (was) + IMU-Winkel/Impact (wie/Härte) → robustere,
  weniger schwellenabhängige Einordnung.
- Realistischer Schritt: IMU zunächst nur zur **Validierung/Kalibrierung** der
  druckbasierten Heuristik nutzen (Ground Truth pro Person), dann Schwellen/
  Scores personalisieren.

## 5. Konkrete neue Felder, die wir einführen könnten (Vorschlag)
Pro Schritt zusätzlich:
- `heel_to_forefoot_ratio` (Anteil der Standphase)
- `simultaneous_sensors` (Liste) + `first_active_sensor` ggf. als „S1+S2"
- `cadence_spm` / `speed_proxy` (aus gait_cycle)
- `heel_strike_index` (0..1, kontinuierlich)
Auf Session-/Personen-Ebene:
- `baseline_heel_to_forefoot_ratio` (Median, IQR)
- pro Schritt `heel_to_forefoot_zscore`

## 6. Offene Fragen an den zweiten Bot
1. Ist **Normierung auf die Standphase** (`heel_to_forefoot / stance`) der
   richtige erste Schritt zur Geschwindigkeitsrobustheit – oder gibt es eine
   bessere etablierte Normierung (z. B. % des Gangzyklus, dimensionslose
   Froude-Zahl)?
2. Wie sinnvoll ist eine **personen-adaptive Baseline (z-Score)** bei nur ~5–20
   Schritten? Wie viele Schritte braucht man minimal für eine stabile Baseline?
3. Ist ein **kontinuierlicher Index** robuster als feste Klassen – und wie würde
   man ihn ohne klinische Ground Truth sinnvoll kalibrieren?
4. Welche **Toleranz für „gleichzeitig"** ist sinnvoll, wenn das Sample-Raster
   bei 100 Hz nur 10 ms beträgt? Relativ (z. B. 1–2 Samples / % der Standphase)?
5. Welche **IMU-Merkmale** (Foot-Pitch, Impact-Peak, Tibia-Winkel) lohnen sich
   am meisten, und wie kombiniert man sie am robustesten mit dem Drucktiming?
6. Welche **Fehlerquellen** übersehen wir (Sensorrauschen, Schwelle 30 Rohwert,
   Glättungsfenster verschmiert Flanken, Drift, unterschiedliche Schuhe)?
7. Macht eine **Geschwindigkeits-skalierte Schwelle** (`k * stance_duration`)
   Sinn, und welche Größenordnung für `k`?

## 7. Meine Meinung / Empfehlung (Cursor-Agent)
- **Sofort sinnvoll & risikoarm:** `heel_to_forefoot_ratio` (Normierung auf
  Standphase) zusätzlich berechnen und die bestehende harte 120-ms-Grenze durch
  eine **relative** Grenze ergänzen. Das adressiert das Geschwindigkeitsproblem
  am direktesten, ohne große Architekturänderung.
- **Variante B** würde ich mit **relativer Toleranz** umsetzen und als
  **Zusatzspalte** (`simultaneous_sensors`), damit `first_active_sensor` ein
  einzelner Wert bleibt und nichts Bestehendes bricht. So bekommst du die
  Gleichzeitigkeits-Info, ohne Tests/Frontend zu zerstören.
- **Personen-adaptive Baseline (z-Score)** ist konzeptionell der beste Weg für
  „starker vs. leichter Fersenlauf", aber erst belastbar ab genug Schritten.
  Würde ich als **zweite Stufe** machen, nicht im ersten Wurf.
- **Kontinuierlicher Heel-Strike-Index** ist langfristig die sauberste Lösung
  (Spektrum statt harter Klassen) und passt perfekt zur „keine festen Werte"-
  Problematik. Mittelfristiges Ziel.
- **IMU** würde ich klar als **spätere Validierungs-/Kalibrierungsquelle**
  einplanen, nicht als Voraussetzung. Die druckbasierte Heuristik sollte auch
  ohne IMU brauchbar bleiben; IMU verbessert/verankert sie.
- **Reihenfolge-Empfehlung:** (1) Ratio + relative Schwelle, (2) Variante B mit
  relativer Toleranz, (3) personen-adaptive Baseline/z-Score, (4) kontinuierl.
  Index, (5) IMU-Fusion.

## 8. Meinung externer Bot (2026-06-01)
**Grundsätzlich:** Richtung sehr gut, biomechanisch deutlich sinnvoller als feste
ms-Schwellen.

**Zustimmung:**
- Normierung auf Standphase (`heel_to_forefoot_ratio`) = wichtigster Schritt.
- Personenadaptive Baseline („Vergleich mit sich selbst") wertvoller als
  universelle Norm – besonders für Verlauf, Fatigue, Reha, Sturzrisiko.
- Kontinuierlicher Heel-Strike-Index (0–100) langfristig beste Lösung.
- IMU (Foot Pitch, Impact) hat enormes Potenzial; Druck allein stößt irgendwann
  an Grenzen.

**Anpassungen / Vorsicht:**
- **z-Score:** `ROLLING_WINDOW_STEPS = 5` zu wenig für stabile Baseline.
  Minimum eher **10–15 Schritte**, besser **20–30**.
- **Gleichzeitige Aktivierung:** bei 100 Hz (10 ms) oft Sample-Artefakt.
  Definition: **simultan = gleiche Sample-Nummer** – dokumentieren, nicht
  überinterpretieren. Zunächst nur erfassen, noch nicht klassifizieren.
- **Größte Schwäche aktuell:** nicht 120 ms, sondern **`SENSOR_THRESHOLD = 30`**.
  Alle Folgeparameter hängen davon ab. Früh Sensitivitätstest (20/25/30/35/40)
  und Stabilität prüfen.

**Konkrete Phasen (externer Bot):**
1. Sofort: `heel_to_forefoot_ratio`
2. Zusätzlich: `stance_duration`, `cadence`, `gait_cycle_duration` speichern
3. Gleichzeitige Aktivierung (`S1+S2` etc.) nur dokumentieren
4. Heel-Strike-Index 0–100 statt harter Kategorien
5. IMU-Fusion

**Kernaussage:** Kein universeller ms-Wert für „richtigen" Fersenaufsatz → früh
auf relative, geschwindigkeitsabhängige Kennzahlen umstellen.

## 9. Abgleich Agent vs. externer Bot (Konsens)
| Thema | Agent | Externer Bot | Konsens |
|-------|-------|--------------|---------|
| `heel_to_forefoot_ratio` | Phase 1, sofort | Phase 1, sofort | **Ja – höchste Priorität** |
| Relative statt absolute Zeiten | Ja | Ja | **Ja** |
| Personen-Baseline / z-Score | Phase 2–3, ab genug Schritten | Ja, aber min. 10–15, besser 20–30 | **Ja, Fenster vergrößern** (nicht 5) |
| Heel-Strike-Index | Mittelfristig | Phase 4 | **Ja, langfristig** |
| Gleichzeitige Aktivierung | Zusatzspalte, relative Toleranz | Gleiche Sample-Nummer, nur dokumentieren | **Ja – erfassen, nicht klassifizieren** |
| IMU | Spätere Kalibrierung | Phase 5, großes Potenzial | **Ja** |
| SENSOR_THRESHOLD | in Fehlerquellen erwähnt | **Wichtigster Hebel vor 120 ms** | **Neu: Sensitivitätstest als Phase 0/1b** |

**Gemeinsame Umsetzungs-Reihenfolge (final):**
0. **Sensitivität `SENSOR_THRESHOLD`** (20–40) auf Stabilität prüfen
1. `heel_to_forefoot_ratio` + relative Schwelle neben bestehender ms-Logik
2. `stance_duration`, `cadence`, `gait_cycle_duration` als Standardfelder
3. `simultaneous_sensors` (gleiche Sample-Nummer) – nur dokumentieren
4. Personen-Baseline ab ≥10–15 Schritten (nicht 5)
5. Heel-Strike-Index 0–100
6. IMU-Fusion
- **Wichtig:** Sprachlich weiter neutral/Screening bleiben – kein „Diagnose".
