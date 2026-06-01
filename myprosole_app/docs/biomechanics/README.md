# Biomechanik-Wissensbasis (MyProSole)

Zentrale Sammelstelle für **Brainstormings, Erkenntnisse, Quellen und
Entscheidungen** rund um die Druck- und Gang-/Laufanalyse von MyProSole.

> Grundprinzip: Alles hier sind **technische Screening-Heuristiken**, **keine
> medizinischen Normen oder Diagnosen.** Sprache bleibt neutral/beschreibend.

## Inhalt
| Datei | Thema |
|-------|-------|
| [`pressure-distribution.md`](pressure-distribution.md) | Druckkarte: Kennzahlen, Referenz-/Heuristikwerte (60/40 statisch), Normen-Einordnung, Quellen |
| [`gait-foot-strike-timing.md`](gait-foot-strike-timing.md) | Fußaufsatz-Erkennung (Ferse vs. Vorfuß), Timing-Problematik bei variabler Person/Geschwindigkeit, adaptive Ideen, IMU-Ausblick |
| [`conversation-log.md`](conversation-log.md) | Chronologisches Log: was wurde besprochen/entschieden, inkl. Bot-Meinungen |
| [`sources.md`](sources.md) | Gesammelte externe Quellen/Referenzen |

## Wie diese Wissensbasis genutzt wird
- Vor Arbeiten an Druck-/Ganganalyse: passende Datei(en) hier **lesen**.
- Neue Erkenntnisse, Brainstormings oder Entscheidungen aus Gesprächen
  **hier einpflegen** (nicht nur im Chat lassen).
- Jeder Eintrag im Log bekommt **Datum** und kurze Quelle (z. B. „Gespräch",
  „externer Bot", „Studie").
- Status pro Idee kennzeichnen: `Idee` / `in Diskussion` / `entschieden` /
  `umgesetzt` / `verworfen`.

## Verknüpfung mit dem Code (Stand der Wahrheit)
- Druck/Referenzwerte: `core/domain/pressure_analysis.py`
- Heatmap-Visualisierung: `core/domain/visualization.py`
- Schritt-Features & Klassifikation: `myprosole_analysis/step_features.py`,
  `myprosole_analysis/gait_classification.py`
- Parameter/Schwellen: `myprosole_analysis/config.py`

Wenn eine Erkenntnis zu einer Code-Änderung führt, hier die betroffene
Datei/Konstante notieren, damit Wissen und Code synchron bleiben.
