from __future__ import annotations

import numpy as np
import pandas as pd
import matplotlib.pyplot as plt

from core.domain.data_loader import (
    LEGACY_FSR_FORMAT,
    PAIRED_PRESSURE_FORMAT,
    PARTIAL_PRESSURE_FORMAT,
    load_pressure_dataframe,
)
from core.domain.pressure_analysis import analyze_pressure
from core.domain.visualization import plot_pressure_distribution


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
    assert result.missing_sensor_columns == ()


def test_loads_left_foot_with_two_sensor_zones() -> None:
    raw = pd.DataFrame(
        {
            "timestamp_ms": [0, 10, 20],
            "L1_heel": [10, 20, 30],
            "L2_lateral_forefoot": [20, 20, 20],
        }
    )

    sensor_format, normalized = load_pressure_dataframe(raw, window=3)
    result = analyze_pressure(normalized)

    assert sensor_format == PARTIAL_PRESSURE_FORMAT
    assert result.sensor_columns["left"] == ["L1_heel", "L2_lateral_forefoot"]
    assert result.sensor_columns["right"] == []
    assert result.per_foot_summary["left"]["total_pressure_raw"] == 40.0
    assert result.per_foot_summary["left"]["medial_forefoot_raw"] == 0.0
    assert result.per_foot_summary["right"]["total_pressure_raw"] == 0.0
    assert "L3_medial_forefoot" in result.missing_sensor_columns
    assert "R1_heel" in result.missing_sensor_columns


def test_loads_legacy_fsr_as_single_partial_insole() -> None:
    raw = pd.DataFrame(
        {
            "Timestamp": [0, 10, 20],
            "FSR1": [10, 20, 30],
            "FSR2": [5, 10, 15],
            "FSR_combined": [10, 20, 30],
        }
    )

    sensor_format, normalized = load_pressure_dataframe(raw, window=3)
    result = analyze_pressure(normalized)

    assert sensor_format == LEGACY_FSR_FORMAT
    assert result.source_format == LEGACY_FSR_FORMAT
    assert result.sensor_columns["left"] == ["L1_heel", "L2_lateral_forefoot"]
    assert result.sensor_columns["right"] == []
    assert result.per_foot_summary["left"]["total_pressure_raw"] == 30.0
    assert result.per_foot_summary["right"]["total_pressure_raw"] == 0.0
    assert any("Seite nicht eindeutig erkannt" in note for note in result.availability_notes)


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


def test_pressure_analysis_fills_missing_columns_without_division_by_zero() -> None:
    raw = pd.DataFrame(
        {
            "timestamp_ms": [0, 10],
            "L1_heel": [0, 0],
        }
    )

    result = analyze_pressure(raw)
    export = result.to_export_frame()

    assert result.per_foot_summary["left"]["total_pressure_raw"] == 0.0
    assert result.per_foot_summary["right"]["total_pressure_raw"] == 0.0
    assert result.sensor_columns["left"] == ["L1_heel"]
    assert np.isfinite(export.select_dtypes(include=[float, int]).to_numpy()).all()


def test_pressure_analysis_adds_estimated_body_weight_when_calibrated() -> None:
    _, normalized = load_pressure_dataframe(_paired_pressure_df(), window=3)
    result = analyze_pressure(normalized, calibration_factor=0.5)

    assert "estimated_body_weight_kg" in result.df.columns
    assert result.bilateral_summary["estimated_body_weight_kg"] == 50.0


def test_pressure_distribution_figure_uses_template_without_default_labels() -> None:
    _, normalized = load_pressure_dataframe(_paired_pressure_df(), window=3)
    result = analyze_pressure(normalized)

    fig = plot_pressure_distribution(result)
    try:
        fig.canvas.draw()
        assert len(fig.axes) == 2
        assert fig._suptitle is not None
        assert fig._suptitle.get_text() == "Druckkarte"
        assert any("Template Größe 44" in text.get_text() for text in fig.texts)
        assert all(len(ax.images) == 2 for ax in fig.axes)

        labels = [text.get_text() for ax in fig.axes[:2] for text in ax.texts]
        assert not any("Ferse" in label for label in labels)
        assert not any("kein Sensor" in label for label in labels)
    finally:
        plt.close(fig)


def test_pressure_distribution_labels_can_be_enabled() -> None:
    _, normalized = load_pressure_dataframe(_paired_pressure_df(), window=3)
    result = analyze_pressure(normalized)

    fig = plot_pressure_distribution(result, show_labels=True)
    try:
        fig.canvas.draw()
        labels = [text.get_text() for ax in fig.axes[:2] for text in ax.texts]
        assert any("Ferse" in label and "%" in label and "raw" in label for label in labels)
        assert any("Medialer Vorfuß" in label for label in labels)
        assert any("Lateraler Vorfuß" in label for label in labels)
    finally:
        plt.close(fig)


def test_pressure_distribution_figure_handles_partial_sensor_map() -> None:
    raw = pd.DataFrame(
        {
            "timestamp_ms": [0, 10, 20],
            "L1_heel": [10, 20, 30],
            "L2_lateral_forefoot": [20, 20, 20],
        }
    )
    _, normalized = load_pressure_dataframe(raw, window=3)
    result = analyze_pressure(normalized)

    fig = plot_pressure_distribution(result, show_labels=True)
    try:
        fig.canvas.draw()
        assert len(fig.axes) == 2
        assert len(fig.axes[0].images) == 2
        assert len(fig.axes[1].images) == 0

        labels = [text.get_text() for ax in fig.axes[:2] for text in ax.texts]
        assert any("Ferse" in label and "%" in label and "raw" in label for label in labels)
        assert any("Lateraler Vorfuß" in label for label in labels)
        assert not any("Medialer Vorfuß" in label for label in labels)
        assert not any("kein Sensor" in label for label in labels)
        assert any(label == "Keine Daten" for label in labels)
    finally:
        plt.close(fig)
