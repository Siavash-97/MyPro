"""Loading and normalizing MyProSole sensor tables."""

from __future__ import annotations

from typing import BinaryIO

import numpy as np
import pandas as pd

from core.domain.fsr import preprocess_fsr
from core.domain.sensor_mapping import (
    HEEL,
    LATERAL_FOREFOOT,
    MEDIAL_FOREFOOT,
    SENSOR_DEFINITIONS,
    SENSOR_COLUMNS,
    TIMESTAMP_ALIASES,
    TIMESTAMP_COLUMN,
    columns_for_region,
)

PAIRED_PRESSURE_FORMAT = "paired_pressure"
PARTIAL_PRESSURE_FORMAT = "partial_pressure"
LEGACY_FSR_FORMAT = "legacy_fsr"


def read_sensor_table(file: str | BinaryIO, filename: str | None = None) -> pd.DataFrame:
    """Read CSV/XLSX sensor data from a path or uploaded file-like object."""
    source_name = (filename or getattr(file, "name", "") or "").lower()
    if source_name.endswith(".xlsx"):
        return pd.read_excel(file)
    return pd.read_csv(file, sep=None, engine="python")


def _normalized_columns(df: pd.DataFrame) -> dict[str, str]:
    return {str(column).strip().lower(): column for column in df.columns}


def _find_column(df: pd.DataFrame, candidates: tuple[str, ...]) -> str | None:
    normalized = _normalized_columns(df)
    for candidate in candidates:
        found = normalized.get(candidate.strip().lower())
        if found is not None:
            return found
    return None


def _sensor_candidates(sensor_column: str, aliases: tuple[str, ...]) -> tuple[str, ...]:
    return (sensor_column, *aliases)


def detect_sensor_format(raw_df: pd.DataFrame) -> str:
    """Return the supported data format for a raw table."""
    timestamp_col = _find_column(raw_df, TIMESTAMP_ALIASES)
    if timestamp_col is None:
        raise ValueError("Keine Zeitspalte gefunden. Erwartet wird z. B. timestamp_ms.")

    paired_columns_found = [
        sensor
        for sensor in SENSOR_DEFINITIONS
        if _find_column(raw_df, _sensor_candidates(sensor.column, sensor.aliases)) is not None
    ]
    if len(paired_columns_found) == len(SENSOR_DEFINITIONS):
        return PAIRED_PRESSURE_FORMAT
    if paired_columns_found:
        return PARTIAL_PRESSURE_FORMAT

    has_legacy_fsr = (
        _find_column(raw_df, ("FSR1", "fsr1", "sensor1")) is not None
        and _find_column(raw_df, ("FSR2", "fsr2", "sensor2")) is not None
    )
    if has_legacy_fsr:
        return LEGACY_FSR_FORMAT

    expected = ", ".join((TIMESTAMP_COLUMN, *SENSOR_COLUMNS))
    raise ValueError(
        "Nicht unterstütztes Sensorformat. Erwartet wird das Paar-CSV "
        f"mit Spalten: {expected}. Legacy FSR1/FSR2 wird weiterhin unterstützt."
    )


def _estimate_sampling_rate_ms(timestamp_ms: pd.Series) -> float | None:
    ts_vals = timestamp_ms.to_numpy()
    dt = np.diff(ts_vals)
    dt_pos = dt[dt > 0]
    if len(dt_pos) == 0:
        return None
    return float(1000.0 / dt_pos.mean())


def normalize_paired_sensor_dataframe(raw_df: pd.DataFrame, window: int = 5) -> pd.DataFrame:
    """Normalize paired or partially paired insole data to canonical columns."""
    raw_df = raw_df.copy()
    raw_df.columns = [str(column).strip() for column in raw_df.columns]

    timestamp_col = _find_column(raw_df, TIMESTAMP_ALIASES)
    if timestamp_col is None:
        raise ValueError("Keine Zeitspalte gefunden. Erwartet wird z. B. timestamp_ms.")

    column_map: dict[str, str] = {}
    for sensor in SENSOR_DEFINITIONS:
        source_col = _find_column(raw_df, _sensor_candidates(sensor.column, sensor.aliases))
        if source_col is not None:
            column_map[sensor.column] = source_col

    df = pd.DataFrame()
    df[TIMESTAMP_COLUMN] = pd.to_numeric(raw_df[timestamp_col], errors="coerce")
    for sensor in SENSOR_DEFINITIONS:
        source_col = column_map.get(sensor.column)
        if source_col is None:
            df[sensor.column] = 0.0
        else:
            df[sensor.column] = pd.to_numeric(raw_df[source_col], errors="coerce")

    df = df.bfill().ffill().fillna(0).reset_index(drop=True)
    df["Timestamp"] = df[TIMESTAMP_COLUMN]

    heel_cols = [
        *columns_for_region("left", HEEL),
        *columns_for_region("right", HEEL),
    ]
    forefoot_cols = [
        *columns_for_region("left", LATERAL_FOREFOOT),
        *columns_for_region("left", MEDIAL_FOREFOOT),
        *columns_for_region("right", LATERAL_FOREFOOT),
        *columns_for_region("right", MEDIAL_FOREFOOT),
    ]

    # Compatibility columns keep the existing step-event pipeline usable.
    df["FSR1"] = df[heel_cols].sum(axis=1)
    df["FSR2"] = df[forefoot_cols].sum(axis=1)
    df["FSR_combined_raw"] = df[list(SENSOR_COLUMNS)].sum(axis=1)
    df["FSR_combined"] = (
        df["FSR_combined_raw"]
        .rolling(window=window, center=True)
        .median()
        .bfill()
        .ffill()
    )

    df.attrs["fs_est"] = _estimate_sampling_rate_ms(df[TIMESTAMP_COLUMN])
    available_sensor_columns = tuple(column_map.keys())
    missing_sensor_columns = tuple(
        sensor.column for sensor in SENSOR_DEFINITIONS if sensor.column not in column_map
    )
    df.attrs["sensor_format"] = (
        PAIRED_PRESSURE_FORMAT if not missing_sensor_columns else PARTIAL_PRESSURE_FORMAT
    )
    df.attrs["available_sensor_columns"] = available_sensor_columns
    df.attrs["missing_sensor_columns"] = missing_sensor_columns
    if missing_sensor_columns:
        df.attrs["pressure_notes"] = (
            "Die Datei enthält nur einen Teil der Paar-Sensoren; fehlende Sensoren "
            "werden in der Druckanalyse als nicht verfügbar ausgewiesen."
        )
    return df


def normalize_legacy_sensor_dataframe(raw_df: pd.DataFrame, window: int = 5) -> pd.DataFrame:
    """Normalize legacy FSR1/FSR2 data and expose it as one partial insole."""
    df = preprocess_fsr(raw_df, window=window)
    df[TIMESTAMP_COLUMN] = df["Timestamp"]

    legacy_mapping = {
        "L1_heel": "FSR1",
        "L2_lateral_forefoot": "FSR2",
    }
    for sensor in SENSOR_DEFINITIONS:
        source_col = legacy_mapping.get(sensor.column)
        if source_col is None:
            df[sensor.column] = 0.0
        else:
            df[sensor.column] = pd.to_numeric(df[source_col], errors="coerce")

    df = df.bfill().ffill().fillna(0).reset_index(drop=True)
    df.attrs["sensor_format"] = LEGACY_FSR_FORMAT
    df.attrs["available_sensor_columns"] = tuple(legacy_mapping.keys())
    df.attrs["missing_sensor_columns"] = tuple(
        sensor.column for sensor in SENSOR_DEFINITIONS if sensor.column not in legacy_mapping
    )
    df.attrs["pressure_notes"] = (
        "Seite nicht eindeutig erkannt; Legacy-Sensoren FSR1/FSR2 werden als "
        "einzelne Legacy-Einlage ausgewertet."
    )
    return df


def load_pressure_dataframe(raw_df: pd.DataFrame, window: int = 5) -> tuple[str, pd.DataFrame]:
    """Normalize either the new paired format or the legacy FSR1/FSR2 format."""
    sensor_format = detect_sensor_format(raw_df)
    if sensor_format in {PAIRED_PRESSURE_FORMAT, PARTIAL_PRESSURE_FORMAT}:
        return sensor_format, normalize_paired_sensor_dataframe(raw_df, window=window)

    return sensor_format, normalize_legacy_sensor_dataframe(raw_df, window=window)
