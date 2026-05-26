const LEFT_SENSOR_LAYOUT = {
  sensor_1_heel: {
    number: 1,
    label: "Ferse",
    sourceRegions: ["heel"],
    x: 63.2,
    y: 82.8,
    radiusX: 12,
    radiusY: 10,
    rotation: 0,
    maxSpread: 1.12,
  },
  sensor_2_midfoot_lateral: {
    number: 2,
    label: "Lateraler Mittelfuss",
    sourceRegions: ["lateral_forefoot"],
    x: 45.3,
    y: 59.3,
    radiusX: 8,
    radiusY: 7,
    rotation: 0,
    maxSpread: 1.02,
  },
  sensor_3_midfoot_medial: {
    number: 3,
    label: "Medialer Mittelfuss",
    sourceRegions: ["medial_forefoot"],
    x: 36,
    y: 43.2,
    radiusX: 8,
    radiusY: 7,
    rotation: 0,
    maxSpread: 1.02,
  },
  sensor_4_little_toe_joint: {
    number: 4,
    label: "Kleinzehengrundgelenk",
    sourceRegions: ["lateral_forefoot"],
    x: 49.6,
    y: 33.9,
    radiusX: 8,
    radiusY: 7,
    rotation: -6,
    maxSpread: 1.04,
  },
  sensor_5_third_toe_joint: {
    number: 5,
    label: "Mittlere Ballenlinie",
    sourceRegions: ["lateral_forefoot", "medial_forefoot"],
    x: 66.9,
    y: 31.9,
    radiusX: 8,
    radiusY: 7,
    rotation: 5,
    maxSpread: 1.03,
  },
  sensor_6_big_toe_joint: {
    number: 6,
    label: "Grosszehengrundgelenk",
    sourceRegions: ["medial_forefoot"],
    x: 64.8,
    y: 56.5,
    radiusX: 8,
    radiusY: 7,
    rotation: 0,
    maxSpread: 1.04,
  },
};

const RIGHT_SENSOR_LAYOUT = {
  sensor_1_heel: {
    number: 1,
    label: "Ferse",
    sourceRegions: ["heel"],
    x: 36.8,
    y: 82.8,
    radiusX: 12,
    radiusY: 10,
    rotation: 0,
    maxSpread: 1.12,
  },
  sensor_2_midfoot_lateral: {
    number: 2,
    label: "Lateraler Mittelfuss",
    sourceRegions: ["lateral_forefoot"],
    x: 54.7,
    y: 59.3,
    radiusX: 8,
    radiusY: 7,
    rotation: 0,
    maxSpread: 1.02,
  },
  sensor_3_midfoot_medial: {
    number: 3,
    label: "Medialer Mittelfuss",
    sourceRegions: ["medial_forefoot"],
    x: 64,
    y: 43.2,
    radiusX: 8,
    radiusY: 7,
    rotation: 0,
    maxSpread: 1.02,
  },
  sensor_4_little_toe_joint: {
    number: 4,
    label: "Kleinzehengrundgelenk",
    sourceRegions: ["lateral_forefoot"],
    x: 50.4,
    y: 33.9,
    radiusX: 8,
    radiusY: 7,
    rotation: 6,
    maxSpread: 1.04,
  },
  sensor_5_third_toe_joint: {
    number: 5,
    label: "Mittlere Ballenlinie",
    sourceRegions: ["lateral_forefoot", "medial_forefoot"],
    x: 33.1,
    y: 31.9,
    radiusX: 8,
    radiusY: 7,
    rotation: -5,
    maxSpread: 1.03,
  },
  sensor_6_big_toe_joint: {
    number: 6,
    label: "Grosszehengrundgelenk",
    sourceRegions: ["medial_forefoot"],
    x: 35.2,
    y: 56.5,
    radiusX: 8,
    radiusY: 7,
    rotation: 0,
    maxSpread: 1.04,
  },
};

export const SENSOR_LAYOUT = {
  left: LEFT_SENSOR_LAYOUT,
  right: RIGHT_SENSOR_LAYOUT,
};

export function layoutForFoot(side, sensorId) {
  return SENSOR_LAYOUT[side]?.[sensorId] ?? null;
}

export function allLayoutSensorsForFoot(side) {
  const layout = SENSOR_LAYOUT[side] ?? SENSOR_LAYOUT.left;
  return Object.entries(layout).map(([id, sensor]) => ({ id, ...sensor }));
}

export function visualSensorsForFoot(side, sourceSensors) {
  const layout = SENSOR_LAYOUT[side] ?? SENSOR_LAYOUT.left;
  const providedVisualSensors = sourceSensors.filter((sensor) => layout[sensor.id]);

  if (providedVisualSensors.length > 0) {
    return providedVisualSensors.map((sensor) => ({
      ...sensor,
      label: sensor.label ?? layout[sensor.id].label,
      number: sensor.number ?? layout[sensor.id].number,
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
        number: sensorLayout.number,
        value,
        percentage,
      };
    })
    .filter(Boolean);
}
