"""Central sensor mapping for paired MyProSole insoles."""

from __future__ import annotations

from dataclasses import dataclass

LEFT = "left"
RIGHT = "right"

HEEL = "heel"
LATERAL_FOREFOOT = "lateral_forefoot"
MEDIAL_FOREFOOT = "medial_forefoot"

FOOT_ORDER = (LEFT, RIGHT)
REGION_ORDER = (HEEL, LATERAL_FOREFOOT, MEDIAL_FOREFOOT)

TIMESTAMP_COLUMN = "timestamp_ms"
TIMESTAMP_ALIASES = ("timestamp_ms", "timestamp", "Timestamp", "time", "zeit")

FOOT_LABELS = {
    LEFT: "Links",
    RIGHT: "Rechts",
}

REGION_LABELS = {
    HEEL: "Ferse",
    LATERAL_FOREFOOT: "Lateraler Vorfuß / kleiner Zeh",
    MEDIAL_FOREFOOT: "Medialer Vorfuß / großer Zeh",
}


@dataclass(frozen=True)
class SensorDefinition:
    """One physical sensor and its single pressure-map point."""

    column: str
    foot: str
    region: str
    label: str
    visual_id: str
    aliases: tuple[str, ...] = ()


# Visual mapping rule:
# 1 = heel, 2/3/5 stay as layout placeholders, 4 = lateral forefoot,
# 6 = medial forefoot. A CSV column colors exactly one visual point.
SENSOR_DEFINITIONS: tuple[SensorDefinition, ...] = (
    SensorDefinition(
        column="L1_heel",
        foot=LEFT,
        region=HEEL,
        label="Linke Ferse",
        visual_id="sensor_1_heel",
        aliases=("L1", "left_heel"),
    ),
    SensorDefinition(
        column="L2_lateral_forefoot",
        foot=LEFT,
        region=LATERAL_FOREFOOT,
        label="Linker lateraler Vorfuß / kleiner Zeh",
        visual_id="sensor_4_little_toe_joint",
        aliases=("L2", "left_lateral_forefoot"),
    ),
    SensorDefinition(
        column="L3_medial_forefoot",
        foot=LEFT,
        region=MEDIAL_FOREFOOT,
        label="Linker medialer Vorfuß / großer Zeh",
        visual_id="sensor_6_big_toe_joint",
        aliases=("L3", "left_medial_forefoot"),
    ),
    SensorDefinition(
        column="R1_heel",
        foot=RIGHT,
        region=HEEL,
        label="Rechte Ferse",
        visual_id="sensor_1_heel",
        aliases=("R1", "right_heel"),
    ),
    SensorDefinition(
        column="R2_lateral_forefoot",
        foot=RIGHT,
        region=LATERAL_FOREFOOT,
        label="Rechter lateraler Vorfuß / kleiner Zeh",
        visual_id="sensor_4_little_toe_joint",
        aliases=("R2", "right_lateral_forefoot"),
    ),
    SensorDefinition(
        column="R3_medial_forefoot",
        foot=RIGHT,
        region=MEDIAL_FOREFOOT,
        label="Rechter medialer Vorfuß / großer Zeh",
        visual_id="sensor_6_big_toe_joint",
        aliases=("R3", "right_medial_forefoot"),
    ),
)

SENSOR_COLUMNS = tuple(sensor.column for sensor in SENSOR_DEFINITIONS)


def sensors_for_foot(foot: str) -> tuple[SensorDefinition, ...]:
    return tuple(sensor for sensor in SENSOR_DEFINITIONS if sensor.foot == foot)


def sensors_for_region(foot: str, region: str) -> tuple[SensorDefinition, ...]:
    return tuple(
        sensor
        for sensor in SENSOR_DEFINITIONS
        if sensor.foot == foot and sensor.region == region
    )


def columns_for_foot(foot: str) -> tuple[str, ...]:
    return tuple(sensor.column for sensor in sensors_for_foot(foot))


def columns_for_region(foot: str, region: str) -> tuple[str, ...]:
    return tuple(sensor.column for sensor in sensors_for_region(foot, region))
