# Erkenntnis- & Gesprächs-Log (Biomechanik)

Chronologische Sammlung von Erkenntnissen, Entscheidungen und Meinungen.
Neueste Einträge oben. Format pro Eintrag:

```
## YYYY-MM-DD – Titel
- Quelle: (Gespräch / externer Bot / Studie / eigener Test)
- Status: Idee | in Diskussion | entschieden | umgesetzt | verworfen
- Inhalt: ...
- Folge für Code/Docs: ...
```

---

## 2026-06-02 – Produktvision: 4 Ebenen (Profil → Muster → Ermüdung → Plan)
- Quelle: Nutzer / Produkt-Brainstorming
- Status: **in Diskussion** (Dokumentation: `docs/produkt-vision-laufcoach.md`)
- Inhalt: Langfristig Entkopplung `ObservedPattern` → `TrainingGoal` → Übungsauswahl
  statt festem `diagnosis_id → Übungen`. Ebenen: (1) Stammdaten/Profil,
  (2) Laufverhalten (nah am MVP), (3) Ermüdung über Segment/Distanz,
  (4) Trainingssystem Technik/Mobilität/Kraft. Gleiches Muster (z. B. Fersenläufer)
  → unterschiedliche Empfehlung je Alter/Risiko/Ziel.
- Folge für Code/Docs: Phase A = Katalog-Tags + `select_exercises(profile)`;
  Phase C = `fatigue_analysis` mit Segment-Metriken; Risiko-Sprache weiter Screening.

---

## 2026-06-01 – Brainstorming-Bot Review zu research-questions.md
- Quelle: externer Bot (Nutzer geteilt)
- Status: **entschieden** (strategische Leitlinien, Code teilweise offen)
- Inhalt: Dokument fachlich stark. Kernaussagen: (1) Messqualität/Kalibrierung P0,
  Raw ≠ Druck; (2) 3 FSR gut für Timing/Symmetrie, nicht für COP/klinische Normen;
  (3) 60/40 nur Stehen, Gang schrittbasiert ohne 60/40-Heatmap; (4) Ratio primär,
  Heel-Strike-Index langfristig; (5) Baseline min. 10–15 Schritte; (6) IMU später
  Foot pitch + Impact; (7) geschärfte Roadmap Messqualität → Modus → Schritt → …
- Folge für Code/Docs: `research-questions.md` §12–13, `sources.md` erweitert.
  **Offen:** Modus-Erkennung, Gang-Heatmap von 60/40 trennen, Raw-Labeling UI.

## 2026-06-01 – research-questions.md erstellt
- Quelle: Gespräch (Nutzer)
- Status: umgesetzt
- Inhalt: Zentrale Forschungsfragen-Datei für Brainstorming-Bots (40 Fragen,
  Prioritäten, Copy-Paste-Prompt).
- Folge für Code/Docs: `docs/biomechanics/research-questions.md`, Index in README.

## 2026-06-01 – Phase 0/1 umgesetzt (Ratio, Simultan, Sample-Profile)
- Quelle: Gespräch + externer Bot + Implementierung
- Status: **umgesetzt**
- Inhalt: `heel_to_forefoot_ratio`, `cadence_spm`, `simultaneous_sensors`
  (gleiche Sample-Nummer), `FLAT_FOOT_STANCE_RATIO=0.15` neben 120 ms.
  Sechs synthetische Profile in `myprosole_analysis/sample_data/`.
  `threshold_sensitivity.py` prueft Stabilitaet bei Threshold 20–40.
- Folge für Code/Docs: `step_features.py`, `gait_classification.py`,
  `generate_sample_data.py`, `main.py` (neue Tabellenspalten).

## 2026-06-01 – Abgleich Fußaufsatz-Timing (externer Bot + Cursor-Agent)
- Quelle: externer Bot (Nutzer geteilt) + Cursor-Agent
- Status: **entschieden** (Roadmap, noch nicht implementiert)
- Inhalt: Beide bestätigen Normierung auf Standphase als wichtigsten Schritt.
  Personen-Baseline sinnvoll, aber z-Score erst ab 10–15 (besser 20–30)
  Schritten, nicht bei `ROLLING_WINDOW_STEPS = 5`. Gleichzeitige Aktivierung =
  gleiche Sample-Nummer, nur dokumentieren. Größter Hebel vor 120 ms:
  **`SENSOR_THRESHOLD`-Stabilität** testen (20–40). Heel-Strike-Index 0–100
  langfristig; IMU Phase 5.
- Folge für Code/Docs: Gemeinsame Phasen-Roadmap in
  `gait-foot-strike-timing.md` §9. Nächster Code-Schritt: Phase 0/1
  (`heel_to_forefoot_ratio` + Threshold-Sensitivität).

## 2026-06-01 – Fußaufsatz-Timing soll adaptiv statt feste ms-Werte sein
- Quelle: Gespräch (Nutzer)
- Status: entschieden (Brainstorming + Bot-Feedback eingearbeitet)
- Inhalt: Abstand Ferse→Vorfuß variiert stark mit Person und Geschwindigkeit;
  feste ms-Schwellen (z. B. `FLAT_FOOT_TIME_WINDOW_MS = 120`) trennen „starker
  vs. leichter Fersenlauf" nicht zuverlässig. Ideen: Normierung auf Standphase
  (`heel_to_forefoot_ratio`), personen-adaptive Baseline/z-Score über mehrere
  Schritte, Tempo-/Kadenz-Schätzung, kontinuierlicher Heel-Strike-Index, später
  IMU (Gyro/Beschleunigung) zur Kalibrierung.
- Folge für Code/Docs: Details in `gait-foot-strike-timing.md`. Noch keine
  Code-Änderung. Variante B (gleichzeitige Aktivierung) gewünscht, mit
  relativer Toleranz + Zusatzspalte `simultaneous_sensors`.

## 2026-06-01 – Druckverteilung: Screening statt Norm
- Quelle: Gespräch + externer Bot
- Status: umgesetzt
- Inhalt: 60/40 Ferse/Vorfuß ist für statisches Stehen plausibel, aber keine
  harte medizinische Norm; für Gangdaten ungeeignet. Raw-Mittelwerte sind nicht
  normfähig (Standard wären Peak/Mean Pressure, Force, Contact Area,
  Pressure-Time-Integral, kalibriert in kPa/% Körpergewicht).
- Folge für Code/Docs: Konstanten umbenannt
  (`REFERENCE_HEEL_SHARE_STATIC`, `REFERENCE_FOREFOOT_SHARE_STATIC`,
  `HEURISTIC_TOLERANCE`, `HEURISTIC_STRONG_DEVIATION`) in
  `core/domain/pressure_analysis.py`; Texte/Disclaimer auf „technischer Hinweis,
  keine Diagnose" umgestellt; UI-Hinweis in `modules/step_analysis/__init__.py`.
  Details in `pressure-distribution.md`.

## 2026-06-01 – Druck-Replay Phase 1–3
- Quelle: Gespräch + externer Bot
- Status: umgesetzt
- Inhalt: Frame-für-Frame-Animation der 3 FSR-Sensoren je Fuß (kein
  Session-Mittelwert). Modi: gesamte CSV, Einzelschritt mit Aktivierungsfolge,
  Zeitleiste L/R + Plotly-Kontextdiagramm.
- Folge für Code/Docs: `modules/foot_pressure_replay/`, `core/domain/foot_replay.py`,
  `core/domain/replay_canvas.py`, `docs/biomechanics/foot-replay-concept.md`.
  Phase 4 (Live ESP32) und 5 (Export) offen.
