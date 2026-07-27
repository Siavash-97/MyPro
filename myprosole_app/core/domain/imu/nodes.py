"""Generic sensor-node registry — the extensibility backbone for IMU hardware.

Today only the two insoles carry a sensor. Future body-worn IMUs (shin,
thigh, trunk, arm) are modeled here as additional node definitions, so that
adding hardware later is a new entry in ``NODE_DEFINITIONS`` — not a rewrite
of calibration, schema detection, or analysis code. Calibration and analysis
must always iterate over the *active* node list of a session, never assume
a fixed left/right pair.
"""

from __future__ import annotations

from dataclasses import dataclass

FOOT = "foot"
SHIN = "shin"
THIGH = "thigh"
TRUNK = "trunk"
UPPER_ARM = "upper_arm"

LEFT = "left"
RIGHT = "right"
CENTER = "center"


@dataclass(frozen=True)
class SensorNodeDefinition:
    """One physical sensor-carrying location on the body."""

    node_id: str
    label: str
    body_location: str
    side: str  # "left" | "right" | "center"
    has_fsr: bool
    has_imu: bool
    required: bool


NODE_DEFINITIONS: tuple[SensorNodeDefinition, ...] = (
    SensorNodeDefinition(
        "insole_left", "Einlage links", FOOT, LEFT,
        has_fsr=True, has_imu=True, required=True,
    ),
    SensorNodeDefinition(
        "insole_right", "Einlage rechts", FOOT, RIGHT,
        has_fsr=True, has_imu=True, required=True,
    ),
    SensorNodeDefinition(
        "shin_left", "Unterschenkel links", SHIN, LEFT,
        has_fsr=False, has_imu=True, required=False,
    ),
    SensorNodeDefinition(
        "shin_right", "Unterschenkel rechts", SHIN, RIGHT,
        has_fsr=False, has_imu=True, required=False,
    ),
    SensorNodeDefinition(
        "thigh_left", "Oberschenkel links", THIGH, LEFT,
        has_fsr=False, has_imu=True, required=False,
    ),
    SensorNodeDefinition(
        "thigh_right", "Oberschenkel rechts", THIGH, RIGHT,
        has_fsr=False, has_imu=True, required=False,
    ),
    SensorNodeDefinition(
        "trunk", "Rumpf", TRUNK, CENTER,
        has_fsr=False, has_imu=True, required=False,
    ),
    SensorNodeDefinition(
        "upper_arm_left", "Oberarm links", UPPER_ARM, LEFT,
        has_fsr=False, has_imu=True, required=False,
    ),
    SensorNodeDefinition(
        "upper_arm_right", "Oberarm rechts", UPPER_ARM, RIGHT,
        has_fsr=False, has_imu=True, required=False,
    ),
)

NODES_BY_ID: dict[str, SensorNodeDefinition] = {node.node_id: node for node in NODE_DEFINITIONS}


def node_by_id(node_id: str) -> SensorNodeDefinition | None:
    return NODES_BY_ID.get(node_id)


def required_nodes() -> tuple[SensorNodeDefinition, ...]:
    return tuple(node for node in NODE_DEFINITIONS if node.required)


def optional_nodes() -> tuple[SensorNodeDefinition, ...]:
    return tuple(node for node in NODE_DEFINITIONS if not node.required)
