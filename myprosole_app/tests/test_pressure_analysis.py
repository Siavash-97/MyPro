from __future__ import annotations

import numpy as np
import pandas as pd

from core.domain.data_loader import PAIRED_PRESSURE_FORMAT, load_pressure_dataframe
from core.domain.pressure_analysis import analyze_pressure


def _paired_pressure_df() -> pd.DataFrame:
    return pd.DataFrame(
        {
            "timestamp_ms": [0, 10, 20],
            "L1_heel": [10, 20, 30],
            "L2_lateral_forefoot": [20, 20, 20],
            "L3_medial_forefoot": [30, 30, 30],
            "R1_heel": [5, 5, 5],
            "R2_lateral_forefoot": [10, 10, 10],
            "R3_medial_forefoot": [15, 15, 15],
        }
    )


def test_loads_six_sensor_pair_csv_and_summarizes_left_right() -> None:
    sensor_format, normalized = load_pressure_dataframe(_paired_pressure_df(), window=3)
    result = analyze_pressure(normalized)

    assert sensor_format == PAIRED_PRESSURE_FORMAT
    assert result.per_foot_summary["left"]["total_pressure_raw"] == 70.0
    assert result.per_foot_summary["right"]["total_pressure_raw"] == 30.0
    assert result.bilateral_summary["total_pressure_both"] == 100.0
    assert result.bilateral_summary["left_right_distribution_percentage"] == 70.0
    assert result.per_foot_summary["left"]["medial_lateral_ratio"] == 1.5


def test_pressure_analysis_handles_zero_pressure_without_infinite_values() -> None:
    raw = pd.DataFrame(
        {
            "timestamp_ms": [0, 10],
            "L1_heel": [0, 0],
            "L2_lateral_forefoot": [0, 0],
            "L3_medial_forefoot": [0, 0],
            "R1_heel": [0, 0],
            "R2_lateral_forefoot": [0, 0],
            "R3_medial_forefoot": [0, 0],
        }
    )
    _, normalized = load_pressure_dataframe(raw, window=3)
    result = analyze_pressure(normalized)
    export = result.to_export_frame()

    assert result.bilateral_summary["total_pressure_both"] == 0.0
    assert result.bilateral_summary["left_right_distribution_percentage"] == 0.0
    assert np.isfinite(export.select_dtypes(include=[float, int]).to_numpy()).all()


def test_pressure_analysis_adds_estimated_body_weight_when_calibrated() -> None:
    _, normalized = load_pressure_dataframe(_paired_pressure_df(), window=3)
    result = analyze_pressure(normalized, calibration_factor=0.5)

    assert "estimated_body_weight_kg" in result.df.columns
    assert result.bilateral_summary["estimated_body_weight_kg"] == 50.0
