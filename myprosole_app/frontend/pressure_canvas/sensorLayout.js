export const SENSOR_LAYOUT = {
  heel: {
    label: "Ferse",
    xPercent: 51,
    yPercent: 80,
    radiusPercent: 21,
  },
  lateral_forefoot: {
    label: "Lateraler Vorfuss",
    xPercent: 40,
    yPercent: 28,
    radiusPercent: 22,
  },
  medial_forefoot: {
    label: "Medialer Vorfuss",
    xPercent: 62,
    yPercent: 23,
    radiusPercent: 23,
  },
};

export function layoutForFoot(side, sensorId) {
  const layout = SENSOR_LAYOUT[sensorId];
  if (!layout) {
    return null;
  }

  return {
    ...layout,
    xPercent: side === "right" ? 100 - layout.xPercent : layout.xPercent,
  };
}
