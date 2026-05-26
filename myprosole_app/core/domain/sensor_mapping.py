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
    angle: float = 0.0
    sigma_x: float | None = None
    sigma_y: float | None = None
    callout_x: float = 1.08
    callout_y: float = 0.5


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

# Normalized left-foot sole outline for a size EU-44 template. The right foot mirrors x.
FOOT_OUTLINE_TEMPLATE: tuple[tuple[float, float], ...] = (
    (0.50, 0.035),
    (0.39, 0.040),
    (0.30, 0.090),
    (0.24, 0.190),
    (0.22, 0.330),
    (0.25, 0.480),
    (0.20, 0.620),
    (0.16, 0.740),
    (0.18, 0.840),
    (0.27, 0.920),
    (0.37, 0.955),
    (0.47, 0.930),
    (0.56, 0.990),
    (0.66, 0.960),
    (0.75, 0.880),
    (0.80, 0.760),
    (0.78, 0.630),
    (0.72, 0.510),
    (0.74, 0.370),
    (0.70, 0.240),
    (0.62, 0.120),
    (0.55, 0.060),
)

VISUAL_REGION_TEMPLATE: dict[str, FootRegionVisualDefinition] = {
    HEEL: FootRegionVisualDefinition(
        region=HEEL,
        x=0.50,
        y=0.22,
        width=0.34,
        height=0.28,
        sigma_x=0.125,
        sigma_y=0.085,
        callout_x=-0.08,
        callout_y=0.23,
    ),
    LATERAL_FOREFOOT: FootRegionVisualDefinition(
        region=LATERAL_FOREFOOT,
        x=0.34,
        y=0.70,
        width=0.30,
        height=0.28,
        angle=-14.0,
        sigma_x=0.110,
        sigma_y=0.090,
        callout_x=-0.08,
        callout_y=0.68,
    ),
    MEDIAL_FOREFOOT: FootRegionVisualDefinition(
        region=MEDIAL_FOREFOOT,
        x=0.66,
        y=0.77,
        width=0.32,
        height=0.30,
        angle=15.0,
        sigma_x=0.125,
        sigma_y=0.095,
        callout_x=-0.08,
        callout_y=0.80,
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
            angle=-visual.angle,
            sigma_x=visual.sigma_x,
            sigma_y=visual.sigma_y,
            callout_x=1.0 - visual.callout_x,
            callout_y=visual.callout_y,
        )
    return visual
