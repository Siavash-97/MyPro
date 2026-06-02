"""Tests for foot pressure replay frame building."""

from __future__ import annotations

import pandas as pd

from core.domain.foot_replay import build_replay_sequence, frame_range_for_step
from myprosole_analysis import config as gait_config


def _sample_df(rows: int = 5) -> pd.DataFrame:
    data = {
        gait_config.TIME_COLUMN: [i * 0.1 for i in range(rows)],
    }
    for column in gait_config.LEFT_SENSOR_COLUMNS + gait_config.RIGHT_SENSOR_COLUMNS:
        data[column] = [10.0 + i * 5 for i in range(rows)]
    return pd.DataFrame(data)


def test_build_replay_sequence_creates_one_frame_per_row():
    df = _sample_df(4)
    steps = [
        {
            "step_id": 1,
            "foot": "L",
            "start_index": 0,
            "end_index": 3,
            "stance_start_time": 0.0,
            "stance_end_time": 0.3,
            "activation_order": ["heel", "lateral"],
            "heel_to_forefoot_ratio": 0.15,
        }
    ]
    replay = build_replay_sequence(df, steps)

    assert len(replay.frames) == 4
    assert replay.frames[0]["t"] == 0.0
    assert len(replay.frames[0]["L"]) == 3
    assert replay.session_max >= 10.0
    assert replay.step_max_by_id[1] >= 10.0
    assert len(replay.timeline_left) == 4


def test_frame_range_for_step_limits_indices():
    df = _sample_df(6)
    steps = [
        {
            "step_id": 2,
            "foot": "R",
            "start_index": 2,
            "end_index": 4,
            "stance_start_time": 0.2,
            "stance_end_time": 0.4,
        }
    ]
    replay = build_replay_sequence(df, steps)

    assert frame_range_for_step(replay, None) == (0, 5)
    assert frame_range_for_step(replay, 2) == (2, 4)
