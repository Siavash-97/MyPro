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
    """One physical sensor in the insole mapping."""

    column: str
    foot: str
    region: str
    label: str
    aliases: tuple[str, ...] = ()


@dataclass(frozen=True)
class FootRegionVisualDefinition:
    """Normalized size-44 visual placement for one pressure region."""

    region: str
    x: float
    y: float
    width: float
    height: float


SENSOR_DEFINITIONS: tuple[SensorDefinition, ...] = (
    SensorDefinition(
        column="L1_heel",
        foot=LEFT,
        region=HEEL,
        label="Linke Ferse",
        aliases=("L1", "left_heel"),
    ),
    SensorDefinition(
        column="L2_lateral_forefoot",
        foot=LEFT,
        region=LATERAL_FOREFOOT,
        label="Linker lateraler Vorfuß / kleiner Zeh",
        aliases=("L2", "left_lateral_forefoot"),
    ),
    SensorDefinition(
        column="L3_medial_forefoot",
        foot=LEFT,
        region=MEDIAL_FOREFOOT,
        label="Linker medialer Vorfuß / großer Zeh",
        aliases=("L3", "left_medial_forefoot"),
    ),
    SensorDefinition(
        column="R1_heel",
        foot=RIGHT,
        region=HEEL,
        label="Rechte Ferse",
        aliases=("R1", "right_heel"),
    ),
    SensorDefinition(
        column="R2_lateral_forefoot",
        foot=RIGHT,
        region=LATERAL_FOREFOOT,
        label="Rechter lateraler Vorfuß / kleiner Zeh",
        aliases=("R2", "right_lateral_forefoot"),
    ),
    SensorDefinition(
        column="R3_medial_forefoot",
        foot=RIGHT,
        region=MEDIAL_FOREFOOT,
        label="Rechter medialer Vorfuß / großer Zeh",
        aliases=("R3", "right_medial_forefoot"),
    ),
)

SENSOR_COLUMNS = tuple(sensor.column for sensor in SENSOR_DEFINITIONS)

VISUAL_FOOT_SIZE_EU = 44

# Normalized left-foot outline for a simple EU-44 template. The right foot mirrors x.
FOOT_OUTLINE_TEMPLATE: tuple[tuple[float, float], ...] = (
    (0.50, 0.04),
    (0.38, 0.05),
    (0.28, 0.13),
    (0.23, 0.28),
    (0.25, 0.48),
    (0.17, 0.68),
    (0.19, 0.84),
    (0.31, 0.96),
    (0.46, 0.93),
    (0.56, 0.98),
    (0.72, 0.94),
    (0.84, 0.81),
    (0.82, 0.65),
    (0.74, 0.48),
    (0.76, 0.31),
    (0.70, 0.16),
    (0.61, 0.07),
)

VISUAL_REGION_TEMPLATE: dict[str, FootRegionVisualDefinition] = {
    HEEL: FootRegionVisualDefinition(
        region=HEEL,
        x=0.50,
        y=0.22,
        width=0.32,
        height=0.24,
    ),
    LATERAL_FOREFOOT: FootRegionVisualDefinition(
        region=LATERAL_FOREFOOT,
        x=0.34,
        y=0.72,
        width=0.30,
        height=0.26,
    ),
    MEDIAL_FOREFOOT: FootRegionVisualDefinition(
        region=MEDIAL_FOREFOOT,
        x=0.66,
        y=0.72,
        width=0.30,
        height=0.26,
    ),
}


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


def visual_outline_for_foot(foot: str) -> tuple[tuple[float, float], ...]:
    if foot == RIGHT:
        return tuple((1.0 - x, y) for x, y in FOOT_OUTLINE_TEMPLATE)
    return FOOT_OUTLINE_TEMPLATE


def visual_region_for_foot(foot: str, region: str) -> FootRegionVisualDefinition:
    visual = VISUAL_REGION_TEMPLATE[region]
    if foot == RIGHT:
        return FootRegionVisualDefinition(
            region=visual.region,
            x=1.0 - visual.x,
            y=visual.y,
            width=visual.width,
            height=visual.height,
        )
    return visual
