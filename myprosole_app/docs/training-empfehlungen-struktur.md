# Training- / Übungsempfehlungen – Architektur & Optimierung

> Stand: Juni 2026 · MyProSole `myprosole_app`  
> Zweck: Überblick für Mensch + Bot (Brainstorming, Refactoring, Produktideen).

**Produktziel (Langfrist):** Vom Muster→Übung-MVP zum persönlichen Laufcoach mit Profil, Ermüdung und Trainingsplan – siehe [`produkt-vision-laufcoach.md`](produkt-vision-laufcoach.md).

Im Code heißt das Feature **„Analyse & Empfehlungen“** (`exercise_recommendations`), die Fachlogik liegt in **`core/domain/recommendations.py`**. Es gibt **kein** separates Modul namens `training_*` – gemeint ist diese regelbasierte Pipeline von Sensor-Daten → Muster → Übungsvorschläge.

---

## Kurzfassung

| Schicht | Pfad | Rolle |
|--------|------|--------|
| Daten & Pipeline | `modules/step_analysis/` | CSV → Druckanalyse, Events, Schrittmetriken → `ctx.set_param("analysis", …)` |
| **Domain (Kern)** | `core/domain/recommendations.py` | Schwellen → `Diagnosis` → `ExerciseRecommendation` |
| **Übungskatalog** | `core/domain/exercises_catalog.py` | Strukturierte Übungen + Mapping `diagnosis_id → exercise_id` |
| **UI Tab** | `modules/exercise_recommendations/` | Tab „Empfehlungen“, Metriken, Muster, Buttons zur Übungsseite |
| **Übungsseite** | `modules/exercises/` + `pages/2_Übungen.py` | Katalog, Filter „aus Analyse“, Session-State-Navigation |

**Prinzip:** Rein **regelbasiert** (if/threshold), **kein ML**, **keine LLM-Integration**. Mehrere Muster können gleichzeitig aktiv sein; es gibt kein explizites Ranking/Priorisierung außer der Reihenfolge in der Diagnose-Liste.

---

## Datenfluss (End-to-End)

```mermaid
flowchart TB
    subgraph upload [Upload]
        CSV[shared_data / raw_df]
    end

    subgraph step [step_analysis – einmal pro Rerun]
        LOAD[load_pressure_dataframe]
        PRESS[analyze_pressure → PressureAnalysisResult]
        EVT[detect_events]
        MET[compute_step_metrics → summary]
        CTX["ctx.set_param('analysis', {df, events, steps_df, summary, pressure_analysis})"]
        LOAD --> PRESS --> EVT --> MET --> CTX
    end

    subgraph rec [exercise_recommendations Tab]
        READ[ctx.param('analysis')]
        PIPE[analyze_and_recommend]
        UI[Kennzahlen + Muster + Übungskarten]
        READ --> PIPE --> UI
    end

    subgraph domain [core/domain/recommendations.py]
        MS[metrics_snapshot]
        DX[diagnose]
        RX[recommend_exercises]
        MS --> DX --> RX
    end

    subgraph catalog [exercises_catalog.py]
        MAP[_DIAGNOSIS_EXERCISE_IDS]
        CAT[EXERCISE_CATALOG]
    end

    subgraph nav [Navigation]
        SS[session_state: diagnosis_ids, focus_exercise_ids]
        PAGE[pages/2_Übungen.py]
    end

    CSV --> step
    CTX --> rec
    PIPE --> domain
    UI -->|Übungen ansehen| nav
    MAP --> CAT
    nav --> PAGE
```

---

## Domain-Pipeline (`analyze_and_recommend`)

```text
metrics_snapshot(df, events, summary, pressure_analysis?)
    → dict für UI-Metriken

diagnose(df, events, summary, pressure_analysis?)
    → list[Diagnosis]

recommend_exercises(diagnoses)
    → list[ExerciseRecommendation]  (aus _EXERCISE_MAP)
```

**Öffentliche API** (`core/domain/__init__.py` exportiert u. a.):

- `analyze_and_recommend` → `{ metrics, diagnoses, recommendations }`
- `build_exercise_recommendations` → flache `list[dict]` (Legacy-Kompatibilität)
- `diagnosis_to_dict` / `recommendation_to_dict`

---

## Datenmodelle

### `Diagnosis` (erkanntes Muster)

| Feld | Bedeutung |
|------|-----------|
| `id` | Schlüssel für Übungs-Mapping (z. B. `heel_strike_tendency`) |
| `title` | UI-Überschrift (immer mit „Mögliches Muster:“ außer `unremarkable_profile`) |
| `finding` | Fließtext-Befund |
| `metrics` | Zusatz-Kennzahlen für Expander/Caption |

### `ExerciseRecommendation` (Vorschlag pro Muster)

| Feld | Bedeutung |
|------|-----------|
| `diagnosis_id` | Verknüpfung zum Muster |
| `title`, `because`, `goal` | Überschrift, Begründung, Trainingsziel |
| `exercises` | `tuple[str, …]` – **Freitext-Zeilen** (3 Stück pro Muster) |

`recommend_exercises` hängt an `because` noch `(diagnosis.title)` an → leicht redundante Texte in der UI.

---

## Erkannte Muster & Schwellen (MVP, hardcoded)

Konstanten in `recommendations.py` (Kommentar: „später konfigurierbar“):

| Konstante | Wert | Muster-ID |
|-----------|------|-----------|
| `HEEL_DOMINANCE_THRESHOLD` | 0.65 | `heel_strike_tendency` (nur wenn **kein** `pressure_analysis`) |
| `HEEL_LOAD_THRESHOLD_PERCENT` | 55 % | `heel_strike_tendency` (pro Fuß aus Druckanalyse) |
| `LEFT_RIGHT_ASYMMETRY_*` | &lt; 40 % oder &gt; 60 % links | `asymmetric_load_distribution` |
| `LOW_CADENCE_THRESHOLD_SPM` | 155 | `low_cadence` |
| `STEP_CV_THRESHOLD_PERCENT` | 8 % | `high_step_variability` |
| `STANCE_RATIO_THRESHOLD` | 0.68 | `long_stance_phase` |

**Fallback:** Wenn nach allen Regeln **keine** Diagnose → ein Eintrag `unremarkable_profile` („Ausgeglichenes Belastungsmuster“).

### Logik-Details

1. **Druckpfad** (`_pressure_pattern_diagnoses`): nutzt `PressureAnalysisResult` – Fersenanteil pro Fuß (`heel_percentage ≥ 55 %`), Links/Rechts aus `bilateral_summary`.
2. **Legacy-Fersenpfad**: nur wenn `pressure_analysis is None` – vergleicht an `hs_idx` ob `FSR1 > FSR2` (Ferse vs. Vorfuß-Sensor).
3. **Temporal/Gang**: Kadenz, Schrittzeit-CV, Stance-Ratio aus `summary` (von `compute_step_metrics` in der Schrittanalyse).
4. **Mehrfachbefunde:** Alle zutreffenden Regeln werden **parallel** angehängt (kein „nur das stärkste“).

---

## Doppelstruktur: Text vs. Katalog

Aktuell existieren **zwei parallele Quellen** für dieselben Übungen:

| Ort | Inhalt |
|-----|--------|
| `recommendations._EXERCISE_MAP` | Kurze **Strings** pro Übung (Anzeige im Tab „Empfehlungen“) |
| `exercises_catalog.EXERCISE_CATALOG` | Strukturierte `Exercise`-Objekte (id, title, description, steps, `video_url`) |
| `exercises_catalog._DIAGNOSIS_EXERCISE_IDS` | `diagnosis_id → (exercise_id, …)` – Reihenfolge soll zu `_EXERCISE_MAP` passen |

**Risiko:** Texte und IDs können auseinanderlaufen (Copy-Paste-Wartung). Smoke-Test prüft nur Katalog-Import, nicht inhaltliche Gleichheit mit `_EXERCISE_MAP`.

---

## UI-Modul `exercise_recommendations`

- Aktivierung: `config.py` → `"modules.exercise_recommendations"`.
- `analysis_tabs`: Tab `section_key="empfehlungen"`, Label „Empfehlungen“, `order=60`.
- Voraussetzung: `shared_data` (Upload) **und** für Inhalt `ctx.param("analysis")` (von `step_analysis`).
- **Keine eigene Neuberechnung** der Schrittanalyse – liest nur vorbereitetes `analysis`.
- Buttons: `navigate_to_exercises(diagnosis_ids=…, focus_exercise_ids=…)` → `pages/2_Übungen.py`.

### Was die UI **nicht** tut

- Kein Caching von `analyze_and_recommend` (läuft bei jedem Tab-Rerun erneut – billig, aber wiederholbar).
- Keine Verknüpfung mit `modules/gait_analysis` (separate Gang-/Laufanalyse, eigene Hinweise – **fließt nicht** in Empfehlungen ein).
- Keine Speicherung von Empfehlungen über Sessions hinweg (nur Streamlit `session_state` für Übungsnavigation).

---

## Abhängigkeiten (Upstream)

| Quelle | Geliefert für Empfehlungen |
|--------|---------------------------|
| `step_analysis` | `analysis["df"]`, `events`, `summary`, optional `pressure_analysis` |
| `core/domain/pressure_analysis.py` | `per_foot_summary`, `bilateral_summary` |
| Schrittmetriken-Pipeline | `cadence_spm`, `step_time_cv_percent`, `stance_ratio_mean`, … |

Sidebar-Parameter der Schrittanalyse (Glättung, Threshold, min/max Schrittzeit, Kalibrierung) beeinflussen indirekt alle Diagnosen.

---

## Modul-Grenzen (Architektur-Regeln)

- ✅ Fachlogik in `core/domain/` (testbar ohne Streamlit).
- ✅ Feature-UI in `modules/exercise_recommendations/`.
- ✅ Aktivierung nur über `ENABLED_MODULES`.
- ⚠️ Übungsseite nutzt **direkt** `session_state` statt `AppContext` – bewusst für Multipage-Navigation.

---

## Optimierungsmöglichkeiten (Brainstorming-Backlog)

### A. Datenmodell & Single Source of Truth

1. **Katalog als einzige Quelle:** `_EXERCISE_MAP` nur aus `EXERCISE_CATALOG` + `_DIAGNOSIS_EXERCISE_IDS` generieren (oder umgekehrt YAML/JSON laden).
2. **Ein Diagnose-Registry-Objekt:** Schwellen, `id`, UI-Texte, verknüpfte `exercise_ids`, Priorität/Schwere in einer Tabelle/Datei.
3. **Versionierte Regelsets:** z. B. `rules/v1.yaml` für A/B oder Kalibrierung pro Kohorte.

### B. Regel-Engine & Qualität

4. **Konfigurierbare Schwellen:** Sidebar oder `config.py` / Umgebungsvariablen statt Magic Numbers.
5. **Priorisierung:** Bei 4+ Mustern nur Top-2 nach Score (z. B. Abstand zur Schwelle) – weniger UI-Overload.
6. **Konfliktregeln:** z. B. `unremarkable_profile` unterdrücken, wenn echte Muster da sind (aktuell nur via „keine Diagnose“).
7. **Doppelte `heel_strike_tendency`:** Druck- **und** Legacy-FSR-Pfad können theoretisch redundant sein – vereinheitlichen.
8. **Confidence / Evidenz:** `metrics` um „Stärke“ ergänzen (z. B. 58 % vs. 72 % Fersenanteil).
9. **Mindest-Schrittzahl:** Diagnosen erst ab `n_steps_valid ≥ N` (Stabilität).

### C. Integration & Kontext

10. **Gait-Analysis einspeisen:** `modules/gait_analysis` liefert eigene Links/Rechts- und Schritt-Hinweise – in `diagnose()` mergen oder deduplizieren.
11. **IMU später:** Platzhalter in `Diagnosis`-Pipeline für Gyro/Accel-Features.
12. **Verlauf / Longitudinal:** Empfehlungen pro Upload-ID speichern, Delta „besser/schlechter“ zeigen.
13. **`ctx.set_param("recommendations", …)`** in `step_analysis` einmal berechnen → andere Module lesen ohne Recompute (Skalierungsregel aus Projekt-Rules).

### D. UX & Produkt

14. **LLM-Layer (optional):** Regeln liefern strukturiertes JSON; Bot formuliert nur `finding`/`because` – **nicht** Diagnose erfinden.
15. **Trainingsplan:** Woche 1–3 aus 3 Übungen, Progression, Erinnerungen.
16. **Videos:** `video_url` im Katalog ist vorbereitet, UI zeigt Platzhalter – befüllen + CDN.
17. **Export:** PDF/Markdown der Empfehlungen für Therapeut:in.
18. **Disclaimer zentral:** Ein Hinweisblock „Screening, keine Diagnose“ (bereits in Biomechanik-Docs gefordert).

### E. Tests & Observability

19. **Golden-Tests:** Fixture-CSV → erwartete `diagnosis.id`-Liste.
20. **Contract-Test:** Jeder `_DIAGNOSIS_EXERCISE_IDS`-Key hat `_EXERCISE_MAP`-Eintrag und umgekehrt.
21. **Telemetrie (privacy-safe):** welche Muster wie oft (ohne Rohdaten).

### F. Internationalisierung & Content

22. **i18n:** `title`/`finding`/`exercises` aus gettext oder JSON pro Sprache.
23. **Zielgruppen:** Anfänger vs. Wettkampf – unterschiedliche Übungssets pro `diagnosis_id`.
24. **Belastungssteuerung:** Schmerz-Flag, Intensität (leicht/mittel) pro Übung.

---

## Erweiterung: neues Muster hinzufügen (Checkliste)

1. Schwellenlogik in `diagnose()` oder `_pressure_pattern_diagnoses()`.
2. Eintrag in `_EXERCISE_MAP` (`ExerciseRecommendation`).
3. Eintrag in `_DIAGNOSIS_EXERCISE_IDS` + neue `Exercise`(s) in `EXERCISE_CATALOG`.
4. Optional: Biomechanik-KB (`docs/biomechanics/`) mit Begründung/Schwellen dokumentieren.
5. Test in `tests/` (derzeit nur Smoke auf Katalog-Import).

---

## Prompt-Ideen für Bot-Brainstorming

Kopierbar in einen anderen Chat:

```text
Kontext: MyProSole nutzt regelbasierte Übungsempfehlungen (recommendations.py + exercises_catalog.py).
Schwellen sind MVP-hardcoded. Zwei parallele Textquellen (_EXERCISE_MAP vs. EXERCISE_CATALOG).

Aufgabe 1: Entwirf ein einziges Diagnosis-Registry-Format (YAML/JSON) mit Schwellen, Priorität, exercise_ids, UI-Texten.
Aufgabe 2: Wie priorisieren wir max. 2 Empfehlungen ohne wichtige Muster zu verstecken?
Aufgabe 3: Sinnvolle Integration von gait_analysis ohne Doppel-Hinweise zu Links/Rechts?
Aufgabe 4: Wo würdest du einen optionalen LLM-Layer einhängen, der nur formuliert, nicht diagnostiziert?
Aufgabe 5: Welche Golden-Tests brauchen wir für heel_strike + asymmetry + unremarkable_profile?
```

---

## Relevante Dateien (Quick Links)

| Datei | Inhalt |
|-------|--------|
| `core/domain/recommendations.py` | Diagnose, Empfehlung, Pipeline |
| `core/domain/exercises_catalog.py` | Übungs-IDs & Katalog |
| `modules/exercise_recommendations/__init__.py` | Tab-UI |
| `modules/step_analysis/__init__.py` | Erzeugt `analysis` |
| `modules/exercises/navigation.py` | Session-State → Übungsseite |
| `modules/exercises/render.py` | Übungsseiten-UI |
| `config.py` | Modul-Aktivierung |
| `MODULE.md` | Plugin-Architektur, Tab-System |
| `docs/biomechanics/` | Fachliche Grenzen (kein Diagnose-Wording) |

---

## Offene Architektur-Fragen

- Soll „Trainingsempfehlung“ langfristig **nur Übungen** sein oder auch **Laufparameter** (Kadenz-Ziel, Schrittlänge)?
- Wer kalibriert Schwellen – Entwickler, Klinik-Partner, oder datengetrieben aus Kohorten-CSV?
- Ein Tab oder getrennte Bereiche für „Muster“ vs. „Plan“ vs. „Übungskatalog“?
