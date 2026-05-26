const COLOR_STOPS = [
  [0.0, [0, 87, 255]],
  [0.32, [0, 210, 106]],
  [0.62, [255, 230, 0]],
  [1.0, [255, 31, 31]],
];

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function pressureColor(intensity) {
  const normalized = clamp(Number.isFinite(intensity) ? intensity : 0, 0, 1);

  for (let index = 1; index < COLOR_STOPS.length; index += 1) {
    const [position, rgb] = COLOR_STOPS[index];
    const [previousPosition, previousRgb] = COLOR_STOPS[index - 1];

    if (normalized <= position) {
      const localT = (normalized - previousPosition) / (position - previousPosition);
      const mixed = rgb.map((channel, channelIndex) =>
        Math.round(previousRgb[channelIndex] + (channel - previousRgb[channelIndex]) * localT),
      );
      return `rgb(${mixed[0]}, ${mixed[1]}, ${mixed[2]})`;
    }
  }

  return "rgb(255, 31, 31)";
}

export function pressureAlpha(intensity) {
  return 0.36 + 0.28 * clamp(Number.isFinite(intensity) ? intensity : 0, 0, 1);
}
