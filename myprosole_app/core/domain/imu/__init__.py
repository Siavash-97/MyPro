"""IMU domain logic (no Streamlit): sensor-node registry and column schema.

Kept separate from ``core/domain/sensor_mapping.py`` (FSR pressure points)
because IMU nodes are not tied to the insole — future nodes (shin, thigh,
trunk, arm) carry IMU only, no FSR.
"""

from __future__ import annotations

from core.domain.imu.nodes import (
    NODE_DEFINITIONS,
    NODES_BY_ID,
    SensorNodeDefinition,
    node_by_id,
    optional_nodes,
    required_nodes,
)
from core.domain.imu.schema import (
    IMU_AXES,
    ImuColumnSet,
    active_node_ids,
    detect_imu_columns,
    extract_imu_dataframe,
)

__all__ = [
    "NODE_DEFINITIONS",
    "NODES_BY_ID",
    "SensorNodeDefinition",
    "node_by_id",
    "optional_nodes",
    "required_nodes",
    "IMU_AXES",
    "ImuColumnSet",
    "active_node_ids",
    "detect_imu_columns",
    "extract_imu_dataframe",
]
