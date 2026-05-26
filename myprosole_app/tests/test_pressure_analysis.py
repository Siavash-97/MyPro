from __future__ import annotations

from pathlib import Path

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
    FOOT_MASK_PATHS,
    FOOT_TEMPLATE_PATHS,
    build_pressure_canvas_html,
    build_pressure_canvas_payload,
)

ROOT = Path(__file__).resolve().parent.parent


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
    assert "L3_medial_forefoot" not in normalized.columns
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

    assert all(path.is_file() for path in FOOT_TEMPLATE_PATHS.values())
    assert all(path.is_file() for path in FOOT_MASK_PATHS.values())
    assert payload["showLabels"] is False
    assert payload["maxPressure"] == 30.0
    assert len(payload["feet"]) == 2
    assert all(foot["hasData"] for foot in payload["feet"])
    assert all(len(foot["sensors"]) == 3 for foot in payload["feet"])
    assert all("mirror" not in foot for foot in payload["feet"])
    left, right = payload["feet"]
    assert next(sensor for sensor in left["sensors"] if sensor["id"] == "sensor_1_heel")["x"] == 63.2
    assert next(sensor for sensor in right["sensors"] if sensor["id"] == "sensor_1_heel")["x"] == 36.8
    assert [sensor["sourceColumn"] for sensor in right["sensors"]] == [
        "R1_heel",
        "R2_lateral_forefoot",
        "R3_medial_forefoot",
    ]
    left_medial = next(
        sensor
        for sensor in left["sensors"]
        if sensor["sourceColumn"] == "L3_medial_forefoot"
    )
    right_medial = next(
        sensor
        for sensor in right["sensors"]
        if sensor["sourceColumn"] == "R3_medial_forefoot"
    )
    assert left_medial["id"] == "sensor_5_third_toe_joint"
    assert right_medial["id"] == "sensor_5_third_toe_joint"
    assert left_medial["number"] == 5
    assert right_medial["number"] == 5
    assert html.count("data:image/png;base64,") >= 4
    assert "drawSensorBadges" not in html
    assert "fillText(String(sensor.number" not in html
    assert "drawMirroredImage" not in html
    assert "Druckkarte" in html


def test_frontend_canvas_does_not_force_sensor_numbers() -> None:
    component = (
        ROOT / "frontend" / "pressure_canvas" / "FootPressureCanvas.jsx"
    ).read_text(encoding="utf-8")

    assert "showLabels = false" in component
    assert "drawSensorBadges" not in component
    assert "fillText(String(sensor.number" not in component
    assert "fillText(String(sensor.number ??" not in component


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
    assert {"Linke Ferse", "Linker lateraler Vorfuß / kleiner Zeh"} <= labels


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
        "sensor_1_heel",
        "sensor_4_little_toe_joint",
    ]
    assert [sensor["sourceColumn"] for sensor in left["sensors"]] == [
        "L1_heel",
        "L2_lateral_forefoot",
    ]
    assert all(sensor["id"] != "sensor_5_third_toe_joint" for sensor in left["sensors"])
    assert "Keine Daten" in html


def test_pressure_canvas_maps_right_partial_csv_to_only_real_sensors() -> None:
    raw = pd.DataFrame(
        {
            "timestamp_ms": [0, 10, 20],
            "R1_heel": [0.05, 0.0, 0.05],
            "R3_medial_forefoot": [0.02, 0.05, 0.0],
        }
    )
    sensor_format, normalized = load_pressure_dataframe(raw, window=3)
    result = analyze_pressure(normalized)

    payload = build_pressure_canvas_payload(result, show_labels=True)
    left, right = payload["feet"]

    assert sensor_format == PARTIAL_PRESSURE_FORMAT
    assert "R2_lateral_forefoot" not in normalized.columns
    assert result.sensor_columns["left"] == []
    assert result.sensor_columns["right"] == ["R1_heel", "R3_medial_forefoot"]
    assert "R2_lateral_forefoot" in result.missing_sensor_columns
    assert left["hasData"] is False
    assert right["hasData"] is True
    assert [sensor["id"] for sensor in right["sensors"]] == [
        "sensor_1_heel",
        "sensor_5_third_toe_joint",
    ]
    assert [sensor["number"] for sensor in right["sensors"]] == [1, 5]
    assert right["pressureBalance"]["complete"] is False
    assert right["pressureBalance"]["status"] == "incomplete"
    assert "lateraler Vorfuss" in right["pressureBalance"]["missingRegions"]
    assert max(sensor["colorIntensity"] for sensor in right["sensors"]) <= 0.62
    assert [sensor["sourceColumn"] for sensor in right["sensors"]] == [
        "R1_heel",
        "R3_medial_forefoot",
    ]
    assert all(
        sensor["id"] != "sensor_4_little_toe_joint" for sensor in right["sensors"]
    )
    assert all(sensor["id"] != "sensor_6_big_toe_joint" for sensor in right["sensors"])


def test_pressure_balance_keeps_sixty_forty_neutral() -> None:
    raw = pd.DataFrame(
        {
            "timestamp_ms": [0, 10, 20],
            "L1_heel": [60, 60, 60],
            "L2_lateral_forefoot": [20, 20, 20],
            "L3_medial_forefoot": [20, 20, 20],
        }
    )
    _, normalized = load_pressure_dataframe(raw, window=3)
    result = analyze_pressure(normalized)

    payload = build_pressure_canvas_payload(result)
    left = payload["feet"][0]

    assert left["pressureBalance"]["complete"] is True
    assert left["pressureBalance"]["status"] == "balanced"
    assert left["pressureBalance"]["heelShare"] == 60.0
    assert left["pressureBalance"]["forefootShare"] == 40.0
    assert max(sensor["colorIntensity"] for sensor in left["sensors"]) <= 0.33


def test_pressure_balance_colors_elevated_zone_toward_red() -> None:
    raw = pd.DataFrame(
        {
            "timestamp_ms": [0, 10, 20],
            "L1_heel": [90, 90, 90],
            "L2_lateral_forefoot": [5, 5, 5],
            "L3_medial_forefoot": [5, 5, 5],
            "R1_heel": [20, 20, 20],
            "R2_lateral_forefoot": [40, 40, 40],
            "R3_medial_forefoot": [40, 40, 40],
        }
    )
    _, normalized = load_pressure_dataframe(raw, window=3)
    result = analyze_pressure(normalized)

    payload = build_pressure_canvas_payload(result)
    left, right = payload["feet"]
    left_heel = next(sensor for sensor in left["sensors"] if sensor["sourceColumn"] == "L1_heel")
    left_forefoot = [
        sensor
        for sensor in left["sensors"]
        if sensor["balanceZone"] == "forefoot"
    ]
    right_heel = next(sensor for sensor in right["sensors"] if sensor["sourceColumn"] == "R1_heel")
    right_forefoot = [
        sensor
        for sensor in right["sensors"]
        if sensor["balanceZone"] == "forefoot"
    ]

    assert left["pressureBalance"]["status"] == "heel_elevated"
    assert left_heel["colorIntensity"] > 0.9
    assert max(sensor["colorIntensity"] for sensor in left_forefoot) <= 0.33
    assert right["pressureBalance"]["status"] == "forefoot_elevated"
    assert right_heel["colorIntensity"] <= 0.33
    assert min(sensor["colorIntensity"] for sensor in right_forefoot) > 0.9


def test_pressure_canvas_handles_no_sensor_data() -> None:
    result = analyze_pressure(pd.DataFrame({"timestamp_ms": [0, 10]}))

    payload = build_pressure_canvas_payload(result)
    html = build_pressure_canvas_html(result)

    assert payload["maxPressure"] == 0.0
    assert all(not foot["hasData"] for foot in payload["feet"])
    assert html.count("Keine Daten") >= 1
