const LEFT_SENSOR_LAYOUT = {
  sensor_1_heel: {
    label: "Ferse",
    sourceRegions: ["heel"],
    x: 50,
    y: 78,
    radiusX: 10,
    radiusY: 12,
    rotation: 0,
    maxSpread: 1.12,
  },
  sensor_2_midfoot_lateral: {
    label: "Lateraler Mittelfuss",
    sourceRegions: ["lateral_forefoot"],
    x: 38,
    y: 56,
    radiusX: 5,
    radiusY: 8,
    rotation: -15,
    maxSpread: 1.02,
  },
  sensor_3_midfoot_medial: {
    label: "Medialer Mittelfuss",
    sourceRegions: ["medial_forefoot"],
    x: 58,
    y: 54,
    radiusX: 5,
    radiusY: 8,
    rotation: 10,
    maxSpread: 1.02,
  },
  sensor_4_little_toe_joint: {
    label: "Kleinzehengrundgelenk",
    sourceRegions: ["lateral_forefoot"],
    x: 34,
    y: 33,
    radiusX: 7,
    radiusY: 5,
    rotation: -20,
    maxSpread: 1.04,
  },
  sensor_5_third_toe_joint: {
    label: "Mittlere Ballenlinie",
    sourceRegions: ["lateral_forefoot", "medial_forefoot"],
    x: 46,
    y: 31,
    radiusX: 7,
    radiusY: 5,
    rotation: 0,
    maxSpread: 1.03,
  },
  sensor_6_big_toe_joint: {
    label: "Grosszehengrundgelenk",
    sourceRegions: ["medial_forefoot"],
    x: 58,
    y: 32,
    radiusX: 8,
    radiusY: 5,
    rotation: 12,
    maxSpread: 1.04,
  },
};

function mirrorLayout(layout) {
  return Object.fromEntries(
    Object.entries(layout).map(([sensorId, sensor]) => [
      sensorId,
      {
        ...sensor,
        x: 100 - sensor.x,
        rotation: -sensor.rotation,
      },
    ]),
  );
}

export const SENSOR_LAYOUT = {
  left: LEFT_SENSOR_LAYOUT,
  right: mirrorLayout(LEFT_SENSOR_LAYOUT),
};

export function layoutForFoot(side, sensorId) {
  return SENSOR_LAYOUT[side]?.[sensorId] ?? null;
}

export function visualSensorsForFoot(side, sourceSensors) {
  const layout = SENSOR_LAYOUT[side] ?? SENSOR_LAYOUT.left;
  const providedVisualSensors = sourceSensors.filter((sensor) => layout[sensor.id]);

  if (providedVisualSensors.length > 0) {
    return providedVisualSensors.map((sensor) => ({
      ...sensor,
      label: sensor.label ?? layout[sensor.id].label,
    }));
  }

  const sensorsById = new Map(sourceSensors.map((sensor) => [sensor.id, sensor]));

  return Object.entries(layout)
    .map(([sensorId, sensorLayout]) => {
      const sourceSensorsForLayout = sensorLayout.sourceRegions
        .map((regionId) => sensorsById.get(regionId))
        .filter(Boolean);

      if (sourceSensorsForLayout.length === 0) {
        return null;
      }

      const value =
        sourceSensorsForLayout.reduce((total, sensor) => total + sensor.value, 0) /
        sourceSensorsForLayout.length;
      const percentage =
        sourceSensorsForLayout.reduce((total, sensor) => total + sensor.percentage, 0) /
        sourceSensorsForLayout.length;

      return {
        id: sensorId,
        label: sensorLayout.label,
        value,
        percentage,
      };
    })
    .filter(Boolean);
}
