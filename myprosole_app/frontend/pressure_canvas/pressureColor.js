const COLOR_STOPS = [
  [0.0, [37, 99, 235]],
  [0.38, [34, 197, 94]],
  [0.68, [250, 204, 21]],
  [1.0, [220, 38, 38]],
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

  return "rgb(220, 38, 38)";
}

export function pressureAlpha(intensity) {
  return 0.3 + 0.58 * clamp(Number.isFinite(intensity) ? intensity : 0, 0, 1);
}
