export const SENSOR_LAYOUT = {
  heel: {
    label: "Ferse",
    xPercent: 37,
    yPercent: 82,
    radiusPercent: 22,
  },
  lateral_forefoot: {
    label: "Lateraler Vorfuss",
    xPercent: 29,
    yPercent: 31,
    radiusPercent: 21,
  },
  medial_forefoot: {
    label: "Medialer Vorfuss",
    xPercent: 70,
    yPercent: 25,
    radiusPercent: 22,
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
