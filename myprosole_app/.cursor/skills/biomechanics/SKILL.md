---
name: biomechanics
description: >-
  Maintains and consults the MyProSole biomechanics knowledge base
  (docs/biomechanics) for pressure-map and gait/run analysis work. Use when the
  user discusses or changes foot pressure distribution, heel/forefoot strike
  timing, step features, gait classification, sensor thresholds, IMU
  (gyroscope/accelerometer) plans, or asks to record/brainstorm biomechanics
  findings. Read the knowledge base before such work and append new
  decisions/insights afterwards.
---

# MyProSole Biomechanics Knowledge Base

Single source of truth for biomechanics brainstorming, insights, sources and
decisions. Everything here is a **technical screening heuristic, never a
medical norm or diagnosis** — keep wording neutral/descriptive.

## Knowledge base location
`docs/biomechanics/`
- `README.md` – index and conventions
- `pressure-distribution.md` – pressure map metrics, static 60/40 reference, norms note
- `gait-foot-strike-timing.md` – heel vs. forefoot timing, adaptive ideas, IMU outlook
- `conversation-log.md` – dated log of insights/decisions (newest on top)
- `sources.md` – external references

## When to use
- Before working on pressure or gait analysis, **read** the relevant file(s) above.
- After a discussion that produces a new idea, decision, bot opinion, or source,
  **record it** (do not leave it only in chat).
- When a discussion changes code, note the affected file/constant so knowledge
  and code stay in sync.

## How to record insights
1. Add a dated entry to the top of `conversation-log.md` using this format:

```
## YYYY-MM-DD – Title
- Quelle: (Gespräch / externer Bot / Studie / eigener Test)
- Status: Idee | in Diskussion | entschieden | umgesetzt | verworfen
- Inhalt: ...
- Folge für Code/Docs: ...
```

2. If the insight belongs to an existing topic, also update that topic file
   (`pressure-distribution.md` or `gait-foot-strike-timing.md`).
3. If it is a new major topic, create `docs/biomechanics/<topic>.md` and link it
   from `README.md`.
4. Add any new external link to `sources.md`.

## Conventions
- Language of the knowledge base content is German (match existing files).
- Neutral terminology: prefer "Hinweis", "Referenz", "Abweichung"; avoid
  "Diagnose", "pathologisch", "normal/abnormal".
- Use forward-slash paths; keep entries concise.
- Mark each idea's status; never silently overwrite a decision — log the change.

## Code anchors (verify against real code before claiming values)
- `core/domain/pressure_analysis.py` – reference/heuristic constants, balance logic
- `core/domain/visualization.py` – pressure heatmap rendering
- `myprosole_analysis/step_features.py` – per-step features (activation, timing)
- `myprosole_analysis/gait_classification.py` – rule-based contact patterns
- `myprosole_analysis/config.py` – thresholds (e.g. FLAT_FOOT_TIME_WINDOW_MS)
