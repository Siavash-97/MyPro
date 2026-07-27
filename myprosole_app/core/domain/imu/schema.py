"""IMU column schema and detection — one naming convention per sensor node.

Canonical column naming: ``{node_id}_ax|ay|az|gx|gy|gz`` (accel in g, gyro in
deg/s). The two insole nodes additionally accept short ``L_``/``R_`` aliases,
matching the shorthand already used for FSR columns in ``sensor_mapping.py``.
A node only counts as "detected" when all six axis columns are present —
partial IMU data is treated as absent rather than guessed at.
"""

from __future__ import annotations

from dataclasses import dataclass

import pandas as pd

from core.domain.imu.nodes import NODE_DEFINITIONS, SensorNodeDefinition

IMU_AXES = ("ax", "ay", "az", "gx", "gy", "gz")

_SHORT_ALIASES: dict[str, str] = {
    "insole_left": "L",
    "insole_right": "R",
}


@dataclass(frozen=True)
class ImuColumnSet:
    """Maps a node's six IMU axes to the actual column names in a dataframe."""

    node_id: str
    columns: dict[str, str]


def _candidate_prefixes(node: SensorNodeDefinition) -> tuple[str, ...]:
    prefixes = [node.node_id]
    alias = _SHORT_ALIASES.get(node.node_id)
    if alias:
        prefixes.append(alias)
    return tuple(prefixes)


def _find_axis_column(
    normalized_columns: dict[str, str], prefixes: tuple[str, ...], axis: str
) -> str | None:
    for prefix in prefixes:
        candidate = f"{prefix}_{axis}".strip().lower()
        found = normalized_columns.get(candidate)
        if found is not None:
            return found
    return None


def detect_imu_columns(df: pd.DataFrame) -> dict[str, ImuColumnSet]:
    """Return, per node_id, the IMU axis columns actually present in ``df``.

    Only nodes with a complete 6-axis set (ax, ay, az, gx, gy, gz) are
    included — this is Etappe 0 ("welche Knoten liefern überhaupt Daten"),
    not yet the orientation math.
    """
    normalized_columns = {str(column).strip().lower(): column for column in df.columns}

    detected: dict[str, ImuColumnSet] = {}
    for node in NODE_DEFINITIONS:
        if not node.has_imu:
            continue
        prefixes = _candidate_prefixes(node)
        columns: dict[str, str] = {}
        for axis in IMU_AXES:
            found = _find_axis_column(normalized_columns, prefixes, axis)
            if found is not None:
                columns[axis] = found
        if len(columns) == len(IMU_AXES):
            detected[node.node_id] = ImuColumnSet(node_id=node.node_id, columns=columns)
    return detected


def active_node_ids(df: pd.DataFrame) -> list[str]:
    """Node ids with a complete 6-axis IMU column set in this dataframe."""
    return list(detect_imu_columns(df).keys())


def extract_imu_dataframe(df: pd.DataFrame, node_id: str) -> pd.DataFrame | None:
    """Return a small ax..gz dataframe for one detected node, or None if absent."""
    column_set = detect_imu_columns(df).get(node_id)
    if column_set is None:
        return None
    return pd.DataFrame({axis: df[column].to_numpy() for axis, column in column_set.columns.items()})
