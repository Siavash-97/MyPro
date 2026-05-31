"""
pipeline.py
===========
Brücke zwischen der Streamlit-App und dem regelbasierten Analyse-Package
``myprosole_analysis``.

Dieses Modul enthält bewusst KEINE Streamlit-Aufrufe, damit es auch in
Tests/Skripten ohne UI nutzbar ist. Aufgaben:

1. Beliebige Eingabe-DataFrames (neues ``time_s``-Format ODER die bisherigen
   App-Formate wie ``timestamp_ms`` mit Teilsensoren) auf das von
   ``myprosole_analysis`` erwartete Schema normalisieren
   (Spalte ``time_s`` in Sekunden + die 6 Sensorspalten L1..R3).
2. Die einstellbaren Analyse-Parameter (Schwellen, Schrittdauern etc.) auf das
   ``config``-Modul des Analyse-Packages anwenden.
3. Die komplette Analyse-Pipeline ausführen und Step-Tabelle, Summary-Tabelle
   und die Kontaktmuster-Verteilung als pandas-Strukturen zurückliefern.

Es findet KEINE medizinische Diagnose statt – nur neutrale Hinweise.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

import numpy as np
import pandas as pd

from myprosole_analysis import config as gait_config
from myprosole_analysis import (
    gait_classification,
    left_right_analysis,
    preprocessing,
    step_detection,
    step_features,
)

# Reihenfolge der 6 Sensorspalten, wie sie das Analyse-Package erwartet.
ANALYSIS_SENSOR_COLUMNS = (
    gait_config.LEFT_SENSOR_COLUMNS + gait_config.RIGHT_SENSOR_COLUMNS
)

# Zeitspalten-Aliase (in der Reihenfolge der Bevorzugung). "time_s" ist in
# Sekunden; alle anderen werden als Millisekunden interpretiert.
_TIME_ALIASES_SECONDS = ("time_s",)
_TIME_ALIASES_MS = ("timestamp_ms", "timestamp", "time", "zeit")

# Aliase je Sensor-Zielspalte, um auch abweichende Schreibweisen zu erkennen.
_SENSOR_ALIASES: dict[str, tuple[str, ...]] = {
    "L1_heel": ("L1_heel", "L1", "left_heel"),
    "L2_lateral_forefoot": ("L2_lateral_forefoot", "L2", "left_lateral_forefoot"),
    "L3_medial_forefoot": ("L3_medial_forefoot", "L3", "left_medial_forefoot"),
    "R1_heel": ("R1_heel", "R1", "right_heel"),
    "R2_lateral_forefoot": ("R2_lateral_forefoot", "R2", "right_lateral_forefoot"),
    "R3_medial_forefoot": ("R3_medial_forefoot", "R3", "right_medial_forefoot"),
}


# Parameter, die über die Sidebar einstellbar sind, samt Default aus config.py.
TUNABLE_PARAMS = (
    "SENSOR_THRESHOLD",
    "ACTIVATION_THRESHOLD_PERCENT",
    "MIN_STEP_DURATION_MS",
    "MAX_STEP_DURATION_MS",
    "MIN_SWING_DURATION_MS",
    "FLAT_FOOT_TIME_WINDOW_MS",
    "LATE_HEEL_CONTACT_THRESHOLD_MS",
    "MEDIAL_LATERAL_THRESHOLD",
    "ASYMMETRY_THRESHOLD_PERCENT",
    "SMOOTHING_WINDOW_SAMPLES",
)


@dataclass
class GaitAnalysisResult:
    """Gebündeltes Ergebnis der Gang-/Laufanalyse."""

    df: pd.DataFrame                      # normalisierte/geglättete Daten (time_s + Sensoren)
    steps: list[dict]                     # alle erkannten Schritte mit Features + Klassifikation
    left_right: dict[str, Any]            # Links-Rechts-Vergleich
    step_table: pd.DataFrame              # Step-Level-Tabelle (Anzeige)
    summary_table: pd.DataFrame           # Summary/Links-Rechts-Tabelle (Anzeige)
    pattern_distribution: pd.DataFrame    # Kontaktmuster-Verteilung pro Seite (Anzeige)
    used_columns: dict[str, str] = field(default_factory=dict)  # Quellspalten-Zuordnung
    missing_sensor_columns: list[str] = field(default_factory=list)


def default_params() -> dict[str, float]:
    """Liefert die aktuellen Default-Parameter aus dem Analyse-config-Modul."""
    return {name: getattr(gait_config, name) for name in TUNABLE_PARAMS}


def apply_params(params: dict[str, float] | None) -> None:
    """Setzt die übergebenen Parameter auf das globale Analyse-config-Modul.

    Nur bekannte (TUNABLE_PARAMS) Schlüssel werden übernommen, alle anderen
    ignoriert. ``SMOOTHING_WINDOW_SAMPLES`` wird zu einem int gerundet.
    """
    if not params:
        return
    for name in TUNABLE_PARAMS:
        if name in params and params[name] is not None:
            value = params[name]
            if name == "SMOOTHING_WINDOW_SAMPLES":
                value = max(1, int(round(float(value))))
            else:
                value = float(value)
            setattr(gait_config, name, value)


def _normalized_lookup(df: pd.DataFrame) -> dict[str, str]:
    """Map: kleingeschriebener, getrimmter Spaltenname -> Originalname."""
    return {str(col).strip().lower(): col for col in df.columns}


def _find_column(lookup: dict[str, str], candidates: tuple[str, ...]) -> str | None:
    for candidate in candidates:
        found = lookup.get(candidate.strip().lower())
        if found is not None:
            return found
    return None


def normalize_to_analysis_schema(raw_df: pd.DataFrame) -> tuple[pd.DataFrame, dict[str, str], list[str]]:
    """Normalisiert einen beliebigen Eingabe-DataFrame auf das Analyse-Schema.

    Ergebnis-DataFrame enthält die Spalte ``time_s`` (Sekunden) sowie alle 6
    Sensorspalten (fehlende Sensoren werden mit 0 aufgefüllt).

    Returns:
        (df, used_columns, missing_sensor_columns)
        - df: normalisierter DataFrame
        - used_columns: Zuordnung Zielspalte -> erkannte Quellspalte
        - missing_sensor_columns: Sensorspalten, die nicht gefunden wurden
    """
    raw_df = raw_df.copy()
    raw_df.columns = [str(col).strip() for col in raw_df.columns]
    lookup = _normalized_lookup(raw_df)

    used_columns: dict[str, str] = {}

    # --- Zeitspalte finden und in Sekunden überführen ---
    time_col_seconds = _find_column(lookup, _TIME_ALIASES_SECONDS)
    time_col_ms = _find_column(lookup, _TIME_ALIASES_MS)

    out = pd.DataFrame()
    if time_col_seconds is not None:
        out[gait_config.TIME_COLUMN] = pd.to_numeric(
            raw_df[time_col_seconds], errors="coerce"
        )
        used_columns[gait_config.TIME_COLUMN] = time_col_seconds
    elif time_col_ms is not None:
        # Millisekunden -> Sekunden.
        out[gait_config.TIME_COLUMN] = (
            pd.to_numeric(raw_df[time_col_ms], errors="coerce") / 1000.0
        )
        used_columns[gait_config.TIME_COLUMN] = time_col_ms
    else:
        raise ValueError(
            "Keine Zeitspalte gefunden. Erwartet wird z. B. 'time_s' (Sekunden) "
            "oder 'timestamp_ms' (Millisekunden)."
        )

    # --- Sensorspalten zuordnen (fehlende mit 0 auffüllen) ---
    missing: list[str] = []
    for target in ANALYSIS_SENSOR_COLUMNS:
        source = _find_column(lookup, _SENSOR_ALIASES.get(target, (target,)))
        if source is not None:
            out[target] = pd.to_numeric(raw_df[source], errors="coerce")
            used_columns[target] = source
        else:
            out[target] = 0.0
            missing.append(target)

    # Zeit-NaNs interpolieren, Sensor-NaNs als "kein Kontakt" (0) behandeln.
    out[gait_config.TIME_COLUMN] = (
        out[gait_config.TIME_COLUMN].interpolate(method="linear").ffill().bfill()
    )
    out[list(ANALYSIS_SENSOR_COLUMNS)] = out[list(ANALYSIS_SENSOR_COLUMNS)].fillna(0.0)

    # Doppelte/fehlende Zeitwerte robust behandeln: sortieren, Reset.
    out = out.dropna(subset=[gait_config.TIME_COLUMN])
    out = out.sort_values(gait_config.TIME_COLUMN, kind="stable").reset_index(drop=True)

    if out.empty:
        raise ValueError("Nach der Normalisierung enthält der Datensatz keine Zeilen.")

    return out, used_columns, missing


def _round_or_none(value: Any, ndigits: int = 1) -> Any:
    """Rundet einen Wert; None bleibt None (vermeidet truthiness-Fallen)."""
    if value is None:
        return None
    try:
        if isinstance(value, float) and np.isnan(value):
            return None
    except TypeError:
        pass
    return round(float(value), ndigits)


def build_step_table(steps: list[dict]) -> pd.DataFrame:
    """Erzeugt die Step-Level-Tabelle mit allen geforderten Spalten."""
    rows = []
    for s in steps:
        rows.append(
            {
                "step_id": s.get("step_id"),
                "foot": s.get("foot"),
                "start_time": _round_or_none(s.get("start_time"), 3),
                "end_time": _round_or_none(s.get("end_time"), 3),
                "stance_duration_ms": _round_or_none(s.get("stance_duration_ms"), 1),
                "swing_duration_ms": _round_or_none(s.get("swing_duration_ms"), 1),
                "gait_cycle_duration_ms": _round_or_none(s.get("gait_cycle_duration_ms"), 1),
                # 0.0 ist falsy -> bewusst kein truthiness-Check, sondern direkter Zugriff.
                "first_active_sensor": s.get("first_active_sensor"),
                "activation_order": "->".join(s.get("activation_order", []) or []),
                "contact_pattern": s.get("contact_pattern"),
                "peak_S1": _round_or_none(s.get("peak_S1", 0.0), 1),
                "peak_S2": _round_or_none(s.get("peak_S2", 0.0), 1),
                "peak_S3": _round_or_none(s.get("peak_S3", 0.0), 1),
                "medial_ratio": _round_or_none(s.get("medial_ratio", 0.0), 2),
                "lateral_ratio": _round_or_none(s.get("lateral_ratio", 0.0), 2),
                "classification_notes": s.get("classification_notes", ""),
            }
        )
    columns = [
        "step_id",
        "foot",
        "start_time",
        "end_time",
        "stance_duration_ms",
        "swing_duration_ms",
        "gait_cycle_duration_ms",
        "first_active_sensor",
        "activation_order",
        "contact_pattern",
        "peak_S1",
        "peak_S2",
        "peak_S3",
        "medial_ratio",
        "lateral_ratio",
        "classification_notes",
    ]
    return pd.DataFrame(rows, columns=columns)


def build_summary_table(lr: dict) -> pd.DataFrame:
    """Erzeugt die Summary/Links-Rechts-Tabelle (eine Kennzahl je Zeile).

    Die Wert-Spalte wird einheitlich als Text gehalten, weil sie sowohl Zahlen
    als auch Texte (z. B. dominant_side) enthält. So bleibt sie konsistent
    serialisierbar (Arrow) und in Streamlit ohne Warnung darstellbar.
    """
    summary = {
        "total_step_count": lr.get("total_step_count", 0),
        "step_count_left": lr.get("step_count_left", 0),
        "step_count_right": lr.get("step_count_right", 0),
        "dominant_side": lr.get("dominant_side", "none"),
        "load_difference_percent": round(lr.get("load_difference_percent", 0.0), 2),
        "average_stance_duration_left": round(lr.get("average_stance_duration_left", 0.0), 2),
        "average_stance_duration_right": round(lr.get("average_stance_duration_right", 0.0), 2),
        "average_swing_duration_left": round(lr.get("average_swing_duration_left", 0.0), 2),
        "average_swing_duration_right": round(lr.get("average_swing_duration_right", 0.0), 2),
        "stance_swing_ratio_left": round(lr.get("stance_swing_ratio_left", 0.0), 2),
        "stance_swing_ratio_right": round(lr.get("stance_swing_ratio_right", 0.0), 2),
        "average_medial_ratio_left": round(lr.get("average_medial_ratio_left", 0.0), 2),
        "average_medial_ratio_right": round(lr.get("average_medial_ratio_right", 0.0), 2),
        "average_lateral_ratio_left": round(lr.get("average_lateral_ratio_left", 0.0), 2),
        "average_lateral_ratio_right": round(lr.get("average_lateral_ratio_right", 0.0), 2),
    }
    rows = [(key, str(value)) for key, value in summary.items()]
    return pd.DataFrame(rows, columns=["Kennzahl", "Wert"])


def build_pattern_distribution_table(lr: dict) -> pd.DataFrame:
    """Kontaktmuster-Verteilung (% der Schritte) je Seite als Tabelle."""
    left = lr.get("contact_pattern_distribution_left", {})
    right = lr.get("contact_pattern_distribution_right", {})
    patterns = list(left.keys()) or list(right.keys())
    rows = []
    for pattern in patterns:
        rows.append(
            {
                "contact_pattern": pattern,
                "links_%": left.get(pattern, 0.0),
                "rechts_%": right.get(pattern, 0.0),
            }
        )
    return pd.DataFrame(rows, columns=["contact_pattern", "links_%", "rechts_%"])


def run_pipeline(
    raw_df: pd.DataFrame, params: dict[str, float] | None = None
) -> GaitAnalysisResult:
    """Führt die komplette regelbasierte Gang-/Laufanalyse aus.

    Args:
        raw_df: Beliebiger Eingabe-DataFrame (time_s- oder timestamp_ms-Format).
        params: Optionale Parameter-Overrides (siehe TUNABLE_PARAMS).

    Returns:
        GaitAnalysisResult mit DataFrame, Schritten, L/R-Analyse und Tabellen.
    """
    apply_params(params)

    df, used_columns, missing = normalize_to_analysis_schema(raw_df)

    # 1) Bereinigen/Glätten (nutzt die einstellbare Fenstergröße aus config).
    cleaned = preprocessing.clean_and_smooth(df)

    # 2) Schritte erkennen (L/R getrennt, gemeinsame step_id).
    steps = step_detection.detect_all_steps(cleaned)

    # 3) Features pro Schritt.
    step_features.compute_features_for_steps(steps)

    # 4) Regelbasierte Klassifikation (neutrale Hinweise).
    gait_classification.classify_steps(steps)

    # 5) Links-Rechts-Analyse.
    lr = left_right_analysis.analyze_left_right(steps)

    return GaitAnalysisResult(
        df=cleaned,
        steps=steps,
        left_right=lr,
        step_table=build_step_table(steps),
        summary_table=build_summary_table(lr),
        pattern_distribution=build_pattern_distribution_table(lr),
        used_columns=used_columns,
        missing_sensor_columns=missing,
    )
