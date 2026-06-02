"""Build frame sequences for foot pressure replay from time-series CSV data."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

import numpy as np
import pandas as pd

from core.domain.sensor_mapping import LEFT, RIGHT, columns_for_foot
from myprosole_analysis import config as gait_config

ReplayNormalization = Literal["session", "step"]


@dataclass(frozen=True)
class ReplaySequence:
    """Serializable replay payload for the Canvas component."""

    frames: list[dict]
    steps: list[dict]
    session_max: float
    step_max_by_id: dict[int, float]
    timeline_left: list[float]
    timeline_right: list[float]
    sensor_threshold: float
    foot_labels: dict[str, str]


def _foot_code(foot: str) -> str:
    return "L" if foot == LEFT else "R"


def build_replay_sequence(
    df: pd.DataFrame,
    steps: list[dict],
    *,
    sensor_threshold: float | None = None,
) -> ReplaySequence:
    """Convert a cleaned sensor dataframe + detected steps into replay frames."""
    threshold = float(
        sensor_threshold
        if sensor_threshold is not None
        else gait_config.SENSOR_THRESHOLD
    )
    time_col = gait_config.TIME_COLUMN
    if time_col not in df.columns:
        raise ValueError(f"Zeitspalte '{time_col}' fehlt im Datensatz.")

    left_cols = list(columns_for_foot(LEFT))
    right_cols = list(columns_for_foot(RIGHT))
    for column in left_cols + right_cols:
        if column not in df.columns:
            raise ValueError(f"Sensorspalte '{column}' fehlt im Datensatz.")

    times = df[time_col].to_numpy(dtype=float)
    left_values = df[left_cols].to_numpy(dtype=float)
    right_values = df[right_cols].to_numpy(dtype=float)

    session_max = float(
        max(
            np.max(left_values) if left_values.size else 0.0,
            np.max(right_values) if right_values.size else 0.0,
            1.0,
        )
    )

    timeline_left = np.sum(left_values, axis=1).round(1).tolist()
    timeline_right = np.sum(right_values, axis=1).round(1).tolist()

    frames: list[dict] = []
    for index in range(len(df)):
        frames.append(
            {
                "i": index,
                "t": round(float(times[index]), 3),
                "L": [round(float(v), 1) for v in left_values[index]],
                "R": [round(float(v), 1) for v in right_values[index]],
            }
        )

    step_max_by_id: dict[int, float] = {}
    step_payloads: list[dict] = []
    for step in steps:
        step_id = int(step["step_id"])
        start_idx = int(step["start_index"])
        end_idx = int(step["end_index"])
        foot = step["foot"]
        values = left_values if foot == "L" else right_values
        slice_values = values[start_idx : end_idx + 1]
        step_max = float(np.max(slice_values)) if slice_values.size else 1.0
        step_max_by_id[step_id] = max(step_max, 1.0)

        activation_order = step.get("activation_order") or []
        ratio = step.get("heel_to_forefoot_ratio")
        step_payloads.append(
            {
                "id": step_id,
                "foot": foot,
                "footLabel": "Links" if foot == "L" else "Rechts",
                "startIdx": start_idx,
                "endIdx": end_idx,
                "startT": round(float(step.get("stance_start_time", times[start_idx])), 3),
                "endT": round(float(step.get("stance_end_time", times[end_idx])), 3),
                "activationOrder": "->".join(activation_order),
                "firstActive": step.get("first_active_sensor"),
                "heelToForefootRatio": (
                    round(float(ratio), 3) if ratio is not None else None
                ),
                "classification": step.get("classification"),
                "contactPattern": step.get("contact_pattern"),
            }
        )

    return ReplaySequence(
        frames=frames,
        steps=step_payloads,
        session_max=session_max,
        step_max_by_id=step_max_by_id,
        timeline_left=timeline_left,
        timeline_right=timeline_right,
        sensor_threshold=threshold,
        foot_labels={"L": "Links", "R": "Rechts"},
    )


def frame_range_for_step(replay: ReplaySequence, step_id: int | None) -> tuple[int, int]:
    """Return inclusive frame index bounds for a step, or the full recording."""
    if step_id is None:
        return 0, max(len(replay.frames) - 1, 0)
    for step in replay.steps:
        if step["id"] == step_id:
            return int(step["startIdx"]), int(step["endIdx"])
    return 0, max(len(replay.frames) - 1, 0)


def active_step_at_frame(replay: ReplaySequence, frame_index: int) -> dict | None:
    for step in replay.steps:
        if step["startIdx"] <= frame_index <= step["endIdx"]:
            return step
    return None


def reduce_replay_frames(replay: ReplaySequence, *, max_frames: int = 900) -> ReplaySequence:
    """Downsample replay payload to keep Streamlit HTML payload lightweight."""
    total = len(replay.frames)
    if total <= max_frames or max_frames <= 0:
        return replay

    stride = max(1, int(np.ceil(total / max_frames)))
    keep_indices = list(range(0, total, stride))
    if keep_indices[-1] != total - 1:
        keep_indices.append(total - 1)

    index_map = {old_idx: new_idx for new_idx, old_idx in enumerate(keep_indices)}

    reduced_frames: list[dict] = []
    for new_idx, old_idx in enumerate(keep_indices):
        frame = replay.frames[old_idx]
        reduced_frames.append(
            {
                "i": new_idx,
                "t": frame["t"],
                "L": frame["L"],
                "R": frame["R"],
            }
        )

    reduced_steps: list[dict] = []
    for step in replay.steps:
        old_start = int(step["startIdx"])
        old_end = int(step["endIdx"])
        new_start = old_start // stride
        new_end = old_end // stride
        if new_start >= len(reduced_frames):
            continue
        new_end = min(new_end, len(reduced_frames) - 1)
        if new_end < new_start:
            continue

        reduced_step = dict(step)
        reduced_step["startIdx"] = new_start
        reduced_step["endIdx"] = new_end
        reduced_steps.append(reduced_step)

    reduced_left = [replay.timeline_left[idx] for idx in keep_indices]
    reduced_right = [replay.timeline_right[idx] for idx in keep_indices]

    return ReplaySequence(
        frames=reduced_frames,
        steps=reduced_steps,
        session_max=replay.session_max,
        step_max_by_id=replay.step_max_by_id,
        timeline_left=reduced_left,
        timeline_right=reduced_right,
        sensor_threshold=replay.sensor_threshold,
        foot_labels=replay.foot_labels,
    )
