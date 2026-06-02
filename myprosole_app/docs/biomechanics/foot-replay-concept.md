# Konzept: Druck-Replay (Frame-für-Frame Animation)

> Status: Phase 1–3 umgesetzt in `modules/foot_pressure_replay/`
> Ziel: Wie ein „Video" zeigen, wie Ferse → lateral → medial unter dem Fuß aktiv werden.

## Modi

1. **CSV-Replay** – alle Zeilen der CSV als Frames (Play/Pause/Geschwindigkeit)
2. **Schritt-Modus** – nur Frames eines erkannten Schritts + Metadaten
3. **Timeline-Sync** – Zeitleiste mit Gesamtdruck L/R und Schritt-Markierungen

## Architektur

```text
shared_data (raw_df)
    → gait pipeline (normalize, steps, features)
    → core/domain/foot_replay.py (Frames, Maxima, Schritt-Metadaten)
    → core/domain/replay_canvas.py (HTML/Canvas + JS)
    → Tab „Druck-Replay"
```

## Farblogik

- Pro Frame, **nicht** Session-Mittelwert
- Normalisierung wählbar: **Session-Max** oder **Schritt-Max**
- Rohwert ≤ Schwelle → grau/transparent
- Sonst Druck-Farbverlauf blau → rot (wie Druckkarte)

## Roadmap

| Phase | Inhalt | Status |
|-------|--------|--------|
| 1 | CSV-Replay, Play/Pause, Speed, Slider | umgesetzt |
| 2 | Schrittfilter, activation_order, ratio | umgesetzt |
| 3 | Timeline L/R + Plotly-Zeitreihe darüber | umgesetzt |
| 4 | Live ESP32 | offen |
| 5 | GIF/MP4-Export | offen |
