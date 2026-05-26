export const SENSOR_LAYOUT = {
  heel: {
    label: "Ferse",
    xPercent: 50,
    yPercent: 78,
    radiusPercent: 18,
  },
  lateral_forefoot: {
    label: "Lateraler Vorfuss",
    xPercent: 34,
    yPercent: 30,
    radiusPercent: 17,
  },
  medial_forefoot: {
    label: "Medialer Vorfuss",
    xPercent: 66,
    yPercent: 23,
    radiusPercent: 18,
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
