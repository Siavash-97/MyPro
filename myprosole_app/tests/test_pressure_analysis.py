from __future__ import annotations

import numpy as np
import pandas as pd

from core.domain.data_loader import (
    LEGACY_FSR_FORMAT,
    PAIRED_PRESSURE_FORMAT,
    PARTIAL_PRESSURE_FORMAT,
    load_pressure_dataframe,
)
from core.domain.pressure_analysis import analyze_pressure
from core.domain.visualization import (
    FOOT_MASK_PATH,
    FOOT_TEMPLATE_PATH,
    build_pressure_canvas_html,
    build_pressure_canvas_payload,
)


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


def test_pressure_canvas_uses_template_assets_without_default_labels() -> None:
    _, normalized = load_pressure_dataframe(_paired_pressure_df(), window=3)
    result = analyze_pressure(normalized)

    payload = build_pressure_canvas_payload(result)
    html = build_pressure_canvas_html(result)

    assert FOOT_TEMPLATE_PATH.is_file()
    assert FOOT_MASK_PATH.is_file()
    assert payload["showLabels"] is False
    assert payload["maxPressure"] == 30.0
    assert len(payload["feet"]) == 2
    assert all(foot["hasData"] for foot in payload["feet"])
    assert all(len(foot["sensors"]) == 3 for foot in payload["feet"])
    assert "foot_template_left.png" not in html
    assert "data:image/png;base64," in html
    assert "Druckkarte" in html


def test_pressure_canvas_labels_can_be_enabled() -> None:
    _, normalized = load_pressure_dataframe(_paired_pressure_df(), window=3)
    result = analyze_pressure(normalized)

    payload = build_pressure_canvas_payload(result, show_labels=True)
    labels = {
        sensor["label"]
        for foot in payload["feet"]
        for sensor in foot["sensors"]
    }

    assert payload["showLabels"] is True
    assert {"Ferse", "Medialer Vorfuß", "Lateraler Vorfuß"} <= labels


def test_pressure_canvas_handles_partial_sensor_map() -> None:
    raw = pd.DataFrame(
        {
            "timestamp_ms": [0, 10, 20],
            "L1_heel": [10, 20, 30],
            "L2_lateral_forefoot": [20, 20, 20],
        }
    )
    _, normalized = load_pressure_dataframe(raw, window=3)
    result = analyze_pressure(normalized)

    payload = build_pressure_canvas_payload(result, show_labels=True)
    html = build_pressure_canvas_html(result, show_labels=True)
    left, right = payload["feet"]

    assert left["id"] == "left"
    assert right["id"] == "right"
    assert left["hasData"] is True
    assert right["hasData"] is False
    assert [sensor["id"] for sensor in left["sensors"]] == [
        "heel",
        "lateral_forefoot",
    ]
    assert all(sensor["id"] != "medial_forefoot" for sensor in left["sensors"])
    assert "Keine Daten" in html


def test_pressure_canvas_handles_no_sensor_data() -> None:
    result = analyze_pressure(pd.DataFrame({"timestamp_ms": [0, 10]}))

    payload = build_pressure_canvas_payload(result)
    html = build_pressure_canvas_html(result)

    assert payload["maxPressure"] == 0.0
    assert all(not foot["hasData"] for foot in payload["feet"])
    assert html.count("Keine Daten") >= 1
