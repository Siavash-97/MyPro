# Feature-Module für MyProSole

Die App ist in einen **stabilen Kern** und **austauschbare Feature-Module** geteilt. Neue Funktionen gehören in `modules/`, nicht in `app.py` oder den Kern.

## Ordnerstruktur

```
myprosole_app/
├── app.py                 # Nur Einstieg: startet den Kern
├── config.py              # Welche Module geladen werden
├── core/                  # Kern (selten ändern)
│   ├── bootstrap.py       # Streamlit-Setup, Modul-Lifecycle
│   ├── context.py         # AppContext (geteilter Zustand)
│   ├── registry.py        # Modul-Schnittstelle & Registry
│   ├── loader.py          # Lädt Module aus config
│   └── domain/            # Gemeinsame Fachlogik (Sensor-Mapping, Druckanalyse, FSR, Metriken, …)
└── modules/               # Features (hier entwickeln)
    ├── step_analysis/
    ├── exercise_recommendations/
    ├── exercises/           # Übungsseite (Multipage)
    └── example_feature/   # Skeleton-Vorlage
```

## Kern vs. Modul

| Bereich | Pfad | Zweck |
|--------|------|--------|
| **Kern** | `core/` | Bootstrap, Registry, Loader, `AppContext` |
| **Domain** | `core/domain/` | Wiederverwendbare Analyse-Logik ohne UI |
| **Konfiguration** | `config.py` | Aktive Module, keine UI |
| **Feature** | `modules/<name>/` | Streamlit-UI, Sidebar, Tabs |

`app.py` bleibt dünn. Der Kern ändert sich nur, wenn sich die **Plugin-Schnittstelle** weiterentwickelt.

## Neues Feature-Modul anlegen

### 1. Ordner erstellen

```
modules/mein_feature/
└── __init__.py
```

### 2. Modul-Klasse implementieren

```python
from core.context import AppContext
from core.registry import ModuleRegistry
import streamlit as st


class MeinFeatureModule:
    id = "mein_feature"
    display_name = "Mein Feature"
    order = 50  # niedriger = früher in Sidebar/Render

    def register_sidebar(self, ctx: AppContext) -> None:
        with st.sidebar:
            ctx.set_param("mein_flag", st.toggle("Mein Feature"))

    def render(self, ctx: AppContext) -> None:
        if not ctx.param("mein_flag"):
            return
        st.subheader("Mein Feature")
        # … UI …

    # Optional: eigener Tab nach erfolgreicher Schrittanalyse
    def render_analysis_tab(self, ctx: AppContext) -> None:
        analysis = ctx.param("analysis")
        if not analysis:
            return
        st.write("Daten aus Schrittanalyse:", analysis["summary"])


def register(registry: ModuleRegistry) -> None:
    registry.add(MeinFeatureModule())
```

### 3. In `config.py` aktivieren

```python
ENABLED_MODULES = [
    "modules.step_analysis",
    "modules.exercise_recommendations",
    "modules.mein_feature",  # neu
]
```

### 4. App starten

```bash
cd myprosole_app
streamlit run app.py
```

## Schnittstelle `FeatureModule`

| Methode | Pflicht | Beschreibung |
|---------|---------|--------------|
| `register_sidebar(ctx)` | nein | Widgets in der Sidebar |
| `render(ctx)` | ja | Hauptbereich der Seite |
| `render_analysis_tab(ctx)` | nein | Zusatz-Tab nach Analyse (siehe `step_analysis`) |

**Geteilter Zustand:** `ctx.set_param("schlüssel", wert)` / `ctx.param("schlüssel")`.
Nach erfolgreicher Analyse setzt `step_analysis` z. B. `ctx.params["analysis"]` mit `df`, `events`, `steps_df`, `summary` und bei Paar-Sensoren zusätzlich `pressure_analysis`. Der Wert steht außerdem direkt unter `ctx.params["pressure_analysis"]`.

## Paar-Sensor-Mapping und CSV-Format

Neue Messungen sollen bevorzugt als Paar-CSV mit diesen Spalten hochgeladen werden:

```text
timestamp_ms,L1_heel,L2_lateral_forefoot,L3_medial_forefoot,R1_heel,R2_lateral_forefoot,R3_medial_forefoot
```

Mapping:

| Spalte | Bedeutung |
|--------|-----------|
| `L1_heel` | linke Ferse |
| `L2_lateral_forefoot` | linker lateraler Vorfuß / kleiner Zeh |
| `L3_medial_forefoot` | linker medialer Vorfuß / großer Zeh |
| `R1_heel` | rechte Ferse |
| `R2_lateral_forefoot` | rechter lateraler Vorfuß / kleiner Zeh |
| `R3_medial_forefoot` | rechter medialer Vorfuß / großer Zeh |

Die zentrale Definition liegt in `core/domain/sensor_mapping.py`. `core/domain/data_loader.py` normalisiert das CSV, `core/domain/pressure_analysis.py` berechnet pro Fuß Druckanteile und links/rechts-Verteilung. Dateien dürfen vollständig oder teilweise sein: Wenn nur eine Fußseite oder einzelne Sensorzonen vorhanden sind, werden die vorhandenen Sensoren analysiert und fehlende Seiten/Zonen transparent als nicht verfügbar gemeldet. Die alte `FSR1`/`FSR2`-CSV-Variante bleibt für bestehende Dateien als Legacy-Format unterstützt und wird als einzelne Legacy-Einlage ohne eindeutig erkannte Fußseite ausgewertet.

Die Druckanalyse berechnet pro Fuß `total_pressure_raw`, `heel_pressure_raw`, `medial_forefoot_raw`, `lateral_forefoot_raw`, Prozentanteile, `medial_lateral_ratio` und `forefoot_heel_ratio`. Fehlende Sensorwerte werden intern mit `0` berechnet, bleiben aber in der Verfügbarkeitsmeldung und in der Druckkarte als fehlend sichtbar. Beidseitig werden `total_pressure_left`, `total_pressure_right`, `total_pressure_both` und `left_right_distribution_percentage` berechnet; mit Kalibrierfaktor zusätzlich `estimated_body_weight_kg`.

## Druckkarte

Nach einer erfolgreichen Druckanalyse zeigt die Schrittanalyse den Tab **„Druckkarte“**. Die Karte nutzt eine geglättete graue/silberne Fußform-Vorlage für Größe 44 und zeichnet die verfügbaren Sensorbereiche Ferse, lateraler Vorfuß und medialer Vorfuß als weiche, transparente Heatmap-Zonen: Blau niedrig, Grün/Gelb mittel, Rot hoch. Prozentanteil am jeweiligen Fuß und mittlerer Rohdruck (`raw`) stehen in kleinen Callouts neben dem Fuß, damit die Druckfelder nicht durch Text verdeckt werden. Fehlende Sensorzonen werden als dezente gestrichelte Bereiche und mit Hinweis-Callout dargestellt; oberhalb der Karte erscheinen weiterhin Hinweise wie „Analysiert: linker Fuß (Ferse, lateraler Vorfuß)“ und „Nicht verfügbar: rechter Fuß“.

Die visuellen Koordinaten liegen zentral in `core/domain/sensor_mapping.py` (`VISUAL_FOOT_SIZE_EU`, `FOOT_OUTLINE_TEMPLATE`, `VISUAL_REGION_TEMPLATE`). Dort werden Fußform, Sensorpositionen, Heatmap-Ausdehnung, Rotation und Callout-Position je Zone gepflegt. Dadurch können spätere Sensoren oder andere Sohlenlayouts angepasst werden, ohne die Analyseberechnung umzubauen. Die Figure-Erzeugung bleibt UI-unabhängig in `core/domain/visualization.py`; Streamlit rendert sie im Tab **„Druckkarte“**.

## Übungsseite & Navigation

Die **Übungsseite** ist eine eigene Streamlit-Multipage-Route unter `pages/2_Übungen.py` (Sidebar: **„Übungen“**). Die UI liegt in `modules/exercises/`; Übungsdaten in `core/domain/exercises_catalog.py` (ohne Streamlit).

**Ablauf aus „Analyse & Empfehlungen“:**

1. Nach Schrittanalyse Tab **„Analyse & Empfehlungen“** öffnen.
2. **„Übungen ansehen“** (pro Empfehlung) oder **„Alle empfohlenen Übungen öffnen“** klicken.
3. `modules/exercises/navigation.py` schreibt Befund-IDs in `st.session_state` und ruft `st.switch_page("pages/2_Übungen.py")` auf.
4. Auf der Übungsseite: Filter **„Aus Ihrer Analyse“** vs. **„Alle Übungen“** (wenn Befunde vorhanden).

**Session-State-Schlüssel:** `exercises_diagnosis_ids`, `exercises_focus_exercise_ids`, `exercises_filter_mode`.

**Videos später:** In `exercises_catalog.py` pro `Exercise` das Feld `video_url` setzen (z. B. YouTube-URL). Die UI zeigt dann `st.video()`; bei leerem Feld erscheint „Video folgt“.

## Vorlage

Siehe `modules/example_feature/` – minimales Skeleton mit Sidebar-Checkbox und Expander.

## Sinnvolle nächste Module (Vorschläge)

- **Zwei-Einlagen-Vergleich** (links/rechts, Symmetrie)
- **Sitzungsverlauf / Export** (PDF, Archiv)
- **Benutzer-/Patientenprofil** (ohne Secrets in Git)
- **Übungsdatenbank** (ersetzt regelbasierte Empfehlungen)
- **Live-BLE-Stream** (Echtzeit statt CSV-Upload)
- **Dashboard / KPI-Übersicht** für Therapeuten

Diese können nacheinander als eigene Pakete unter `modules/` ergänzt werden.
