from __future__ import annotations

import pandas as pd

from myprosole_analysis import config
from myprosole_analysis import gait_classification
from myprosole_analysis import step_features


def _make_step(
    s1: list[float],
    s2: list[float],
    s3: list[float],
    *,
    stance_duration_ms: float = 620.0,
    gait_cycle_duration_ms: float = 1100.0,
) -> dict:
    time_s = [i * 0.01 for i in range(len(s1))]
    raw = pd.DataFrame(
        {
            config.TIME_COLUMN: time_s,
            "L1_heel": s1,
            "L2_lateral_forefoot": s2,
            "L3_medial_forefoot": s3,
        }
    )
    return {
        "raw_step_data": raw,
        "sensor_columns": config.LEFT_SENSOR_COLUMNS,
        "stance_duration_ms": stance_duration_ms,
        "gait_cycle_duration_ms": gait_cycle_duration_ms,
    }


def test_heel_to_forefoot_ratio_for_classic_heel_strike():
    s1 = [0, 0, 500, 500, 400, 200, 0, 0]
    s2 = [0, 0, 0, 0, 0, 450, 450, 0]
    s3 = [0, 0, 0, 0, 0, 0, 480, 0]
    step = _make_step(s1, s2, s3, stance_duration_ms=70.0)
    step_features.compute_features_for_steps([step])

    assert step["heel_to_forefoot_time_ms"] == 30.0
    assert abs(step["heel_to_forefoot_ratio"] - (30.0 / 70.0)) < 1e-6
    assert step["first_active_sensor"] == "S1"
    assert abs(step["cadence_spm"] - (60000.0 / 1100.0)) < 0.01


def test_simultaneous_sensors_same_sample():
    s1 = [0, 500, 500, 400, 0]
    s2 = [0, 520, 520, 300, 0]
    s3 = [0, 0, 0, 480, 0]
    step = _make_step(s1, s2, s3, stance_duration_ms=40.0)
    step_features.compute_features_for_steps([step])

    assert set(step["simultaneous_sensors"]) == {"S1", "S2"}
    assert step["first_active_sensor"] == "S1+S2"
    assert step["activation_order"][0] == "S1+S2"


def test_flat_foot_detected_by_ratio_at_fast_pace():
    s1 = [0, 500, 500, 300, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
    s2 = [0, 0, 0, 0, 450, 450, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
    s3 = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
    step = _make_step(s1, s2, s3, stance_duration_ms=200.0)
    step_features.compute_features_for_steps([step])
    gait_classification.classify_steps([step])

    assert step["heel_to_forefoot_time_ms"] == 30.0
    assert abs(step["heel_to_forefoot_ratio"] - 0.15) < 1e-6
    assert step["is_flat_foot_contact"] is True
    assert step["classification"] == "fast_flat_foot_contact"
