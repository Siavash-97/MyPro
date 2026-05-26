// Python sensor_mapping.py owns the CSV-column mapping:
// heel -> sensor_1_heel, lateral forefoot -> sensor_4_little_toe_joint,
// medial forefoot -> sensor_5_third_toe_joint. Other points remain placeholders.
const LEFT_SENSOR_LAYOUT = {
  sensor_1_heel: {
    number: 1,
    label: "Ferse",
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
  return sourceSensors
    .filter((sensor) => layout[sensor.id])
    .map((sensor) => ({
      ...sensor,
      label: sensor.label ?? layout[sensor.id].label,
      number: sensor.number ?? layout[sensor.id].number,
    }));
}
