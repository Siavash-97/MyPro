"""
preprocessing.py
=================
Bereinigt und glättet die FSR-Sensordaten vor der eigentlichen Analyse.

Schritte (bewusst einfach gehalten, echtzeitfreundlich):
1. Fehlende Werte (NaN) behandeln -> mit 0 auffüllen (kein Kontakt).
2. Negative Werte auf 0 setzen (FSR kann physikalisch nicht negativ sein).
3. Glättung per gleitendem Mittelwert (rolling mean) gegen Sensorrauschen.
4. Optionale Normalisierung pro Sensor auf 0..NORMALIZE_RANGE_MAX.

Es wird KEINE komplexe Filterung (Butterworth o. ä.) verwendet, damit die
Verarbeitung schnell und später auf Mikrocontrollern umsetzbar bleibt.
"""

from __future__ import annotations

import pandas as pd

try:  # Package-Import (z. B. aus der Streamlit-App)
    from . import config
except ImportError:  # Skript-Import (python myprosole_analysis/main.py)
    import config


def _sensor_columns() -> list[str]:
    """Liefert alle Sensorspalten (links + rechts)."""
    return config.LEFT_SENSOR_COLUMNS + config.RIGHT_SENSOR_COLUMNS


def clean_and_smooth(df: pd.DataFrame) -> pd.DataFrame:
    """Bereinigt und glättet die Sensordaten.

    Args:
        df: Roh-DataFrame mit Zeit- und Sensorspalten (aus data_loader.load_csv).

    Returns:
        Eine bereinigte Kopie des DataFrames. Das Original bleibt unverändert.
    """
    cleaned = df.copy()
    sensor_cols = _sensor_columns()

    # 1) Fehlende Sensorwerte als "kein Kontakt" interpretieren -> 0.
    cleaned[sensor_cols] = cleaned[sensor_cols].fillna(0.0)

    # Fehlende Zeitstempel interpolieren (linear), Randwerte auffüllen.
    cleaned[config.TIME_COLUMN] = (
        cleaned[config.TIME_COLUMN].interpolate(method="linear").ffill().bfill()
    )

    # 2) Negative Werte sind physikalisch unmöglich -> auf 0 begrenzen.
    cleaned[sensor_cols] = cleaned[sensor_cols].clip(lower=0.0)

    # 3) Glättung per rolling mean (zentriert), um die Flanken nicht zu verschieben.
    window = max(1, int(config.SMOOTHING_WINDOW_SAMPLES))
    if window > 1:
        cleaned[sensor_cols] = (
            cleaned[sensor_cols]
            .rolling(window=window, center=True, min_periods=1)
            .mean()
        )

    # 4) Optionale Normalisierung pro Sensor auf 0..NORMALIZE_RANGE_MAX.
    if config.NORMALIZE_PER_SENSOR:
        cleaned = _normalize_per_sensor(cleaned, sensor_cols)

    return cleaned


def _normalize_per_sensor(df: pd.DataFrame, sensor_cols: list[str]) -> pd.DataFrame:
    """Skaliert jeden Sensor einzeln auf 0..NORMALIZE_RANGE_MAX.

    Hat ein Sensor keinen positiven Maximalwert (immer 0), bleibt er bei 0.
    """
    for col in sensor_cols:
        col_max = df[col].max()
        if col_max and col_max > 0:
            df[col] = df[col] / col_max * config.NORMALIZE_RANGE_MAX
    return df
