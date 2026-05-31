"""
step_detection.py
=================
Erkennt einzelne Schritte (Standphasen) getrennt für den linken und den
rechten Fuß auf Basis der 3 FSR-Drucksensoren je Fuß.

Definitionen:
- Standphase START: mindestens einer der 3 Sensoren eines Fußes liegt ueber
  ``config.SENSOR_THRESHOLD``.
- Standphase ENDE: alle 3 Sensoren dieses Fußes liegen wieder unter dem
  Schwellenwert.
- Zu kurze oder zu lange Standphasen werden als Artefakte verworfen.
- Schwungphase (swing): Zeitraum nach Ende einer Standphase bis zum Beginn der
  naechsten Standphase desselben Fußes.
- Gangzyklus (gait cycle): von einem Kontaktbeginn eines Fußes bis zum
  naechsten Kontaktbeginn desselben Fußes.

Die Kantenerkennung ist vektorisiert (numpy), damit sie auch fuer lange
Aufzeichnungen schnell bleibt und spaeter echtzeitnah portierbar ist.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

try:  # Package-Import (z. B. aus der Streamlit-App)
    from . import config
except ImportError:  # Skript-Import (python myprosole_analysis/main.py)
    import config


def detect_all_steps(df: pd.DataFrame) -> list[dict]:
    """Erkennt alle Schritte beider Fueße und vergibt fortlaufende step_id.

    Args:
        df: Bereinigter DataFrame (aus preprocessing.clean_and_smooth).

    Returns:
        Liste von Step-Dictionaries, chronologisch sortiert, mit eindeutiger
        ``step_id`` ueber beide Fueße hinweg.
    """
    left_steps = _detect_steps_for_foot(df, "L", config.LEFT_SENSOR_COLUMNS)
    right_steps = _detect_steps_for_foot(df, "R", config.RIGHT_SENSOR_COLUMNS)

    # Beide Listen zusammenfuehren und chronologisch nach Startzeit sortieren.
    all_steps = left_steps + right_steps
    all_steps.sort(key=lambda s: s["stance_start_time"])

    # Fortlaufende, eindeutige step_id vergeben.
    for new_id, step in enumerate(all_steps, start=1):
        step["step_id"] = new_id

    return all_steps


def _detect_steps_for_foot(
    df: pd.DataFrame, foot: str, sensor_cols: list[str]
) -> list[dict]:
    """Erkennt Standphasen, Schwungphasen und Gangzyklen fuer EINEN Fuß.

    Args:
        df: Bereinigter DataFrame.
        foot: "L" oder "R".
        sensor_cols: Die 3 Sensorspalten dieses Fußes [heel, lateral, medial].

    Returns:
        Liste von Step-Dictionaries (ohne globale step_id; die wird spaeter gesetzt).
    """
    time = df[config.TIME_COLUMN].to_numpy(dtype=float)
    sensors = df[sensor_cols].to_numpy(dtype=float)  # shape (n, 3)

    # Pro Sample: ist der Fuß in Kontakt? (mind. ein Sensor ueber Schwelle)
    active = np.any(sensors > config.SENSOR_THRESHOLD, axis=1)

    # Steigende und fallende Flanken der Kontakt-Zeitreihe bestimmen.
    starts, ends = _find_active_intervals(active)

    steps: list[dict] = []
    for start_idx, end_idx in zip(starts, ends):
        stance_start_time = float(time[start_idx])
        # end_idx zeigt auf den ersten Sample OHNE Kontakt; das Standphasenende
        # ist der Zeitpunkt dieses Wechsels.
        stance_end_time = float(time[end_idx])
        stance_duration_ms = (stance_end_time - stance_start_time) * 1000.0

        # Zu kurze/zu lange Standphasen verwerfen.
        if stance_duration_ms < config.MIN_STEP_DURATION_MS:
            continue
        if stance_duration_ms > config.MAX_STEP_DURATION_MS:
            continue

        # Rohdaten-Ausschnitt der Standphase (inkl. Endindex fuer Vollstaendigkeit).
        raw_slice = df.iloc[start_idx : end_idx + 1][
            [config.TIME_COLUMN] + sensor_cols
        ].reset_index(drop=True)

        steps.append(
            {
                "step_id": None,  # wird in detect_all_steps global gesetzt
                "foot": foot,
                "start_time": stance_start_time,
                "end_time": stance_end_time,
                "start_index": int(start_idx),
                "end_index": int(end_idx),
                "stance_start_time": stance_start_time,
                "stance_end_time": stance_end_time,
                "stance_duration_ms": stance_duration_ms,
                # Schwung-/Gangzyklus-Felder werden unten ergaenzt.
                "swing_start_time": None,
                "swing_end_time": None,
                "swing_duration_ms": None,
                "gait_cycle_duration_ms": None,
                "raw_step_data": raw_slice,
                "sensor_columns": list(sensor_cols),
            }
        )

    _add_swing_and_cycle(steps)
    return steps


def _find_active_intervals(active: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """Findet Start- und Endindizes zusammenhaengender Kontaktphasen.

    Args:
        active: Bool-Array, True = Fuß in Kontakt.

    Returns:
        (starts, ends) als Index-Arrays. ``starts[i]`` ist der erste Kontakt-Sample,
        ``ends[i]`` der erste Sample OHNE Kontakt danach (Wechselzeitpunkt).
    """
    if active.size == 0:
        return np.array([], dtype=int), np.array([], dtype=int)

    # int-Diff: +1 = steigende Flanke (Kontakt beginnt), -1 = fallende Flanke.
    active_int = active.astype(np.int8)
    diff = np.diff(active_int)

    starts = np.where(diff == 1)[0] + 1  # +1: Index des ersten True
    ends = np.where(diff == -1)[0] + 1   # +1: Index des ersten False nach Kontakt

    # Sonderfall: Aufzeichnung beginnt bereits im Kontakt.
    if active[0]:
        starts = np.insert(starts, 0, 0)

    # Sonderfall: Aufzeichnung endet im Kontakt -> Ende auf letzten Index setzen.
    if active[-1]:
        ends = np.append(ends, active.size - 1)

    # Paarweise zusammenfuehren (Laengen sind durch die Sonderfaelle gleich).
    n = min(starts.size, ends.size)
    return starts[:n], ends[:n]


def _add_swing_and_cycle(steps: list[dict]) -> None:
    """Ergaenzt Schwungphase und Gangzyklus fuer aufeinanderfolgende Schritte EINES Fußes.

    Modifiziert die Step-Dictionaries in-place.
    """
    for i in range(len(steps) - 1):
        current = steps[i]
        nxt = steps[i + 1]

        # Schwungphase: vom Ende dieser Standphase bis zum Beginn der naechsten.
        swing_start = current["stance_end_time"]
        swing_end = nxt["stance_start_time"]
        swing_duration_ms = (swing_end - swing_start) * 1000.0

        # Nur als gueltige Schwungphase werten, wenn lang genug.
        if swing_duration_ms >= config.MIN_SWING_DURATION_MS:
            current["swing_start_time"] = swing_start
            current["swing_end_time"] = swing_end
            current["swing_duration_ms"] = swing_duration_ms

        # Gangzyklus: von Kontaktbeginn bis zum naechsten Kontaktbeginn desselben Fußes.
        gait_cycle_ms = (nxt["stance_start_time"] - current["stance_start_time"]) * 1000.0
        if gait_cycle_ms > 0:
            current["gait_cycle_duration_ms"] = gait_cycle_ms
